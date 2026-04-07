---
title: NewSQL（分散ACIDデータベース）
description: CockroachDB・TiDB・Google Spannerの設計思想。NoSQLのスケーラビリティとRDBのACID保証を両立させる方法、従来の2PCをRaftで置き換えるアプローチを理解する
category: "概念"
tags: ["データ設計", "NewSQL", "CockroachDB", "Spanner", "分散トランザクション", "DDIA"]
emoji: "🌐"
date: "2026-04-07"
order: 821
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017) / CockroachDB, Spanner Papers"
---

## 定義

**NewSQL**：水平スケールできる分散アーキテクチャを持ちながら、従来のRDBと同等のACIDトランザクションとSQLインターフェースを提供するDBのカテゴリ。

```
NoSQL（Cassandra, DynamoDB）:
  ✅ 水平スケール
  ✅ 高可用性
  ❌ トランザクションが弱い（or ない）
  ❌ SQL非対応（多くの場合）

従来のRDB（PostgreSQL, MySQL）:
  ✅ ACID保証
  ✅ SQL
  ❌ 水平スケールが難しい
  ❌ 単一ノード障害で全停止リスク

NewSQL（Spanner, CockroachDB, TiDB）:
  ✅ 水平スケール
  ✅ ACID保証
  ✅ SQL
  ✅ 地理分散対応
```

## なぜ今まで難しかったか

[分散システムの問題](./concepts_ddia_distributed_problems.md)で述べた通り、分散環境でのトランザクションは本質的に難しい。

```
2PCの問題:
  コーディネーターがダウン → 参加者が宙ぶらりん
  ロック時間が長い → 可用性低下

CAP定理との関係:
  ネットワーク分断時に一貫性と可用性のどちらかを諦める必要がある
  → NewSQLはCPシステム（一貫性を優先、分断時は可用性を一部犠牲）
```

## Spanner（Google）

2012年にGoogleが公開。世界初の「グローバルスケールの外部一貫性を持つDB」。

### TrueTime API

[分散システムの問題](./concepts_ddia_distributed_problems.md)で触れたGoogleの時刻管理システム。

```
通常のシステム: 時刻の「点」（10:00:00.000）
TrueTime:       時刻の「区間」[earliest, latest]
                例: [10:00:00.003, 10:00:00.007]（不確かさ±4ms）

コミット時の動作:
  1. コミット開始時刻 t を記録
  2. TrueTimeの不確かさが解消されるまで待機（Commit Wait）
  3. t + 不確かさ の時刻になってからコミット完了
  
→ あとからコミットされるトランザクションは必ず大きいタイムスタンプを持つ
→ 外部一貫性（External Consistency）の保証
```

GPSアンテナと原子時計をデータセンターに設置することで不確かさを数ms以内に収める。

### Paxosによるレプリケーション

2PCコーディネーターの代わりにPaxosグループがシャードを管理。コーディネーター障害問題を解消。

## CockroachDB

SpannerのオープンソースインスパイアードDB。TrueTimeは使わず、Hybrid Logical Clock（HLC）で代替。

### アーキテクチャ

```
SQL Layer（PostgreSQL互換のSQLパーサー）
  ↓
KV Layer（分散KVストア）
  ↓
Raftグループ（各レンジのレプリケーション）
  ↓
RocksDB（各ノードのストレージ）
```

### レンジ（Range）

```
データをキーレンジで分割した単位（デフォルト64MB）

レンジ1: key "a" 〜 "f"   → ノード1(leader), ノード2, ノード3
レンジ2: key "g" 〜 "m"   → ノード2(leader), ノード1, ノード4
レンジ3: key "n" 〜 "z"   → ノード3(leader), ノード2, ノード4
```

各レンジは独立したRaftグループで管理。レンジをまたぐトランザクションは**分散トランザクション**が必要。

### 分散トランザクション（Parallel Commits）

従来の2PCをRaftで改良した手法。

```
従来の2PC:
  Phase1 → 全参加者がPrepare
  Phase2 → コーディネーターがCommit指示
  問題: Phase1とPhase2の間にコーディネーターが落ちると詰まる

CockroachDBのParallel Commits:
  1. すべてのレンジへの書き込みを並列に実行
  2. すべての書き込みが完了したことを「Staging」状態として記録
     （コーディネーターがクラッシュしても回復できる）
  3. Staging確認後にCommit
  
  → コーディネーターの状態をRaftログに永続化
  → クラッシュ後も他のノードがStagingから回復できる
```

## TiDB

PingCAPが開発した分散HTAP DB（Hybrid Transactional/Analytical Processing）。

```
TiDB（SQLレイヤー）← MySQL互換
  ↓
TiKV（分散KVストア）← OLTPワークロード
TiFlash（列指向ストレージ）← OLAPワークロード

同じデータをTiKV（行指向）とTiFlash（列指向）に同期
→ OLTPクエリはTiKVへ
→ OLAPクエリはTiFlashへ
→ MySQLから移行しやすい（MySQL互換）
```

## YugabyteDB

PostgreSQL互換のNewSQL。PostgreSQLのクエリエンジンをそのまま使い、ストレージ層を分散に置き換えた設計。

## NewSQLの比較

| DB | 互換性 | TrueTime代替 | HTAP | 自己ホスト |
|---|---|---|---|---|
| Spanner | ANSI SQL | TrueTime（GPS+原子時計） | △ | ❌（GCPのみ） |
| CockroachDB | PostgreSQL互換 | HLC | ❌ | ✅ |
| TiDB | MySQL互換 | TSO（中央タイムスタンプ） | ✅（TiFlash） | ✅ |
| YugabyteDB | PostgreSQL互換 | HLC | △ | ✅ |
| AlloyDB | PostgreSQL互換 | Spanner技術転用 | △ | ❌（GCPのみ） |

## 採用時の判断基準

```
NewSQLが適している:
  - グローバル展開（地理分散）
  - 書き込みスケールが必要 + ACIDが必要
  - マルチリージョンのアクティブ-アクティブ構成
  - 現行のSQLアプリを大きく変えずにスケールしたい

従来RDB（PostgreSQL）で十分:
  - 単一リージョン
  - 読み取りスケールはレプリカで対応できる
  - チームがPostgreSQLのオペレーションに習熟している

注意:
  NewSQLは分散環境特有の遅延（ネットワーク往復）が発生する
  単純なクエリなら従来のRDBより遅いこともある
```

## 関連概念

- → [一貫性と合意](./concepts_ddia_consistency_consensus.md)（Raft・2PC・外部一貫性）
- → [パーティショニング](./concepts_ddia_partitioning.md)（レンジ分割とリバランシング）
- → [分散システムの問題](./concepts_ddia_distributed_problems.md)（TrueTimeが解決する問題）
- → [列指向ストレージ](./concepts_ddia_columnar_storage.md)（TiFlashのHTAP設計）

## 出典・参考文献

- James C. Corbett et al., "Spanner: Google's Globally Distributed Database" (2012)
- CockroachDB, "CockroachDB: The Resilient Geo-Distributed SQL Database" (2020)
- Huang et al., "TiDB: A Raft-based HTAP Database" (2020)
- Martin Kleppmann, *Designing Data-Intensive Applications* (2017) Chapter 9
