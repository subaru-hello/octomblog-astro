---
category: "概念"
order: 107
title: n8n AI・LLMエージェント（Chain・Agent）
description: n8nのAdvanced AI機能。LangChain統合によるLLMチェーン・AIエージェント・RAG（検索拡張生成）・ベクターストアの構築方法を解説。
tags: ["n8n", "AI", "LLM", "LangChain", "RAG", "エージェント", "OpenAI"]
emoji: "🤖"
date: "2026-04-09"
source: "https://docs.n8n.io/advanced-ai/"
series:
  - n8nワークフロー自動化
---

## n8nのAI機能概要

n8nはLangChainを内部で使用し、ノーコードでAIパイプラインを構築できる。LLMプロバイダー・メモリ・ツール・ベクターストアを組み合わせてエージェントを設計する。

## LLMプロバイダー対応

| プロバイダー | ノード名 |
|---|---|
| OpenAI (GPT-4等) | OpenAI Chat Model |
| Anthropic (Claude) | Anthropic Chat Model |
| Google Gemini | Google Gemini Chat Model |
| Mistral AI | Mistral Cloud Chat Model |
| Groq | Groq Chat Model |
| Ollama（ローカル） | Ollama Chat Model |
| Azure OpenAI | Azure OpenAI Chat Model |

## AI Chain（チェーン）

複数ノードをチェーン状につなぎ、LLMに処理させるパターン。

### Basic LLM Chain

最もシンプルな構成。1回のLLM呼び出し。

```
[Chat Trigger] → [Basic LLM Chain（OpenAI）] → [応答返却]
```

### Question and Answer Chain

ドキュメントを参照してQ&Aに回答する。

```
[入力] → [Q&A Chain] ← [ベクターストア（知識ベース）]
              ↓
         [LLM（回答生成）]
```

### Summarization Chain

長文テキストを要約する。

## AI Agent（エージェント）

ツールを自律的に選択・実行してタスクを達成するエージェント。

```
[Chat Trigger]
      ↓
[AI Agent] ← [LLMモデル]
      ↓        ↓
[ツール群]  [メモリ]
  - HTTP Request
  - Code
  - Slack送信
  - DB検索
```

### エージェントの種類

| エージェント | 特徴 |
|---|---|
| Conversational Agent | 会話履歴を保持した対話型 |
| ReAct Agent | Reasoning + Actingで段階的思考 |
| OpenAI Functions Agent | OpenAIのFunction Callingを使用 |
| SQL Agent | SQLデータベースを自然言語で操作 |

## メモリ（会話履歴の保持）

エージェントに会話の文脈を持たせる。

| メモリ種別 | 特徴 |
|---|---|
| Window Buffer Memory | 直近N件のメッセージを保持 |
| Token Buffer Memory | トークン数上限でメモリを管理 |
| Redis Chat Memory | Redisに永続化（セッション跨ぎ） |
| Postgres Chat Memory | PostgreSQLに永続化 |

## ベクターストア・RAG

独自ドキュメントをベクター化して検索拡張生成（RAG）を実現。

```
【インデックス構築】
[ドキュメント] → [Text Splitter] → [Embeddings] → [ベクターストア]

【検索・回答】
[クエリ] → [ベクターストア検索] → [関連チャンク取得] → [LLM（回答生成）]
```

**対応ベクターストア**: Pinecone / Qdrant / Weaviate / Supabase / In-memory

**対応Embeddings**: OpenAI / Google / Cohere / Ollama

## ユースケース

| ユースケース | 説明 | リンク |
|---|---|---|
| サポートボット | LLMで問い合わせ自動応答 | [→ doc](./concepts_n8n_usecase_ai_support_bot.md) |
| RAG検索システム | ドキュメントを知識ベースに自動回答 | [→ doc](./concepts_n8n_usecase_rag_search.md) |
| メール自動分類 | AIでメールカテゴリ分類・ルーティング | [→ doc](./concepts_n8n_usecase_email_classifier.md) |

## 公式ドキュメント

- https://docs.n8n.io/advanced-ai/
- https://docs.n8n.io/advanced-ai/ai-agent/
- https://docs.n8n.io/advanced-ai/langchain/
