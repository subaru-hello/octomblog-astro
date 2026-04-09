---
title: "Claude Sonnet 4.6 - コスパ最強のOpusクラス性能"
category: "概念"
series:
  - "Anthropic Research - プロダクト"
source: "https://www.anthropic.com/news/claude-sonnet-4-6"
tags: ["anthropic", "claude", "sonnet", "llm", "model-release", "coding", "computer-use"]
date: "2026-04-09"
emoji: "⚡"
order: 4
---

## 概要

Anthropicが2026年2月17日に発表した最新Sonnetモデル。コーディング・Computer Use・長文理解・エージェント計画で大幅な改善を実現し、Opus 4.5と同等の性能をSonnet価格で提供することが大きな特徴。

## 要点

- FreeおよびProプランのclaude.aiでデフォルトモデルとして採用
- 価格はSonnet 4.5と同一（入力$3/出力$15 per Mトークン）
- ユーザーの70%がSonnet 4.5よりSonnet 4.6を選好（開発者テストより）
- OSWorldベンチマークで継続改善 — スプレッドシート操作とWebフォーム入力で人間レベルに接近
- 1Mトークンコンテキストウィンドウ（ベータ版）に対応
- プロンプトインジェクション耐性がSonnet 4.5から大幅改善

## 主要概念・技術

### 主な改善領域

#### コーディング能力
- 開発者テストでSonnet 4.5に対して約70%の確率で選好される
- Opus 4.5との比較でも59%の確率でSonnet 4.6が選ばれる
- Databricks、Replit、Cursor、GitHubなどのパートナーが「agentic coding at scale」での解決率向上を確認

#### Computer Use（コンピュータ操作）
Verceptチームの統合成果として、OSWorldベンチマークで継続的な改善：
- 複雑なスプレッドシートナビゲーション
- マルチステップのWebフォーム入力
- ブラウザをまたいだ操作

#### 長文コンテキスト処理
1Mトークンコンテキストウィンドウ（ベータ）で複数の研究論文やコードベース全体を一度に処理できる。

### ベンチマーク成績

| 評価 | 特徴 |
|---|---|
| OfficeQA | Opus 4.6に匹敵する文書理解性能 |
| Terminal-Bench 2.0 | 大幅改善 |
| ARC-AGI-2 | 大幅改善 |
| Vending-Bench Arena | 長期的戦略計画能力を実証 |

### 産業別の実績

| 分野 | 企業・成果 |
|---|---|
| 保険 | Pace：94%精度 |
| 金融分析 | 複雑な数値処理タスクで高精度 |
| モバイル開発 | Rakuten：iOS開発でProduction品質 |

### 新機能・API強化

- **適応的思考（Adaptive Thinking）**: 問題の複雑さに応じて思考量を自動調整
- **Extended Thinking対応**: 段階的な推論を必要とするタスク向け
- **コンテキスト圧縮（ベータ）**: 長期会話の実効コンテキスト長を拡大
- **Webサーチ・取得ツール**: 動的フィルタリング機能搭載

### 安全性評価

包括的なセキュリティ評価で「高度なミスアライメントに関する大きな懸念の兆候なし」と確認。プロンプトインジェクション耐性はSonnet 4.5から大幅に改善されており、エージェントとして実稼働環境に投入する際の信頼性が向上している。
