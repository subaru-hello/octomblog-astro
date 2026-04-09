---
category: "概念"
order: 103
title: n8nロジック制御（フィルター・条件分岐・ループ・マージ）
description: n8nワークフローの制御構造。Filterノードでの絞り込み・IFノードでの条件分岐・Loopノードでのイテレーション・Mergeノードでのデータ統合を解説。
tags: ["n8n", "条件分岐", "ループ", "フィルター", "マージ", "制御フロー"]
emoji: "🔀"
date: "2026-04-09"
source: "https://docs.n8n.io/flow-logic/"
series:
  - n8nワークフロー自動化
---

## ロジック制御ノード一覧

| ノード | 役割 |
|---|---|
| Filter | 条件に合うitemだけを通過させる |
| IF | 条件に応じて処理を2方向に分岐 |
| Switch | 複数条件による多方向分岐 |
| Loop Over Items | item配列を1件ずつ処理 |
| Merge | 複数パスのデータを統合 |
| Wait | 指定時間・条件まで処理を待機 |

## Filter（フィルター）

条件に合致するitemだけを後続に渡す。SQLのWHEREに相当。

```
入力: [Alice(age:25), Bob(age:17), Carol(age:30)]
条件: age >= 18
出力: [Alice(age:25), Carol(age:30)]
```

**設定例:**
```
フィールド: {{ $json.age }}
演算子: 以上
値: 18
```

複数条件はAND / OR で組み合わせ可能。

## IF（条件分岐）

trueとfalseの2つの出力パスに処理を分岐する。

```
[IF: status == "paid"]
  ├── true  → 領収書送信ノード
  └── false → 未払い通知ノード
```

## Switch（多方向分岐）

3方向以上に分岐する場合に使用。

```
[Switch: plan]
  ├── "free"       → 無料プラン処理
  ├── "pro"        → Proプラン処理
  └── "enterprise" → Enterprise処理
```

## Loop Over Items

item配列を1件ずつ処理するループ。**バッチサイズ**を設定してAPI制限に対応できる。

```
[顧客リスト 100件] → [Loop Over Items] → [メール送信ノード]
                           ↑_________________|（100回繰り返し）
```

**設定項目:**
- `Batch Size`: 1回のループで処理するitem数（デフォルト: 1）
- `Reset`: ループ開始時に内部カウンターをリセット

## Merge（データ統合）

複数のパスからのデータを1つに統合する。

| Modeオプション | 動作 |
|---|---|
| Append | 全パスのitemを順番に結合 |
| Combine | 同じインデックスのitemを1つにマージ |
| SQL Query | 2つのデータセットをJOIN的にマージ |
| Wait for All | 全パスの完了を待って統合 |

## Wait（待機）

処理を一時停止する。

- **固定時間待機**: 指定秒数・分数だけ待つ
- **Webhook再開**: 外部リクエストが来るまで待つ（承認フローなどに使用）

## ユースケース

| ユースケース | 説明 | リンク |
|---|---|---|
| リードルーティング | 属性で担当者を条件分岐 | [→ doc](./concepts_n8n_usecase_lead_routing.md) |
| 一括メール送信 | ループで全リスト処理 | [→ doc](./concepts_n8n_usecase_bulk_email_loop.md) |
| 複数API統合レポート | Mergeで複数ソースを結合 | [→ doc](./concepts_n8n_usecase_multi_source_merge.md) |

## 公式ドキュメント

- https://docs.n8n.io/flow-logic/splitting/
- https://docs.n8n.io/flow-logic/looping/
- https://docs.n8n.io/flow-logic/merging/
