---
category: "概念"
order: 247
title: 経営ダッシュボードを毎朝Slackに自動配信する
description: 売上・ユーザー数・CS問い合わせ・サーバー状態などの主要KPIを複数APIから自動集計し、AIの分析コメント付きで毎朝Slackに配信するエグゼクティブ向けワークフロー。
tags: ["n8n", "ユースケース", "経営ダッシュボード", "KPI", "自動レポート", "経営者向け", "意思決定"]
emoji: "📊"
date: "2026-04-09"
source: "https://docs.n8n.io/advanced-ai/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

毎朝7時に売上・新規ユーザー・解約率・CS問い合わせ数・サーバー稼働状況を各APIから自動集計し、AIが前日比コメントを付けてSlackのCEOチャンネルに配信する。

**解決する課題**: 毎朝5〜6つのダッシュボードを手動確認していた経営陣の時間（約30分/日）を削減し、1つのSlackメッセージですべての状況を把握できる

**使用するn8nノード:**
- Schedule Trigger（毎朝7時）
- HTTP Request × 複数（各KPI API）
- Merge（データ統合）
- Code（前日比計算・異常検知）
- OpenAI Chat Model（分析コメント生成）
- Slack（配信）

## ワークフロー構成

```
[Schedule Trigger: 毎日07:00 JST]
    ↓（並列取得）
[HTTP Request: 売上API]              ─┐
[HTTP Request: ユーザー数API]         ─┤
[HTTP Request: CS問い合わせAPI]       ─┤→ [Merge]
[HTTP Request: サーバー稼働API]       ─┤
[HTTP Request: 広告費・CVR API]      ─┘
    ↓
[Code: KPI計算・前日比・異常検知]
    ↓
[OpenAI: 注目すべき指標のコメント生成]
    ↓
[Slack: #executive に配信]
```

## 実装手順

### Step 1: 各KPI APIの並列呼び出し

5つのHTTP Requestノードを並列に配置する（同じSchedule Triggerから接続）。

**売上API（例: Stripe）:**
```
GET https://api.stripe.com/v1/balance_transactions?created[gte]={{ 昨日00:00のUNIXタイム }}&created[lte]={{ 昨日23:59のUNIXタイム }}&limit=100
Headers: Authorization: Bearer {{ $credentials.stripeKey }}
```

**ユーザー数API（例: 自社API）:**
```
GET https://api.yourapp.com/analytics/users?date={{ $now.minus({days:1}).toFormat('yyyy-MM-dd') }}
Headers: X-API-Key: {{ $vars.ANALYTICS_API_KEY }}
```

### Step 2: KPI計算（Codeノード）

```javascript
// 各APIの結果をノード名で参照
const sales = $('Stripe').first().json;
const users = $('Users').first().json;
const cs = $('CS').first().json;
const server = $('Server').first().json;

// 前日比計算
const salesGrowth = ((sales.today - sales.yesterday) / sales.yesterday * 100).toFixed(1);
const userGrowth = ((users.today - users.yesterday) / users.yesterday * 100).toFixed(1);

// 異常フラグ
const alerts = [];
if (parseFloat(salesGrowth) < -20) alerts.push('🚨 売上が前日比-20%以下');
if (server.uptime < 99.5) alerts.push('🚨 サーバー稼働率低下');
if (cs.pendingCount > 50) alerts.push('⚠️ 未対応CSチケット50件超');

return [{
  json: {
    date: $now.minus({days:1}).toFormat('M月d日'),
    sales: { today: sales.today, growth: salesGrowth },
    users: { today: users.today, growth: userGrowth },
    churn: users.churnRate,
    csPending: cs.pendingCount,
    serverUptime: server.uptime,
    alerts,
    hasAlerts: alerts.length > 0
  }
}];
```

### Step 3: AIコメント生成（OpenAI）

```
System: あなたは経営アドバイザーです。KPIデータを見て、最も重要な1〜2点を50文字以内で簡潔に指摘してください。

User:
売上前日比: {{ $json.sales.growth }}%
ユーザー成長: {{ $json.users.growth }}%
解約率: {{ $json.churn }}%
CS未対応: {{ $json.csPending }}件
稼働率: {{ $json.serverUptime }}%
```

### Step 4: Slackへの配信

```javascript
// Slackブロックキット形式でリッチなメッセージを生成
const d = $json;
const emoji = d.hasAlerts ? '🚨' : '📊';

// Block Kit JSON
const blocks = [
  {
    "type": "header",
    "text": { "type": "plain_text", "text": `${emoji} ${d.date} 経営KPI` }
  },
  {
    "type": "section",
    "fields": [
      { "type": "mrkdwn", "text": `*売上*\n¥${d.sales.today.toLocaleString()} (${d.sales.growth}%)` },
      { "type": "mrkdwn", "text": `*新規ユーザー*\n${d.users.today}人 (${d.users.growth}%)` },
      { "type": "mrkdwn", "text": `*解約率*\n${d.churn}%` },
      { "type": "mrkdwn", "text": `*未対応CS*\n${d.csPending}件` },
    ]
  },
  {
    "type": "section",
    "text": { "type": "mrkdwn", "text": `*AIコメント:*\n${$('OpenAI').first().json.message.content}` }
  }
];

if (d.hasAlerts) {
  blocks.push({
    "type": "section",
    "text": { "type": "mrkdwn", "text": d.alerts.join('\n') }
  });
}

return [{ json: { blocks: JSON.stringify(blocks) } }];
```

## ポイント・注意事項

- 各APIの認証情報はn8n Credentialsに格納し、ワークフローに直書きしない
- 1つのAPIが失敗した場合もダッシュボードを配信できるよう、各HTTP Requestに `On Error: Continue` を設定する
- 週次・月次バージョンも作り、より詳細な分析（累計・比較）を定期配信するとさらに効果的

## 関連機能

- [経営者・管理職向けガイド](./concepts_n8n_role_executive.md)
- [複数APIのデータマージ](./concepts_n8n_usecase_multi_source_merge.md)
- [週次レポート自動生成](./concepts_n8n_usecase_weekly_report.md)
