---
category: "概念"
order: 200
title: SlackとNotionを連携したチームタスク管理フロー
description: Slackの特定絵文字リアクションをトリガーにメッセージをNotionタスクとして自動作成し、Slack通知でフィードバックを返すワークフロー。
tags: ["n8n", "ユースケース", "Slack", "Notion", "タスク管理", "チーム", "インテグレーション"]
emoji: "✅"
date: "2026-04-09"
source: "https://docs.n8n.io/integrations/builtin/trigger-nodes/n8n-nodes-base.slacktrigger/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

Slackメッセージに ✅ リアクションを付けると、そのメッセージが自動でNotionのタスクDBに追加される。タスク管理ツールへの手動転記作業をなくす。

**解決する課題**: Slackで「これタスクにして！」と言われたものを手動でNotionに転記する作業をなくす

**使用するn8nノード:**
- Slack Trigger（リアクション追加イベント）
- Slack（元メッセージの本文取得）
- IF（✅ リアクションのみ対象）
- Notion（タスク作成）
- Slack（完了フィードバック投稿）

## ワークフロー構成

```
[Slack Trigger: reaction_added イベント]
    ↓
[IF: reaction == "white_check_mark"]
  ├── false → スキップ
  └── true  →
      [Slack: メッセージ本文取得]
          ↓
      [Notion: タスク作成]
          ↓
      [Slack: スレッドにフィードバック]
```

## 実装手順

### Step 1: Slack Triggerの設定

```
Trigger On: Reaction Added
```

イベントペイロード例:
```json
{
  "reaction": "white_check_mark",
  "item": {
    "type": "message",
    "channel": "C0123456789",
    "ts": "1617123456.000100"
  },
  "user": "U0987654321"
}
```

### Step 2: ✅リアクションのみフィルタ

```
Condition: {{ $json.reaction }} equals "white_check_mark"
```

### Step 3: 元メッセージの本文取得

```
Resource: Message
Operation: Get
Channel: {{ $json.item.channel }}
Timestamp: {{ $json.item.ts }}
```

### Step 4: Notionにタスク作成

```
Database: チームタスクDB
Properties:
  タスク名: {{ $('Slack Get Message').first().json.messages[0].text }}
  ソース: Slack
  Slack URL: https://yourteam.slack.com/archives/{{ $json.item.channel }}/p{{ $json.item.ts.replace('.', '') }}
  作成者: {{ $json.user }}
  ステータス: Todo
  作成日: {{ $now.toISO() }}
```

### Step 5: Slackスレッドにフィードバック

```
Resource: Message
Operation: Reply in Thread
Channel: {{ $json.item.channel }}
Thread TS: {{ $json.item.ts }}
Text: ✅ Notionにタスクを作成しました！
{{ $('Notion Create').first().json.url }}
```

## ポイント・注意事項

- Slack TriggerにはEvents API設定が必要。Slack Appを作成し、n8nのWebhook URLをEvent Subscriptionsに登録する
- `reaction_added` イベントはワークスペース全体に発火するため、対象チャンネルをIFで絞ることを推奨
- フィードバックメッセージはスレッド返信にすることで、元の会話の流れを崩さない

## 関連機能

- [主要インテグレーション](./concepts_n8n_integrations.md)
- [トリガーの種類](./concepts_n8n_triggers.md)
- [ロジック制御](./concepts_n8n_logic_flow.md)
