---
category: "概念"
order: 106
title: n8nエラーハンドリング・デバッグ
description: n8nワークフローのエラー処理戦略。ノードレベルのエラー設定・Error Triggerワークフロー・リトライ設定・デバッグ手法を解説。
tags: ["n8n", "エラーハンドリング", "デバッグ", "リトライ", "信頼性"]
emoji: "🛡️"
date: "2026-04-09"
source: "https://docs.n8n.io/flow-logic/error-handling/"
series:
  - n8nワークフロー自動化
---

## エラーハンドリングの必要性

本番ワークフローではAPIの一時障害・レート制限・データ不整合など様々なエラーが発生する。適切なエラーハンドリングなしでは、エラーが静かに無視されるか、ワークフロー全体が停止する。

## ノードレベルのエラー設定

各ノードの設定で「エラー時の動作」を制御できる。

```
Node Settings → On Error
```

| 設定値 | 動作 |
|---|---|
| Stop Workflow | エラーで全体停止（デフォルト） |
| Continue (Error Output) | エラーitemをエラー出力パスに渡す |
| Continue (Regular Output) | エラーを無視して次のノードへ |
| Retry on Fail | 失敗時に自動リトライ |

### Retry on Fail（リトライ設定）

```
Max Tries: 3
Wait Between Tries: 5000ms（5秒）
```

一時的なAPI障害や503エラーに有効。永続的なエラー（認証失敗・404等）にはリトライ不要。

## エラー出力パス（Error Branch）

`Continue (Error Output)` を設定すると、エラーが発生したitemがエラー専用の出力パスに流れる。

```
[HTTP Request] ─── 成功 ──→ [Slack: 通知]
                └── エラー →  [Slack: アラート] → [Airtable: ログ記録]
```

エラーitemには以下の情報が付与される:
```json
{
  "error": {
    "message": "Request failed with status code 404",
    "name": "NodeApiError",
    "httpCode": "404"
  }
}
```

## Error Trigger（ワークフロー全体のエラー監視）

専用の「Error Workflow」を設定することで、任意のワークフローのエラーを一元監視できる。

**設定手順:**
1. エラー通知専用のワークフローを作成
2. 起点ノードとして「Error Trigger」を設置
3. 監視対象ワークフローの `Settings → Error Workflow` に指定

Error Triggerで取得できる情報:
```json
{
  "workflow": { "id": "123", "name": "Order Processing" },
  "node": { "name": "HTTP Request", "type": "n8n-nodes-base.httpRequest" },
  "error": { "message": "..." },
  "execution": { "id": "456", "url": "..." }
}
```

## デバッグの手法

### 実行ログの確認

```
Executions → 実行一覧 → 特定実行をクリック
```

各ノードの入出力データを確認できる。エラー発生ノードは赤くハイライトされる。

### ピン留め（Pin Data）

ノードのテストデータを「ピン留め」して固定できる。
→ 本番APIを呼ばずに後続ノードのテストが可能

### 部分実行

ワークフロー途中の特定ノードから再実行できる。
→ エラー修正後に該当箇所だけ再テスト

## ユースケース

| ユースケース | 説明 | リンク |
|---|---|---|
| エラー時Slackアラート | APIエラーをSlackに即通知 | [→ doc](./concepts_n8n_usecase_error_slack_alert.md) |
| リトライ付き同期フロー | 堅牢なデータ同期の実装 | [→ doc](./concepts_n8n_usecase_retry_sync.md) |
| エラーログ記録 | エラーをAirtableに自動記録 | [→ doc](./concepts_n8n_usecase_error_log_airtable.md) |

## 公式ドキュメント

- https://docs.n8n.io/flow-logic/error-handling/
- https://docs.n8n.io/flow-logic/error-handling/error-workflows/
