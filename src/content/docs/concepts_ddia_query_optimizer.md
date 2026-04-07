---
title: クエリオプティマイザーと実行計画
description: DBがSQLをどう最適化して実行するか。コストベースオプティマイザーの仕組み、EXPLAIN出力の読み方、インデックスが使われない理由を理解する
category: "概念"
tags: ["データ設計", "クエリ最適化", "実行計画", "PostgreSQL", "インデックス", "DDIA"]
emoji: "🔍"
date: "2026-04-07"
order: 818
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017) Chapter 2-3"
---

## 定義

**クエリオプティマイザー**：SQLを受け取り、最も効率的な実行計画（Execution Plan）を選択するDBの内部コンポーネント。同じSQLでも実行計画が異なれば、速度が100倍以上変わることがある。

## クエリ処理の流れ

```
SQL文字列
  ↓
パーサー（構文解析）
  ↓
リライター（ビュー展開、ルール適用）
  ↓
オプティマイザー（実行計画の選択）← ここが核心
  ↓
エグゼキュータ（実行計画の実行）
  ↓
結果
```

## コストベースオプティマイザー

PostgreSQLは**コストベース最適化（CBO）**を採用。考えられる実行計画を列挙し、それぞれの「コスト（I/O回数 + CPU時間の見積もり）」を統計情報から計算して最小コストを選ぶ。

### 統計情報

```sql
-- テーブルの統計情報を更新
ANALYZE users;

-- 統計情報の確認
SELECT tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE tablename = 'users';
```

統計情報が古いとオプティマイザーが誤った計画を選ぶ。大量のINSERT/DELETE後は `ANALYZE` を実行する。

**主な統計情報**：
- `n_distinct`：カラムの重複を除いた値の数
- `correlation`：物理的な格納順と論理的な順序の相関（1.0なら完全一致）
- ヒストグラム：値の分布

## EXPLAIN の読み方

```sql
EXPLAIN (ANALYZE, BUFFERS) 
SELECT u.name, COUNT(o.id)
FROM users u
JOIN orders o ON o.user_id = u.id
WHERE u.country = 'JP'
GROUP BY u.name;
```

```
Hash Aggregate  (cost=1250.00..1260.00 rows=1000 width=40)
                (actual time=45.2..47.1 rows=800 loops=1)
  Buffers: shared hit=320 read=45
  →  Hash Join  (cost=300.00..1200.00 rows=10000 width=24)
                (actual time=12.3..40.1 rows=10000 loops=1)
       Hash Cond: (o.user_id = u.id)
       →  Seq Scan on orders o  (cost=0.00..500.00 rows=50000 width=8)
                                (actual time=0.1..15.2 rows=50000 loops=1)
       →  Hash  (cost=250.00..250.00 rows=4000 width=20)
             →  Index Scan using idx_users_country on users u
                              (cost=0.00..250.00 rows=4000 width=20)
                              (actual time=0.2..8.1 rows=4000 loops=1)
                  Index Cond: (country = 'JP')
```

### 読み方のポイント

```
cost=X..Y:
  X: 最初の行を返すまでのコスト（起動コスト）
  Y: 全行を返すまでの総コスト

actual time=X..Y:
  X: 実際の起動時間（ミリ秒）
  Y: 実際の総実行時間

rows=N:
  推定行数（EXPLAINのみ）または実際の行数（ANALYZE付き）

Buffers: shared hit=N read=M:
  N: バッファキャッシュからの読み取り（速い）
  M: ディスクからの読み取り（遅い）
```

**注目すべき差異**：推定rowsと実際のrowsに大きな乖離があれば、統計情報が古いか、統計が偏りを捉えられていないサイン。

## スキャン方式の種類

### Seq Scan（シーケンシャルスキャン）

```
テーブル全体を先頭から順に読む
→ 返す行が全体の10〜20%以上なら、インデックスよりSeq Scanの方が速い
   （インデックスのランダムアクセスよりシーケンシャルの方が効率的）
```

### Index Scan

```
インデックスでキーを見つけてからテーブルの行を取得
→ ランダムI/Oが発生（ヒープアクセス）
→ 返す行が少ない場合に有効
```

### Index Only Scan

```
インデックスだけで必要な値が揃う場合（カバリングインデックス）
テーブルを読まない → 非常に速い
```

### Bitmap Index Scan + Bitmap Heap Scan

```
インデックスで対象行のビットマップを作成
→ ビットマップに基づいてテーブルをブロック単位で読む
→ 複数インデックスの AND/OR 組み合わせに使われる
```

## ジョイン方式の種類

```
Nested Loop Join:
  外側の各行に対して内側をループ
  → 外側が少なく内側にインデックスがある場合に有効

Hash Join:
  小さい方のテーブルをハッシュテーブルに載せ、大きい方をスキャン
  → 中〜大規模テーブルの等値ジョインに有効

Merge Join:
  両テーブルをソートしてから順番にマージ
  → 両テーブルがジョインキーでソート済みの場合に最速
```

## インデックスが使われない典型例

```sql
-- ❌ 関数適用: インデックスが効かない
WHERE LOWER(email) = 'alice@example.com'
-- ✅ 関数インデックスを作る
CREATE INDEX ON users (LOWER(email));

-- ❌ 暗黙キャスト: 型が違うと効かない
WHERE user_id = '123'  -- user_idがINTの場合
-- ✅ 型を合わせる
WHERE user_id = 123

-- ❌ 否定演算子: 通常インデックスを使えない
WHERE status != 'active'
-- ✅ 部分インデックスで対応
CREATE INDEX ON orders (id) WHERE status = 'pending';

-- ❌ LIKE の前方ワイルドカード
WHERE name LIKE '%alice%'
-- ✅ 全文検索インデックスを使う

-- ❌ OR 条件（片方だけインデックスがある場合）
WHERE country = 'JP' OR created_at > '2024-01-01'
-- ✅ UNION ALL に分解するか両方にインデックス
```

## プランナーへのヒント

```sql
-- 統計情報の更新
ANALYZE users;

-- サンプリング率を上げる（デフォルト100）
ALTER TABLE users ALTER COLUMN country SET STATISTICS 500;

-- セッション内でSeq Scanを無効化してテスト
SET enable_seqscan = off;
EXPLAIN SELECT * FROM users WHERE country = 'JP';
SET enable_seqscan = on;

-- JOIN順序の最適化を無効化（小さいテーブルのJOINで効果あり）
SET join_collapse_limit = 1;
```

## パフォーマンスチューニングの順序

```
1. EXPLAIN ANALYZEで遅いクエリを特定
2. 推定rowsと実際rowsの乖離確認 → 乖離があればANALYZE
3. Seq Scanになっている箇所を確認 → インデックスが必要か判断
4. Buffers: readが多い → ディスクI/Oがボトルネック
5. ジョイン方式が不適切 → インデックスの追加やクエリの書き換え
```

## 関連概念

- → [ストレージとインデックス](./concepts_ddia_storage_indexing.md)（インデックス構造の詳細）
- → [列指向ストレージ](./concepts_ddia_columnar_storage.md)（OLAPのクエリ実行）
- → [トランザクション](./concepts_ddia_transactions.md)（ロックとクエリ計画の関係）

## 出典・参考文献

- Martin Kleppmann, *Designing Data-Intensive Applications* (2017) Chapter 2-3
- PostgreSQL Documentation, "Using EXPLAIN" — postgresql.org/docs/current/using-explain.html
- Use The Index, Luke — use-the-index-luke.com
