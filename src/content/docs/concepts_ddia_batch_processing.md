---
title: バッチ処理
description: 大量データを効率よく処理するバッチパイプラインの設計。MapReduceの仕組みとその限界、Sparkなどデータフローエンジンへの発展を理解する
category: "概念"
tags: ["データ設計", "バッチ処理", "MapReduce", "Spark", "データパイプライン", "DDIA"]
emoji: "📦"
date: "2026-04-07"
order: 809
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017) Chapter 10"
---

## 定義

**バッチ処理**：有限のデータセットに対して処理を実行し、結果を生成するシステム。入力が確定しており（境界あり）、処理時間より出力の正確さを優先する。

```
バッチ処理:    [有限の入力データ] → [処理] → [出力]
ストリーム処理: [終わりのない入力] → [処理] → [継続的な出力]
```

## Unixパイプラインの思想

バッチ処理の基礎はUnixのツールチェーン哲学にある。

```bash
# ウェブサーバーログから最もアクセスの多いURLトップ5を出力
cat access.log |
  awk '{print $7}' |        # URLを抽出
  sort |                     # ソート
  uniq -c |                  # 重複カウント
  sort -r -n |               # カウント降順
  head -n 5                  # 上位5件
```

各ツールは単一の仕事をする。パイプでつなぐことで複雑な処理を組み立てる。MapReduceはこれを分散環境に拡張したもの。

## MapReduce

Googleが2004年に発表。HDFSとYARNを基盤とするHadoopが代表的な実装。

### 処理フロー

```
Input Files (HDFS)
  │
  ▼
Map Phase: 各入力レコードをキーバリューペアに変換
  (doc1, "the cat sat") → [("the",1), ("cat",1), ("sat",1)]
  (doc2, "the cat lay") → [("the",1), ("cat",1), ("lay",1)]
  │
  ▼
Shuffle & Sort: 同じキーをグループ化してReducerに送る
  "cat" → [1, 1]
  "lay" → [1]
  "sat" → [1]
  "the" → [1, 1]
  │
  ▼
Reduce Phase: グループ内の値を集約
  "cat" → 2
  "lay" → 1
  "sat" → 1
  "the" → 2
  │
  ▼
Output Files (HDFS)
```

### MapReduceのジョイン

**ソートマージジョイン**：

```
Mapper1がユーザーレコードを処理: key=user_id, value=("user", {name, ...})
Mapper2がアクティビティを処理:   key=user_id, value=("activity", {action, ...})

Shuffleにより同じuser_idの全レコードが同じReducerへ
Reducerでユーザー情報とアクティビティを結合
```

**ブロードキャストハッシュジョイン**：一方が小さいテーブルの場合、全Mapperがそれをメモリに持つ。ネットワーク転送なしでジョインできる。

### MapReduceの問題点

1. **中間結果のディスク書き込み**：MapとReduceの間、ReduceとMap（次ジョブ）の間に毎回HDFSに書き出す → 低速
2. **ジョブの連鎖が難しい**：複雑な処理は複数MapReduceジョブをフローとして管理する必要がある
3. **遅延が高い**：バッチジョブ1回が数分〜数時間

## データフローエンジン（Spark, Flink）

MapReduceの問題を解決するために登場。

### Apache Spark

```
RDD（Resilient Distributed Dataset）:
  不変の分散データコレクション
  中間結果をメモリにキャッシュ可能

処理:
  JavaRDDの連鎖 → メモリ上でデータフローグラフを構築
  → 実際の計算はActionオペレーター（collect, save）でトリガー
```

**MapReduceとの違い**：

| 観点 | MapReduce | Spark |
|---|---|---|
| 中間結果 | 毎回HDFSに書く | メモリにキャッシュ |
| 処理モデル | Map+Reduce固定 | 任意のDAG |
| 対話的クエリ | 不可 | Spark SQL / Spark Shell |
| ストリーミング | 不可 | Spark Streaming（Micro-batch） |
| 速度 | 遅い | 10〜100倍高速 |

### 処理グラフ（DAG）

```
Input
  ├── Filter(age > 18)
  │     └── GroupBy(country)
  │               └── Count
  │                     └── Output
  └── Join(another_dataset)
        └── Map(transform)
              └── Output
```

Sparkのオプティマイザー（Catalyst）がDAGを解析し、最適な実行計画を生成。

## バッチ処理の設計原則

### 入力の不変性

```
バッチ処理の黄金律:
  入力データは変更しない
  → 処理失敗時は単純に再実行すればよい
  → デバッグが容易（入力を再現できる）
  → 時点を指定して過去に遡れる（タイムトラベル）
```

### データの再処理性

既存データに新しい処理を適用するために再処理できる設計。機械学習モデルの更新、バグ修正の適用などで重要。

**Lambda Architecture**：バッチ層（正確だが遅い）とスピード層（速いが近似）を組み合わせる。運用コストが高い欠点がある。

**Kappa Architecture**：ストリームエンジンだけで両方を実現する。Kafkaに全イベントを保持し、必要に応じて再処理。

## ETLとデータウェアハウス

```
OLTP DB (PostgreSQL) ──→ Extract ──→ Transform ──→ Load ──→ DWH (BigQuery)
  （運用DB）              取り出し       変換         積み込み  （分析DB）
  
定期的にバッチ処理で同期（毎日深夜など）
```

**問題**：OLTPのスキーマ変更がETLを壊す。列指向ストレージの利点を最大化するためのスキーマ設計（スタースキーマ、スノーフレークスキーマ）が必要。

## 関連概念

- → [ストリーム処理](./concepts_ddia_stream_processing.md)（バッチの対になる処理方式）
- → [ストレージとインデックス](./concepts_ddia_storage_indexing.md)（OLAP向け列指向ストレージ）
- → [データモデル](./concepts_ddia_data_models.md)（DWHのスキーマ設計）

## 出典・参考文献

- Martin Kleppmann, *Designing Data-Intensive Applications* (2017) Chapter 10
- Jeffrey Dean & Sanjay Ghemawat, "MapReduce: Simplified Data Processing on Large Clusters" (2004)
- Matei Zaharia et al., "Resilient Distributed Datasets: A Fault-Tolerant Abstraction for In-Memory Cluster Computing" (2012)
