---
category: "概念"
order: 107
title: マルチエージェントオーケストレーション（Dify実践）
description: 複数の専門エージェントを役割分担させ、複雑なリサーチや意思決定タスクを自律的にこなすDify設計パターン。
tags: ["Dify", "マルチエージェント", "オーケストレーション", "API", "可観測性", "ユースケース"]
emoji: "🕸️"
date: "2026-04-09"
source: "Dify公式ドキュメント https://docs.dify.ai"
series:
  - Difyユースケース
---

## シナリオ概要

**課題**: 競合分析レポートを作りたい。「競合の最新情報収集」「財務データ分析」「SWOT分析」「レポート執筆」が必要だが、1つのエージェントに全部やらせるとコンテキストが爆発し精度も下がる。

**解決策**: 専門エージェントに役割分担させ、オーケストレーターが調整する。

```
[オーケストレーター（Workflow）]
  ├── [Research Agent: 最新情報収集]
  │     ツール: Google Search, Web Scraping
  │     → competitor_info
  ├── [Finance Agent: 財務分析]
  │     ツール: Financial Data API
  │     → financial_analysis
  └── [Writer Agent: レポート執筆]
        入力: competitor_info + financial_analysis
        → final_report
```

---

## 使用する Dify 機能

| 機能 | 役割 |
|---|---|
| [ツール・プラグイン](concepts_dify_tools_plugins.md) | 各エージェントのツール |
| [API・デプロイ](concepts_dify_api_deployment.md) | ワークフローをAPIとして公開・連携 |
| [可観測性・デバッグ](concepts_dify_observability.md) | 複雑な実行の追跡 |
| [エージェント機能](concepts_dify_agents.md) | 各専門エージェントの設計 |
| [変数システム](concepts_dify_variables.md) | エージェント間のデータ受け渡し |

---

## パターン1: 1つのワークフロー内でAgent ノードを並列配置

最もシンプルな方法。単一ワークフロー内でエージェントを並列実行する。

```
Workflow 構成:

[Start]
  │ {{company}}: 分析対象企業名
  ▼
[並列実行]
  ├── [Agent A: リサーチエージェント]
  │     system: "Web検索で最新情報を収集してください"
  │     tools: [google_search, web_scraper]
  │     max_iterations: 5
  │     → {{research.result}}
  │
  ├── [Agent B: 財務エージェント]
  │     system: "財務データを取得・分析してください"
  │     tools: [financial_api, calculator]
  │     max_iterations: 3
  │     → {{finance.result}}
  │
  └── [Agent C: SNS分析エージェント]
        system: "SNSでの評判を分析してください"
        tools: [twitter_search, sentiment_analyzer]
        max_iterations: 3
        → {{social.result}}
  ▼
[LLM: 統合レポート執筆]
  │ 3つのエージェントの出力を統合して最終レポートを生成
  ▼
[End]
  出力: 競合分析レポート
```

---

## パターン2: ワークフロー間の連携（マイクロサービス的）

各専門ワークフローを独立してデプロイし、API 経由で連携する。

```
専門ワークフロー（別々のDify Workflow）:

  [research-workflow]  → API: POST /v1/workflows/run
  [finance-workflow]   → API: POST /v1/workflows/run
  [report-workflow]    → API: POST /v1/workflows/run

オーケストレーター（メインワークフロー）:

[Start]
  │ company = "Competitor Corp"
  ▼
[並列HTTP Request]
  ├── POST https://api.dify.ai/v1/workflows/run
  │   body: {inputs: {company}, app_id: "research-workflow-id"}
  │   → {{research_task_id}}
  │
  └── POST https://api.dify.ai/v1/workflows/run
      body: {inputs: {company}, app_id: "finance-workflow-id"}
      → {{finance_task_id}}
  ▼
[Code: 非同期結果を待つ]
  │ polling で完了を確認（または Webhook を使う）
  ▼
[HTTP Request: 結果取得]
  │ GET /v1/workflow-runs/{{research_task_id}}
  │ GET /v1/workflow-runs/{{finance_task_id}}
  ▼
[Agent: 統合レポート]
  ▼
[End]
```

---

## パターン3: 自己修正ループ（Reflexion パターン）

エージェントが自分の出力を評価して改善するパターン。

```
[Agent: 初期レポート生成]
  → {{draft}}
  ▼
[LLM: 品質評価]
  │ プロンプト: "このレポートの品質を0〜10で評価し、改善点を指摘してください"
  │ → {{quality_score}}, {{feedback}}
  ▼
[Conditional Branch]
  ├── score >= 8  → [End: 品質OK、レポートを返す]
  └── score < 8   → [Agent: フィードバックを元に改善]
                         → ループ（最大3回）
```

---

## Handoff パターン（エージェント間の引き渡し）

専門エージェントが「別のエージェントに渡す」判断をするパターン。

```
[Question Classifier Agent]
  │ ユーザー入力を分析
  │ "この質問はどの専門エージェントが最適か？"
  ▼
  ├── 法律関係  → [Legal Agent]
  ├── 技術関係  → [Tech Agent]
  ├── 財務関係  → [Finance Agent]
  └── 複合質問  → [Research Agent → 複数エージェントへ順次渡す]

各エージェントは完了後、必要なら次のエージェントへ渡す情報を生成する。
```

---

## 可観測性：複雑なフローの追跡

マルチエージェントは実行が複雑なため、可観測性が特に重要。

```
Langfuse での追跡設定:

各エージェントに Metadata を付与:
  - agent_name: "research-agent"
  - agent_iteration: 3
  - tools_used: ["google_search", "web_scraper"]

Langfuse で確認できること:
  - どのエージェントが何回ツールを呼んだか
  - トータルコストの内訳（エージェントごと）
  - ボトルネックノードのレイテンシ
  - エラーが発生したエージェントとその原因

タグ設定で絞り込み:
  - env: production
  - workflow: competitive-analysis
  - team: sales-research
```

---

## コスト管理

```
マルチエージェントはコストが膨らみやすい:

コスト見積もり方法:
  1. 各エージェントの平均トークン数を Logs から確認
  2. max_iterations × 平均トークン × 料金 = 1回の最大コスト
  3. 月間実行回数 × 1回コスト = 月間予算

コスト削減戦略:
  a. 軽量モデルを使う
     Research Agent: GPT-4o mini（情報収集は精度より速度）
     Writer Agent: Claude 3.5 Sonnet（最終出力は高品質モデル）

  b. max_iterations を絞る
     情報収集系: max_iterations = 3 で十分なことが多い

  c. 並列化でレイテンシを短縮
     待ち時間を減らすだけでなく、タイムアウトリスクも減る
```

---

## 設計のベストプラクティス

```
1. 各エージェントの責務を明確に
   × 「何でもやる汎用エージェント」
   ○ 「Web検索のみを担当する専門エージェント」

2. エージェント間のインターフェースを標準化
   常に同じJSONスキーマで出力する
   → オーケストレーターが依存しやすい

3. フォールバックを設計する
   エージェントAが失敗してもエージェントBの結果で続行できるよう設計
   [Variable Aggregator] で "null合流" を処理

4. Human-in-the-loop を組み込む
   重要な判断前に [Human Input ノード] で確認
   例: 「このレポートを顧客に送信してもよいですか？」

5. イテレーションに上限を設ける
   max_iterations を必ず設定する（無限ループ防止）
   予算上限も Environment Variables で管理
```

---

## 参考：他のユースケース

- [コードレビュー自動化](concepts_dify_usecase_code_review.md) — 単一エージェントの実践例
- [可観測性・デバッグ](concepts_dify_observability.md) — 複雑なフローの監視設計
- [API・デプロイ](concepts_dify_api_deployment.md) — ワークフロー間の API 連携
