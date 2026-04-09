---
category: "概念"
order: 200
title: GitHubデプロイイベントをSlackに通知する
description: GitHub Triggerでpush/deploymentイベントを検知し、デプロイ環境・コミット情報・ステータスをSlackの開発チャンネルにリッチフォーマットで自動通知するワークフロー。
tags: ["n8n", "ユースケース", "GitHub", "Slack", "デプロイ通知", "CI/CD", "DevOps"]
emoji: "🚀"
date: "2026-04-09"
source: "https://docs.n8n.io/integrations/builtin/trigger-nodes/n8n-nodes-base.githubtrigger/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

GitHubのDeployment/Deployment Statusイベントを検知し、デプロイ開始・成功・失敗をSlackに分かりやすく通知する。失敗時はエラー担当者へのメンションも自動で行う。

**解決する課題**: デプロイ状況をSlackで追跡する際の手動確認作業をなくし、チーム全員がリアルタイムで把握できる

**使用するn8nノード:**
- Webhook Trigger（GitHub Webhookイベント受信）
- Switch（イベント種別・ステータスで分岐）
- Slack（Slackブロックキット形式で通知）

## ワークフロー構成

```
[Webhook Trigger: GitHub deployment_status webhook]
    ↓
[Switch: deployment_status.state]
  ├── "pending"  → [Slack: 🔄 デプロイ開始通知]
  ├── "success"  → [Slack: ✅ デプロイ成功通知]
  ├── "failure"  → [Slack: ❌ デプロイ失敗通知（担当者メンション）]
  └── "error"    → [Slack: 🚨 エラー通知]
```

## 実装手順

### Step 1: GitHub Webhookの設定

GitHub側の設定:
```
Repository → Settings → Webhooks → Add webhook
Payload URL: https://your-n8n.example.com/webhook/github-deploy
Content Type: application/json
Events: Deployment, Deployment status
```

### Step 2: Switchノードで状態分岐

```
Mode: Expression
Output 0 (pending):  {{ $json.deployment_status?.state === 'pending' }}
Output 1 (success):  {{ $json.deployment_status?.state === 'success' }}
Output 2 (failure):  {{ $json.deployment_status?.state === 'failure' }}
Output 3 (default):  {{ true }}
```

### Step 3: Slackへのリッチ通知（成功時）

Slackのブロックキット形式でリッチなメッセージを送信する。

```
Resource: Message
Operation: Send
Channel: #deployments
Blocks (JSON):
[
  {
    "type": "header",
    "text": { "type": "plain_text", "text": "✅ デプロイ成功" }
  },
  {
    "type": "section",
    "fields": [
      { "type": "mrkdwn", "text": "*リポジトリ:*\n{{ $json.repository.full_name }}" },
      { "type": "mrkdwn", "text": "*環境:*\n{{ $json.deployment.environment }}" },
      { "type": "mrkdwn", "text": "*ブランチ:*\n{{ $json.deployment.ref }}" },
      { "type": "mrkdwn", "text": "*実行者:*\n{{ $json.sender.login }}" }
    ]
  },
  {
    "type": "actions",
    "elements": [
      { "type": "button", "text": { "type": "plain_text", "text": "デプロイを見る" },
        "url": "{{ $json.deployment_status.target_url }}" }
    ]
  }
]
```

### Step 4: 失敗時の担当者メンション

```
Text: ❌ デプロイ失敗 <@U_ONCALL_USER_ID>
確認をお願いします: {{ $json.deployment_status.log_url }}
```

## ポイント・注意事項

- GitHub AppよりPersonal Access TokenのWebhookは組織全体に設定できない。組織Webhookには管理者権限が必要
- Slackのブロックキット形式は `blocks` フィールドに配列を渡す。n8nのJSON入力で直接記述できる
- デプロイ担当者のGitHub usernameからSlack IDへのマッピングテーブルをGoogleシートで管理するパターンが運用しやすい

## 関連機能

- [主要インテグレーション](./concepts_n8n_integrations.md)
- [トリガーの種類](./concepts_n8n_triggers.md)
- [ロジック制御](./concepts_n8n_logic_flow.md)
