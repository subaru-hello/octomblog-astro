---
category: "概念"
order: 120
title: n8nトリガーの種類（Webhook・スケジュール・イベント）
description: n8nワークフローを起動するトリガーの種類と使い分け。Webhookトリガー・スケジュールトリガー・アプリイベントトリガーの設定方法を解説。
tags: ["n8n", "トリガー", "Webhook", "スケジュール", "イベント駆動"]
emoji: "⚡"
date: "2026-04-09"
source: "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/"
series:
  - n8nワークフロー自動化
---

## トリガーとは

ワークフローを起動する「きっかけ」。n8nでは複数のトリガー種別が用意されており、用途に応じて使い分ける。

## トリガーの種類

### 1. Webhook Trigger

外部サービスからのHTTPリクエストを受け付けて起動する。

```
外部サービス → HTTP POST → n8n Webhook URL → ワークフロー起動
```

**設定項目:**

| 設定 | 説明 |
|---|---|
| HTTP Method | GET / POST / PUT / DELETE |
| Authentication | None / Basic Auth / Header Auth |
| Response Mode | 即時応答 / ワークフロー完了後に応答 |
| Path | URLのパス（例: `/stripe-webhook`） |

**用途**: Stripe決済通知、GitHub Push通知、フォーム送信受信

### 2. Schedule Trigger（Cron）

指定した時刻・間隔でワークフローを定期実行する。

```
毎日 09:00 → ワークフロー起動
```

**設定例:**

| パターン | Cron式 |
|---|---|
| 毎日09:00 | `0 9 * * *` |
| 毎週月曜08:00 | `0 8 * * 1` |
| 毎時0分 | `0 * * * *` |
| 5分おき | `*/5 * * * *` |

**用途**: 定期レポート生成、バッチ処理、ヘルスチェック

### 3. アプリ固有のTrigger

各サービスのイベントを監視して起動する。ポーリングまたはWebhook経由。

| Trigger名 | 起動条件 |
|---|---|
| Gmail Trigger | 特定条件のメール受信時 |
| Slack Trigger | メッセージ受信・リアクション追加時 |
| GitHub Trigger | PR作成・マージ・Issueオープン時 |
| Airtable Trigger | レコード作成・更新時 |
| Typeform Trigger | フォーム回答送信時 |

### 4. Manual Trigger

UIの「Test workflow」ボタンで手動起動。開発・テスト専用。

### 5. Chat Trigger

n8nのAIチャットインターフェースからの入力で起動。AIエージェントの起点として使用。

## Webhookの認証設定

本番Webhookには認証を必ず設定する。

```
Header Auth: X-Webhook-Secret: your-secret-token
```

Stripeなど署名検証が必要なサービスはCodeノードでHMAC検証を実装する。

## ユースケース

| ユースケース | 説明 | リンク |
|---|---|---|
| Stripe決済Webhook | 決済完了イベントを受信して後処理 | [→ doc](./concepts_n8n_usecase_stripe_webhook.md) |
| 週次レポート | スケジュールで自動生成・送信 | [→ doc](./concepts_n8n_usecase_weekly_report.md) |
| Gmail→Notion | メール受信でチケット自動作成 | [→ doc](./concepts_n8n_usecase_gmail_to_notion.md) |

## 公式ドキュメント

- https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/
- https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/
