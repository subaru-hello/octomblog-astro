---
category: "概念"
order: 6
title: エージェント機能（自律推論・ReAct）
description: DifyのAgent Node——LLMが自律的にツールを選択・実行するReActループの仕組みと設計ガイド。
tags: ["Dify", "エージェント", "ReAct", "ツール選択", "自律推論", "LLMOps"]
emoji: "🤖"
date: "2026-04-09"
source: "Dify公式ドキュメント https://docs.dify.ai"
series:
  - Dify機能ガイド
---

## エージェントとは

「何をすべきか」を LLM 自身が判断し、ツールを自律的に選択・実行するモード。事前に処理フローを完全定義できない複雑なタスクに適する。

```
通常のワークフロー（決定論的）：
  [入力] → [Node A] → [Node B] → [Node C] → [出力]
  （フローは設計時に固定）

エージェント（自律的）：
  [入力] → [LLM が考える]
              ↓
         「検索が必要」→ [Search Tool を実行] → 結果を観察
              ↓
         「計算が必要」→ [Calculator を実行] → 結果を観察
              ↓
         「十分な情報が揃った」→ [最終回答を生成]
              ↓
         [出力]
```

---

## ReAct（Reason + Act）ループ

Dify のエージェントは ReAct フレームワークをベースにする。

```
┌──────────────────────────────────────────────────────┐
│                  ReAct ループ                          │
│                                                        │
│  ① Thought（思考）                                    │
│     「ユーザーの質問に答えるには最新の株価が必要だ」    │
│                    ↓                                   │
│  ② Action（行動）                                     │
│     tool: stock_price_lookup                           │
│     params: {"symbol": "AAPL"}                        │
│                    ↓                                   │
│  ③ Observation（観察）                                │
│     result: {"price": 185.50, "change": "+1.2%"}      │
│                    ↓                                   │
│  ④ 十分な情報があるか？ → なければ① に戻る            │
│              ↓ ある                                    │
│  ⑤ Final Answer（最終回答）                           │
│     「Appleの現在株価は$185.50で前日比+1.2%です」      │
└──────────────────────────────────────────────────────┘
```

---

## Agent ノードの設定

```yaml
Agent ノード設定項目:

  # 推論戦略
  strategy: ReAct  # または Function Calling

  # 利用可能なツール（LLM が選択して使う）
  tools:
    - google_search
    - calculator
    - my_custom_api

  # 最大イテレーション数
  max_iterations: 5  # 無限ループ防止

  # システムプロンプト（エージェントへの指示）
  system_prompt: |
    あなたは財務アナリストです。
    ユーザーの質問に答えるために必要なツールを使用してください。
    必ず数値には出典を示してください。

  # 出力変数
  output: agent_response
```

---

## 推論戦略の比較

### ReAct（Reasoning + Acting）

```
メリット：
  - 思考過程（Thought）が出力されるため、デバッグしやすい
  - ほぼすべてのモデルに対応
  - 複数ステップの複雑な推論に強い

デメリット：
  - トークン消費が多い（Thought の分）
  - やや遅い
```

### Function Calling

```
メリット：
  - ツール呼び出しがJSONで構造化される（安定性が高い）
  - トークン消費が少ない
  - OpenAI / Anthropic の最新モデルで特に高精度

デメリット：
  - Function Calling 対応モデルに限定される
```

---

## エージェントが向いているケース

```
向いている:
  ✓ 質問によって必要な情報が変わる（動的な情報収集）
  ✓ 複数のデータソースを組み合わせて回答する
  ✓ ユーザーの意図が曖昧で事前フロー定義が難しい
  ✓ 試行錯誤が必要なタスク（コード実行 → エラー → 修正）

向いていない:
  ✗ 毎回同じ処理フローで十分なケース → 通常のワークフローの方が速い
  ✗ 厳密な実行順序・監査が必要なケース → Workflow の方が安全
  ✗ コスト制約が厳しいケース → イテレーションを重ねるためコスト増
```

---

## ワークフロー内の Agent ノード

Agent 機能を単体アプリとしても、**Workflow の1ノードとして組み込む**こともできる。

```
[Workflow 例: 問い合わせ自動対応]

[Start]
  │
  ├── [Question Classifier]
  │       ├── 技術的な質問 → [Agent: 技術調査エージェント]
  │       ├── 料金の質問  → [Knowledge Retrieval: 料金DB]
  │       └── その他      → [LLM: 一般回答]
  │
  └── [Variable Aggregator] → [End]

エージェントを「複雑な処理が必要な分岐」にだけ使うことで
コストとレイテンシを最小化できる。
```

---

## 会話メモリの管理

Chatflow でエージェントを使う場合、過去の会話を引き継げる。

```
設定:
  Memory type: Full context（全履歴）or Last N turns（最近N回）
  
  全履歴: 文脈は完璧だが、長期会話でトークンが爆発する
  最近N回（推奨）: 直近の文脈だけを使い、トークンコストを制御する
```

---

## 実践ユースケース

- [カスタマーサポートボット](concepts_dify_usecase_customer_support.md) — Chatflow + Agent でリアルタイム情報検索
- [コードレビュー自動化](concepts_dify_usecase_code_review.md) — Agent がコードの問題点を自律的に調査
