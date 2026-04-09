---
category: "概念"
order: 233
title: LLMを使ったカスタマーサポート自動応答ボット
description: Chat TriggerとAI AgentでFAQに自動回答するサポートボットをn8nで構築する。Notionの社内ナレッジをRAGで参照し、対応できない場合は担当者へエスカレーションする。
tags: ["n8n", "ユースケース", "AIエージェント", "カスタマーサポート", "RAG", "LLM", "チャットボット"]
emoji: "🤖"
date: "2026-04-09"
source: "https://docs.n8n.io/advanced-ai/ai-agent/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

Webサイトに埋め込んだチャットからの質問をAI Agentが受け取り、社内ナレッジベース（Notion/ドキュメント）を参照して回答する。AI信頼度が低い場合は担当者へエスカレーションする。

**解決する課題**: 夜間・休日の問い合わせ対応を自動化し、よくある質問への人的対応コストを削減する

**使用するn8nノード:**
- Chat Trigger（チャットインターフェース）
- AI Agent（ReAct Agent）
- OpenAI Chat Model（LLMモデル）
- Window Buffer Memory（会話履歴保持）
- Vector Store Tool（ナレッジベース検索）
- Slack（エスカレーション通知）

## ワークフロー構成

```
[Chat Trigger]
    ↓
[AI Agent]
  ├── [OpenAI Chat Model: gpt-4o]
  ├── [Window Buffer Memory: 直近10メッセージ]
  └── [Tools]
        ├── [Qdrant Vector Store: FAQナレッジ検索]
        └── [HTTP Request: 注文状況API]
    ↓
[IF: response.confidence < 0.7]
  ├── true  → [Slack: #support にエスカレーション]
  └── false → Chat応答として返却
```

## 実装手順

### Step 1: Chat Triggerの設定

```
Chat Trigger → Create Chat
Public Mode: True
Initial Message: こんにちは！サポートボットです。ご質問をどうぞ。
```

### Step 2: AI Agentの設定

```
Agent Type: Conversational Agent
System Prompt:
あなたはYourApp社のカスタマーサポートアシスタントです。
以下のルールに従ってください:
1. 提供されたナレッジベースの情報のみを使って回答する
2. 確信が持てない場合は「担当者に確認します」と回答する
3. 個人情報・内部情報を漏洩しない
4. 日本語で丁寧に回答する
```

### Step 3: Vector Store Toolの設定

**事前にインデックス構築（別ワークフロー）:**
```
[Notion ページ取得]
    ↓
[Text Splitter: Recursive Character (chunk_size=500)]
    ↓
[OpenAI Embeddings]
    ↓
[Qdrant Vector Store: upsert]
```

**AI Agentのツール設定:**
```
Tool: Qdrant Vector Store
Description: FAQや製品情報を検索する際に使用してください
Top K: 5
```

### Step 4: エスカレーション判定

```javascript
// AI Agentの回答にキーワードが含まれる場合にエスカレーション
const response = $json.output;
const escalationKeywords = ['担当者に確認', '分かりません', 'わかりません'];
const needsEscalation = escalationKeywords.some(k => response.includes(k));

return [{ json: { ...$json, needsEscalation } }];
```

### Step 5: Slackエスカレーション

```
Channel: #support
Message:
🙋 *サポートエスカレーション*

*ユーザー質問:* {{ $('Chat Trigger').first().json.chatInput }}
*AI回答:* {{ $json.output }}

人的対応が必要です。
```

## ポイント・注意事項

- Window Buffer Memoryは同一セッション（チャット画面）内でのみ有効。セッション跨ぎにはRedis/Postgres Memoryを使用する
- RAGのチャンクサイズはドキュメント種別で調整する（FAQ: 200〜500文字、マニュアル: 500〜1000文字）
- AI Agentへのシステムプロンプトは定期的に見直し、ハルシネーション対策のルールを追加する

## 関連機能

- [AI・LLMエージェント](./concepts_n8n_ai_agents.md)
- [RAG検索システム](./concepts_n8n_usecase_rag_search.md)
- [エラーハンドリング](./concepts_n8n_error_handling.md)
