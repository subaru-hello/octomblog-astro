---
category: "概念"
order: 220
title: Gmailトリガーでサポートメールを自動Notionチケット化する
description: GmailトリガーでサポートメールをリアルタイムDetect検知し、AI分類後にNotionデータベースへ自動チケット作成するワークフロー。
tags: ["n8n", "ユースケース", "Gmail", "Notion", "サポート", "チケット管理", "AI分類"]
emoji: "🎫"
date: "2026-04-09"
source: "https://docs.n8n.io/integrations/builtin/trigger-nodes/n8n-nodes-base.gmailtrigger/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

support@yourapp.comへの受信メールをGmailトリガーで検知し、AIで優先度・カテゴリを分類してNotionのサポートDBに自動チケットを作成する。

**解決する課題**: サポートチームのメール確認作業と手動チケット入力をなくし、対応漏れを防ぐ

**使用するn8nノード:**
- Gmail Trigger（新着メール検知）
- OpenAI Chat Model（メール分類）
- IF（緊急度で分岐）
- Notion（チケット作成）
- Slack（緊急チケットのアラート）

## ワークフロー構成

```
[Gmail Trigger: support@yourapp.com の新着メール]
    ↓
[OpenAI: メール分類（カテゴリ・優先度判定）]
    ↓
[Notion: サポートDBにチケット作成]
    ↓
[IF: priority == "urgent"]
  ├── true  → [Slack: #support-urgent にアラート]
  └── false → 処理完了
```

## 実装手順

### Step 1: Gmail Triggerの設定

```
Polling Times: Every 5 Minutes
Filters → Label: サポート （Gmailのフィルタで振り分け済み）
```

Gmail側でフィルタを設定し、support@へのメールに「サポート」ラベルを自動付与しておく。

### Step 2: AIによるメール分類（OpenAI）

```
System Prompt:
あなたはカスタマーサポートの分類AIです。
メールを以下のJSONで分類してください:
{
  "category": "請求|技術|一般|バグ報告|解約",
  "priority": "urgent|high|normal|low",
  "summary": "30文字以内の件名要約"
}

User Message:
件名: {{ $json.subject }}
本文: {{ $json.snippet }}
```

### Step 3: Notionへのチケット作成

```
Database ID: your-support-db-id
Properties:
  Name: {{ $json.summary }}（AIサマリー）
  Category: {{ $json.category }}
  Priority: {{ $json.priority }}
  Status: Open
  Customer Email: {{ $('Gmail Trigger').first().json.from }}
  Received At: {{ $now.toISO() }}
  Original Subject: {{ $('Gmail Trigger').first().json.subject }}
```

### Step 4: 緊急チケットのSlack通知

```
Condition: {{ $json.priority }} equals "urgent"
Channel: #support-urgent
Message: 🚨 緊急サポートチケット作成
件名: {{ $json.summary }}
送信者: {{ $('Gmail Trigger').first().json.from }}
Notion: {{ $('Notion').first().json.url }}
```

## ポイント・注意事項

- Gmail TriggerはPolling（定期確認）方式。リアルタイム検知が必要な場合はGmail→Pub/Sub→Webhookのフローを検討
- AIの分類精度を上げるにはFew-shotプロンプト（分類例を含める）が有効
- Notionのプロパティは事前にデータベースで定義しておく必要がある

## 関連機能

- [トリガーの種類](./concepts_n8n_triggers.md)
- [AI・LLMエージェント](./concepts_n8n_ai_agents.md)
- [主要インテグレーション](./concepts_n8n_integrations.md)
