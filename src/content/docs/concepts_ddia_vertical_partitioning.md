---
title: 垂直分割（Vertical Partitioning）
description: テーブルのカラムを分割して格納するVertical Partitioningの設計。頻繁にアクセスされるカラムと大きなデータを分離し、キャッシュ効率とクエリパフォーマンスを改善する方法を理解する
category: "概念"
tags: ["データ設計", "垂直分割", "パーティショニング", "スキーマ設計", "パフォーマンス", "DDIA"]
emoji: "✂️"
date: "2026-04-08"
order: 838
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017) Chapter 6"
---

## 定義

**垂直分割（Vertical Partitioning）**：1つのテーブルのカラムを複数のテーブルに分割する手法。[水平分割（シャーディング）](./concepts_ddia_partitioning.md)が行を分割するのに対し、垂直分割はカラムを分割する。

```
水平分割（Horizontal）:
  orders → orders_2024, orders_2023, orders_2022（行で分割）

垂直分割（Vertical）:
  users → users_core + users_profile + users_settings（列で分割）
```

## なぜ垂直分割が必要か

### 問題：幅広いテーブルのパフォーマンス

```sql
-- 全カラムを持つusersテーブル（50カラム以上）
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255),         -- 頻繁にアクセス
  name VARCHAR(100),          -- 頻繁にアクセス
  created_at TIMESTAMPTZ,     -- 頻繁にアクセス
  
  bio TEXT,                   -- たまにアクセス（数KB）
  avatar_url TEXT,            -- たまにアクセス
  
  notification_email BOOLEAN, -- 設定系（滅多にアクセスしない）
  notification_push BOOLEAN,
  theme VARCHAR(20),
  language VARCHAR(10),
  timezone VARCHAR(50),
  -- ...40カラム続く
);

-- 認証チェックで毎回全カラムが読まれる
SELECT * FROM users WHERE email = 'alice@example.com';
-- → 使わないbioやsettingsカラムもI/Oに含まれる
-- → DBのバッファキャッシュに不要なデータが入る
```

### バッファキャッシュの効率

```
PostgreSQLはページ（8KB）単位でデータをキャッシュする

幅広いテーブル:
  1行 = 2KB → 1ページに4行
  頻繁アクセスの4行を読みたいが、滅多に使わないカラムも同じページに

垂直分割後:
  users_core（5カラム）:  1行 = 200B → 1ページに40行
  → 同じキャッシュサイズで10倍の行をキャッシュできる
  → キャッシュヒット率が大幅に向上
```

## 垂直分割のパターン

### パターン1：コア情報と拡張情報の分離

```sql
-- コアテーブル（頻繁にアクセス・必須情報）
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- プロファイルテーブル（たまにアクセス・任意情報）
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT,
  avatar_url TEXT,
  website_url TEXT,
  location VARCHAR(100),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 設定テーブル（滅多にアクセスしない）
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notification_email BOOLEAN DEFAULT true,
  notification_push BOOLEAN DEFAULT true,
  theme VARCHAR(20) DEFAULT 'light',
  language VARCHAR(10) DEFAULT 'ja',
  timezone VARCHAR(50) DEFAULT 'Asia/Tokyo'
);
```

```sql
-- 認証: コアテーブルだけ
SELECT id, email, status FROM users WHERE email = $1;

-- プロフィールページ: JOINで結合
SELECT u.*, p.bio, p.avatar_url
FROM users u
LEFT JOIN user_profiles p ON p.user_id = u.id
WHERE u.id = $1;

-- 設定ページ: 設定テーブルだけ
SELECT * FROM user_settings WHERE user_id = $1;
```

### パターン2：大きなバイナリデータの分離

```sql
-- 本体テーブル（メタデータのみ）
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  owner_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  file_size_bytes INT,
  content_type VARCHAR(100)
);

-- コンテンツテーブル（大きなデータ）
CREATE TABLE document_contents (
  document_id UUID PRIMARY KEY REFERENCES documents(id),
  content TEXT,           -- 数MB〜数十MBになる可能性
  raw_bytes BYTEA
);

-- 一覧表示: コンテンツを読まない
SELECT id, title, file_size_bytes FROM documents WHERE owner_id = $1;

-- 詳細表示: コンテンツも読む
SELECT d.*, c.content
FROM documents d
JOIN document_contents c ON c.document_id = d.id
WHERE d.id = $1;
```

### パターン3：カラムストアへの部分オフロード

```sql
-- PostgreSQL: 頻繁なOLTPクエリ用（コアカラムのみ）
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES users(id),
  status VARCHAR(20),
  total_amount DECIMAL(10,2),
  created_at TIMESTAMPTZ
);

-- BigQuery: OLAP分析用（全カラム、変換済み）
-- CDCで非同期に同期される
-- orders_analytics テーブル（列指向で格納、より多くのカラムを持つ）
```

## PostgreSQLのパーティション（垂直方向）

PostgreSQLの `PARTITION BY` は水平分割専用だが、垂直分割は上記の別テーブルアプローチで実現する。

一方、`TOAST（The Oversized-Attribute Storage Technique）`はPostgreSQLが内部的に行う垂直分割の一形態。

```sql
-- TOASTの動作
-- 2KBを超える値（TEXT, BYTEA等）は自動的に別のTOASTテーブルに格納される

-- TOAST設定の確認
SELECT
  attname,
  attstorage  -- 'p'=plain, 'e'=external, 'x'=extended(圧縮+外部), 'm'=main
FROM pg_attribute
WHERE attrelid = 'documents'::regclass;

-- TOASTを使わないよう設定（頻繁に短い値しか入らない場合）
ALTER TABLE documents ALTER COLUMN title SET STORAGE PLAIN;
```

## 垂直分割のトレードオフ

| 観点 | 分割前 | 分割後 |
|---|---|---|
| キャッシュ効率 | 低い（余分なカラムも読む） | 高い（必要なカラムだけ） |
| JOIN数 | 0 | 1〜3（用途によって） |
| スキーマ管理 | シンプル | テーブル数が増える |
| 整合性 | 強い（1テーブル） | 要注意（外部キー制約で担保） |
| Null値の削減 | 多い（オプション項目） | 少ない（分割先テーブル自体が任意） |

## 適切な分割の判断基準

```
垂直分割を検討すべきサイン:

1. テーブルのカラム数が20を超えている
2. 一部のカラムだけが高頻度でアクセスされる
3. TEXT/BYTEA/JSONBなど大きなカラムがある
4. キャッシュヒット率が低い
5. 同じテーブルでOLTPとOLAP両方に使われている

分割しない方がよいサイン:
1. ほぼすべてのクエリが全カラムを使う
2. トランザクションで複数カラムを一緒に更新することが多い
3. テーブルが既に小さい（100万行以下）
```

## 関連概念

- → [パーティショニング（水平分割）](./concepts_ddia_partitioning.md)（行で分割する手法との対比）
- → [列指向ストレージ](./concepts_ddia_columnar_storage.md)（垂直分割の極端な形）
- → [クエリオプティマイザー](./concepts_ddia_query_optimizer.md)（垂直分割後のJOINコスト）
- → [MVCC](./concepts_ddia_mvcc.md)（TOASTとのMVCC動作の関係）

## 出典・参考文献

- Martin Kleppmann, *Designing Data-Intensive Applications* (2017) Chapter 6
- PostgreSQL Documentation, "TOAST" — postgresql.org/docs/current/storage-toast.html
- Markus Winand, *SQL Performance Explained* (2012)
