---
category: "概念"
order: 7
title: ツール・プラグインエコシステム
description: Difyが持つ50以上のビルトインツール・カスタムツール・プラグインマーケットプレイスの仕組みと使い方。
tags: ["Dify", "ツール", "プラグイン", "OpenAPI", "外部連携", "LLMOps"]
emoji: "🔧"
date: "2026-04-09"
source: "Dify公式ドキュメント https://docs.dify.ai"
series:
  - Dify機能ガイド
---

## ツールとプラグインの位置付け

LLM 単体では「テキストを理解・生成する」しかできない。ツール/プラグインによって**現実世界と接続**する。

```
ツールなしの LLM:
  ユーザー「今日の天気は？」→ LLM「わかりません（学習データにリアルタイム情報なし）」

ツールありのエージェント:
  ユーザー「今日の天気は？」
    → LLM「weather_api ツールを使おう」
    → [weather_api: location=Tokyo] → {temp: 22°C, condition: 晴れ}
    → LLM「東京は現在22度で晴れています」
```

---

## ビルトインツール（50以上）

### 検索・情報収集系

| ツール | 機能 |
|---|---|
| Google Search | Google 検索結果を取得（SerpAPI経由） |
| Bing Search | Bing 検索（Microsoft Azure連携） |
| DuckDuckGo | プライバシー重視の検索 |
| Wikipedia | Wikipedia 記事を取得 |
| Jina Reader | Webページをマークダウンに変換して取得 |
| Firecrawl | Webサイトを再帰的にクロールしてテキスト取得 |

### コンテンツ生成系

| ツール | 機能 |
|---|---|
| DALL-E | OpenAI の画像生成（テキスト→画像） |
| Stable Diffusion | ローカル/APIでの画像生成 |

### データ処理系

| ツール | 機能 |
|---|---|
| WolframAlpha | 数学・科学計算・データ解析 |
| Calculator | 算術演算 |
| Chart | データをチャート画像に変換 |

### コミュニケーション系

| ツール | 機能 |
|---|---|
| Slack | メッセージ送信・チャンネル読み取り |
| Gmail | メール送信・読み取り |
| Notion | ページ作成・読み取り |

---

## カスタムツール（OpenAPI連携）

OpenAPI 3.0 仕様（Swagger）をインポートするだけで任意の REST API をツール化できる。

```yaml
# OpenAPI スキーマ例（社内在庫APIをDifyツール化）
openapi: "3.0.0"
info:
  title: 在庫管理API
  version: "1.0"
paths:
  /inventory/check:
    get:
      operationId: checkInventory
      summary: 商品在庫を確認する
      parameters:
        - name: product_id
          in: query
          required: true
          schema:
            type: string
          description: 商品ID
      responses:
        "200":
          description: 在庫情報
          content:
            application/json:
              schema:
                type: object
                properties:
                  quantity:
                    type: integer
                  status:
                    type: string
```

```
インポート手順:
  Tools → Custom Tools → Add Tool
  → OpenAPI スキーマを貼り付け or URLから取得
  → 認証設定（API Key / Bearer Token / Basic Auth）
  → 保存 → エージェントで利用可能になる
```

---

## ワークフローをツールとして再利用

作成した Workflow を別のエージェントやフローから呼び出せる。

```
Workflow A（文書要約ワークフロー）をツール化：
  → エージェントが「長い文書を要約したい」と判断したとき
    "summarize_document" ツールを呼び出す
  → Workflow A が実行され、要約結果が返ってくる

メリット：
  - 複雑な処理をカプセル化して再利用できる
  - エージェントの判断でオンデマンド実行される
```

---

## プラグインエコシステム（v1.0.0+）

Dify v1.0 からプラグインシステムが導入された。

```
プラグインの種別：
  ┌─────────────────────────────────────────────────────┐
  │  Tools        外部サービスとの統合（Slack, GitHub...）  │
  │  Extensions   HTTP Webhook による双方向連携            │
  │  Agent Strategies カスタム推論ロジック（CoT, ToT...）  │
  │  Model Plugins カスタムモデルプロバイダーの実装        │
  │  Bundles      プラグインのキュレーションコレクション    │
  └─────────────────────────────────────────────────────┘
```

### Dify Marketplace

```
Marketplace URL: https://marketplace.dify.ai

- コミュニティが公開したプラグインを1クリックでインストール
- 人気のプラグイン例：
    GitHub Issues 管理
    Linear タスク作成
    Jira チケット連携
    Stripe 決済情報取得
    Salesforce CRM連携
```

---

## Extensions（HTTP Webhook連携）

ツールが提供されていない外部サービスと連携するための仕組み。

```
Extension の動作：

Dify からリクエスト
  │
  ▼
[自前のHTTPサーバー/AWS Lambda等]
  │ 任意の処理
  ▼
レスポンスを Dify に返す

用途例：
  - 社内システムとの連携（APIキーを外部公開したくない場合）
  - 複雑な変換処理（Difyのノードだけでは難しい処理）
  - 外部Webhookのトリガー（GitHub Actions起動等）
```

---

## ツール設計のポイント

```
1. 粒度を適切に保つ
   × "全部やる" ツール → LLM が使い方を間違える
   ○ "1つのことをうまく" ツール → 選択が確実になる

2. エラーレスポンスを設計する
   {"error": "Product not found"} を返すと
   エージェントが「別の方法を試そう」と判断できる

3. Description を丁寧に書く
   LLM はこの説明文からツールを選ぶ。
   「いつ使うべきか」「何を返すか」を明確に記述する

4. 認証情報はEnvironment変数で管理
   ハードコーディングせず Dify の Secrets 機能を使う
```

---

## 実践ユースケース

- [コードレビュー自動化](concepts_dify_usecase_code_review.md) — GitHub API ツールとエージェントの組み合わせ
- [マルチエージェントオーケストレーション](concepts_dify_usecase_multi_agent.md) — 複数ツールを使うエージェント協調
