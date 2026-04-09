---
category: "概念"
order: 104
title: コンテンツ一括生成（Dify実践）
description: 商品説明・メール文面・翻訳などをDify WorkflowのIterationと並列実行で大量バッチ処理する実践例。
tags: ["Dify", "バッチ処理", "コンテンツ生成", "Iteration", "並列実行", "ユースケース"]
emoji: "⚡"
date: "2026-04-09"
source: "Dify公式ドキュメント https://docs.dify.ai"
series:
  - Difyユースケース
---

## シナリオ概要

**課題**: ECサイトに新製品を1000件登録したいが、各製品の説明文を手動で書くのが大変。商品名・仕様・カテゴリだけを渡せば、SEO に最適化された説明文を自動生成したい。

**解決策**: Dify Workflow の Iteration ノードで製品リストを処理し、並列化で速度を最大化する。

```
入力:
  products = [
    {"name": "ワイヤレスイヤホン Pro", "specs": "ノイキャン/30h再生", "category": "オーディオ"},
    {"name": "スマートウォッチ Air",   "specs": "心拍/GPS/5ATM防水",   "category": "ウェアラブル"},
    ... (1000件)
  ]

出力:
  [
    {"name": "ワイヤレスイヤホン Pro", "description": "最先端のノイズキャンセリング技術..."},
    {"name": "スマートウォッチ Air",   "description": "アクティブなライフスタイルに寄り添う..."},
    ...
  ]
```

---

## 使用する Dify 機能

| 機能 | 役割 |
|---|---|
| [ワークフロー vs チャットフロー](concepts_dify_workflow_chatflow.md) | Workflow で単発バッチ実行 |
| [ノード一覧](concepts_dify_nodes.md) | Iteration・並列・Code ノード |
| [変数システム](concepts_dify_variables.md) | リスト変数の操作 |

---

## ワークフロー設計

```
Workflow 構成:

[Start]
  │ {{products}}: JSON文字列（製品リスト）
  ▼
[Code: JSONパース]
  │ products_list = json.loads(products)
  │ {{code.product_list}}: 配列に変換
  ▼
[Iteration]
  │ items: {{code.product_list}}
  │ parallel_num: 10（10件を同時処理）
  │
  │  ┌─────────────────────────────────────────────┐
  │  │ 各製品に対して:                               │
  │  │                                               │
  │  │ [LLM: 説明文生成]                            │
  │  │   入力: item.name, item.specs, item.category  │
  │  │   出力: generated_description                  │
  │  │                                               │
  │  │ [Code: 製品情報と説明文をマージ]             │
  │  │   output: {name, specs, description}          │
  │  └─────────────────────────────────────────────┘
  │
  │ {{iteration.output_list}}: 全製品の結果配列
  ▼
[Code: 最終JSON整形]
  ▼
[End]
  出力: 完成した説明文リスト
```

---

## LLM プロンプト設計（説明文生成）

```
System:
あなたは EC サイトのコピーライターです。
SEO に強く、購買意欲を高める製品説明文を生成してください。

制約:
- 文字数: 150〜200文字
- キーワードを自然に含める
- 製品の特徴を具体的に表現する
- 文体: 丁寧語（です・ます調）

User:
製品名: {{item.name}}
仕様: {{item.specs}}
カテゴリ: {{item.category}}

上記の製品説明文を生成してください。
```

---

## 並列数とコストのトレードオフ

```
parallel_num の設定:

並列数1（直列）:
  1000件 × 2秒/件 = 約33分
  コスト: 安定（API レートリミットに引っかかりにくい）

並列数10:
  1000件 / 10 × 2秒 = 約3分
  コスト: 変わらないが API レートリミットに注意

並列数最大（10）推奨条件:
  - 使用モデルのレートリミットが高い（GPT-4o: 500 RPM等）
  - 大量データを急いで処理したい場合

並列数を抑える条件:
  - OpenAI の Tier 1（RPM 制限が低い）
  - コスト計測・デバッグ中
```

---

## 多言語コンテンツの一括生成

同じ製品を複数言語で展開するパターン。

```
[Iteration の中身を変更]

[LLM A: 日本語説明文] ─┐
[LLM B: 英語説明文]   ─┤── [Variable Aggregator] → 1つのオブジェクトに
[LLM C: 中国語説明文] ─┘

出力:
  {
    "name": "ワイヤレスイヤホン Pro",
    "ja": "最先端のノイズキャンセリング...",
    "en": "State-of-the-art noise cancelling...",
    "zh": "采用最先进的主动降噪技术..."
  }

3言語を並列生成するため、直列より2/3の時間で完了
```

---

## メール文面の一括生成

顧客セグメント別のメールマーケティング。

```
入力:
  customers = [
    {"name": "田中", "segment": "VIP", "last_purchase": "ワイヤレスイヤホン"},
    {"name": "鈴木", "segment": "休眠", "last_purchase": "スマートウォッチ"},
    ...
  ]

LLM プロンプト:
  "{{item.name}} 様向けの {{item.segment}} セグメントメールを生成"
  "前回購入: {{item.last_purchase}} に関連したパーソナライズ文を含める"

出力: 各顧客向けにカスタマイズされたメール本文
```

---

## 翻訳バッチ処理

```
入力: テキストのリスト（ブログ記事・ドキュメント等）

特有の注意点:
  - 文脈を保つため、段落単位でチャンキング
  - 前後の文脈を含めて翻訳精度を上げる
    （chunk[i-1] + chunk[i] + chunk[i+1] を LLM に渡す）
  - 専門用語は glossary として System Prompt に含める

[Code: グロッサリー生成]
  → [Iteration: 各段落を翻訳]
  → [Code: 段落を結合して完成文書]
```

---

## 実装のポイント

### エラーリカバリ

```
Iteration ノードのエラー処理設定:

  error_handling: continue  ← 1件失敗しても残りを続ける
  （stop にすると1件エラーで全体が止まる）

失敗した件のトラッキング:
  [Code ノード] で失敗時に error フラグを立てる
  → [End] で結果と一緒にエラーリストも返す
```

### 中間チェックポイント

```
1000件を一度に処理するよりも分割する:

外部から:
  Workflow API を 100件ずつ呼び出す
  → 失敗しても 100件分だけやり直せる
  → 進捗も管理しやすい
```

---

## 参考：他のユースケース

- [構造化データ抽出ワークフロー](concepts_dify_usecase_data_extraction.md) — 生成でなく抽出をバッチ処理したい場合
- [PDFドキュメント分析パイプライン](concepts_dify_usecase_doc_analysis.md) — ファイルのバッチ処理
