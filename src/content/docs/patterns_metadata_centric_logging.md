---
title: "メタデータ中心ロギング（Metadata-Centric Logging）"
description: "ログに記録するのはメタデータ（誰が・いつ・どこで・どのくらい・結果は何か）に限定し、コンテンツ（ユーザー入力・LLMの出力・ファイルの中身）を含めないアプローチ。"
category: "フレームワーク"
tags: []
date: "2026-04-01"
emoji: "🔌"
order: 1
series:
  - SREワークブック
---

## 定義

ログに記録するのは**メタデータ**（誰が・いつ・どこで・どのくらい・結果は何か）に限定し、**コンテンツ**（ユーザー入力・LLMの出力・ファイルの中身）を含めないアプローチ。

```
# 悪い例（content ありのログ）
{ "user_message": "私の住所は東京都...", "llm_response": "はい、承りました..." }

# 良い例（metadata のみのログ）
{ "session_id": "abc123", "tokens_used": 342, "latency_ms": 1200, "model": "gpt-4o" }
```

## なぜ重要か

**PII（個人情報）混入リスクの低減**

AIエージェントやチャットシステムでは、ユーザーの入力に氏名・住所・クレジットカード番号・医療情報などが含まれる可能性がある。ログにコンテンツを記録すると：

- ログストレージが個人データの保管場所になり、GDPR等の規制対象になる
- ログの閲覧権限を持つ開発者・運用者全員が個人データにアクセスできてしまう
- ログのバックアップ・転送先（監視SaaS等）にも個人データが漏出する

ICOのデータ最小化原則（Data Minimisation）は「目的に必要な最小限のデータのみ処理する」を求めており、ログに不必要なコンテンツを残すことはこれに反する。

## Canonical Completion Log パターン

**1リクエスト = 1ログエントリ**で最終状態のみを記録するパターン。

処理の途中経過を逐次ログに書くのではなく、リクエストが完了（または失敗）した時点で、1つの構造化ログエントリを出力する。

```json
{
  "timestamp": "2026-04-02T10:00:00Z",
  "trace_id": "abc123",
  "session_id": "xyz789",
  "duration_ms": 1450,
  "tokens_input": 512,
  "tokens_output": 128,
  "model": "gpt-4o",
  "status": "success",
  "failure_domain": null,
  "failure_stage": null
}
```

**メリット：**
- ログ量が予測可能（リクエスト数に比例）
- 1エントリで1リクエストの全体像が把握できる
- クエリ・集計が容易

## failure_domain と failure_stage

障害発生時に「どこで・どの段階で壊れたか」を構造化して記録するためのフィールド。

| フィールド | 役割 | 値の例 |
|---|---|---|
| `failure_domain` | **どのシステム境界で**失敗したか | `llm_provider`, `tool_execution`, `database`, `external_api` |
| `failure_stage` | **どの処理段階で**失敗したか | `planning`, `tool_call`, `validation`, `response_generation` |

```json
{
  "status": "error",
  "failure_domain": "llm_provider",
  "failure_stage": "response_generation",
  "error_code": "rate_limit_exceeded"
}
```

この2つを組み合わせることで、障害のダッシュボードやアラートを「LLMプロバイダのレート制限によるエラーが急増している」のように具体的に分類できる。

## 適用場面

- LLMを使ったチャット・エージェントシステムのログ設計
- マイクロサービス間のリクエスト完了ログ
- 監査ログが必要なシステム（金融・医療・EC）

## 関連概念

- → [オブザーバビリティ](../concepts/observability.md)
- → [ログにはメタデータを記録する](../../rules/log_metadata_not_content.md)（行動規範）

## 出典

- [OpenTelemetry Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/)
- [OpenTelemetry Messaging Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/messaging/)
- [OpenTelemetry Sensitive Data Guidance](https://opentelemetry.io/docs/specs/otel/overview/#sensitive-data)
- [ICO Data Minimisation Principle](https://ico.org.uk/for-organisations/guide-to-data-protection/guide-to-the-general-data-protection-regulation-gdpr/principles/data-minimisation/)
