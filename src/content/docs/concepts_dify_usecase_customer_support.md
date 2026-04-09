---
category: "概念"
order: 103
title: カスタマーサポートボット（Dify実践）
description: 製品FAQ・注文状況・返品対応を自律的に処理するカスタマーサポートボットをDify Chatflowで構築する実践例。
tags: ["Dify", "カスタマーサポート", "チャットフロー", "エージェント", "RAG", "ユースケース"]
emoji: "🎧"
date: "2026-04-09"
source: "Dify公式ドキュメント https://docs.dify.ai"
series:
  - Difyユースケース
---

## シナリオ概要

**課題**: ECサイトのカスタマーサポートに大量の問い合わせが来るが、多くが「注文状況確認」「返品方法」「製品の使い方」の3種類に集中している。

**解決策**: Dify Chatflow で意図分類 → 専門処理（RAG/API/Agent）にルーティングするボットを構築。人間が対応すべき複雑なケースは有人チャットへエスカレーション。

```
ユーザー: 「注文した商品がまだ届いていない」
  → 意図分類: 配送問い合わせ
  → 注文管理APIへ問い合わせ
  → 「ご注文 #12345 は現在配送中です。お届け予定は明日です。
      追跡番号: JP1234567890」
```

---

## 使用する Dify 機能

| 機能 | 役割 |
|---|---|
| [ワークフロー vs チャットフロー](concepts_dify_workflow_chatflow.md) | Chatflow で文脈保持 |
| [エージェント機能](concepts_dify_agents.md) | 動的な API 呼び出しと推論 |
| [ナレッジベース・RAG](concepts_dify_knowledge_rag.md) | FAQ・製品マニュアル検索 |
| [変数システム](concepts_dify_variables.md) | 会話変数でユーザー情報保持 |

---

## ワークフロー設計

```
Chatflow 構成:

[Start]
  │ {{sys.query}}: ユーザー入力
  ▼
[Question Classifier]
  │ 意図を分類
  ├── 注文・配送に関する質問 ──────────────────→ [注文フロー]
  ├── 製品の使い方・トラブルシューティング → [FAQ フロー]
  ├── 返品・交換の手続き ─────────────────→ [返品フロー]
  └── 複雑・感情的・クレーム ────────────→ [エスカレーションフロー]

[注文フロー]
  ├── [Parameter Extraction: 注文番号を抽出]
  │     {{order_id}}: 注文番号（なければ質問して取得）
  ├── [HTTP Request: 注文管理API]
  │     GET /api/orders/{{order_id}}
  │     {{order_info}}: 注文・配送情報
  └── [LLM: 自然言語で回答]

[FAQ フロー]
  ├── [Knowledge Retrieval: 製品マニュアルDB]
  │     {{faq_context}}: 関連FAQ
  └── [LLM: FAQ に基づいて回答]

[返品フロー]
  ├── [HTTP Request: 注文API で注文日を確認]
  ├── [Code: 返品期限（30日以内）を計算]
  └── [LLM: 返品可否と手順を案内]

[エスカレーションフロー]
  └── [Answer: 有人チャットへの転送メッセージ]
```

---

## 会話変数の活用

```
初回ターン:
  [LLM: ユーザー名を抽出] → [Variable Assigner]
    conversation.user_name = "田中さん"
    
  以降のターン:
    「${conversation.user_name}、お問い合わせありがとうございます」
    → 毎回名前を聞かなくて済む

注文情報を覚えておく:
  conversation.last_order_id = "12345"
  
  Turn 1: 「12345の注文はどうなってる？」
  Turn 2: 「返品したい」← 注文番号を再入力させない
```

---

## Parameter Extraction ノード

自然言語から注文番号を抽出する設定。

```yaml
ノード: Parameter Extraction
入力: {{sys.query}}

抽出パラメータ定義:
  - name: order_id
    type: string
    description: "注文番号（例: #12345, 注文12345, ORD-12345など）"
    required: false

  - name: product_name
    type: string
    description: "問い合わせしている製品名"
    required: false

出力:
  {{param_extraction.order_id}}: "12345"（見つかった場合）
  {{param_extraction.order_id}}: null（見つからない場合）
```

---

## 注文番号が見つからない場合の処理

```
[Conditional Branch]
  IF: {{param_extraction.order_id}} is not empty
    → [HTTP Request: 注文API]
  ELSE:
    → [Answer: "ご注文番号をお教えください（例: #12345）"]

→ 次のターンで番号が来たら会話変数に保存して継続
```

---

## エスカレーション判断

```
Question Classifier で「クレーム・感情的・複雑」に分類されたら:

[Answer]
  「大変ご不便をおかけして申し訳ございません。
  担当オペレーターにおつなぎします。
  少しお待ちください。
  
  チャット引き継ぎ番号: {{sys.conversation_id}}
  （オペレーターにこの番号をお伝えください）」

→ 会話IDを使って有人チャットシステムと連携
→ 過去の会話ログもIDで参照可能
```

---

## 実装のポイント

### 1. 分類の精度を上げる

```
Question Classifier のプロンプトに具体例を含める:

「注文・配送」の例:
  - "荷物が届かない"
  - "到着はいつ？"
  - "#12345 の状況は"

「FAQ」の例:
  - "使い方がわからない"
  - "設定方法を教えて"
  
→ 例が多いほど分類精度が上がる
```

### 2. API エラーへの対処

```
[Conditional Branch]
  IF: {{http_order.status_code}} == 200
    → 正常処理
  ELIF: {{http_order.status_code}} == 404
    → [Answer: "その注文番号が見つかりませんでした。ご確認ください"]
  ELSE:
    → [Answer: "現在システムが混み合っています。しばらく後でお試しください"]
```

### 3. 応答時間の短縮

```
人間は返答が遅いとチャットから離脱する:

- ストリーミング出力を ON（Answer ノードの設定）
  → テキストが生成されながらリアルタイム表示

- 重い処理（API呼び出し）は並列化
  → 注文情報と配送状況を同時取得

- よくある質問はキャッシュ
  → Helicone のキャッシュ機能を活用
```

---

## 参考：他のユースケース

- [RAGチャットボット構築](concepts_dify_usecase_rag_chatbot.md) — FAQ専用の簡易版
- [マルチエージェントオーケストレーション](concepts_dify_usecase_multi_agent.md) — より複雑な自律処理
