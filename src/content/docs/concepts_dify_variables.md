---
category: "概念"
order: 8
title: 変数システムとデータフロー
description: Difyワークフローを貫くデータの流れ——入力・出力・会話・環境・システム変数の種別と使い方を体系的に解説。
tags: ["Dify", "変数", "データフロー", "会話変数", "ワークフロー", "LLMOps"]
emoji: "📊"
date: "2026-04-09"
source: "Dify公式ドキュメント https://docs.dify.ai"
series:
  - Dify機能ガイド
---

## 変数の役割

Dify のワークフローはノード間でデータを**変数**を通じて受け渡す。変数がなければノードは孤立した処理で終わり、フロー全体の「流れ」が生まれない。

```
[Start]
  │ user_input = "Pythonの非同期処理を教えて"
  ▼
[Knowledge Retrieval]
  │ context = [チャンク1, チャンク2, ...]
  ▼
[LLM]
  │ answer = "Pythonの非同期処理は asyncio ライブラリを..."
  ▼
[End / Answer]

→ 各矢印が「変数によるデータの受け渡し」
```

---

## 変数の種別

### 1. 入力変数（Input Variables）

Start ノードで定義する。ユーザーや API からの入力を受け取る。

```yaml
入力変数の型:
  String  : テキスト（ユーザーの質問等）
  Number  : 数値（件数・しきい値等）
  Select  : ドロップダウン選択肢
  Paragraph: 長いテキスト
  File    : ファイルアップロード（PDF等）
  File List: 複数ファイル

例:
  user_question: String（必須）
  language: Select ["ja", "en", "zh"]（任意）
  document: File（任意）
```

### 2. 出力変数（Output Variables）

各ノードが生成する変数。下流ノードで参照できる。

```
[LLM ノード] が生成する変数:
  {{lllm_node.text}}     : 生成テキスト
  {{llm_node.usage}}     : トークン使用量
  {{llm_node.finish_reason}}: 終了理由

[HTTP Request ノード] が生成する変数:
  {{http_node.body}}     : レスポンスボディ
  {{http_node.status_code}}: HTTPステータス
  {{http_node.headers}}  : レスポンスヘッダ

[Code ノード] が生成する変数:
  return {"result": ...} で定義した変数すべて
```

### 3. 会話変数（Conversation Variables）— Chatflow 専用

会話セッション全体を通して値を保持できる変数。ページをリロードしても消えない。

```yaml
型:
  String, Number, Object, Array, File

使い方:
  - Variable Assigner ノードで書き込む
  - 任意のノードで {{conversation_variable}} として読み込む

典型的な用途:
  user_name: "山田太郎"（1回取得して全ターンで使い回す）
  topic: "Pythonプログラミング"（現在の話題）
  order_items: [...]（注文内容を蓄積）
  language: "ja"（ユーザーの言語設定）
```

### 4. 環境変数（Environment Variables）

API キーなどの機密情報を安全に管理する。ハードコーディングを避けるため。

```
Settings → Environment Variables → Add Variable

種別:
  String: テキスト
  Number: 数値
  Secret: 暗号化保存（ログに表示されない）←APIキーはこれ

参照方法:
  {{env.MY_API_KEY}}

用途:
  - 外部APIのシークレットキー
  - 接続先URLなどの設定値
  - 環境ごとに変えたい設定（dev/staging/prod）
```

### 5. システム変数（System Variables）

Dify が自動的に提供する変数。設定不要で使える。

```
{{sys.user_id}}            : 現在のユーザーID
{{sys.app_id}}             : アプリID
{{sys.conversation_id}}    : 会話セッションID（Chatflow）
{{sys.query}}              : 最新のユーザー入力（Chatflow）
{{sys.files}}              : アップロードされたファイル
{{sys.dialogue_count}}     : 現在の会話ターン数（Chatflow）
{{sys.workflow_run_id}}    : ワークフロー実行ID（Workflow）
```

---

## 変数の参照方法

### ドロップダウン選択（GUI）

```
ノードの入力欄でスラッシュ(/)を打つと変数一覧が表示される
→ 上流ノードの変数を一覧から選択して差し込む
```

### Jinja2 テンプレート

Template ノードや LLM プロンプト内で使える。

```jinja2
こんにちは、{{ conversation.user_name }} さん！
今日の{{ sys.query }}についてお答えします。

{% if items | length > 0 %}
カート内の商品：
{% for item in items %}
  - {{ item.name }}: {{ item.price }}円
{% endfor %}
合計: {{ items | sum(attribute='price') }}円
{% endif %}
```

---

## データフローの設計パターン

### パターン1: 線形パイプライン

```
{{start.user_query}}
  → [Knowledge Retrieval] → {{retrieval.context}}
  → [LLM] → {{llm.answer}}
  → [End]
```

### パターン2: 並列集約

```
{{start.text}}
  ├─→ [LLM A: 要約]     → {{llm_a.summary}}
  ├─→ [LLM B: 感情分析] → {{llm_b.sentiment}}
  └─→ [LLM C: 翻訳]     → {{llm_c.translation}}
       ↓ Variable Aggregator
  [End] → {{result}}
```

### パターン3: 会話状態管理（Chatflow）

```
Turn N:
  {{sys.query}} = "注文したい"
    → [分類] → 注文フロー
    → [LLM]  → "何をご注文しますか？"
    → [Variable Assigner: conversation.flow = "ordering"]

Turn N+1:
  {{conversation.flow}} を読んで「注文フロー中」と判断
    → 適切なノードへルーティング
```

---

## Variable Assigner ノード

会話変数への書き込みを担う専用ノード。

```yaml
設定例:
  # ユーザー名を会話変数に保存
  target: conversation.user_name
  value: {{llm_name_extractor.text}}

  # リストに追加（append モード）
  target: conversation.history
  mode: append
  value: {{sys.query}}
```

---

## 実践ユースケース

- [構造化データ抽出ワークフロー](concepts_dify_usecase_data_extraction.md) — 変数の型変換とデータ整形の実例
