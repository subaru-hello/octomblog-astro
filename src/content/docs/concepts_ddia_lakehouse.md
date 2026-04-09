---
title: Lakehouse（Apache Iceberg / Delta Lake）
description: データレイクとDWHを統合する次世代アーキテクチャ。Apache IcebergとDelta Lakeの設計思想、ACID保証・スキーマ進化・タイムトラベルの仕組みを理解する
category: "概念"
tags: ["データ設計", "Lakehouse", "Apache Iceberg", "Delta Lake", "データレイク", "DDIA"]
emoji: "🏔️"
date: "2026-04-09"
order: 847
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017) Chapter 10 / Apache Iceberg Documentation"
---

## 定義

**Lakehouse**：データレイク（安価・柔軟）とデータウェアハウス（ACID・高性能クエリ）の利点を統合したアーキテクチャ。S3などのオブジェクトストレージの上にトランザクション層を追加することで実現する。

## データレイクとDWHの問題

```
データレイク（S3 + Parquet）の問題:
  ✅ 安価・無限にスケール
  ✅ あらゆる形式のデータを保存できる
  ❌ ACIDがない（ファイルを上書きする操作が中断されたら壊れる）
  ❌ スキーマ変更が難しい
  ❌ 古いファイルが溜まる（デリートが困難）
  ❌ 「最新のデータがどのファイルか」管理が大変

データウェアハウス（BigQuery, Snowflake）の問題:
  ✅ ACID保証・高速クエリ
  ✅ スキーマ管理が容易
  ❌ ベンダーロックイン
  ❌ 生データ（画像・音声・非構造化）を扱えない
  ❌ DWHへのコピーで二重管理・鮮度の問題

Lakehouse:
  S3等のオブジェクトストレージを「そのまま」使いながら
  DWHと同等のACID・スキーマ管理・高速クエリを実現
```

## Apache Icebergの設計

Netflixが開発し、ApacheトップレベルプロジェクトになったLakehouseフォーマット。

### メタデータ層の構造

```
S3バケット
  ├── data/
  │   ├── part-00001.parquet
  │   ├── part-00002.parquet
  │   └── ...（実際のデータファイル）
  │
  └── metadata/
      ├── v1.metadata.json    ← テーブルのスキーマ・スナップショット一覧
      ├── v2.metadata.json    ← 更新のたびに新しいバージョン
      ├── snap-001.avro       ← スナップショット（ファイルリスト）
      └── snap-002.avro
```

### スナップショットベースのACID

```
書き込みフロー:
  1. 新しいParquetファイルをS3に書く（アトミック操作）
  2. 新しいメタデータファイルを作成（変更リスト）
  3. current-metadata-location をアトミックに更新
     → これがコミット操作

読み取りフロー:
  1. current-metadata-location を読む
  2. 最新のスナップショットのファイルリストを取得
  3. そのファイルだけ読む

中断した書き込み:
  新しいParquetファイルは書かれているが、
  メタデータが更新されていない
  → 誰にも見えないゴミファイルとして残る（定期的にorphan fileを掃除）
  → 読み取り側には全く影響なし
```

### タイムトラベル（Time Travel）

```sql
-- Sparkでの例（SparkはIcebergをネイティブサポート）

-- 1時間前のデータを参照
SELECT * FROM catalog.db.orders
TIMESTAMP AS OF '2024-01-15 10:00:00';

-- スナップショットIDで参照
SELECT * FROM catalog.db.orders
VERSION AS OF 12345678;

-- 変更履歴の確認
SELECT * FROM catalog.db.orders.history;
```

**用途**：誤ってデータを削除した場合の復元、A/Bテストの再現、監査。

### スキーマ進化

```python
# PythonでIcebergのスキーマを変更
from pyiceberg.catalog import load_catalog

catalog = load_catalog('default')
table = catalog.load_table('db.orders')

# カラム追加（後方互換性あり）
with table.update_schema() as update:
    update.add_column('discount_amount', DoubleType())

# カラムリネーム
with table.update_schema() as update:
    update.rename_column('old_name', 'new_name')

# カラム削除（ファイルは変更しない、メタデータのみ）
with table.update_schema() as update:
    update.delete_column('deprecated_field')
```

## Delta Lake

DatabricksがApache Spark向けに開発。Icebergとほぼ同等の機能を持つ。

```python
# PySpark + Delta Lake
from delta.tables import DeltaTable
from pyspark.sql import SparkSession

spark = SparkSession.builder \
    .config('spark.sql.extensions', 'io.delta.sql.DeltaSparkSessionExtension') \
    .getOrCreate()

# Delta Tableへの書き込み
df.write.format('delta').save('s3://bucket/orders')

# UPSERTの例（Delta Lakeの特徴）
deltaTable = DeltaTable.forPath(spark, 's3://bucket/orders')
deltaTable.alias('target').merge(
    updates.alias('source'),
    'target.order_id = source.order_id'
).whenMatchedUpdateAll() \
 .whenNotMatchedInsertAll() \
 .execute()

# タイムトラベル
df_old = spark.read.format('delta') \
    .option('timestampAsOf', '2024-01-15') \
    .load('s3://bucket/orders')
```

## Apache Hudi

MergeOnRead（更新を差分として保存）とCopyOnWrite（更新時にファイルをコピー）の2モードを持つ。Uber発。

```
3フォーマットの比較:
              Iceberg  Delta Lake  Hudi
ACIDトランザクション  ✅      ✅         ✅
タイムトラベル        ✅      ✅         ✅
スキーマ進化          ✅      ✅         ✅
UPSERT効率          普通     普通       高い（MoR）
エンジンサポート     広い     Spark中心  普通
コミュニティ         活発     活発       普通
採用実績            Netflix等 Databricks Uber等
```

## モダンLakehouseスタック

```
データソース
  ↓ Fivetran / Airbyte（EL）
S3 / GCS / ADLS（ストレージ）
  ↓ Apache Iceberg / Delta Lake（トランザクション層）
  ↓ dbt（変換）
Spark / Trino / DuckDB（クエリエンジン）
  ↓
BI ツール（Tableau / Metabase）
```

**Trino（Presto後継）**：Iceberg/Delta Lakeをクエリできる分散SQLエンジン。BigQueryやSnowflakeに依存せず、自前のLakehouseを構築できる。

## 関連概念

- → [バッチ処理](./concepts_ddia_batch_processing.md)（MapReduce→Sparkの発展でLakehouseへ）
- → [列指向ストレージ](./concepts_ddia_columnar_storage.md)（IcebergがParquetを使う理由）
- → [エンコーディングとスキーマ進化](./concepts_ddia_encoding.md)（Icebergのスキーマ進化との関係）
- → [dbtとデータ変換パイプライン](./concepts_ddia_dbt_pipeline.md)（Lakehouseの変換層）

## 出典・参考文献

- Apache Iceberg Documentation — iceberg.apache.org/docs
- Delta Lake Documentation — docs.delta.io
- Ryan Blue et al., "Apache Iceberg: An Architectural Look Under the Covers" (2020)
