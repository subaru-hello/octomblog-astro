---
category: "概念"
order: 9
title: API・公開・デプロイオプション
description: DifyアプリをREST API・Webアプリ・埋め込みウィジェット・セルフホストで公開する方法と設計の選び方。
tags: ["Dify", "API", "デプロイ", "Webアプリ", "埋め込み", "Docker", "LLMOps"]
emoji: "🚀"
date: "2026-04-09"
source: "Dify公式ドキュメント https://docs.dify.ai"
series:
  - Dify機能ガイド
---

## 公開方法の全体像

作成したアプリを外部に公開する方法は4種類ある。

```
┌───────────────────────────────────────────────────────────┐
│  Dify アプリ                                               │
│                                                           │
│  公開方法:                                                │
│  1. Web アプリ    → ブラウザからすぐ使えるUI              │
│  2. REST API      → 自前フロントエンドやバックエンドと統合  │
│  3. 埋め込み      → 既存Webサイトにチャットを組み込む       │
│  4. Webhook/Trigger → 外部イベントで自動実行               │
└───────────────────────────────────────────────────────────┘
```

---

## 1. Web アプリとして公開

作成したアプリを Dify が提供する Web UI として即時公開できる。

```
Publish → Web App → URL を共有するだけ

提供されるUI:
  - チャットUI（Chatbot/Chatflow）
  - フォームUI（Workflow: 入力→実行→結果表示）

カスタマイズ可能な項目:
  - アプリ名・アイコン・説明文
  - 初期メッセージ（ウェルカムメッセージ）
  - 会話スターター（サジェスト質問）
  - テーマカラー
  - フッターのクレジット非表示
```

---

## 2. REST API として公開

最も柔軟な統合方法。自前のアプリから Dify を LLM バックエンドとして使う。

### API キーの管理

```
API Access → Create API Key → 安全に保管

APIキーは X-App-ID ヘッダーではなく Authorization ヘッダーで渡す:
  Authorization: Bearer app-xxxxxxxxxxxxxxxxxxx
```

### Chat API（Chatflow/Chatbot）

```bash
# 会話開始（conversation_id を省略すると新規会話）
curl -X POST 'https://api.dify.ai/v1/chat-messages' \
  -H 'Authorization: Bearer {api_key}' \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "Pythonでリストを逆順にする方法は？",
    "inputs": {},
    "response_mode": "streaming",
    "conversation_id": "",
    "user": "user-123"
  }'

# response_mode:
#   streaming: SSE（Server-Sent Events）でリアルタイム配信
#   blocking: 完了まで待って一括返却（タイムアウトに注意）

# 会話継続（前回の conversation_id を指定）
curl -X POST 'https://api.dify.ai/v1/chat-messages' \
  -d '{
    "query": "続きを教えて",
    "conversation_id": "conv-abc123",
    "user": "user-123"
  }'
```

### Workflow API

```bash
# Workflow を1回実行
curl -X POST 'https://api.dify.ai/v1/workflows/run' \
  -H 'Authorization: Bearer {api_key}' \
  -H 'Content-Type: application/json' \
  -d '{
    "inputs": {
      "text": "翻訳したいテキスト",
      "target_language": "en"
    },
    "response_mode": "blocking",
    "user": "user-123"
  }'

# レスポンス（blocking モード）
{
  "workflow_run_id": "run-xyz",
  "task_id": "task-xyz",
  "data": {
    "outputs": {
      "translated_text": "Text to be translated"
    },
    "status": "succeeded",
    "elapsed_time": 2.34,
    "total_tokens": 150
  }
}
```

### ストリーミングレスポンスの処理

```javascript
// Node.js でのストリーミング受信例
const response = await fetch('/v1/chat-messages', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ query, response_mode: 'streaming', user })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  // SSE フォーマット: "data: {...}\n\n"
  const lines = chunk.split('\n').filter(l => l.startsWith('data:'));
  
  for (const line of lines) {
    const event = JSON.parse(line.replace('data: ', ''));
    if (event.event === 'message') {
      process.stdout.write(event.answer);  // リアルタイム表示
    }
  }
}
```

---

## 3. 埋め込みウィジェット

既存の Web サイトにチャットを組み込む2つの方法。

### チャットバブル（フローティングボタン）

```html
<!-- ページの右下に浮かぶチャットボタンを追加 -->
<script>
  window.difyChatbotConfig = {
    token: 'your-app-token',
    baseUrl: 'https://api.dify.ai'
  }
</script>
<script
  src="https://udify.app/embed.min.js"
  id="your-app-token"
  defer>
</script>
```

### iFrame 埋め込み（インライン）

```html
<!-- ページ内にチャットUIをインラインで表示 -->
<iframe
  src="https://udify.app/chatbot/your-app-token"
  style="width: 100%; height: 100%; min-height: 700px"
  frameborder="0"
  allow="microphone">
</iframe>
```

---

## 4. セルフホスト（Docker Compose）

データをクラウドに送りたくない場合、または高度なカスタマイズが必要な場合。

```bash
# クイックスタート
git clone https://github.com/langgenius/dify.git
cd dify/docker
cp .env.example .env

# .env の必須設定
# SECRET_KEY: openssl rand -base64 42 で生成したランダム文字列
# INIT_PASSWORD: 初期管理者パスワード

docker compose up -d

# 起動後 http://localhost/install でセットアップ
```

### コンテナ構成

```yaml
services:
  api:         # FastAPI（ポート5001）
  worker:      # Celery 非同期ワーカー
  web:         # Next.js（ポート3000）
  db:          # PostgreSQL 15
  redis:       # Redis 6
  weaviate:    # ベクトルDB（ポート8080）
  nginx:       # リバースプロキシ（ポート80/443）
  sandbox:     # Codeノード実行環境（隔離）
  ssrf_proxy:  # SSRF攻撃防止プロキシ

最小スペック: 2コアCPU / 4GB RAM
推奨スペック: 4コアCPU / 8GB RAM
```

### 代替ベクトルDB

```yaml
# docker-compose.yaml の VECTOR_STORE 環境変数で変更
VECTOR_STORE: qdrant    # または milvus / pgvector

# Weaviate から Qdrant に変える理由:
# - Qdrant: Go製で軽量・高速
# - Milvus: エンタープライズ向けの機能が豊富
# - pgvector: PostgreSQL 拡張、追加DBが不要
```

---

## デプロイ先の選択

| 要件 | 推奨デプロイ方法 |
|---|---|
| すぐ試したい | Dify Cloud (dify.ai) |
| データを社内に保持したい | Docker Compose セルフホスト |
| AWS 環境に統合したい | AWS Marketplace（ワンクリックVPC）|
| 高カスタマイズ | ソースコードからビルド |

---

## API 設計のベストプラクティス

```
1. conversation_id の管理
   → フロントエンドでセッションごとに保持・送信する

2. streaming vs blocking の選択
   → レスポンスが長い/ユーザーが待つ → streaming
   → バックエンド処理で結果だけ必要 → blocking

3. user フィールドを必ず設定する
   → Dify のログとメトリクスでユーザーを識別できる

4. エラーハンドリング
   → 429: レートリミット → バックオフして再試行
   → 400: 入力検証エラー → パラメータを確認
   → 500: サーバーエラー → Dify のログを確認
```

---

## 実践ユースケース

- [マルチエージェントオーケストレーション](concepts_dify_usecase_multi_agent.md) — API 経由で複数の Dify ワークフローを連携する例
