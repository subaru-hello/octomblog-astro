---
title: コンシステントハッシング
description: ノードの追加・削除時のデータ移動を最小化するアルゴリズム。Redis Cluster・Cassandraが採用する仮想ノードの仕組みと、通常のモジュロハッシュとの違いを理解する
category: "概念"
tags: ["データ設計", "コンシステントハッシング", "分散システム", "Redis", "Cassandra", "DDIA"]
emoji: "🔵"
date: "2026-04-08"
order: 834
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017) Chapter 6"
---

## 定義

**コンシステントハッシング（Consistent Hashing）**：分散システムでキーをノードに割り当てるアルゴリズム。ノードの追加・削除時に移動が必要なキーを最小限（1/N）に抑えることが最大の特徴。

## 通常のハッシュ分割の問題

```
3ノード構成:
  hash(key) % 3 でノードを決定

  key "user:1" → hash=10 → 10 % 3 = 1 → Node1
  key "user:2" → hash=20 → 20 % 3 = 2 → Node2
  key "user:3" → hash=30 → 30 % 3 = 0 → Node0

ノードを3→4に増やしたとき:
  hash(key) % 4 で全キーの割り当てが変わる

  key "user:1" → hash=10 → 10 % 4 = 2 → Node2（変わった！）
  key "user:2" → hash=20 → 20 % 4 = 0 → Node0（変わった！）
  key "user:3" → hash=30 → 30 % 4 = 2 → Node2（変わった！）

→ ほぼ全キーの再配置が必要（キャッシュなら全キャッシュが無効に）
```

## コンシステントハッシングの仕組み

```
アイデア: ノードとキーを同じ「ハッシュリング（0〜2^32の円）」上に配置する

1. ノードをリング上に配置（ノードIDをハッシュして位置を決める）
2. キーをリング上に配置（キーをハッシュして位置を決める）
3. キーの担当ノード = 時計回りに最初に出会うノード

リングのイメージ:
       0
      / \
  Node2  Node0
    |      |
  Node1---+
     
key "user:1" → リング上の位置 → 時計回りに最初のノードが担当
```

### ノード追加時の動作

```
4番目のノード（Node3）をNode0とNode1の間に追加:

変更前: Node0とNode1の間のキーはNode1が担当
変更後: Node0とNode3の間のキーはNode3が担当
       Node3とNode1の間のキーは引き続きNode1が担当

→ 移動が必要なキーは全体の約1/N（ノード数が4なら25%）
→ 通常のモジュロハッシュは約75%が移動
```

## 仮想ノード（Virtual Nodes / vnodes）

シンプルなコンシステントハッシングでは、ノードの分布が偏ることがある（ハッシュ関数の偏り）。

```
問題:
  3ノードがリング上に均等に配置されるとは限らない
  偏りが大きいとホットスポットが発生

解決: 各物理ノードを複数の仮想ノードとしてリング上に配置

Node0 → vnode0-1, vnode0-2, vnode0-3, ...（100個）
Node1 → vnode1-1, vnode1-2, vnode1-3, ...（100個）
Node2 → vnode2-1, vnode2-2, vnode2-3, ...（100個）

→ 300個の仮想ノードが均等にリング上に散らばる
→ 各物理ノードの担当範囲が均等になる
→ ノード追加時も自動的に均等になる
```

## Redis Clusterでの実装

Redis Clusterはコンシステントハッシングではなく「ハッシュスロット」を使うが、思想は同じ。

```
16384個のハッシュスロット（0〜16383）

key → CRC16(key) % 16384 → スロット番号

スロットをノードに割り当て:
  Node0: スロット 0〜5460
  Node1: スロット 5461〜10922
  Node2: スロット 10923〜16383

ノード追加時（4台目）:
  各ノードからスロットの一部を移動するだけ
  Node0: 0〜4095（一部Node3へ）
  Node3: 4096〜5460 + 5461〜7280 + 10923〜12287（各ノードから移管）
```

```bash
# Redis Clusterのスロット確認
redis-cli cluster info
redis-cli cluster nodes

# スロットのリシャーディング
redis-cli --cluster reshard 127.0.0.1:7000
```

## Cassandraでの実装

Cassandraはコンシステントハッシングと仮想ノードを組み合わせて使う。

```
パーティションキーをMurmur3ハッシュでリング上に配置
デフォルトで1ノードあたり256個の仮想ノード

書き込みフロー:
  クライアント → 任意のノード（コーディネーター）
  コーディネーター → ハッシュリングでレプリカノードを特定
  → レプリカノードに書き込み（Consistency Levelで決まる数）
```

## コンシステントハッシングの活用場面

### CDNのエッジサーバー選択

```
コンテンツのURLをハッシュしてエッジサーバーを決定
同じURLは常に同じエッジサーバーにキャッシュされる

エッジサーバーが追加・削除されてもキャッシュのヒット率低下を最小化
```

### ロードバランサーのスティッキーセッション

```
セッションIDをハッシュして担当バックエンドを決定
同一セッションは常に同じバックエンドに向く（セッション情報の共有不要）

コンシステントハッシングならバックエンドの増減でも影響最小
```

### 分散キャッシュのシャーディング

```typescript
// Node.jsでコンシステントハッシングを実装するライブラリ例
import ConsistentHashing from 'consistent-hashing';

const ring = new ConsistentHashing(['cache1:6379', 'cache2:6379', 'cache3:6379']);

function getCache(key: string) {
  const node = ring.getNode(key);  // 担当ノードを取得
  return createRedisClient(node);
}

// ノード追加
ring.addNode('cache4:6379');
// → 約25%のキーだけ移動先が変わる
```

## 通常のハッシュ vs コンシステントハッシング

| 観点 | 通常のモジュロハッシュ | コンシステントハッシング |
|---|---|---|
| ノード追加時の移動量 | ほぼ全キー（(N-1)/N） | 1/N のキーのみ |
| 実装の複雑さ | シンプル | やや複雑 |
| 均等分散 | 均等 | 仮想ノードなしでは偏りあり |
| ノード間の偏り対策 | 不要 | 仮想ノードで解決 |
| 採用例 | 固定台数のシステム | Redis Cluster, Cassandra, CDN |

## 関連概念

- → [パーティショニング](./concepts_ddia_partitioning.md)（ハッシュパーティションとリバランシング）
- → [キャッシュ戦略](./concepts_ddia_cache_strategy.md)（分散キャッシュへの応用）
- → [レプリケーション](./concepts_ddia_replication.md)（Cassandraのリーダーレス構成との関係）

## 出典・参考文献

- David Karger et al., "Consistent Hashing and Random Trees" (1997) — MIT
- Martin Kleppmann, *Designing Data-Intensive Applications* (2017) Chapter 6
- Redis Cluster Specification — redis.io/docs/reference/cluster-spec
