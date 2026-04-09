---
category: "概念"
order: 119
title: n8nワークフローの基本（ノード・コネクション・実行）
description: n8nワークフローを構成するノード・コネクション・実行モードの基本概念。手動実行・本番実行・部分実行の違いと、データ構造（item配列）の理解。
tags: ["n8n", "ワークフロー", "ノード", "実行", "データ構造"]
emoji: "⚙️"
date: "2026-04-09"
source: "https://docs.n8n.io/workflows/"
series:
  - n8nワークフロー自動化
---

## ワークフローの構成要素

### ノード（Node）

ワークフローの処理単位。各ノードが1つの役割を担う。

| 種別 | 役割 | 例 |
|---|---|---|
| Trigger | ワークフローの起点 | Webhook Trigger, Schedule Trigger |
| Action | APIへの操作 | Slack（メッセージ送信）, Gmail（メール送信） |
| Core | データ加工・制御 | Code, Filter, Merge, HTTP Request |
| AI | LLM・ベクターDB操作 | OpenAI, LangChain Agent |

### コネクション（Connection）

ノードとノードをつなぐ矢印。前のノードの**出力データ**が次のノードの**入力データ**になる。

- 1つのノードから複数のコネクションを出せる（並列処理）
- エラー出力用のコネクション（赤い矢印）も設定可能

### データ構造

n8nのデータは**item（アイテム）の配列**として流れる。

```json
[
  { "json": { "name": "Alice", "email": "alice@example.com" } },
  { "json": { "name": "Bob",   "email": "bob@example.com"   } }
]
```

- 各ノードはitem配列を受け取り、加工してitem配列を返す
- `{{ $json.name }}` のように**式（Expression）**でデータを参照できる

## 実行モード

| モード | 説明 | 用途 |
|---|---|---|
| 手動実行 | UIの「Test workflow」ボタン | 開発・デバッグ |
| 本番実行 | Triggerが発火した際の自動実行 | 運用 |
| 部分実行 | 特定ノードから再実行 | デバッグ |

## 式（Expression）の基本

```
{{ $json.fieldName }}          // 現在ノードのデータ参照
{{ $('NodeName').item.json.x }} // 別ノードのデータ参照
{{ $now }}                      // 現在日時
{{ $itemIndex }}                // 現在のitem番号
```

## ワークフローの状態管理

- **アクティブ**: Triggerが有効。本番実行を受け付ける
- **非アクティブ**: Triggerが停止。手動実行のみ可能
- **バージョン履歴**: 変更履歴を保存・ロールバック可能

## ユースケース

| ユースケース | 説明 | リンク |
|---|---|---|
| 朝のSlack通知 | 毎朝天気・ニュースをSlackに自動通知 | [→ doc](./concepts_n8n_usecase_morning_slack_weather.md) |
| GitHub×Googleシート連携 | PRをシートに自動記録 | [→ doc](./concepts_n8n_usecase_github_sheet_sync.md) |
| Welcomeメール自動化 | 新規登録ユーザーへの自動メール | [→ doc](./concepts_n8n_usecase_welcome_email.md) |

## 公式ドキュメント

- https://docs.n8n.io/workflows/
- https://docs.n8n.io/data/
