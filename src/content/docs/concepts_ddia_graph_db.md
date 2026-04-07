---
title: グラフDB深掘り
description: Neo4jの物理的なインデックスフリー隣接の仕組み、Cypherクエリのパターン、PageRank・最短経路などグラフアルゴリズムの実装と用途を理解する
category: "概念"
tags: ["データ設計", "グラフDB", "Neo4j", "Cypher", "グラフアルゴリズム", "DDIA"]
emoji: "🕸️"
date: "2026-04-08"
order: 832
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017) Chapter 2"
---

## 定義

グラフDBはノード（頂点）とエッジ（辺）でデータを表現し、複雑な関係性のトラバーサル（経路探索）に特化したDB。RDBでは再帰的なJOINが必要な「深さ不定の関係性探索」を自然に表現できる。

## なぜグラフDBが必要か

```sql
-- RDBで「友達の友達を全員取得」（SNSのつながり）
-- 深さが固定なら書けるが...
SELECT DISTINCT u3.*
FROM users u1
JOIN friendships f1 ON f1.user_id = u1.id
JOIN users u2 ON u2.id = f1.friend_id
JOIN friendships f2 ON f2.user_id = u2.id
JOIN users u3 ON u3.id = f2.friend_id
WHERE u1.id = 1;

-- 深さが可変（「最大N度のつながり」）は再帰CTEが必要
WITH RECURSIVE connections AS (
  SELECT friend_id, 1 AS depth FROM friendships WHERE user_id = 1
  UNION ALL
  SELECT f.friend_id, c.depth + 1
  FROM friendships f JOIN connections c ON f.user_id = c.friend_id
  WHERE c.depth < 6  -- LinkedIn的な「6次の隔たり」
)
SELECT DISTINCT friend_id FROM connections;
-- → クエリが複雑、大規模グラフでは非常に遅い
```

グラフDBではこれが数行で書ける。

## Neo4j のインデックスフリー隣接

Neo4jの最大の特徴。各ノードが隣接するノードへの直接ポインタ（物理的なアドレス）を持つ。

```
RDBのJOIN:
  user(id=1) → friendship(user_id=1) をインデックスで検索 → O(log N)
  → 深さが増えるたびにインデックス検索を繰り返す

Neo4jのトラバーサル:
  node(id=1) → ポインタを辿るだけ → O(1) per hop
  → グラフの大きさに関係なく、トラバーサル速度は一定
```

```
ノードの物理構造:
  [nodeId | labels | firstRelationshipId | firstPropertyId]

リレーションシップの物理構造:
  [relId | type | startNodeId → nextRelFromStart | endNodeId → nextRelFromEnd | firstPropertyId]
```

全ノードをスキャンするのではなく、ポインタを辿るだけで関連ノードに到達できる。

## Cypher クエリ言語

```cypher
// ノードとリレーションシップの作成
CREATE (alice:Person {name: 'Alice', age: 30})
CREATE (bob:Person {name: 'Bob', age: 25})
CREATE (alice)-[:KNOWS {since: 2020}]->(bob)

// パターンマッチング
MATCH (p:Person {name: 'Alice'})-[:KNOWS]->(friend)
RETURN friend.name

// 可変長パス（1〜3ホップ）
MATCH (alice:Person {name: 'Alice'})-[:KNOWS*1..3]->(person)
RETURN DISTINCT person.name

// 最短経路
MATCH (alice:Person {name: 'Alice'}), (dave:Person {name: 'Dave'})
MATCH path = shortestPath((alice)-[:KNOWS*]-(dave))
RETURN path, length(path)
```

### よく使うパターン

```cypher
// 共通の友達
MATCH (alice:Person {name: 'Alice'})-[:KNOWS]->(friend)<-[:KNOWS]-(bob:Person {name: 'Bob'})
RETURN friend.name

// 商品レコメンデーション（協調フィルタリング）
MATCH (user:User {id: 1})-[:PURCHASED]->(product)<-[:PURCHASED]-(other:User)
      -[:PURCHASED]->(recommended)
WHERE NOT (user)-[:PURCHASED]->(recommended)
RETURN recommended.name, COUNT(*) AS score
ORDER BY score DESC
LIMIT 10
```

## グラフアルゴリズム

Neo4j Graph Data Science（GDS）ライブラリで実装済みのアルゴリズムを活用できる。

### PageRank

```
Webのリンク構造から「重要なページ」を計算するアルゴリズム（Googleの基盤）
ソーシャルグラフでは「影響力のあるユーザー」の特定に使う

直感: 多くの人からフォローされ、かつフォロワー自身も多くフォローされているユーザーが高スコア
```

```cypher
// Neo4j GDSでPageRankを計算
CALL gds.pageRank.stream('myGraph')
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).name AS name, score
ORDER BY score DESC
LIMIT 10
```

### コミュニティ検出（Louvain法）

```
類似したノード群（クラスター）を自動検出
SNSのコミュニティ、不正グループの検出に使われる

直感: 内部のエッジが多く、外部のエッジが少ないグループを見つける
```

```cypher
CALL gds.louvain.stream('myGraph')
YIELD nodeId, communityId
RETURN gds.util.asNode(nodeId).name AS name, communityId
ORDER BY communityId
```

### 最短経路（Dijkstra / A*）

```cypher
// 重み付き最短経路（Dijkstra）
MATCH (source:Location {name: 'Tokyo'})
MATCH (target:Location {name: 'Osaka'})
CALL gds.shortestPath.dijkstra.stream('myGraph', {
  sourceNode: source,
  targetNode: target,
  relationshipWeightProperty: 'distance'
})
YIELD path, totalCost
RETURN path, totalCost
```

### 中心性指標

```
Degree Centrality:  エッジの多いノード（ハブ）
Betweenness:        多くの最短経路が通るノード（ブリッジ）
Closeness:          他ノードへの平均距離が短いノード
```

## グラフDBの主な用途

| 用途 | 詳細 |
|---|---|
| **不正検知** | 複数口座間の送金ネットワークで不正グループを検出 |
| **レコメンデーション** | 協調フィルタリング、「あなたへのおすすめ」 |
| **ナレッジグラフ** | Google Knowledge Graph、Wikidata |
| **アクセス制御** | RBAC（Role-Based Access Control）のロール継承 |
| **サプライチェーン** | 部品の依存関係、影響範囲の分析 |
| **経路探索** | カーナビ、物流最適化 |

## RDB + グラフDB のハイブリッド

実務ではすべてをグラフDBに移すのではなく、用途別に使い分ける。

```
PostgreSQL（メインのビジネスデータ）:
  users, orders, products, payments
  
Neo4j（関係性の探索に特化）:
  ソーシャルグラフ、レコメンデーション
  
同期方法:
  PostgreSQLへの書き込み → CDCでKafkaに流す
  KafkaのConsumerがNeo4jに書き込む
```

## AGE（PostgreSQLのグラフ拡張）

PostgreSQLのままグラフクエリを書ける拡張。Apacheプロジェクト。

```sql
-- PostgreSQLでCypherを実行
SELECT * FROM cypher('my_graph', $$
  MATCH (v:Person)-[e:KNOWS]->(v2:Person)
  RETURN v.name, v2.name
$$) AS (person1 agtype, person2 agtype);
```

既存のPostgreSQLスタックにグラフ機能を追加したい場合に有用。

## 関連概念

- → [データモデル](./concepts_ddia_data_models.md)（グラフモデルの基本概念）
- → [パーティショニング](./concepts_ddia_partitioning.md)（グラフのシャーディングの難しさ）
- → [データシステムの統合設計](./concepts_ddia_future.md)（CDCによるRDBとの同期）

## 出典・参考文献

- Martin Kleppmann, *Designing Data-Intensive Applications* (2017) Chapter 2
- Neo4j Documentation — neo4j.com/docs
- Neo4j Graph Data Science Library — neo4j.com/docs/graph-data-science
- Apache AGE — age.apache.org
