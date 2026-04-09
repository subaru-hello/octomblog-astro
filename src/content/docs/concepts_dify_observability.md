---
category: "概念"
order: 10
title: 可観測性・デバッグ・評価（LangSmith等）
description: Difyの実行ログ・トレース・評価機能と、LangSmith/Langfuse等の外部可観測性ツール連携を解説。
tags: ["Dify", "可観測性", "デバッグ", "LangSmith", "Langfuse", "トレース", "LLMOps"]
emoji: "🔍"
date: "2026-04-09"
source: "Dify公式ドキュメント https://docs.dify.ai"
series:
  - Dify機能ガイド
---

## LLMアプリに可観測性が必要な理由

LLM はブラックボックス。「なぜこの回答が生成されたのか」が見えなければ、品質改善もコスト最適化もできない。

```
LLM アプリの観測が難しい理由:
  - 確率的な出力（同じ入力でも出力が変わる）
  - 長い実行チェーン（どのノードで問題が起きた？）
  - トークンコストの積み上がり（どの処理が高コスト？）
  - ユーザーの不満の原因（何が問題だった？）
```

---

## Dify ビルトインの観測機能

### 実行ログ（Logs）

```
Logs ページで確認できる情報:

各実行（Run）の詳細:
  ┌──────────────────────────────────────────┐
  │ Run ID: run-abc123                        │
  │ Status: succeeded / failed                │
  │ User: user-123                            │
  │ Started At: 2026-04-09 14:30:00           │
  │ Elapsed: 3.2s                             │
  │ Total Tokens: 1,250                       │
  │ Cost: $0.0025                             │
  └──────────────────────────────────────────┘

各ノードの詳細（クリックで展開）:
  - 入力変数の値
  - 出力変数の値
  - 処理時間
  - エラーメッセージ（失敗時）
```

### ワークフロートレース（v1.5.0+）

```
ビジュアルなフロー図でリアルタイムに実行を追う:

[Start] → [LLM] → [Knowledge Retrieval] → [Answer]
   ✅        ✅            ✅                   ✅

各ノードの状態:
  ✅ 成功（緑）
  ❌ 失敗（赤）
  ⏳ 実行中（黄）
  ⏸️ スキップ（グレー）
```

### アノテーション（回答評価）

```
実際の会話に対してラベルを付ける機能:

Annotation ワークフロー:
  1. ユーザーが送った質問・Difyの回答を閲覧
  2. 人間が「Good/Bad」を評価
  3. Bad の回答には「正解の回答」を記録
  4. 蓄積したアノテーションをプロンプト改善に活用

→ 教師あり評価データセットを構築できる
```

---

## 外部可観測性ツールとの連携

### LangSmith

```
Settings → Monitoring → LangSmith

設定項目:
  API Key: ls__xxxxxxxxxx
  Project: dify-production（任意のプロジェクト名）

LangSmith で見られるもの:
  - 全実行のトレース（入力/出力/レイテンシ）
  - エラーレート・成功率
  - モデル別のコスト分析
  - A/Bテスト（Comparison View）
  - 評価指標（正確性・忠実性・有害性等）
```

### Langfuse

```
Settings → Monitoring → Langfuse

設定項目:
  Public Key: pk-lf-xxxxxxxx
  Secret Key: sk-lf-xxxxxxxx
  Host: https://cloud.langfuse.com（セルフホストも可）

Langfuse の強み:
  - オープンソース（セルフホスト可能）
  - トレース・スコア・フィードバックの一元管理
  - プロンプトバージョン管理との連携
  - LLMコスト追跡（詳細）
```

### Helicone

```
Settings → Monitoring → Helicone

Helicone の特徴:
  - OpenAI/Anthropic のプロキシとして動作
  - リクエスト/レスポンスをすべてキャプチャ
  - リアルタイムのコスト・レイテンシダッシュボード
  - キャッシュ機能（同じリクエストのAPI課金を削減）
  - レート制限の設定
```

### Arize Phoenix (AX)

```
Settings → Monitoring → ArizePhoenix

Arize の強み:
  - エンタープライズグレードの LLM モニタリング
  - ドリフト検出（出力品質の変化を自動検知）
  - 幻覚（Hallucination）検出
  - バイアス分析
  - 本番データのリアルタイム評価
```

---

## デバッグ実践

### ノード単体のデバッグ

```
Workflow エディタ上での単体テスト:

1. ノードを右クリック → "Run this node"
2. テスト入力を入力
3. 出力変数を確認

→ フロー全体を通さず、特定ノードだけ検証できる
```

### よくあるエラーと対処

```
エラー: "Variable not found: {{upstream_node.output}}"
原因: 参照しているノードの変数名が間違っている
対処: 変数名をUIのドロップダウンで確認・再選択

エラー: "LLM token limit exceeded"
原因: コンテキストが長すぎてモデルの上限を超えた
対処:
  1. Knowledge Retrieval の top_k を減らす
  2. より長いコンテキストのモデルに変える（Claude 3 等）
  3. プロンプトを短縮する

エラー: "HTTP Request: timeout"
原因: 外部APIの応答が遅い
対処:
  1. タイムアウト設定を伸ばす（デフォルト10秒）
  2. 並列実行を避けて直列にする（外部APIの並列制限に注意）

エラー: "Code: execution failed"
原因: Pythonコードに構文エラーまたはランタイムエラー
対処:
  1. ローカルで同じコードを検証してから貼り付ける
  2. エラーメッセージのスタックトレースを確認
```

---

## 評価（Evaluation）の設計

```
LLM 出力の品質評価指標:

1. 忠実性（Faithfulness）
   「回答が文書に基づいているか」
   → RAG回答の根拠確認に使う

2. 回答関連性（Answer Relevance）
   「回答がユーザーの質問に答えているか」
   → 的はずれな回答を検出

3. 文脈精度（Context Precision）
   「取得したチャンクが実際に使われたか」
   → 検索精度の評価に使う

4. 有害性（Toxicity）
   「回答に有害なコンテンツが含まれるか」
   → セーフティフィルター

これらの評価は Langfuse / LangSmith でモデルベース評価として自動化できる
```

---

## コスト最適化のモニタリング

```
ログデータから分析すべき指標:

1. p95 レイテンシ → SLO 設定の基準
2. 平均トークン数 → 異常に高いケースを特定
3. エラーレート → 5%超えたら要調査
4. コスト/会話 → ユーザー数 × コスト = 予算計画

コスト削減のヒント:
  - 高コストノードを特定 → 安価なモデルに変更
  - Knowledge Retrieval の top_k を最小化
  - Helicone のキャッシュで繰り返し同じクエリのコスト削減
```

---

## 実践ユースケース

- [マルチエージェントオーケストレーション](concepts_dify_usecase_multi_agent.md) — 複雑なワークフローの可観測性設計
