---
category: "概念"
order: 234
title: ドキュメントRAG検索システムを構築する
description: 社内ドキュメント（Notion/PDF/Confluence）をベクター化してQdrantに格納し、自然言語クエリで関連情報を検索・LLMで回答生成するRAGシステムをn8nで構築する。
tags: ["n8n", "ユースケース", "RAG", "ベクターDB", "Qdrant", "Embeddings", "検索拡張生成"]
emoji: "🔎"
date: "2026-04-09"
source: "https://docs.n8n.io/advanced-ai/langchain/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

社内ドキュメントをベクター化してQdrantに格納し、「○○の設定方法は？」「△△の仕様について教えて」という自然言語クエリに対してLLMが関連ドキュメントを参照しながら回答する。

**解決する課題**: 社内Confluenceやドキュメントが増えすぎて「どこに何があるかわからない」問題を解決する

**使用するn8nノード:**
- Schedule Trigger（定期インデックス更新）
- HTTP Request / Notion（ドキュメント取得）
- Text Splitter（チャンク分割）
- OpenAI Embeddings（ベクター化）
- Qdrant Vector Store（格納・検索）
- OpenAI Chat Model（回答生成）

## ワークフロー構成

### ワークフロー1: インデックス構築（定期実行）

```
[Schedule Trigger: 毎日03:00]
    ↓
[Notion: 全ページ取得]
    ↓
[Loop Over Items]
  └── [Text Splitter: Recursive Character]
          ↓
      [OpenAI Embeddings]
          ↓
      [Qdrant: Upsert]
```

### ワークフロー2: 検索・回答（オンデマンド）

```
[Webhook / Chat Trigger]
    ↓
[Basic LLM Chain with Vector Store Retriever]
  ├── [OpenAI Chat Model]
  └── [Qdrant Vector Store: 類似検索]
    ↓
[回答返却]
```

## 実装手順（インデックス構築）

### Step 1: Notionページの取得

```
Resource: Database Item
Operation: Get Many
Database ID: your-doc-database-id
Filter: Published = true
```

### Step 2: テキスト分割（Text Splitter）

```
Type: Recursive Character Text Splitter
Chunk Size: 500
Chunk Overlap: 50
```

チャンクオーバーラップを設定することで文脈の切れ目を軽減する。

### Step 3: Embeddingsの生成

```
Provider: OpenAI Embeddings
Model: text-embedding-3-small
```

各チャンクをベクター（浮動小数点数の配列）に変換する。

### Step 4: Qdrantへのインデックス格納

```
Operation: Upsert
Collection: company_docs
Mode: Insert Documents with Metadata

Metadata:
  source: notion
  pageId: {{ $json.id }}
  title: {{ $json.properties.Name.title[0].plain_text }}
  url: {{ $json.url }}
  updatedAt: {{ $json.last_edited_time }}
```

## 実装手順（検索・回答）

### Step 5: Q&A Chainの設定

```
Node: Question and Answer Chain
Retriever: Vector Store Retriever
  → Qdrant (上記コレクション)
  → Top K: 5

LLM: OpenAI Chat Model (gpt-4o-mini)

System Prompt:
以下の参考情報に基づいてのみ回答してください。
参考情報に答えがない場合は「情報が見つかりませんでした」と回答してください。
回答の根拠となった情報源のURLも示してください。
```

## ポイント・注意事項

- チャンクサイズはドキュメントの密度に合わせる。短い仕様書は500字、長い技術文書は1000字が目安
- メタデータ（source・title・url）を付与することで、回答に出典情報を含められる
- Qdrantはオープンソースでセルフホスト可能。n8nと同じDockerネットワークに配置する

## 関連機能

- [AI・LLMエージェント](./concepts_n8n_ai_agents.md)
- [サポートボット](./concepts_n8n_usecase_ai_support_bot.md)
- [HTTP Request・API連携](./concepts_n8n_http_api.md)
