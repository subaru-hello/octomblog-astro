---
title: 列指向ストレージとOLAP設計
description: BigQueryやClickHouseがなぜ速いか。列ごとにデータを格納するColumnar Storageの圧縮・ベクトル化実行・スタースキーマの設計原理を理解する
category: "概念"
tags: ["データ設計", "列指向ストレージ", "OLAP", "BigQuery", "ClickHouse", "DDIA"]
emoji: "📊"
date: "2026-04-07"
order: 815
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017) Chapter 3"
---

## 定義

**列指向ストレージ（Columnar Storage）**：テーブルの各行をまとめて格納するのではなく、各列のすべての値をまとめて格納する方式。分析クエリ（OLAP）に最適化されている。

## 行指向 vs 列指向

```
テーブルの例:
  id | name    | country | revenue
  ---+---------+---------+--------
   1 | Alice   | JP      | 5000
   2 | Bob     | US      | 3000
   3 | Charlie | JP      | 8000

行指向（Row-oriented）:
  [1, Alice, JP, 5000] [2, Bob, US, 3000] [3, Charlie, JP, 8000]
  
列指向（Column-oriented）:
  id:      [1, 2, 3]
  name:    [Alice, Bob, Charlie]
  country: [JP, US, JP]
  revenue: [5000, 3000, 8000]
```

## なぜ分析クエリに速いか

```sql
-- 「日本のユーザーの合計売上」を求めるクエリ
SELECT SUM(revenue)
FROM sales
WHERE country = 'JP'
```

**行指向の場合**：全行を読み込んでcountryをフィルタ → nameやidも無駄に読む  
**列指向の場合**：countryとrevenueの2列だけ読む → IOが数十〜数百倍削減

```
実際の分析クエリは数百列のテーブルから5〜10列しか使わない
→ 列指向ならそのコスト比が直接効く
```

## 圧縮：列指向の最大の武器

同じ列には似たような値が続く。これが圧縮効率を劇的に上げる。

### ビットマップエンコーディング

```
country列: [JP, US, JP, JP, US, JP, ...]

JP: 1 0 1 1 0 1 ...  → ビットマップで表現
US: 0 1 0 0 1 0 ...

WHERE country = 'JP' → JPのビットマップで論理AND → 行番号を特定
WHERE country = 'JP' OR country = 'US' → 2つのビットマップのOR演算
```

ビット演算はCPUの最も得意とする操作。WHERE句の評価がビット演算で完結する。

### ランレングスエンコーディング（RLE）

```
country列: JP, JP, JP, JP, US, US, US, JP, JP ...
           ↓ RLE
           4×JP, 3×US, 2×JP ...

データが連続する場合、格納サイズが1/10以下になることもある
```

### 辞書エンコーディング

```
country列: [JP, US, JP, CN, JP]
           ↓
辞書: {0: JP, 1: US, 2: CN}
データ: [0, 1, 0, 2, 0]  ← 文字列ではなく整数で保存
```

## ベクトル化実行（Vectorized Execution）

列指向の圧縮データに対して、CPUのSIMD命令で一度に複数の値を処理する。

```
通常のループ（行指向的）:
  for row in rows:
    if row.country == 'JP':
      sum += row.revenue

ベクトル化実行:
  countryChunk = country[0:1024]  // 1024件を一度にロード
  mask = countryChunk == 'JP'     // SIMD命令で一括比較
  revenueChunk = revenue[0:1024]
  sum += revenueChunk[mask]       // マスクされた値を一括加算
```

現代のCPUはAVX-512命令で512bitを一度に処理できる（int32なら16個同時）。行指向のループより10〜100倍速くなる。

## データウェアハウスのスキーマ設計

OLAP向けのDB設計はOLTPとは異なる。

### スタースキーマ（Star Schema）

```
              ファクトテーブル（大きい）
              orders
              ┌──────────────┐
              │ order_id     │
              │ customer_id ─┼──→ dim_customers
              │ product_id  ─┼──→ dim_products
              │ date_id     ─┼──→ dim_date
              │ store_id    ─┼──→ dim_stores
              │ quantity     │
              │ revenue      │
              └──────────────┘
              
ファクトテーブル: 事実（トランザクション）を記録。外部キーのみ
ディメンションテーブル: 記述情報（属性）を保持
```

**非正規化が推奨**：OLTPと逆にJOINを減らすため、ディメンションテーブルに冗長データを持つ。

### スノーフレークスキーマ

スタースキーマのディメンションをさらに正規化した形。JOINが増えるため、実務ではスタースキーマが多い。

## 主要な列指向OLAP DB比較

| DB | 特徴 | 適した用途 |
|---|---|---|
| BigQuery | サーバーレス、自動スケール、Dremel設計 | GCPユーザー、アドホック分析 |
| Snowflake | ストレージとコンピュートを分離 | マルチクラウド、データシェアリング |
| ClickHouse | 超高速、自己ホスト可能 | リアルタイム分析、ログ分析 |
| Redshift | AWSマネージド、PostgreSQL互換 | AWSユーザー |
| DuckDB | インプロセス、ファイル直接読み込み | ローカル分析、Pandas代替 |
| Apache Parquet | ストレージフォーマット（DBではない） | S3上のデータレイク |

### Apache Parquet

列指向のファイルフォーマット。DBではなくフォーマット仕様。

```
Parquetファイル構造:
  ファイル
  ├── Row Group 1 (128MB単位)
  │   ├── Column Chunk: id     [圧縮済み]
  │   ├── Column Chunk: name   [辞書エンコード]
  │   └── Column Chunk: amount [RLE + Bit-packing]
  └── Row Group 2
      └── ...

フッターにスキーマとRow Groupの統計情報（min/max）
→ 不要なRow Groupをスキップ（述語プッシュダウン）
```

BigQuery, Spark, DuckDB, PrestoはすべてParquetを読める。S3+Parquetが「データレイク」の標準的な組み合わせ。

## OLTPとOLAPの役割分担

```
書き込み      OLTP DB（PostgreSQL）     正規化、高い整合性
（リアルタイム）     │
                    │ CDC / ETL / ELT
                    ↓
読み取り      OLAP DB（BigQuery）       非正規化、高いスキャン性能
（バッチ分析）
```

**ELT（Extract-Load-Transform）**：BigQueryなどのパワーでロード後に変換。従来のETL（変換してからロード）より現代的。

## 関連概念

- → [ストレージとインデックス](./concepts_ddia_storage_indexing.md)（行指向の詳細）
- → [バッチ処理](./concepts_ddia_batch_processing.md)（OLAPとデータパイプライン）
- → [データシステムの統合設計](./concepts_ddia_future.md)（CDCでOLTPからOLAPへ）

## 出典・参考文献

- Martin Kleppmann, *Designing Data-Intensive Applications* (2017) Chapter 3
- Sergey Melnik et al., "Dremel: Interactive Analysis of Web-Scale Datasets" (2010) — Google
- Apache Parquet Format Specification — parquet.apache.org
