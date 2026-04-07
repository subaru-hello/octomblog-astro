---
title: ストレージエンジンとインデックス
description: DBが内部でデータをどう保存・検索するか。BツリーとLSMツリーの設計思想の違いを理解することで、適切なDBエンジンを選べるようになる
category: "概念"
tags: ["データ設計", "ストレージ", "インデックス", "Bツリー", "LSMツリー", "DDIA"]
emoji: "💾"
date: "2026-04-07"
order: 803
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017) Chapter 3"
---

## 定義

ストレージエンジンとは、DBがディスクへのデータの書き込み・読み取りを管理する内部機構。同じSQLインターフェースでも、エンジンの違いがパフォーマンス特性を根本的に変える。

## 最も単純なDBの実装

```bash
# 2つのbash関数で作るKVストア
db_set() {
  echo "$1,$2" >> database
}

db_get() {
  grep "^$1," database | last | cut -d',' -f2
}
```

書き込みは追記（append）だけなので非常に高速。しかし読み取りはO(n)のフルスキャン。インデックスはこの「読み取りを速くする」ためのデータ構造。

## 2つの主要インデックス構造

```
データベースインデックス
  ├── Bツリー（B-Tree）
  │     ほぼすべてのRDBMSで使われる
  └── LSMツリー（Log-Structured Merge-Tree）
        書き込み最適化。HBase, Cassandra, LevelDB, RocksDB
```

## Bツリー

ページ（通常4KB）を単位とした木構造。ほとんどのRDBMS（PostgreSQL, MySQL InnoDB等）が採用。

```
ルートページ
  ├── [ref | 100 | ref | 200 | ref]
  │        ↓             ↓
  │   [ref|50|ref|75|ref]  [ref|150|ref|175|ref]
  │               ↓
  │         リーフページ（実際のデータへの参照）
  └── ...
```

**ルール**：
- ページを分割・マージしてバランスを保つ
- n個のキーに対して深さはO(log n)
- 典型的な4レベルの木で数百万件を格納

**書き込み**：既存ページを上書き（in-place update）。ディスクのランダム書き込み。

**WAL（Write-Ahead Log）**：ページ更新前にログに記録。クラッシュ時のリカバリに使う。

## LSMツリー（Log-Structured Merge-Tree）

書き込みをすべてシーケンシャルに行うことで高スループットを実現。

```
書き込みフロー:
  1. 書き込み → MemTable（インメモリのソート済み木）
  2. MemTableが閾値超え → SSTable（ディスク上のソート済みファイル）に書き出し
  3. バックグラウンドでSSTableをマージ・コンパクション
  
読み取りフロー:
  1. MemTableを検索
  2. なければ最新のSSTableから順に検索
  （ブルームフィルターで無駄なディスクアクセスを省く）
```

### SSTable（Sorted String Table）

キーでソートされた不変のファイル。マージソートで効率よく統合できる。

```
SSTable 1: [a:1, c:3, e:5]
SSTable 2: [b:2, c:4, d:6]  ← cは後の値が正
マージ後:  [a:1, b:2, c:4, d:6, e:5]
```

## Bツリー vs LSMツリー

| 特性 | Bツリー | LSMツリー |
|---|---|---|
| 書き込み速度 | 遅い（ランダム書き込み） | 速い（シーケンシャル書き込み） |
| 読み取り速度 | 速い（ページが確定している） | やや遅い（複数SSTableを参照） |
| 書き込み増幅 | 1回の書き込み = 複数ページ更新 | コンパクション時に増幅 |
| スペース効率 | ページ内フラグメントあり | コンパクションで解消されるが圧迫時も |
| 適した用途 | 読み取り多い業務システム | 書き込み多いログ・時系列・イベント |

**書き込み増幅（Write Amplification）**：1回の書き込みが、ディスク上で何倍もの実際の書き込みを引き起こす現象。LSMのコンパクションが典型。SSDは書き込み回数制限があるため重要な指標。

## インデックスの種類

### クラスタードインデックス vs カバリングインデックス

```sql
-- クラスタードインデックス: データ行をインデックスのリーフに直接格納
-- MySQL InnoDB の主キーは常にクラスタードインデックス

-- カバリングインデックス: クエリに必要なカラムをすべてインデックスに含める
CREATE INDEX idx_covering ON orders (user_id) INCLUDE (status, total_amount);
-- このクエリはインデックスだけで完結（テーブルアクセス不要）
SELECT status, total_amount FROM orders WHERE user_id = 123;
```

### 複合インデックスと多次元インデックス

```sql
-- 複合インデックス: 左端のカラムから順に有効
CREATE INDEX idx_lastname_firstname ON users (last_name, first_name);

-- このクエリは使える（left-most prefix）
WHERE last_name = 'Smith'
WHERE last_name = 'Smith' AND first_name = 'John'

-- このクエリは使えない（last_nameがない）
WHERE first_name = 'John'
```

位置検索（緯度・経度）のような多次元インデックスにはR-Treeや空間インデックス（PostGISなど）を使う。

### フルテキストインデックス

```
転置インデックス（Inverted Index）:
  "apple" → [doc1, doc3, doc7]
  "banana" → [doc2, doc3]
  "cherry" → [doc1, doc5]
  
Elasticsearchはこの構造を大規模に実装したもの
```

## OLTP vs OLAP

| 観点 | OLTP | OLAP |
|---|---|---|
| 主な用途 | トランザクション処理 | 分析・集計 |
| アクセスパターン | 少数の行、インデックス検索 | 大量の行、列のスキャン |
| データ鮮度 | リアルタイム | バッチ更新が多い |
| DB例 | PostgreSQL, MySQL | BigQuery, Redshift, ClickHouse |
| 最適なストレージ | 行指向（Row-oriented） | 列指向（Column-oriented） |

**列指向ストレージ（Columnar Storage）**：同じ列のデータをまとめて格納。SELECT句で指定した列だけ読むため、IOが大幅削減。圧縮効率も高い。

## 関連概念

- → [データモデル](./concepts_ddia_data_models.md)（何を格納するか）
- → [パーティショニング](./concepts_ddia_partitioning.md)（インデックスを分散させる）
- → [トランザクション](./concepts_ddia_transactions.md)（WALとACIDの関係）

## 出典・参考文献

- Martin Kleppmann, *Designing Data-Intensive Applications* (2017) Chapter 3
- Patrick O'Neil et al., "The Log-Structured Merge-Tree" (1996)
