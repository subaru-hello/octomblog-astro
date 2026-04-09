---
category: "概念"
order: 150
title: Dify×n8n連携ガイド（AIと外部サービスをつなぐオーケストレーション）
description: DifyのAI処理能力とn8nの外部サービス連携力を組み合わせるアーキテクチャパターン。Slack/Notion/Google Sheets連携の実装例とDify API呼び出しコードを解説。
tags: ["Dify", "n8n", "連携", "ワークフロー自動化", "API", "統合", "エコシステム"]
emoji: "🔗"
date: "2026-04-09"
source: "Dify公式ドキュメント / n8n連携事例"
series:
  - Dify実践ガイド
---

## Dify と n8n の役割分担

```
2ツールの強みは異なる。組み合わせることで弱点を補い合える。

Dify が得意なこと:
  ✅ LLM を使ったテキスト生成・分析・分類
  ✅ RAG（社内ナレッジへの Q&A）
  ✅ マルチターンの会話管理
  ✅ プロンプトのバージョン管理・A/B テスト
  ✅ AI ワークフローのビジュアルデバッグ

  苦手なこと:
  ❌ 定期実行（cron）
  ❌ 100以上の外部サービスとの直接連携
  ❌ データベースの CRUD 操作
  ❌ 複雑な条件分岐を伴うデータパイプライン

n8n が得意なこと:
  ✅ 400以上の外部サービスとのネイティブ連携
    （Slack・Notion・Google Sheets・GitHub・Salesforce・HubSpot…）
  ✅ cron スケジュール実行
  ✅ データ変換・フィルタリング・マッピング
  ✅ Webhook トリガー

  苦手なこと:
  ❌ LLM の高度な制御（プロンプト管理・RAG）

組み合わせ:
  n8n → トリガー・データ収集・外部連携
  Dify → AI 処理・自然言語理解・生成
  n8n → 結果の保存・通知・アクション
```

---

## 連携パターン1: n8n → Dify（最も一般的）

### パターン概要

```
トリガー（n8n）→ AI 処理（Dify）→ アクション（n8n）

用途:
  - 定期バッチ処理（毎朝のレポート生成）
  - 外部イベント駆動の AI 処理（新着メールを分析）
  - 複数サービスのデータを集めて AI に渡す
```

### 実装例: 毎朝の競合情報サマリー

```
n8n ワークフロー:

[Cron: 毎朝8時]
  ↓
[HTTP Request: Google News API]
  競合他社の最新ニュース取得
  ↓
[Function: 記事リストを整形]
  → JSON に変換
  ↓
[HTTP Request: Dify API]
  POST /v1/workflows/run
  → 記事リストを Dify に送信
  ↓
[HTTP Request: Slack API]
  サマリーを #market-news チャンネルに投稿
```

### Dify API の呼び出し方（n8n の HTTP Request ノード）

```json
// n8n HTTP Request ノード設定

Method: POST
URL: https://api.dify.ai/v1/workflows/run

Headers:
  Authorization: Bearer {{$env.DIFY_API_KEY}}
  Content-Type: application/json

Body（JSON）:
{
  "inputs": {
    "articles": "{{$json.articles_text}}"
  },
  "response_mode": "blocking",
  "user": "n8n-scheduler"
}
```

```json
// レスポンス例
{
  "workflow_run_id": "abc123",
  "task_id": "xyz789",
  "data": {
    "outputs": {
      "summary": "本日の主要トピック:\n1. 競合A社が新製品を発表...",
      "alert_level": "high"
    },
    "status": "succeeded",
    "elapsed_time": 3.42,
    "total_tokens": 2150
  }
}
```

---

## 連携パターン2: Dify → n8n（Webhook 経由）

### パターン概要

```
AI が判断 → n8n に通知 → 外部サービスを操作

用途:
  - AI の分析結果に応じて CRM を更新
  - ハイスコアのリードを自動的に担当者にアサイン
  - 重要アラートを特定チャンネルにエスカレーション
```

### 実装例: カスタマーサポートのエスカレーション

```
Dify Chatflow:

[ユーザーメッセージ]
  ↓
[Question Classifier: 緊急度判定]
  ├── 通常: [LLM: 標準回答生成] → ユーザーに返信
  └── 緊急（クレーム/障害）: 
        [HTTP Request ノード: n8n Webhook を呼び出す]

HTTP Request ノード設定:
  Method: POST
  URL: https://n8n.example.com/webhook/support-escalation
  Body:
    {
      "conversation_id": "{{conversation_id}}",
      "user_message": "{{query}}",
      "urgency": "high",
      "category": "{{classifier_result}}"
    }

n8n がこの Webhook を受け取り:
  → 担当者に Slack DM を送信
  → Salesforce のケースを「優先度: 高」で作成
  → PagerDuty でオンコール担当者に通知
```

---

## 連携パターン3: 完全統合パイプライン

### 実装例: 社内ドキュメント自動更新フロー

```
全体像:

[Confluence/Notion の更新を n8n が検知]
  ↓
[n8n: ドキュメントテキストを取得・整形]
  ↓
[n8n → Dify API: ナレッジベース更新]
  POST /v1/datasets/{dataset_id}/document/create-by-text
  ↓
[Dify: 新ドキュメントをチャンキング・インデックス化]
  ↓
[n8n: 完了通知を Slack に投稿]
  「ナレッジベースが更新されました: [ページ名]」
```

### Dify ナレッジ API の呼び出し

```javascript
// n8n Function ノードのコード例

const DIFY_API_KEY = $env.DIFY_API_KEY;
const DATASET_ID = $env.DIFY_DATASET_ID;

const response = await $http.request({
  method: "POST",
  url: `https://api.dify.ai/v1/datasets/${DATASET_ID}/document/create-by-text`,
  headers: {
    "Authorization": `Bearer ${DIFY_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    name: $json.document_title,
    text: $json.document_content,
    indexing_technique: "high_quality",
    process_rule: {
      mode: "automatic"
    }
  })
});

return { documentId: response.data.document.id };
```

---

## 連携パターン4: Chatbot への統合

### 実装例: Slack Bot から Dify Chatflow を呼び出す

```
全体構成:

Slack → n8n（Slack Trigger）→ Dify（Chatflow API）→ n8n → Slack 返信

n8n のフロー:
  [Slack Trigger: @ボット宛てのメッセージ]
    ↓
  [Function: 会話履歴を管理]
    conversation_id = channel_id + thread_ts
    ↓
  [HTTP Request: Dify Chat API]
    POST /v1/chat-messages
    {
      "inputs": {},
      "query": "{{$json.text}}",
      "response_mode": "blocking",
      "conversation_id": "{{$json.dify_conversation_id}}",
      "user": "{{$json.user_id}}"
    }
    ↓
  [Function: レスポンスから回答を取り出す]
    answer = response.answer
    new_conversation_id = response.conversation_id
    ↓
  [Function: 会話 ID を保存（n8n の Static Data）]
    ↓
  [Slack: スレッドに返信]
```

Dify Chatflow API の主要パラメータ:
```
POST /v1/chat-messages

{
  "inputs": {},           // ワークフロー変数（任意）
  "query": "ユーザーの質問",
  "response_mode": "blocking",  // または "streaming"
  "conversation_id": "",  // 空 = 新規会話、値あり = 継続
  "user": "user-identifier"
}
```

詳細な Slack ボット実装: [Slack連携ボット構築](concepts_dify_usecase_slack_bot.md)

---

## 環境変数・シークレット管理

```
n8n と Dify の連携で必要な認証情報:

Dify 側:
  DIFY_API_KEY         → アプリの API キー（アプリ設定 → API キー）
  DIFY_DATASET_ID      → ナレッジベース ID（ナレッジ設定で確認）
  DIFY_BASE_URL        → セルフホストの場合のエンドポイント

n8n 側での管理:
  n8n Settings → Credentials → New Credential（HTTP Header Auth）
  → Name: DIFY_API_KEY
  → Value: app-xxxxxxxxxxxxxxxxxx

ローテーション方針:
  API キーは定期的に再発行する（月次推奨）
  n8n の Credential を更新するだけで全ワークフローに反映される
```

---

## アーキテクチャ選定フロー

```
どちらを主系にするか:

AI 処理がメイン + 外部連携はシンプル:
  → Dify を主系にして、Dify の HTTP Request ノードで外部 API を直接叩く

外部サービス連携が複雑 + AI 処理が部分的:
  → n8n を主系にして、Dify を「AI 処理 API」として呼び出す

両方複雑:
  → n8n を司令塔（オーケストレーター）
  → Dify を AI 専用サービス（マイクロサービス化）として位置付ける

コスト考慮:
  n8n Cloud: $20/月〜（ノード実行回数制限あり）
  n8n セルフホスト: 無料（サーバー代のみ）
  Dify Cloud: 無料プランあり / セルフホストも無料
```

---

## 参考：関連ドキュメント

- [Dify API・公開・デプロイ](concepts_dify_api_deployment.md) — Dify API の詳細仕様
- [マルチエージェントオーケストレーション](concepts_dify_usecase_multi_agent.md) — 複数 AI サービスの連携パターン
- [Slack連携ボット構築](concepts_dify_usecase_slack_bot.md) — Slack × Dify の実装詳細
- [Difyでできること・できないこと](concepts_dify_intro_limitations.md) — n8n との使い分け判断基準
