---
title: dbtとデータ変換パイプライン
description: モダンデータスタックの核心であるdbt（data build tool）のモデル定義・依存関係・テスト・ドキュメント生成の仕組み。ELTパターンでのデータ変換設計を理解する
category: "概念"
tags: ["データ設計", "dbt", "データパイプライン", "ELT", "データウェアハウス", "DDIA"]
emoji: "🔧"
date: "2026-04-08"
order: 841
series:
  - データ志向アプリケーション設計（DDIA）
source: "dbt Documentation / The Analytics Engineering Guide"
---

## 定義

**dbt（data build tool）**：データウェアハウス内でのデータ変換をSQLとYAMLで管理するツール。「Tのあるバージョン管理されたELT」と言われ、データエンジニアリングにソフトウェアエンジニアリングの手法（テスト・バージョン管理・ドキュメント）を持ち込む。

## ETLからELTへ

```
ETL（従来）:
  Extract（抽出）→ Transform（変換）→ Load（ロード）
  変換してからDWHに入れる
  変換処理が別のシステムで動く（Spark等）

ELT（モダン）:
  Extract（抽出）→ Load（ロード）→ Transform（変換）
  生データをそのままDWHに入れ、DWH内で変換する
  BigQuery・Snowflakeの計算パワーを活用
  dbtはこのTを担当する
```

## dbtのプロジェクト構造

```
my_project/
  dbt_project.yml       # プロジェクト設定
  models/               # SQLモデル（変換ロジック）
    staging/            # 生データの軽い変換
      stg_orders.sql
      stg_users.sql
    intermediate/       # 中間集計
      int_order_items.sql
    marts/              # ビジネス向けの最終モデル
      finance/
        fct_revenue.sql
        dim_customers.sql
  tests/                # データテスト
  seeds/                # CSVの静的データ
  macros/               # 再利用可能なSQLスニペット
```

## モデルの定義

```sql
-- models/staging/stg_orders.sql
-- 生データの型変換・命名規則の統一
SELECT
  id                                    AS order_id,
  customer_id,
  CAST(total_amount AS DECIMAL(10,2))   AS total_amount,
  LOWER(status)                         AS status,
  created_at                            AT TIME ZONE 'UTC' AS created_at_utc
FROM {{ source('raw', 'orders') }}  -- {{ }} はJinjaテンプレート
WHERE created_at >= '2020-01-01'    -- 古すぎるデータを除外
```

```sql
-- models/marts/finance/fct_revenue.sql
-- ビジネスロジックを適用した最終モデル
WITH orders AS (
  SELECT * FROM {{ ref('stg_orders') }}  -- 他のモデルを参照
),
customers AS (
  SELECT * FROM {{ ref('stg_customers') }}
)
SELECT
  o.order_id,
  o.total_amount,
  o.created_at_utc,
  c.customer_name,
  c.country,
  DATE_TRUNC('month', o.created_at_utc) AS revenue_month
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
WHERE o.status = 'completed'
```

## 依存関係グラフ（DAG）

`{{ ref() }}`と`{{ source() }}`を使うと、dbtが自動的にモデル間の依存関係を解析してDAGを構築する。

```
raw.orders ──→ stg_orders ──→ int_order_items ──→ fct_revenue
raw.users  ──→ stg_users  ──→ dim_customers   ──┘

実行: dbt run
→ DAGに従って依存関係の順番に実行
→ 依存のないモデルは並列実行
```

```bash
# 全モデルを実行
dbt run

# 特定モデルだけ
dbt run --select fct_revenue

# 依存するモデルも含めて実行
dbt run --select +fct_revenue  # 上流も含む
dbt run --select fct_revenue+  # 下流も含む
```

## マテリアライゼーション戦略

```yaml
# dbt_project.yml
models:
  my_project:
    staging:
      +materialized: view         # 毎回クエリを実行（軽い変換向け）
    intermediate:
      +materialized: ephemeral    # CTEとして展開（実体化しない）
    marts:
      +materialized: table        # テーブルとして保存（重い集計向け）
      finance:
        +materialized: incremental  # 差分だけ追加（大規模テーブル向け）
```

### インクリメンタルモデル

```sql
-- models/marts/finance/fct_daily_revenue.sql
{{
  config(
    materialized='incremental',
    unique_key='revenue_date',
    on_schema_change='sync_all_columns'
  )
}}

SELECT
  DATE_TRUNC('day', created_at_utc) AS revenue_date,
  SUM(total_amount) AS total_revenue,
  COUNT(*) AS order_count
FROM {{ ref('stg_orders') }}
WHERE status = 'completed'

{% if is_incremental() %}
  -- 増分実行時: 直近3日分だけ再計算（遅延到着データに対応）
  AND created_at_utc >= (SELECT MAX(revenue_date) - INTERVAL '3 days' FROM {{ this }})
{% endif %}

GROUP BY 1
```

## データテスト

```yaml
# models/staging/schema.yml
version: 2

models:
  - name: stg_orders
    description: "生注文データの標準化"
    columns:
      - name: order_id
        description: "注文の一意ID"
        tests:
          - unique           # 重複チェック
          - not_null         # NULL禁止
      - name: status
        tests:
          - accepted_values:
              values: ['pending', 'completed', 'cancelled']
      - name: customer_id
        tests:
          - relationships:   # 参照整合性チェック
              to: ref('stg_customers')
              field: customer_id
      - name: total_amount
        tests:
          - not_null
          - dbt_utils.accepted_range:  # 拡張パッケージのテスト
              min_value: 0
```

```bash
# テスト実行
dbt test

# 出力例
PASS test.stg_orders.unique_order_id
PASS test.stg_orders.not_null_order_id
FAIL test.stg_orders.accepted_values_status  ← 'refunded'が入っていた
```

## ソースの鮮度チェック

```yaml
# models/staging/sources.yml
sources:
  - name: raw
    database: my_warehouse
    schema: raw
    tables:
      - name: orders
        freshness:
          warn_after: {count: 6, period: hour}   # 6時間更新なしで警告
          error_after: {count: 24, period: hour}  # 24時間でエラー
        loaded_at_field: _loaded_at
```

```bash
# ソースの鮮度確認
dbt source freshness
```

## ドキュメント自動生成

```bash
# ドキュメントサイトを生成
dbt docs generate
dbt docs serve  # ローカルでWebサーバー起動

# → モデルの説明・カラム定義・依存関係グラフがWebで確認できる
```

## モダンデータスタックの全体像

```
データソース（アプリDB・SaaS）
  ↓ Fivetran / Airbyte（Extract + Load）
BigQuery / Snowflake / Redshift（生データ保存）
  ↓ dbt（Transform）
BigQuery / Snowflake（変換済みデータ）
  ↓ Metabase / Tableau / Looker（可視化）
```

## dbt Cloud vs dbt Core

| 観点 | dbt Core | dbt Cloud |
|---|---|---|
| 費用 | 無料（OSS） | 有料 |
| 実行 | ローカル or CI/CD | マネージドスケジューラー |
| IDE | VS Code等 | ブラウザIDE |
| オーケストレーション | Airflow / Prefect と組み合わせ | 内蔵 |

## 関連概念

- → [バッチ処理](./concepts_ddia_batch_processing.md)（ELTパイプラインとの関係）
- → [列指向ストレージ](./concepts_ddia_columnar_storage.md)（DWHとスタースキーマ）
- → [マテリアライズドビュー](./concepts_ddia_materialized_views.md)（dbtのマテリアライゼーションとの類比）
- → [データシステムの統合設計](./concepts_ddia_future.md)（モダンデータスタックの文脈）

## 出典・参考文献

- dbt Documentation — docs.getdbt.com
- Claire Carroll, "What is Analytics Engineering?" — getdbt.com/blog
- dbt-utils package — github.com/dbt-labs/dbt-utils
