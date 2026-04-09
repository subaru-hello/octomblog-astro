---
category: "概念"
order: 200
title: リトライ付きの堅牢なデータ同期フローを構築する
description: APIのレート制限・一時障害に対応するリトライロジックとエクスポネンシャルバックオフを実装し、24時間安定して動作するデータ同期ワークフローのパターン。
tags: ["n8n", "ユースケース", "リトライ", "データ同期", "レート制限", "堅牢性", "冪等性"]
emoji: "🔁"
date: "2026-04-09"
source: "https://docs.n8n.io/flow-logic/error-handling/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

外部APIへのデータ同期で発生する一時的なエラー（503・429・タイムアウト）に自動でリトライし、永続的なエラーのみ担当者に通知する堅牢なフロー設計パターン。

**解決する課題**: API一時障害のたびに手動再実行が必要な状況をなくし、自己修復するワークフローを実現する

**使用するn8nノード:**
- HTTP Request（`Retry on Fail` 設定）
- Code（リトライ状態の管理）
- Wait（エクスポネンシャルバックオフ）
- IF（リトライ可能エラーと永続エラーの区別）

## ワークフロー構成

**パターン1: ノード組み込みリトライ（シンプル）**

```
[HTTP Request]
  ↓ Settings → On Error: Retry on Fail
    Max Tries: 5
    Wait Between Tries: 3000ms
```

**パターン2: カスタムリトライロジック（詳細制御）**

```
[HTTP Request: API呼び出し（Error Output有効）]
  ├── 成功 → 後続処理
  └── エラー →
      [Code: リトライ回数カウントアップ]
          ↓
      [IF: retryCount < 3 AND statusCode IN [429, 503, 504]]
        ├── true  →
        │   [Code: 待機時間計算（指数的バックオフ）]
        │       ↓
        │   [Wait: 計算された時間待機]
        │       ↓
        │   [HTTP Request: 再試行]
        └── false → [Slack: 永続エラー通知]
```

## 実装手順

### パターン1: 組み込みリトライの設定

```
Node Settings:
  On Error: Retry on Fail
  Max Tries: 3
  Wait Between Tries: 5000 (5秒)
```

### パターン2: 指数的バックオフの実装

#### リトライ回数の管理（Codeノード）

```javascript
const retryCount = ($json._retryCount ?? 0) + 1;
const statusCode = parseInt($json.error?.httpCode ?? '0');

// リトライ可能なエラーコード
const retryableErrors = [429, 503, 504, 500];
const canRetry = retryableErrors.includes(statusCode) && retryCount <= 3;

// 指数的バックオフ: 2^retryCount * 1000ms (2s, 4s, 8s)
const waitMs = Math.pow(2, retryCount) * 1000;

return [{
  json: {
    ...$json,
    _retryCount: retryCount,
    _canRetry: canRetry,
    _waitMs: waitMs
  }
}];
```

#### 待機時間の設定（Waitノード）

```
Wait Amount: {{ $json._waitMs }}
Wait Unit: Milliseconds
```

### レート制限（429）への対応

Retry-Afterヘッダーがある場合はその値を待機時間として使用する:

```javascript
const retryAfter = $input.first().headers?.['retry-after'];
const waitMs = retryAfter
  ? parseInt(retryAfter) * 1000
  : Math.pow(2, $json._retryCount) * 1000;
```

## 冪等性の確保

リトライしても安全なAPI設計のポイント:
- `POST` ではなく `PUT` / `PATCH` でupsert操作にする
- リクエストに `Idempotency-Key` ヘッダーを付与する（Stripe等で対応）
- `external_id` でのupsertにし、重複作成を防ぐ

## ポイント・注意事項

- 429（レート制限）はリトライが有効だが、401（認証失敗）・404はリトライ不要
- 指数的バックオフなしの連続リトライはレート制限をさらに悪化させる
- リトライ上限に達した場合は必ず担当者への通知を実装する

## 関連機能

- [エラーハンドリング・デバッグ](./concepts_n8n_error_handling.md)
- [HTTP Request・API連携](./concepts_n8n_http_api.md)
- [Codeノード](./concepts_n8n_code_node.md)
