---
category: "概念"
order: 218
title: StripeのWebhookで決済完了を検知して処理する
description: Stripeの決済完了イベントをn8nのWebhookで受信し、署名検証後に領収書メール送信・DBレコード更新・Slack通知を実行するワークフロー。
tags: ["n8n", "ユースケース", "Stripe", "Webhook", "決済", "署名検証", "HMAC"]
emoji: "💳"
date: "2026-04-09"
source: "https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.stripe/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

Stripeで決済完了（`payment_intent.succeeded`）イベントが発生すると、n8nが署名を検証してから後処理（領収書送信・DB更新・Slack通知）を実行する。

**解決する課題**: Stripeの決済完了後の後処理を一元管理し、バックエンドの負担を軽減

**使用するn8nノード:**
- Webhook Trigger（Stripe Webhookイベント受信）
- Code（HMAC署名検証）
- IF（イベント種別の分岐）
- HTTP Request（自社APIへのDB更新リクエスト）
- Gmail（領収書メール送信）
- Slack（支払い通知）

## ワークフロー構成

```
[Webhook Trigger: POST /stripe-webhook]
    ↓
[Code: HMAC-SHA256 署名検証]
    ↓
[IF: event.type == "payment_intent.succeeded"]
  ├── true  → [HTTP Request: 自社API DB更新]
  │               ↓
  │           [Gmail: 領収書メール送信]
  │               ↓
  │           [Slack: 支払い通知]
  └── false → スキップ
```

## 実装手順

### Step 1: Webhook Triggerの設定

```
HTTP Method: POST
Path: stripe-webhook
Response Mode: Immediately（署名検証前に200を返す）
```

**重要**: Stripeは応答が遅いとWebhookをリトライするため、処理完了を待たずに即200を返す。

### Step 2: HMAC署名検証（Codeノード）

```javascript
const crypto = require('crypto');

const stripeSignature = $input.first().headers['stripe-signature'];
const rawBody = $input.first().binary?.data
  ? Buffer.from($input.first().binary.data, 'base64').toString('utf8')
  : JSON.stringify($input.first().json);

const webhookSecret = $env.STRIPE_WEBHOOK_SECRET;
const timestamp = stripeSignature.split(',')[0].replace('t=', '');
const signature = stripeSignature.split(',')[1].replace('v1=', '');

const expectedSig = crypto
  .createHmac('sha256', webhookSecret)
  .update(`${timestamp}.${rawBody}`)
  .digest('hex');

if (signature !== expectedSig) {
  throw new Error('Invalid Stripe signature');
}

return $input.all();
```

### Step 3: イベント種別の分岐

```
Condition: {{ $json.type }} equals "payment_intent.succeeded"
```

### Step 4: 領収書メール送信

```
To: {{ $json.data.object.receipt_email }}
Subject: お支払い確認 - ¥{{ $json.data.object.amount.toLocaleString() }}
```

## ポイント・注意事項

- Stripe署名検証は必須。署名なしのWebhookを処理するとセキュリティリスクになる
- Webhook Secretは Stripe Dashboard → Developers → Webhooks で取得し、n8n環境変数に設定する
- `payment_intent.succeeded` 以外にも `checkout.session.completed` など複数のイベントがある

## 関連機能

- [トリガーの種類](./concepts_n8n_triggers.md)
- [Codeノード](./concepts_n8n_code_node.md)
- [エラーハンドリング](./concepts_n8n_error_handling.md)
