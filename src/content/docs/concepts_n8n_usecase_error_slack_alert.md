---
category: "概念"
order: 230
title: APIエラー発生時にSlackへアラートを送る
description: n8nのError Triggerワークフローを使い、任意のワークフローでエラーが発生した際にSlackへ詳細なアラートを自動送信する監視パターン。
tags: ["n8n", "ユースケース", "エラーアラート", "Slack", "Error Trigger", "監視", "オンコール"]
emoji: "🚨"
date: "2026-04-09"
source: "https://docs.n8n.io/flow-logic/error-handling/error-workflows/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

専用の「エラー監視ワークフロー」を作成し、全ワークフローのエラーを一元的にSlackへ通知する。エラーの内容・発生ワークフロー・実行URLを含む詳細な通知を送る。

**解決する課題**: 本番ワークフローのサイレント失敗を検知できず、問題に気づかない状況をなくす

**使用するn8nノード:**
- Error Trigger（エラーイベント受信）
- IF（エラー種別による分岐）
- Slack（アラート送信）

## ワークフロー構成

**エラー監視ワークフロー（専用）:**

```
[Error Trigger]
    ↓
[IF: エラーが4xxか5xxか]
  ├── 4xx (クライアントエラー) → [Slack: #dev-alerts（警告レベル）]
  └── 5xx (サーバーエラー) → [Slack: #oncall（緊急レベル）+ メンション]
```

**各ワークフローの設定:**

```
Settings → Error Workflow → エラー監視ワークフローを選択
```

## 実装手順

### Step 1: エラー監視ワークフローの作成

新規ワークフローを作成し、最初のノードとして **Error Trigger** を設置する。

Error Triggerで利用できるデータ:
```json
{
  "workflow": {
    "id": "123",
    "name": "Order Processing"
  },
  "execution": {
    "id": "456",
    "url": "https://your-n8n.com/workflow/123/executions/456",
    "error": {
      "message": "Request failed with status code 503",
      "name": "NodeApiError",
      "httpCode": "503",
      "node": { "name": "HTTP Request", "type": "n8n-nodes-base.httpRequest" }
    },
    "lastNodeExecuted": "HTTP Request"
  }
}
```

### Step 2: エラー種別の判定（IFノード）

```
Condition: {{ parseInt($json.execution.error.httpCode || '0') }} >= 500
true  → サーバーエラー（5xx）
false → クライアントエラー（4xx）または非HTTPエラー
```

### Step 3: Slackアラート送信

**緊急時（5xx）:**
```
Channel: #oncall
Text: 🚨 *本番エラー発生* <!here>

*ワークフロー:* {{ $json.workflow.name }}
*エラーノード:* {{ $json.execution.error.node?.name }}
*エラー内容:* {{ $json.execution.error.message }}
*HTTPコード:* {{ $json.execution.error.httpCode }}
*実行ログ:* {{ $json.execution.url }}
```

**警告時（4xx）:**
```
Channel: #dev-alerts
Text: ⚠️ ワークフローエラー

*ワークフロー:* {{ $json.workflow.name }}
*エラー:* {{ $json.execution.error.message }}
```

### Step 4: 監視対象ワークフローへの設定

各ワークフローの設定を変更する:
```
Workflow Settings → Error Workflow → 「エラー監視ワークフロー」を選択
```

## ポイント・注意事項

- Error Triggerはワークフロー全体が停止した時のみ発火する。ノードの `Continue on Error` 設定だとエラーが吸収されて発火しない
- Error Workflowを設定しない場合、エラーはn8n管理画面のExecutionsにのみ記録される
- Slackの `<!here>` はチャンネルのオンラインメンバー全員にメンション。深夜の誤発火に注意

## 関連機能

- [エラーハンドリング・デバッグ](./concepts_n8n_error_handling.md)
- [主要インテグレーション](./concepts_n8n_integrations.md)
