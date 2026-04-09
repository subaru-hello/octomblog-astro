---
title: データコントラクト
description: Producer/Consumer間のスキーマ契約を組織的に管理する仕組み。「誰かがスキーマを変えたら下流が壊れた」問題を防ぐデータコントラクトの設計と運用を理解する
category: "概念"
tags: ["データ設計", "データコントラクト", "スキーマ管理", "データ品質", "マイクロサービス", "DDIA"]
emoji: "📜"
date: "2026-04-09"
order: 848
series:
  - データ志向アプリケーション設計（DDIA）
source: "Chad Sanderson, 'Data Contracts: An Introduction' / Martin Kleppmann, DDIA Chapter 4"
---

## 定義

**データコントラクト（Data Contract）**：データのProducer（生成者）とConsumer（消費者）の間で合意された、データの形式・品質・鮮度・意味論の明示的な契約。コードのAPIドキュメントに相当するデータの世界の取り決め。

## なぜデータコントラクトが必要か

```
典型的な問題（コントラクトなし）:
  注文サービスチーム:
    「orders.total_amountを税込みに変えたので念のため連絡します」
    → Slackに流れていたが誰も見ていなかった
    
  3週間後:
    データサイエンスチーム: 「売上レポートの数値がおかしい」
    BI チーム: 「ダッシュボードの計算が全部ずれている」
    請求システム: 「二重請求が発生していた」
    
  原因: total_amountの意味が変わったことを誰も知らなかった
```

```
API（コード）の世界:
  型定義・OpenAPI仕様・テスト → 変更があれば静的解析・CIで検出
  
データパイプラインの世界（コントラクトなし）:
  Kafkaのスキーマ・DBのカラム → 変更しても誰も気づかない
  下流のパイプラインが壊れてから初めて発覚
```

## データコントラクトの構成要素

```yaml
# data-contract.yaml（例）
apiVersion: v2.0.0
kind: DataContract
id: orders-v1
info:
  title: Orders Data Contract
  version: 1.2.0
  owner: order-team@example.com
  description: "注文データのProducer/Consumer間の契約"

servers:
  - type: kafka
    topic: orders.completed
  - type: bigquery
    project: my-project
    dataset: analytics
    table: orders

schema:
  type: object
  required: [order_id, customer_id, total_amount, status, created_at]
  properties:
    order_id:
      type: string
      format: uuid
      description: "注文の一意ID"
    customer_id:
      type: string
      format: uuid
    total_amount:
      type: number
      description: "税抜き価格（円）"  ← 意味論を明示
      minimum: 0
    status:
      type: string
      enum: [pending, completed, cancelled]
    created_at:
      type: string
      format: date-time

quality:
  - type: not_null
    columns: [order_id, customer_id, total_amount]
  - type: unique
    columns: [order_id]
  - type: freshness
    column: created_at
    max_delay: PT1H  # 最大1時間遅延を許容

terms:
  usage: "請求・分析目的に限定"
  limitations: "個人情報を含む。GDPRポリシー準拠必須"
  noticePeriod: P3M  # 変更時は3ヶ月前に通知
```

## スキーマレジストリとの違い

```
スキーマレジストリ（Confluent Schema Registry等）:
  技術的な契約：バイナリフォーマットの互換性チェック
  「このAvro/ProtobufのフィールドをConsumerが読めるか」

データコントラクト:
  ビジネス的な契約：意味・品質・SLA・ガバナンス
  「このフィールドは何を意味するか、いつ更新されるか、誰が責任者か」

両方を組み合わせるのが現代的なアプローチ
```

## データコントラクトのテスト

```python
# Great Expectations（データ品質テストフレームワーク）
import great_expectations as gx

context = gx.get_context()
datasource = context.sources.add_pandas_filesystem(
    name="orders",
    base_directory="./data"
)

# コントラクトをテストとして定義
suite = context.add_or_update_expectation_suite("orders_contract")
validator = context.get_validator(...)

validator.expect_column_to_exist("order_id")
validator.expect_column_values_to_not_be_null("order_id")
validator.expect_column_values_to_be_unique("order_id")
validator.expect_column_values_to_be_between(
    "total_amount", min_value=0
)
validator.expect_column_values_to_be_in_set(
    "status", ["pending", "completed", "cancelled"]
)

# パイプラインの最初と最後で実行
results = validator.validate()
if not results.success:
    raise DataContractViolationError(results)
```

## 変更管理プロセス

```
コントラクトの変更が必要になった場合:

後方互換な変更（Consumerへの通知のみ）:
  ✅ オプションフィールドの追加
  ✅ フィールドの説明文の変更
  ✅ 品質基準の緩和

非互換な変更（3ヶ月前の通知必須）:
  ❌ フィールドの削除
  ❌ 型の変更（string → int）
  ❌ 意味論の変更（税抜き → 税込み）
  ❌ enumの値の削除

Expand-Contractパターンとの対応:
  1. 新フィールド total_amount_with_tax を追加（Expand）
  2. Consumerが新フィールドに移行（Migrate）
  3. total_amount を deprecated にする（3ヶ月待つ）
  4. 旧フィールドを削除（Contract）
```

## データコントラクトツール

| ツール | 特徴 |
|---|---|
| **soda-core** | SQLベースのデータ品質テスト。YAMLでコントラクトを定義 |
| **Great Expectations** | Pythonベース。テストとドキュメントを生成 |
| **datacontract-cli** | OpenDataContract仕様のCLIツール。lint・test・export |
| **dbt tests** | dbtパイプライン内での品質チェック |
| **Monte Carlo** | データオブザーバビリティ（ML異常検知） |

```bash
# datacontract-cliの使い方
pip install datacontract-cli

# コントラクトの検証
datacontract lint datacontract.yaml

# 実際のデータに対してテスト
datacontract test datacontract.yaml

# HTMLドキュメントの生成
datacontract export --format html datacontract.yaml
```

## データメッシュとの関係

[データシステムの統合設計](./concepts_ddia_future.md)で触れたデータメッシュでは、データコントラクトが「データプロダクト」の仕様書として機能する。

```
データプロダクト = データ + コントラクト + オーナーシップ

注文ドメインチーム（Producer）:
  data-contract.yaml に署名
  → SLAを保証（鮮度・品質）
  → 変更時はnoticePeriodを守る

BIチーム・データサイエンスチーム（Consumer）:
  コントラクトに合意してからパイプラインを構築
  → コントラクト違反があれば自動通知される
  → Producerに変更を要求できる
```

## 関連概念

- → [エンコーディングとスキーマ進化](./concepts_ddia_encoding.md)（技術的な互換性管理）
- → [dbtとデータ変換パイプライン](./concepts_ddia_dbt_pipeline.md)（dbt testsとの組み合わせ）
- → [ストリーム処理](./concepts_ddia_stream_processing.md)（KafkaのSchema Registryとの補完）
- → [データシステムの統合設計](./concepts_ddia_future.md)（データメッシュの文脈）

## 出典・参考文献

- Chad Sanderson, "Data Contracts: An Introduction" (2022) — datacontract.com
- Open Data Contract Standard — bitol.io/open-data-contract-standard
- dbt Documentation, "Data Tests" — docs.getdbt.com/docs/build/data-tests
