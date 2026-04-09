---
category: "概念"
order: 3
title: ノード一覧と制御フロー（並列・イテレーション）
description: Difyワークフローの構成要素——20以上のノード種別・並列実行・ループ処理の仕組みを体系的に解説。
tags: ["Dify", "ワークフロー", "ノード", "並列実行", "イテレーション", "制御フロー"]
emoji: "⚙️"
date: "2026-04-09"
source: "Dify公式ドキュメント https://docs.dify.ai"
series:
  - Dify機能ガイド
---

## ノードとは

Dify ワークフローのビルディングブロック。各ノードが**入力変数を受け取り・処理し・出力変数を返す**。ノード同士を接続してデータフローを定義する。

```
[ノードの基本構造]
  入力変数（上流ノードの出力 or ユーザー入力）
    │
    ▼
  ┌─────────────┐
  │  Node Type  │  ← 処理内容（LLM推論、HTTPリクエスト、条件分岐…）
  └─────────────┘
    │
    ▼
  出力変数（下流ノードへ渡す）
```

---

## ノード種別一覧

### エントリー・出力系

| ノード | 役割 |
|---|---|
| **Start** | ワークフローの入口。ユーザー入力変数・システム変数を受け取る |
| **End** | Workflow の出口。最終出力変数を定義する |
| **Answer** | Chatflow 専用の出口。ストリーミング出力に対応 |

### AI 処理系

| ノード | 役割 |
|---|---|
| **LLM** | 選択したモデルへプロンプトを送り推論結果を返す。最も基本的なノード |
| **Knowledge Retrieval** | ナレッジベースをベクトル/全文/ハイブリッド検索でクエリする |
| **Question Classifier** | 入力テキストを複数クラスに分類してルーティングする |
| **Parameter Extraction** | 自然言語入力から構造化パラメータ（JSON）を抽出する |
| **Agent** | ツールを自律的に選択・実行できるReActエージェントを組み込む |

### 制御フロー系

| ノード | 役割 |
|---|---|
| **Conditional Branch** | IF / ELSE / ELIF で処理を分岐する |
| **Iteration** | リスト要素を繰り返し処理する（最大10並列） |
| **Variable Assigner** | 変数に値を代入・更新する |

### データ・統合系

| ノード | 役割 |
|---|---|
| **HTTP Request** | 外部APIへリクエストを送りレスポンスを変数に格納する |
| **Code** | Python または Node.js コードを隔離環境で実行する |
| **Template** | Jinja2テンプレートで変数を文字列に展開する |
| **List Operator** | リスト変数のフィルター・ソート・スライスを行う |
| **Variable Aggregator** | 複数分岐の出力をひとつの変数にまとめる |
| **Doc Extractor** | ファイル変数から本文テキストを取り出す |

### 人間介入系

| ノード | 役割 |
|---|---|
| **Human Input** | ワークフローを一時停止し人間の確認・入力を待つ |

---

## LLM ノードの詳細

```
[LLM ノード設定項目]

1. モデル選択
   → GPT-4o / Claude 3.7 / Gemini 2.0 / Llama 3.1 など

2. プロンプト
   System Prompt: システムプロンプト（変数展開可能）
   User Message: ユーザー入力（変数展開可能）

3. コンテキスト（オプション）
   → Knowledge Retrieval の結果を差し込む

4. メモリ（Chatflow のみ）
   → 過去の会話ターンを含める件数を設定

5. パラメータ
   Temperature / Top-P / Max Tokens など
```

---

## 制御フロー：条件分岐

```
Conditional Branch ノード：

                  [入力]
                    │
                    ▼
          ┌─────────────────┐
          │ IF: score > 80  │──→ 合格ルート → [LLM A]
          │ ELIF: score > 60│──→ 再検討ルート → [LLM B]
          │ ELSE            │──→ 不合格ルート → [LLM C]
          └─────────────────┘

条件には変数・演算子（==, >, contains, is empty 等）を組み合わせ可能。
```

---

## 制御フロー：並列実行

```
並列実行（Parallel Node）：

[Start] ──→ [LLM A: 要約]   ─┐
         ├→ [LLM B: 翻訳]   ─┤──→ [Variable Aggregator] ──→ [End]
         └→ [HTTP: 外部検索] ─┘

- 同じデータを複数ノードで同時処理
- 最大3階層のネスト並列をサポート
- WorkerPool が並列度を管理
```

---

## 制御フロー：イテレーション（ループ）

```
Iteration ノード：

入力: items = ["記事1", "記事2", "記事3", ...]
         │
         ▼
  ┌─────────────────────────────────────────┐
  │ Iteration                               │
  │                                         │
  │  [item] → [LLM: 翻訳] → [output_item]  │
  │                                         │
  └─────────────────────────────────────────┘
         │
         ▼
出力: results = ["翻訳1", "翻訳2", "翻訳3", ...]

最大10並列で同時処理（parallel_num 設定）
エラー時の動作: continue / stop を選択可能
```

---

## Code ノード（Python/JS実行）

```python
# Python の場合（隔離された Sandbox 環境で実行）
def main(inputs: dict) -> dict:
    text = inputs.get("text", "")
    words = len(text.split())
    
    return {
        "word_count": words,
        "summary": text[:100]
    }

# 制約：
# - ネットワークアクセス不可（セキュリティ）
# - 実行時間制限あり
# - 標準ライブラリのみ利用可能（一部サードパーティあり）
```

---

## HTTP Request ノード

```
設定項目：
  Method:  GET / POST / PUT / DELETE / PATCH
  URL:     https://api.example.com/endpoint（変数展開可能）
  Headers: Authorization: Bearer {{api_key}}
  Body:    {"query": "{{user_input}}", "limit": 10}

出力変数：
  body    : レスポンスボディ（JSON/テキスト）
  status_code: HTTPステータスコード
  headers : レスポンスヘッダ
```

---

## ノード設計のベストプラクティス

```
1. 単一責任: 1ノード = 1つの処理。肥大化したら分割する

2. 変数命名: わかりやすい名前をつける
   × output_1  →  ○ translated_text

3. エラー処理: HTTP ノードは status_code を確認してから下流へ渡す

4. 並列化: 独立した処理は積極的に並列化してレイテンシを削減

5. イテレーション: リスト処理でノードを何度もコピーしない
   → Iteration ノード1個で解決できる
```

---

## 実践ユースケース

- [構造化データ抽出ワークフロー](concepts_dify_usecase_data_extraction.md) — Code・Parameter Extraction・HTTP Request ノードの組み合わせ例
- [コンテンツ一括生成](concepts_dify_usecase_batch_content.md) — Iteration と並列実行を活用した例
