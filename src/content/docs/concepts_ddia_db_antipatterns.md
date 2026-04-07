---
title: データベース設計アンチパターン
description: EAV・ポリモーフィック関連・JSONの乱用・ナイーブなソフトデリートなど、よくある設計の落とし穴とその代替案を理解する
category: "概念"
tags: ["データ設計", "アンチパターン", "スキーマ設計", "PostgreSQL", "DDIA"]
emoji: "⚠️"
date: "2026-04-08"
order: 831
series:
  - データ志向アプリケーション設計（DDIA）
source: "Bill Karwin, 'SQL Antipatterns' (2010)"
---

## 定義

DBアンチパターンとは、短期的には問題なく動くが、データ量の増加・要件変更・パフォーマンスチューニングの局面で深刻な問題を引き起こす設計パターン。

## アンチパターン1：EAV（Entity-Attribute-Value）

「どんな属性でも追加できる」柔軟性を求めてたどり着く設計。

```sql
-- EAVテーブル
CREATE TABLE attributes (
  entity_id INT,
  attr_name VARCHAR(50),
  attr_value TEXT   -- 全属性を文字列で格納
);

INSERT INTO attributes VALUES
  (1, 'name',  'Alice'),
  (1, 'age',   '30'),
  (1, 'email', 'alice@example.com');
```

**問題**：

```sql
-- 「30歳以上のユーザーのメールアドレスを取得」
SELECT a_email.attr_value AS email
FROM attributes a_age
JOIN attributes a_email ON a_age.entity_id = a_email.entity_id
WHERE a_age.attr_name = 'age'
  AND CAST(a_age.attr_value AS INT) >= 30  -- 型安全でない
  AND a_email.attr_name = 'email';
-- → 通常のWHEREが数行のクエリが数十行に
-- → 型チェックなし、インデックスが効かない
```

**代替案**：

```sql
-- 固定カラム + JSONB（可変属性）のハイブリッド
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,       -- よく検索するカラムは固定
  email VARCHAR(255) UNIQUE,
  extra_attrs JSONB DEFAULT '{}'    -- 可変属性はJSONB
);

CREATE INDEX ON users USING gin(extra_attrs);  -- JSONB用のGINインデックス

-- クエリ可能
SELECT * FROM users WHERE extra_attrs->>'plan' = 'enterprise';
```

さらに属性の種類が多い場合は[グラフモデル](./concepts_ddia_data_models.md)やドキュメントDBの採用を検討する。

## アンチパターン2：ポリモーフィック関連

「コメントが投稿・動画・写真のどれにも付けられる」を1テーブルで表現しようとする。

```sql
-- ポリモーフィック関連（アンチパターン）
CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  commentable_type VARCHAR(50),  -- 'Post', 'Video', 'Photo'
  commentable_id INT,            -- それぞれのID
  body TEXT
);
-- → commentable_id に外部キー制約を張れない
-- → JOINが複雑（typeによって結合先が変わる）
-- → インデックスの効率が悪い
```

**代替案**：

```sql
-- 案1: 別テーブルに分ける（シンプル）
CREATE TABLE post_comments  (id, post_id  REFERENCES posts,  body TEXT);
CREATE TABLE video_comments (id, video_id REFERENCES videos, body TEXT);

-- 案2: 共通の親テーブルを使う（スーパータイプ）
CREATE TABLE commentables (id SERIAL PRIMARY KEY);
CREATE TABLE posts  (id INT PRIMARY KEY REFERENCES commentables);
CREATE TABLE videos (id INT PRIMARY KEY REFERENCES commentables);
CREATE TABLE comments (id, commentable_id REFERENCES commentables, body TEXT);
```

## アンチパターン3：JSONの乱用

「スキーマを決めたくない」という逃げのJSON格納。

```sql
-- よくある乱用
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  data JSONB  -- 全部ここに入れる
);

INSERT INTO orders (data) VALUES (
  '{"customer_id": 1, "items": [...], "total": 9900, "status": "pending"}'
);
```

**問題**：
- `WHERE data->>'status' = 'pending'` はインデックスが効きにくい
- 型安全性がない（statusに数値を入れてもエラーにならない）
- JOINが不可能（`customer_id`に外部キー制約を張れない）
- スキーマの変更が見えない（どんな構造か把握できない）

**適切なJSON使用場面**：
```sql
-- ✅ 本当に可変な属性（製品の仕様、メタデータ）
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  specifications JSONB   -- {'color': 'red', 'weight': '500g'} など可変
);

-- ✅ 外部APIのレスポンスをそのまま保存
CREATE TABLE api_responses (
  id SERIAL PRIMARY KEY,
  fetched_at TIMESTAMPTZ,
  raw_response JSONB   -- 加工前の生データ
);
```

## アンチパターン4：ナイーブなソフトデリート

削除を `deleted_at` カラムで表現する設計は正しいが、実装が雑だと問題が起きる。

```sql
-- よくある実装
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;
-- 削除: UPDATE users SET deleted_at = NOW() WHERE id = 1;
-- 取得: SELECT * FROM users WHERE deleted_at IS NULL;
```

**問題**：

```sql
-- 忘れやすいWHERE条件
SELECT * FROM users;  -- 削除済みも返る！
SELECT * FROM users WHERE email = 'alice@example.com';  -- 削除済みが引っかかる

-- UNIQUE制約が機能しない
-- deleted_at IS NULLのemailだけユニークにしたい
ALTER TABLE users ADD UNIQUE (email);  -- 削除済みと重複してもエラーになる
```

**改善案**：

```sql
-- 部分ユニークインデックス（アクティブなemailだけユニーク）
CREATE UNIQUE INDEX users_email_active
  ON users (email)
  WHERE deleted_at IS NULL;

-- Row Level Securityで削除済みを自動除外
CREATE POLICY hide_deleted ON users
  USING (deleted_at IS NULL);

-- または別テーブルに移動（アーカイブパターン）
CREATE TABLE deleted_users (LIKE users INCLUDING ALL);
-- 削除時: INSERT INTO deleted_users SELECT * FROM users WHERE id = $1;
--         DELETE FROM users WHERE id = $1;
```

## アンチパターン5：インデックスの張りすぎ・なさすぎ

```sql
-- インデックスなさすぎ（パフォーマンス問題）
SELECT * FROM orders WHERE customer_id = 1;  -- フルスキャン

-- インデックス張りすぎ（書き込み遅延、ディスク消費）
CREATE INDEX ON orders (id);             -- PRIMARY KEYなので不要
CREATE INDEX ON orders (status);         -- カーディナリティが低い（pending/shipped/...）
CREATE INDEX ON orders (created_at);     -- 単体では使われないことが多い
CREATE INDEX ON orders (notes);          -- テキスト全体のBツリーは無意味

-- 適切なインデックス戦略
-- 1. 外部キーには必ずインデックス
CREATE INDEX ON orders (customer_id);

-- 2. よく使われるフィルタ条件
CREATE INDEX ON orders (status) WHERE status = 'pending';  -- 部分インデックス

-- 3. ソートに使われるカラム
CREATE INDEX ON orders (customer_id, created_at DESC);
```

## アンチパターン6：SELECT *

```sql
-- ❌ 不要なカラムまで取得
SELECT * FROM users WHERE id = 1;

-- ✅ 必要なカラムだけ取得
SELECT id, name, email FROM users WHERE id = 1;
```

**理由**：
- 不要なデータの転送でネットワークI/Oが増える
- カバリングインデックスが使えなくなる（インデックスだけで完結できない）
- スキーマ変更後に予期しないカラムが含まれるリスク

## アンチパターン7：アプリ側でのソート・フィルタ

```typescript
// ❌ 全件取得してアプリ側でフィルタ
const allOrders = await db.query('SELECT * FROM orders');
const pendingOrders = allOrders.filter(o => o.status === 'pending');

// ✅ DBでフィルタ
const pendingOrders = await db.query(
  'SELECT * FROM orders WHERE status = $1',
  ['pending']
);
```

DBはフィルタ・ソート・集計が得意。アプリに転送してから処理するのは無駄。

## 関連概念

- → [データモデル](./concepts_ddia_data_models.md)（適切なモデル選択の基準）
- → [ストレージとインデックス](./concepts_ddia_storage_indexing.md)（インデックス設計の詳細）
- → [クエリオプティマイザー](./concepts_ddia_query_optimizer.md)（インデックスの使われ方）
- → [Row Level Security](./concepts_ddia_row_level_security.md)（ソフトデリートの代替実装）

## 出典・参考文献

- Bill Karwin, *SQL Antipatterns: Avoiding the Pitfalls of Database Programming* (2010)
- Markus Winand, *SQL Performance Explained* (2012) — use-the-index-luke.com
