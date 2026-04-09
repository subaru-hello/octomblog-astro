---
category: "概念"
order: 217
title: 新規ユーザー登録時にWelcomeメールを自動送信する
description: WebhookでユーザーDB登録を検知し、SendGrid/Gmailでパーソナライズされたウェルカムメールを自動送信するワークフロー。
tags: ["n8n", "ユースケース", "メール", "SendGrid", "Gmail", "ユーザー登録", "自動化"]
emoji: "📧"
date: "2026-04-09"
source: "https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.sendgrid/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

バックエンドがユーザー登録完了時にn8nのWebhookを呼び出し、n8nがウェルカムメールを送信する。メール内容はユーザー属性に応じてパーソナライズできる。

**解決する課題**: バックエンドコードにメール送信ロジックを組み込まず、ノーコードで柔軟にメール内容を変更できる

**使用するn8nノード:**
- Webhook Trigger（登録イベント受信）
- IF（ユーザープランで分岐）
- SendGrid または Gmail（メール送信）

## ワークフロー構成

```
[Webhook Trigger: POST /user-registered]
    ↓
[IF: plan == "pro"]
  ├── true  → [SendGrid: Proプランウェルカムメール]
  └── false → [SendGrid: 無料プランウェルカムメール]
```

## 実装手順

### Step 1: Webhook Triggerの設定

```
HTTP Method: POST
Path: user-registered
Authentication: Header Auth（X-Internal-Secret）
Response Mode: Immediately
```

バックエンドからの送信ペイロード例:
```json
{
  "userId": "u_123",
  "email": "alice@example.com",
  "name": "Alice",
  "plan": "pro",
  "language": "ja"
}
```

### Step 2: IFノードでプラン分岐

```
Condition: {{ $json.plan }} equals "pro"
```

### Step 3: SendGridでメール送信

```
To Email: {{ $json.email }}
From Email: noreply@yourapp.com
Subject: 【YourApp】ご登録ありがとうございます！

HTML Body:
<h1>{{ $json.name }} さん、ようこそ！</h1>
<p>{{ $json.plan === 'pro' ? 'Proプラン' : '無料プラン' }}でのご登録ありがとうございます。</p>
```

### Step 4: Webhookレスポンスを返却

```
Respond to Webhook:
Status Code: 200
Body: { "success": true }
```

## ポイント・注意事項

- SendGridはトランザクションメールに適している。無料プランで月100通まで送信可能
- HTMLメールのテンプレートはn8n外で管理し、SendGridのテンプレートIDを指定する方法もある
- 送信失敗時はError Branchでエラーログを記録し、管理者に通知する

## 関連機能

- [ワークフローの基本](./concepts_n8n_workflow_basics.md)
- [トリガーの種類](./concepts_n8n_triggers.md)
- [エラーハンドリング](./concepts_n8n_error_handling.md)
