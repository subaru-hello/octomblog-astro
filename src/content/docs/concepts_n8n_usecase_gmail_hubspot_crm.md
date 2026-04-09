---
category: "概念"
order: 228
title: GmailとHubSpotを連携したCRM自動化フロー
description: Gmailで受信した営業メールをGmailトリガーで検知し、HubSpotのコンタクト・Deal・Activityに自動記録するCRM自動化ワークフロー。
tags: ["n8n", "ユースケース", "Gmail", "HubSpot", "CRM", "営業自動化", "コンタクト管理"]
emoji: "🤝"
date: "2026-04-09"
source: "https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.hubspot/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

営業メールアドレスへの受信メールをGmailトリガーで検知し、HubSpotのコンタクト確認→新規作成またはアクティビティ記録を自動で行う。CRM記録漏れをなくす。

**解決する課題**: 営業担当が手動でHubSpotにメール内容を転記する作業をなくし、すべての商談接触を自動記録する

**使用するn8nノード:**
- Gmail Trigger（受信メール検知）
- HubSpot（Contact検索）
- IF（既存コンタクトか新規か）
- HubSpot（Contact作成 / Activity記録）
- OpenAI（メール要約・Intent分析）
- Slack（営業チームへの通知）

## ワークフロー構成

```
[Gmail Trigger: sales@ の新着メール]
    ↓
[OpenAI: メール要約・Intentを分析]
    ↓
[HubSpot: Emailでコンタクト検索]
    ↓
[IF: コンタクトが存在するか]
  ├── 存在しない → [HubSpot: 新規Contact作成]
  └── 存在する  → そのまま
    ↓
[HubSpot: Email Activity記録]
    ↓
[IF: intent == "購買意欲高"]
  └── true → [Slack: #sales にアラート]
```

## 実装手順

### Step 1: Gmail Triggerの設定

```
Polling: Every 5 minutes
Filter: to:sales@yourcompany.com
```

### Step 2: AI分析（OpenAI）

```
Prompt:
以下のメールを分析してJSON形式で回答してください:
{
  "summary": "3文以内の要約",
  "intent": "購買意欲高|情報収集|クレーム|その他",
  "company": "会社名（判明した場合）",
  "contactName": "氏名（判明した場合）"
}

件名: {{ $json.subject }}
本文: {{ $json.snippet }}
差出人: {{ $json.from }}
```

### Step 3: HubSpotでコンタクト検索

```
Resource: Contact
Operation: Search
Filter: email equals {{ $json.from.match(/<(.+)>/)?.[1] || $json.from }}
```

### Step 4: 新規Contact作成（IFがfalseの場合）

```
Resource: Contact
Operation: Create
Properties:
  email: {{ $json.from }}
  firstname: {{ $('OpenAI').first().json.contactName.split(' ')[0] }}
  company: {{ $('OpenAI').first().json.company }}
  hs_lead_source: Email Inbound
```

### Step 5: Email Activity記録

```
Resource: Activity
Operation: Create
Type: EMAIL
Contact ID: {{ $('HubSpot Search').first().json.id }}
Subject: {{ $('Gmail Trigger').first().json.subject }}
Body: {{ $('OpenAI').first().json.summary }}
```

## ポイント・注意事項

- メールの `From` ヘッダーは `"Name" <email@example.com>` 形式のため、正規表現でメールアドレス部分を抽出する
- HubSpotの無料プランではAPIコール数に制限がある（1日1000コール）
- AI分析のトークン消費を抑えるため、`snippet`（プレビュー）を使い、本文全体は送らない

## 関連機能

- [主要インテグレーション](./concepts_n8n_integrations.md)
- [AI・LLMエージェント](./concepts_n8n_ai_agents.md)
- [トリガーの種類](./concepts_n8n_triggers.md)
