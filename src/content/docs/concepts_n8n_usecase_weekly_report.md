---
category: "概念"
order: 219
title: スケジュールトリガーで週次レポートを自動生成する
description: 毎週月曜朝にKPIデータをAPIから取得し、LLMで分析サマリーを生成してSlackとメールに自動配信する週次レポートワークフロー。
tags: ["n8n", "ユースケース", "週次レポート", "スケジュール", "LLM", "Slack", "自動化"]
emoji: "📈"
date: "2026-04-09"
source: "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

毎週月曜8:00にKPIデータ（売上・ユーザー数・エラー率等）を自動集計し、LLMで分析コメントを生成してSlackのレポートチャンネルに投稿する。

**解決する課題**: 週次レポート作成の手動作業をなくし、毎週一定品質のレポートをチームに届ける

**使用するn8nノード:**
- Schedule Trigger（毎週月曜起動）
- HTTP Request × 複数（各KPI APIの呼び出し）
- Code（集計・整形処理）
- OpenAI Chat Model（分析コメント生成）
- Slack（レポート投稿）
- Gmail（経営陣へのメール送信）

## ワークフロー構成

```
[Schedule Trigger: 毎週月曜 08:00]
    ↓
[HTTP Request: 売上API]
[HTTP Request: ユーザー数API]   ←（並列実行）
[HTTP Request: エラー率API]
    ↓
[Merge: 3つのデータを統合]
    ↓
[Code: KPI計算・前週比算出]
    ↓
[OpenAI: 分析コメント生成]
    ↓
[Slack: #weekly-kpi に投稿]
    ↓
[Gmail: 経営陣にメール送信]
```

## 実装手順

### Step 1: Schedule Triggerの設定

```
Trigger Times → Add Time
Rule: Every Week
Weekday: Monday
Hour: 8
Minute: 0
```

### Step 2: KPI APIの並列呼び出し

3つのHTTP Requestノードを並列に配置し、それぞれ異なるAPIエンドポイントを呼ぶ。

```
Node: 売上API
URL: https://api.yourapp.com/analytics/revenue?period=last_week
Headers: Authorization: Bearer {{ $env.ANALYTICS_API_KEY }}
```

### Step 3: 前週比計算（Codeノード）

```javascript
const revenue = $('売上API').first().json;
const users = $('ユーザー数API').first().json;

const revenueGrowth = ((revenue.thisWeek - revenue.lastWeek) / revenue.lastWeek * 100).toFixed(1);
const userGrowth = ((users.thisWeek - users.lastWeek) / users.lastWeek * 100).toFixed(1);

return [{
  json: {
    revenueThisWeek: revenue.thisWeek,
    revenueGrowth: `${revenueGrowth}%`,
    usersThisWeek: users.thisWeek,
    userGrowth: `${userGrowth}%`,
    summary: `売上: ¥${revenue.thisWeek.toLocaleString()}（前週比${revenueGrowth}%）`
  }
}];
```

### Step 4: LLM分析コメント生成

```
Prompt: 以下のKPIデータを分析し、3行以内で重要なポイントを指摘してください。
データ: {{ $json.summary }}
```

### Step 5: Slackへの整形投稿

```
Message:
📊 *週次KPIレポート（{{ $now.format('YYYY/MM/DD') }}）*
売上: ¥{{ $json.revenueThisWeek.toLocaleString() }} ({{ $json.revenueGrowth }})
ユーザー数: {{ $json.usersThisWeek }} ({{ $json.userGrowth }})

*AI分析:*
{{ $('OpenAI').first().json.message.content }}
```

## ポイント・注意事項

- APIが複数ある場合は並列ノードで同時呼び出しし、Mergeで統合するとレイテンシを削減できる
- LLMのトークンコスト削減のため、プロンプトに渡すデータは必要最小限に絞る
- Slackのblock kit形式を使うとよりリッチなレポートレイアウトになる

## 関連機能

- [トリガーの種類](./concepts_n8n_triggers.md)
- [ロジック制御](./concepts_n8n_logic_flow.md)
- [AI・LLMエージェント](./concepts_n8n_ai_agents.md)
