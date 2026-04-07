---
title: Row Level Security（行レベルセキュリティ）
description: マルチテナントSaaSのデータ分離をDBレベルで実現するRLS。アプリ層のWHERE条件ではなくポリシーでアクセス制御する設計と、テナント分離戦略の比較を理解する
category: "概念"
tags: ["データ設計", "セキュリティ", "RLS", "マルチテナント", "PostgreSQL", "DDIA"]
emoji: "🛡️"
date: "2026-04-07"
order: 828
series:
  - データ志向アプリケーション設計（DDIA）
source: "PostgreSQL Documentation / Supabase Documentation"
---

## 定義

**RLS（Row Level Security）**：DBのテーブルに「どのユーザーがどの行を読み書きできるか」をポリシーとして定義する機能。アプリケーションコードではなくDB側でアクセス制御を強制する。

## なぜアプリ側のWHERE条件では不十分か

```typescript
// よくある実装: アプリ側でテナントIDをWHERE条件に追加
async function getOrders(userId: string, tenantId: string) {
  return db.query(
    'SELECT * FROM orders WHERE tenant_id = $1',
    [tenantId]
  );
}

// 問題1: 開発者がWHERE条件を書き忘れると全テナントのデータが漏れる
async function buggyGetOrders(userId: string) {
  return db.query('SELECT * FROM orders');  // 全テナントのデータが返る！
}

// 問題2: 新しいクエリを書くたびに同じ条件を書き続ける必要がある
// 問題3: ORMの使い方を間違えると条件が外れる
```

RLSはこの問題をDBレベルで解決する。WHERE条件を書き忘れてもポリシー違反の行は返らない。

## PostgreSQL でのRLS設定

```sql
-- 1. テーブルにRLSを有効化
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 2. ポリシーを定義
CREATE POLICY tenant_isolation ON orders
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- これだけで、全クエリに以下が自動で追加される:
-- WHERE tenant_id = current_setting('app.tenant_id')::uuid
```

### アプリからの利用

```typescript
// リクエスト開始時にテナントIDをセッション変数に設定
async function withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    // セッション変数にテナントIDをセット
    await client.query(`SET LOCAL app.tenant_id = '${tenantId}'`);
    return await fn();
  } finally {
    client.release();
  }
}

// 使用例
const orders = await withTenant(tenantId, async () => {
  // このクエリは自動的にtenant_idでフィルタされる
  return db.query('SELECT * FROM orders');
});
```

## 複数のポリシー

```sql
-- 読み取り: 自分のテナントのデータのみ
CREATE POLICY orders_select ON orders
  FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- 書き込み: 自分のテナントにのみ作成可能
CREATE POLICY orders_insert ON orders
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

-- 更新: 自分のテナントの行のみ更新可能
CREATE POLICY orders_update ON orders
  FOR UPDATE
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

-- 管理者は全テナントを見られる
CREATE POLICY admin_all ON orders
  USING (current_setting('app.role') = 'admin');
```

### USING と WITH CHECK の違い

```
USING:     既存行の「読み取り・更新・削除」の対象を制限
WITH CHECK: 新規行の「挿入・更新後の値」の制約を制限

UPDATE の場合:
  USING      → 更新できる行（更新前の行がマッチする必要あり）
  WITH CHECK → 更新後の値の制約（別テナントに移動できないようにする）
```

## BypassRLS ロール

```sql
-- スーパーユーザーはデフォルトでRLSをバイパスする
-- バックグラウンドジョブ用にBypassRLSを持つロールを作成
CREATE ROLE app_job BYPASSRLS;

-- 通常のアプリユーザーはRLSを強制
CREATE ROLE app_user;
GRANT app_user TO api_server;
-- app_userはBYPASSRLSを持たないのでポリシーが適用される
```

## マルチテナント分離戦略の比較

### Row-Level Isolation（RLS方式）

```
全テナントが同じテーブルを共有
tenant_id カラムでRLSにより分離

✅ リソース効率が高い（テーブル数が少ない）
✅ テナント追加がゼロコスト（行を追加するだけ）
✅ クロステナント集計が容易
❌ テナント数 × データ量でテーブルが巨大になる
❌ RLSのバグがデータ漏洩に直結
適した規模: 数百〜数万テナント
```

### Schema-per-Tenant

```
テナントごとに別のスキーマ（名前空間）を使う

tenant_001.orders
tenant_002.orders
tenant_003.orders

✅ テナント間の完全な分離
✅ テナントごとにスキーマを独立して変更できる
❌ テナント数が増えるとスキーマ数が膨大になる
❌ マイグレーションを全テナントに適用する手間
適した規模: 数十〜数百テナント
```

### Database-per-Tenant

```
テナントごとに別のDBインスタンスを用意

tenant_001_db → PostgreSQL instance 1
tenant_002_db → PostgreSQL instance 2

✅ 最強の分離（ネットワーク・ディスク）
✅ テナントごとにスケール・バックアップが独立
❌ コストが最も高い（DBの固定コスト × テナント数）
❌ クロステナント分析が困難
適した規模: 数〜数十の大口エンタープライズ顧客
```

### ハイブリッド戦略（実務的）

```
無料/スモール: Row-Level Isolation（コスト最小）
エンタープライズ: Database-per-Tenant（最高の分離）
中間層: Schema-per-Tenant

→ 契約プランによって分離レベルを変える
```

## Supabase でのRLS活用

```sql
-- Supabaseの場合、JWTのクレームをそのまま使える
CREATE POLICY user_data ON profiles
  USING (id = auth.uid());  -- JWTのsubject（ユーザーID）と一致する行のみ

-- テナントIDをJWTカスタムクレームに含める
CREATE POLICY tenant_data ON orders
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );
```

## RLSのパフォーマンス

```sql
-- RLSポリシーのWHERE条件にインデックスを必ず張る
CREATE INDEX ON orders (tenant_id);

-- 複合インデックスも効果的
CREATE INDEX ON orders (tenant_id, created_at DESC);

-- ポリシーの確認
SELECT * FROM pg_policies WHERE tablename = 'orders';

-- EXPLAIN でポリシーが正しく適用されているか確認
EXPLAIN SELECT * FROM orders;
-- → Filter: (tenant_id = current_setting('app.tenant_id')::uuid) が表示される
```

## よくある落とし穴

```
落とし穴1: セッション変数の漏れ
  コネクションプール使用時、SET は接続が返却されてもリセットされない
  → 必ず SET LOCAL（トランザクション内有効）を使う
  → PgBouncer の Transaction モードなら安全

落とし穴2: スーパーユーザーのバイパス
  スーパーユーザーはRLSを無視する
  → アプリは最小権限のロールを使う

落とし穴3: ポリシーのないテーブル
  RLSを有効化してもポリシーがなければデフォルトで全行拒否
  → 管理者用のポリシーを忘れずに設定
```

## 関連概念

- → [トランザクション](./concepts_ddia_transactions.md)（SET LOCAL のトランザクションスコープ）
- → [コネクションプーリング](./concepts_ddia_connection_pooling.md)（PgBouncerとSET LOCALの相性）
- → [パーティショニング](./concepts_ddia_partitioning.md)（テナント分離の物理的手法との比較）

## 出典・参考文献

- PostgreSQL Documentation, "Row Security Policies" — postgresql.org/docs/current/ddl-rowsecurity.html
- Supabase Documentation, "Row Level Security" — supabase.com/docs/guides/auth/row-level-security
- Citus Data, "Multi-Tenant Applications with Citus" — citusdata.com
