---
category: "概念"
order: 5
title: モデルプロバイダー統合（OpenAI・Anthropic・OSS）
description: DifyでLLM・埋め込み・画像生成・音声モデルを接続する方法。100以上のプロバイダー対応の仕組みと設定手順。
tags: ["Dify", "LLM", "OpenAI", "Anthropic", "Claude", "Ollama", "モデル統合"]
emoji: "🤖"
date: "2026-04-09"
source: "Dify公式ドキュメント https://docs.dify.ai"
series:
  - Dify機能ガイド
---

## モデル統合の全体像

Dify は **100以上のモデルプロバイダー**に対応。LLMだけでなく埋め込み・画像生成・音声認識・TTS まで統一したインターフェースで管理できる。

```
[Dify アプリ]
     │
     │ 統一API（Dify内部）
     ▼
[Model Provider Layer]
  ├── OpenAI    : GPT-4o, GPT-3.5, DALL-E 3, Whisper, text-embedding-3
  ├── Anthropic : Claude 3.5 Sonnet, Claude 3 Opus/Haiku
  ├── Google    : Gemini 2.0 Flash, Gemini 1.5 Pro
  ├── Mistral   : Mistral Large, Mistral Medium
  ├── DeepSeek  : DeepSeek V3, DeepSeek R1
  ├── Cohere    : Command R+, Rerank v3（リランキング用）
  └── ...（100以上）
```

---

## モデルの種別

| 種別 | 用途 | 代表モデル |
|---|---|---|
| **LLM** | テキスト生成・推論 | GPT-4o, Claude 3.7 Sonnet |
| **Text Embedding** | RAG用ベクトル生成 | text-embedding-3-small, Cohere Embed |
| **Rerank** | 検索結果の再ランキング | Cohere Rerank v3, Jina Reranker |
| **Speech-to-Text** | 音声→テキスト | Whisper |
| **Text-to-Speech** | テキスト→音声 | OpenAI TTS |
| **Image Generation** | 画像生成 | DALL-E 3, Stable Diffusion |

---

## プロバイダー設定手順

```
Settings → Model Providers → プロバイダー選択 → API キーを入力 → Save

設定後はワークスペース全体で共有される（メンバー全員が使用可能）
```

---

## 主要プロバイダーの特徴

### OpenAI

```yaml
対応モデル:
  LLM: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo
  Embedding: text-embedding-3-small (低コスト), text-embedding-3-large (高精度)
  Image: dall-e-3
  STT: whisper-1

注意点:
  - Function calling / Structured output に対応
  - o1/o3 シリーズは推論特化（コスト高いが複雑問題に強い）
```

### Anthropic (Claude)

```yaml
対応モデル:
  LLM: claude-3-7-sonnet, claude-3-5-sonnet, claude-3-opus, claude-3-haiku

特徴:
  - 長いコンテキスト（200K トークン）が得意
  - コード生成・文書解析で高い評価
  - 安全性フィルターが厳格
  - ファイル変数（PDF等）の直接処理に対応（v1.0以降）
```

### ローカルモデル（Ollama）

```bash
# Ollama 経由でローカル LLM を接続する手順

# 1. Ollama をインストールしてモデルを取得
ollama pull llama3.1:8b
ollama pull nomic-embed-text  # 埋め込み用

# 2. Dify の Model Provider 設定
# Provider: Ollama
# Base URL: http://host.docker.internal:11434  # Dockerの場合
# または   http://localhost:11434  # ネイティブの場合

# メリット：
# - データが外部に出ない（プライバシー重視の要件に対応）
# - API課金なし
# - インターネット接続不要
```

---

## OpenAI Compatible（カスタムエンドポイント）

OpenAI API 互換の任意のエンドポイントを接続できる。

```yaml
対応サービス（例）：
  - Azure OpenAI
  - Groq（高速推論）
  - Together AI
  - Anyscale
  - LM Studio（ローカル）
  - vLLM（セルフホスト）

設定:
  Base URL: https://your-endpoint.com/v1
  API Key: your-api-key
  Model: model-name-here
```

---

## モデル選択のガイドライン

```
コスト重視（高頻度バッチ処理）:
  GPT-4o mini / Claude 3 Haiku / Gemini 2.0 Flash

精度重視（複雑な推論・分析）:
  GPT-4o / Claude 3.7 Sonnet / Gemini 1.5 Pro

超高精度（最難タスク）:
  Claude 3 Opus / o3

コード生成:
  Claude 3.7 Sonnet / GPT-4o

長文処理（50K+ トークン）:
  Claude 3.5（200K） / Gemini 1.5 Pro（1M）

プライバシー重視（社内データ）:
  Ollama（ローカル） / Azure OpenAI（データレジデンシー保証）

RAG 埋め込み（コスト重視）:
  text-embedding-3-small（OpenAI最安） / nomic-embed-text（Ollama無料）
```

---

## モデルパラメータの調整

```
LLM ノードで設定可能なパラメータ：

Temperature: 0.0〜2.0
  0.0 = 決定論的（同じ入力で常に同じ出力）→ データ抽出・分類に適す
  0.7 = バランス（デフォルト）→ 汎用
  1.5+ = 創造的（多様な出力）→ ブレインストーミング・物語生成

Top-P: 0.0〜1.0
  Temperature と組み合わせて確率分布を制御

Max Tokens:
  出力の最大長を制限（長すぎる出力はコスト増加）

Presence/Frequency Penalty:
  同じ内容の繰り返しを抑制（長文生成で有効）
```

---

## コスト管理

```
Dify では各実行でのトークン使用量を記録する：

Logs ページで確認できる情報：
  - 入力トークン数
  - 出力トークン数
  - 推定コスト（USD）
  - 実行時間

予算管理のヒント：
  1. 開発時は安価なモデル（mini/haiku）で動作確認
  2. 本番は精度要件に合わせてモデルを選択
  3. Max Tokens を適切に設定して無駄な出力を防ぐ
  4. プロンプトキャッシュ（Anthropic）で繰り返し呼び出しのコストを削減
```

---

## 実践ユースケース

- [RAGチャットボット構築](concepts_dify_usecase_rag_chatbot.md) — モデル選択とコスト設計の実例
