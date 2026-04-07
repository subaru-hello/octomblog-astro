---
title: ゼロダウンタイムマイグレーション
description: 本番DBをサービスを止めずに変更するExpand-Contractパターン。カラム追加・削除・リネームを安全に行うステップバイステップの手順と、大規模テーブルへの変更戦略を理解する
category: "概念"
tags: ["データ設計", "マイグレーション", "PostgreSQL", "ゼロダウンタイム", "デプロイ", "DDIA"]
emoji: "🚧"
date: "2026-04-07"
order: 824
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017) Chapter 4"
---

## 定義

**ゼロダウンタイムマイグレーション**：本番データベースのスキーマ変更を、サービスを停止せずに行う手法。デプロイとマイグレーションを分離し、旧コードと新コードが同時に動作する期間を安全に乗り越える。

## なぜ単純なALTER TABLEは危険か

```sql
-- 本番DBへのナイーブな変更
ALTER TABLE users RENAME COLUMN email TO email_address;

問題1: テーブルロック
  PostgreSQLはRENAMEでAccessExclusiveLockを取得
  → その間すべての読み書きがブロックされる
  
問題2: コードとDBの不整合
  旧コード: email を参照 → エラー
  新コード: email_address を参照 → OK
  
  デプロイ中に旧コードが動いている間、DBはどちらを持つべきか？
```

## Expand-Contract パターン

スキーマ変更を「拡張 → 移行 → 収縮」の3フェーズに分ける。

```
Phase 1: Expand（拡張）
  新旧両方に対応できるようDBを変更
  
Phase 2: Migrate（移行）
  データを移行し、コードを新しい構造に切り替える
  
Phase 3: Contract（収縮）
  古い構造を削除する
```

## カラムリネームの例

### 目標

`users.email` → `users.email_address` にリネームしたい

### Phase 1: Expand（新カラムを追加）

```sql
-- 新しいカラムを追加（NULLを許容、デフォルト値なし）
ALTER TABLE users ADD COLUMN email_address VARCHAR(255);
```

```typescript
// アプリコード: 両方のカラムに書く
async function updateEmail(userId: string, email: string) {
  await db.query(
    'UPDATE users SET email = $1, email_address = $1 WHERE id = $2',
    [email, userId]
  );
}

// 読み取り: 新カラムを優先、なければ旧カラム
async function getEmail(userId: string) {
  const { email, email_address } = await db.query(
    'SELECT email, email_address FROM users WHERE id = $1',
    [userId]
  );
  return email_address ?? email;
}
```

**この段階でデプロイ。**

### Phase 2: Migrate（既存データを移行）

```sql
-- バックグラウンドで既存データを埋める
-- 一度に全行更新するとロックが発生するためバッチで処理
DO $$
DECLARE
  batch_size INT := 1000;
  last_id BIGINT := 0;
BEGIN
  LOOP
    UPDATE users
    SET email_address = email
    WHERE id IN (
      SELECT id FROM users
      WHERE email_address IS NULL AND id > last_id
      ORDER BY id
      LIMIT batch_size
    )
    RETURNING MAX(id) INTO last_id;
    
    EXIT WHEN NOT FOUND;
    PERFORM pg_sleep(0.01); -- DBへの負荷を分散
  END LOOP;
END $$;

-- 移行完了後、NOT NULL制約を追加
ALTER TABLE users ALTER COLUMN email_address SET NOT NULL;
```

**アプリコードを新カラムのみ使うよう変更してデプロイ。**

### Phase 3: Contract（古いカラムを削除）

```sql
-- 旧コードが完全に消えてから削除
ALTER TABLE users DROP COLUMN email;
```

## 大規模テーブルへのインデックス追加

```sql
-- ❌ 通常のインデックス作成: テーブルロックが発生
CREATE INDEX ON orders (user_id);

-- ✅ CONCURRENTLY: ロックなしで作成（時間はかかるが本番安全）
CREATE INDEX CONCURRENTLY idx_orders_user_id ON orders (user_id);
-- 注意: トランザクション内では使えない
-- 注意: 失敗するとINVALIDなインデックスが残る（要手動削除）
```

## NOT NULL 制約の安全な追加

```sql
-- ❌ 危険: テーブル全行をスキャンしてロック
ALTER TABLE users ALTER COLUMN phone SET NOT NULL;

-- ✅ 安全な手順（PostgreSQL 12以降）

-- Step1: CHECK制約として追加（バリデーションをスキップ）
ALTER TABLE users ADD CONSTRAINT users_phone_not_null
  CHECK (phone IS NOT NULL) NOT VALID;

-- Step2: バックグラウンドでバリデーション（ShareUpdateExclusiveLock, 弱いロック）
ALTER TABLE users VALIDATE CONSTRAINT users_phone_not_null;

-- Step3: これでNOT NULL制約と等価
-- PostgreSQL 12以降はVALIDATEDなCHECK制約をNOT NULLに変換できる
```

## デフォルト値の安全な追加（PostgreSQL 11以降）

```sql
-- PostgreSQL 10以前: デフォルト値付きカラム追加は全行書き換え → 危険
ALTER TABLE orders ADD COLUMN status VARCHAR(20) DEFAULT 'pending';

-- PostgreSQL 11以降: メタデータのみ更新（全行書き換えなし）
-- 既存行は読み取り時に動的にデフォルト値を返す → 安全
```

## pg_repack / pt-online-schema-change

完全なテーブル書き換えが必要な場合のツール。

```
pg_repack の動作:
  1. テーブルのコピーを作成
  2. コピーに変更を適用（カラム削除、型変更など）
  3. 元テーブルへの変更を差分としてトリガーでキャプチャ
  4. 差分を適用
  5. 極短時間のロックで名前を入れ替え

→ ダウンタイムをほぼゼロにして大規模なテーブル変更が可能
```

## マイグレーションツールの選択

| ツール | 特徴 |
|---|---|
| Flyway / Liquibase | バージョン管理型。SQLまたはXMLで記述 |
| golang-migrate | シンプルなGoツール |
| Prisma Migrate | TypeScriptスキーマからSQLを生成 |
| sqitch | 変更の依存関係を管理 |

**共通の注意点**：
- マイグレーションは一方通行（ロールバックは別途実装）
- 本番適用前にステージングで必ず検証
- 大規模テーブルの変更はメンテナンスウィンドウを検討

## マイグレーションの原則

```
原則1: アプリとDBを同時に変更しない
  DBを先に変更して後方互換を保ち、アプリをデプロイし、旧構造を削除

原則2: 後方互換を壊す変更は段階的に
  リネーム = 追加 → 移行 → 削除 の3ステップ

原則3: 本番DBで`テスト`しない
  必ずステージング環境で実行時間と影響を確認

原則4: 長時間ロックを避ける
  CONCURRENTLY、NOT VALID、pg_repackを積極的に使う
```

## 関連概念

- → [エンコーディングとスキーマ進化](./concepts_ddia_encoding.md)（後方/前方互換性の概念）
- → [WALと論理レプリケーション](./concepts_ddia_wal_replication.md)（マイグレーション中のレプリカへの影響）
- → [トランザクション](./concepts_ddia_transactions.md)（マイグレーション中のロック管理）

## 出典・参考文献

- Martin Kleppmann, *Designing Data-Intensive Applications* (2017) Chapter 4
- Braintree Engineering, "Safe Operations For High Volume PostgreSQL" (2014)
- PostgreSQL Documentation, "ALTER TABLE" — postgresql.org/docs/current/sql-altertable.html
- pg_repack — github.com/reorg/pg_repack
