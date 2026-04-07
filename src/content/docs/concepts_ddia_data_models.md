---
title: データモデルとクエリ言語
description: リレーショナル・ドキュメント・グラフの3モデルを比較し、それぞれの強みと適切な使いどころを理解する
category: "概念"
tags: ["データ設計", "データモデル", "SQL", "NoSQL", "グラフDB", "DDIA"]
emoji: "🧩"
date: "2026-04-07"
order: 802
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017) Chapter 2"
---

## 定義

データモデルは、「現実世界の事柄をどうデータとして表現するか」の設計。モデルの選択がアプリケーションの書き方、クエリの柔軟性、スケールの仕方を根本的に決める。

## 3つの主要モデル

```
リレーショナルモデル（SQL）
  └── 行と列のテーブル。JOINで関係を表現
  
ドキュメントモデル（NoSQL Document）
  └── JSON/BSON形式。階層構造をそのまま格納
  
グラフモデル（Graph DB）
  └── ノードとエッジ。多対多の関係を自然に表現
```

## リレーショナルモデル（SQL）

Edgar Codd (1970)が提唱。**データの正規化**と**JOINによる関係の表現**が核心。

```sql
-- 正規化: データを重複なく分散して格納
-- 一対多: usersとresumesは別テーブル

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  region_id INT REFERENCES regions(id)  -- 外部キーで関係を表現
);

CREATE TABLE positions (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  title VARCHAR(100),
  company VARCHAR(100)
);

-- JOINで結合して取得
SELECT u.name, p.title, p.company, r.name as region
FROM users u
JOIN positions p ON p.user_id = u.id
JOIN regions r ON r.id = u.region_id
WHERE u.id = 1;
```

**強み**：複雑なクエリ、集計、トランザクション、スキーマの明確さ  
**弱み**：ネストした構造（履歴書のような木構造）をJOINで表現する煩雑さ

## ドキュメントモデル

JSON形式でデータを格納。**局所性（Locality）**が高い。

```json
{
  "user_id": 251,
  "first_name": "Bill",
  "last_name": "Gates",
  "summary": "Co-chair of the Bill & Melinda Gates...",
  "region_id": "us:91",
  "industry_id": 131,
  "photo_url": "/p/7/000/253/05b/308dd6e.jpg",
  "positions": [
    {"job_title": "Co-chair", "organization": "Bill & Melinda Gates Foundation"},
    {"job_title": "Co-founder, Chairman", "organization": "Microsoft"}
  ],
  "education": [
    {"school_name": "Harvard University", "start": 1973, "end": 1975}
  ]
}
```

1回のクエリでユーザープロフィール全体を取得できる（JOINが不要）。

**強み**：スキーマの柔軟性、データ局所性の高さ、木構造の自然な表現  
**弱み**：多対多の関係の表現が難しい、ドキュメントをまたぐ結合がない

### スキーマオンライト vs スキーマオンリード

| 観点 | スキーマオンライト（SQL） | スキーマオンリード（Document） |
|---|---|---|
| タイミング | 書き込み時にスキーマを強制 | 読み取り時にスキーマを解釈 |
| 例 | `ALTER TABLE` でカラム追加 | アプリコードでフィールドの有無を確認 |
| メリット | DB側でデータ整合性を保証 | スキーマ変更が容易 |
| リスク | マイグレーションコストが高い | 古い構造のデータが混在しうる |

## グラフモデル

多対多の関係が複雑に絡み合う場合に最適。SNS、不正検知、知識グラフなどで力を発揮。

```
ノード（頂点）= エンティティ（人、場所、出来事）
エッジ（辺）  = 関係（フォロー、居住、所属）
```

```cypher
-- Neo4j の Cypher クエリ言語
-- 「Lisaが生まれた大陸の名前を返す」
MATCH (person) -[:BORN_IN]-> () -[:WITHIN*0..]-> (us:Location {name:'United States'}),
      (person) -[:LIVES_IN]-> () -[:WITHIN*0..]-> (eu:Location {name:'Europe'})
RETURN person.name
```

リレーショナルDBでは再帰的なJOINが必要な「深さ不定のパス探索」を自然に表現できる。

## 比較まとめ

| 特性 | リレーショナル | ドキュメント | グラフ |
|---|---|---|---|
| 関係の複雑さ | 一対多中心 | 一対多中心 | 多対多が得意 |
| スキーマ | 厳密（事前定義） | 柔軟（後から解釈） | 柔軟 |
| クエリ言語 | SQL（標準化） | MongoDB Query / GQL | Cypher / SPARQL |
| スケール | 垂直スケールが主 | 水平スケールしやすい | ケースによる |
| 適したデータ | 業務データ全般 | カタログ、プロフィール | SNS、経路探索、知識グラフ |

## ドキュメントDBでも参照は生きている

MongoDBでも参照（`DBRef`）は使える。「何でもドキュメントに入れる」のが正解ではない。  
多対多の関係が出てきたタイミングで、参照かリレーショナルへの移行を検討する。

## 関連概念

- → [ストレージとインデックス](./concepts_ddia_storage_indexing.md)（モデルの背後にある物理的実装）
- → [パーティショニング](./concepts_ddia_partitioning.md)（ドキュメントDBの水平スケール）
- → [CQRS](./concepts_backend_cqrs.md)（読み取りモデルを書き込みモデルと分離する設計）

## 出典・参考文献

- Martin Kleppmann, *Designing Data-Intensive Applications* (2017) Chapter 2
