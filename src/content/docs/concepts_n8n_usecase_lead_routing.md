---
category: "概念"
order: 200
title: 条件分岐でリード属性に応じて担当者を振り分ける
description: Webhookで受け取ったリード情報をIF/Switchノードで分類し、業種・予算・地域に応じた担当営業チームのSlackチャンネルに自動振り分けるワークフロー。
tags: ["n8n", "ユースケース", "リードルーティング", "CRM", "条件分岐", "Switch", "Slack"]
emoji: "🎯"
date: "2026-04-09"
source: "https://docs.n8n.io/flow-logic/splitting/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

問い合わせフォームから送信されたリード情報を自動分析し、業種・予算規模・地域に応じて最適な営業担当チームのSlackへ通知する。

**解決する課題**: 手動でのリード振り分け作業とその遅延をなくし、リード獲得後すぐに担当チームが対応できる状態を作る

**使用するn8nノード:**
- Webhook Trigger（フォーム送信受信）
- Switch（業種による多方向分岐）
- IF（予算規模による分岐）
- Slack（各チームチャンネルへの通知）
- HubSpot（CRMにリード登録）

## ワークフロー構成

```
[Webhook Trigger: POST /lead-form]
    ↓
[HubSpot: Contact作成]
    ↓
[Switch: industry（業種）]
  ├── "SaaS"        → [IF: budget >= 1000000]
  │                     ├── true  → [Slack: #sales-enterprise]
  │                     └── false → [Slack: #sales-smb]
  ├── "EC"          → [Slack: #sales-ec]
  ├── "製造"         → [Slack: #sales-manufacturing]
  └── default       → [Slack: #sales-general]
```

## 実装手順

### Step 1: Webhook Triggerの設定

```
Method: POST
Path: lead-form
Response: Immediately
```

受け取るペイロード例:
```json
{
  "name": "山田太郎",
  "email": "yamada@example.com",
  "company": "Example株式会社",
  "industry": "SaaS",
  "budget": 2000000,
  "region": "東京"
}
```

### Step 2: HubSpotにContact登録

```
Operation: Contact → Create
Properties:
  firstname: {{ $json.name.split(' ')[0] }}
  email: {{ $json.email }}
  company: {{ $json.company }}
  hs_lead_status: NEW
```

### Step 3: Switchノードで業種分岐

```
Mode: Expression
Output 0 (SaaS):    {{ $json.industry === 'SaaS' }}
Output 1 (EC):      {{ $json.industry === 'EC' }}
Output 2 (製造):    {{ $json.industry === '製造' }}
Output 3 (default): {{ true }}
```

### Step 4: エンタープライズ判定（IF）

```
Condition: {{ $json.budget }} >= 1000000
```

### Step 5: Slack通知

```
Channel: #sales-enterprise
Message:
🎯 *新規エンタープライズリード*
会社: {{ $json.company }}（{{ $json.industry }}）
担当: {{ $json.name }}（{{ $json.email }}）
予算: ¥{{ $json.budget.toLocaleString() }}
HubSpot: {{ $('HubSpot').first().json.id }}
```

## ポイント・注意事項

- Switchノードの「Rules Based」モードでは、最初にマッチした条件のみが発火する（優先順位あり）
- HubSpotへの登録は振り分け前に行い、どのチームへ渡る場合も必ずCRMに記録する
- 振り分けロジックは将来変更しやすいよう、条件値は環境変数や別ノードで管理する

## 関連機能

- [ロジック制御](./concepts_n8n_logic_flow.md)
- [主要インテグレーション](./concepts_n8n_integrations.md)
- [トリガーの種類](./concepts_n8n_triggers.md)
