---
category: "概念"
order: 100
title: n8n概要 - ワークフロー自動化プラットフォーム
description: n8nはオープンソースのワークフロー自動化ツール。400以上のインテグレーションとAI機能を備え、ノーコード〜フルコードで自動化を構築できる。
tags: ["n8n", "ワークフロー自動化", "ノーコード", "iPaaS", "オープンソース"]
emoji: "🔄"
date: "2026-04-09"
source: "https://docs.n8n.io/"
series:
  - n8nワークフロー自動化
---

## n8nとは

n8n（*nodemation*）は、ビジュアルエディタでワークフローを構築できるオープンソースの自動化プラットフォーム。ZapierやMake（旧Integromat）と同カテゴリだが、**セルフホスト可能**かつ**コードで拡張できる**点が特徴。

### 主な特徴

| 特徴 | 説明 |
|---|---|
| 400以上のインテグレーション | Slack、Gmail、GitHub、Salesforce、Stripe等に標準対応 |
| AI/LLMネイティブ | LangChain統合によるAIエージェント・RAG構築が標準機能 |
| セルフホスト対応 | Docker / npm でオンプレ運用可能。データを自社管理できる |
| Codeノード | JavaScriptまたはPythonで任意の処理を記述可能 |
| フェアコードライセンス | ソース公開・自由利用だが商用SaaS再販は制限あり |

## アーキテクチャの概観

```
[Trigger] → [Node 1] → [Node 2] → ... → [Output]
              ↓ (エラー時)
           [Error Handler]
```

- **Trigger（起点）**: Webhook受信、スケジュール、外部サービスのイベント
- **Node（処理単位）**: データ変換・API呼び出し・条件分岐など
- **Connection（矢印）**: ノード間のデータフロー

## シリーズ構成

このシリーズでは以下の順でn8nの機能を解説する。

| # | カテゴリ | ドキュメント |
|---|---|---|
| 1 | コア | [ワークフローの基本](./concepts_n8n_workflow_basics.md) |
| 2 | トリガー | [トリガーの種類](./concepts_n8n_triggers.md) |
| 3 | ロジック | [ロジック制御](./concepts_n8n_logic_flow.md) |
| 4 | API連携 | [HTTP Request・API連携](./concepts_n8n_http_api.md) |
| 5 | インテグレーション | [主要インテグレーション](./concepts_n8n_integrations.md) |
| 6 | 信頼性 | [エラーハンドリング・デバッグ](./concepts_n8n_error_handling.md) |
| 7 | AI | [AI・LLMエージェント](./concepts_n8n_ai_agents.md) |
| 8 | カスタム処理 | [Codeノード](./concepts_n8n_code_node.md) |
| 9 | 運用 | [エンタープライズ機能](./concepts_n8n_enterprise.md) |

## n8n vs 競合比較

| 観点 | n8n | Zapier | Make |
|---|---|---|---|
| セルフホスト | ✅ | ❌ | ❌ |
| コード拡張 | ✅ JS/Python | ❌ | 限定的 |
| AI/LLM | ✅ ネイティブ | 追加コスト | 追加コスト |
| 料金 | セルフホスト無料 | 有料 | 有料 |
| 学習コスト | 中 | 低 | 中 |

## 公式ドキュメント

- https://docs.n8n.io/
- https://n8n.io/workflows/（テンプレートギャラリー）
