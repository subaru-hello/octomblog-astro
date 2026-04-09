---
category: "概念"
order: 232
title: エラーログをAirtableに自動記録する
description: n8nのError Triggerでワークフローエラーを検知し、エラー詳細・ワークフロー名・発生時刻をAirtableに自動記録して運用ダッシュボードを構築するパターン。
tags: ["n8n", "ユースケース", "エラーログ", "Airtable", "監視", "ダッシュボード", "Error Trigger"]
emoji: "📝"
date: "2026-04-09"
source: "https://docs.n8n.io/flow-logic/error-handling/error-workflows/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

エラー監視ワークフローでError Triggerを受け取り、エラー詳細をAirtableに蓄積する。Airtableのビュー機能でエラー傾向ダッシュボードを作成し、改善優先度を可視化する。

**解決する課題**: エラーがn8nの実行ログにしか残らず傾向分析ができない問題を解決し、エラーの頻度・種類・ワークフロー別の傾向を把握できるようにする

**使用するn8nノード:**
- Error Trigger（エラーイベント受信）
- Code（エラーデータの整形）
- Airtable（ログレコード作成）
- IF（重大度による分岐）
- Slack（重大エラーの即時通知）

## ワークフロー構成

```
[Error Trigger]
    ↓
[Code: エラーデータ整形・重大度判定]
    ↓
[Airtable: エラーログレコード作成]
    ↓
[IF: severity == "critical"]
  └── true → [Slack: #oncall に緊急通知]
```

## 実装手順

### Step 1: Error Triggerの設置

新規ワークフロー「エラーログ管理」を作成し、Error Triggerを最初のノードに設置する。

### Step 2: エラーデータの整形（Codeノード）

```javascript
const error = $json.execution.error;
const statusCode = parseInt(error.httpCode ?? '0');

// 重大度の判定
let severity = 'low';
if (statusCode >= 500 || !error.httpCode) severity = 'critical';
else if (statusCode >= 400) severity = 'medium';

return [{
  json: {
    workflowName: $json.workflow.name,
    workflowId: $json.workflow.id,
    executionId: $json.execution.id,
    executionUrl: $json.execution.url,
    errorMessage: error.message,
    errorType: error.name,
    httpCode: error.httpCode ?? 'N/A',
    nodeName: error.node?.name ?? 'N/A',
    severity: severity,
    occurredAt: new Date().toISOString(),
    date: new Date().toLocaleDateString('ja-JP'),
  }
}];
```

### Step 3: Airtableへの記録

**Airtableのテーブル設計:**

| フィールド名 | 型 | 説明 |
|---|---|---|
| ワークフロー名 | Single Line Text | エラー発生ワークフロー |
| エラーメッセージ | Long Text | エラーの詳細メッセージ |
| HTTPコード | Number | HTTPステータスコード |
| 発生ノード | Single Line Text | エラーが発生したノード名 |
| 重大度 | Single Select | critical/medium/low |
| 発生日時 | Date Time | ISO形式の発生時刻 |
| 実行URL | URL | n8nの実行詳細ページ |
| 対応済み | Checkbox | 対応完了フラグ |

```
Resource: Record
Operation: Create
Base ID: your-airtable-base-id
Table: エラーログ
Fields:
  ワークフロー名: {{ $json.workflowName }}
  エラーメッセージ: {{ $json.errorMessage }}
  HTTPコード: {{ $json.httpCode }}
  発生ノード: {{ $json.nodeName }}
  重大度: {{ $json.severity }}
  発生日時: {{ $json.occurredAt }}
  実行URL: {{ $json.executionUrl }}
```

### Step 4: Airtableダッシュボードの活用

Airtableのビュー機能でエラー分析用のビューを作成:
- **重大エラーのみ**: `severity = critical` フィルタ
- **未対応エラー**: `対応済み = false` フィルタ
- **ワークフロー別集計**: グループ化 by ワークフロー名

## ポイント・注意事項

- Airtableの無料プランはBase当たり1,000レコードまで。定期的に古いログをアーカイブまたは削除する
- エラーログはセキュリティ情報（APIキーのエラーメッセージ等）を含む場合がある。Airtableのアクセス権限を適切に設定する
- 同じエラーが大量に発生する場合（ループ内エラー等）はAirtableへの書き込みレート制限に注意

## 関連機能

- [エラーハンドリング・デバッグ](./concepts_n8n_error_handling.md)
- [Codeノード](./concepts_n8n_code_node.md)
- [エラー時Slackアラート](./concepts_n8n_usecase_error_slack_alert.md)
