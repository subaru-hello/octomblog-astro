---
category: "概念"
order: 223
title: 複数APIのデータをマージして統合レポートを作成する
description: 複数のAPIソース（CRM・分析・会計）から並列でデータを取得し、Mergeノードで統合してGoogleシートへの統合ダッシュボードを作成するワークフロー。
tags: ["n8n", "ユースケース", "マージ", "統合レポート", "並列処理", "データ集計", "Google Sheets"]
emoji: "📋"
date: "2026-04-09"
source: "https://docs.n8n.io/flow-logic/merging/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

CRM・GA4・会計システムの3つのAPIから並列でデータを取得し、Mergeノードで統合してGoogleシートのダッシュボードに書き込む。週次で自動更新。

**解決する課題**: 複数ツールに散在したデータを手動でExcelに転記する作業を自動化する

**使用するn8nノード:**
- Schedule Trigger（週次実行）
- HTTP Request × 3（並列API呼び出し）
- Merge（データ統合）
- Code（計算・整形）
- Google Sheets（ダッシュボード更新）
- Slack（レポート完了通知）

## ワークフロー構成

```
[Schedule Trigger: 毎週月曜 07:00]
    ↓
[HTTP Request: HubSpot CRM API]  ─┐
[HTTP Request: GA4 Analytics API] ─┤→ [Merge: Combine All]
[HTTP Request: 会計API]          ─┘
    ↓
[Code: 統合指標計算]
    ↓
[Google Sheets: ダッシュボード更新]
    ↓
[Slack: 更新完了通知]
```

## 実装手順

### Step 1: 並列HTTP Request配置

3つのHTTP Requestノードを**同じSchedule Triggerからの接続**にする（並列実行）。

**HubSpot CRM:**
```
GET https://api.hubapi.com/crm/v3/objects/contacts?properties=lifecyclestage,createdate
Headers: Authorization: Bearer {{ $credentials.hubspotApiKey }}
```

**GA4 Analytics:**
```
POST https://analyticsdata.googleapis.com/v1beta/properties/YOUR_ID:runReport
Body: { "dateRanges": [{"startDate": "7daysAgo", "endDate": "today"}], ... }
```

**会計API（例: freee）:**
```
GET https://api.freee.co.jp/api/1/deals?fiscal_year=2026&type=income
Headers: Authorization: Bearer {{ $credentials.freeeToken }}
```

### Step 2: Mergeノードの設定

```
Mode: Combine All Inputs Into a Single List
```

3つの入力データが1つのアイテム配列になる。

### Step 3: 統合指標計算（Codeノード）

```javascript
const crm = $('HubSpot').first().json;
const ga4 = $('GA4').first().json;
const accounting = $('会計API').first().json;

return [{
  json: {
    week: $now.format('YYYY/MM/DD'),
    newLeads: crm.total,
    pageViews: ga4.rowCount,
    revenue: accounting.total_amount,
    conversionRate: ((crm.total / ga4.rowCount) * 100).toFixed(2) + '%'
  }
}];
```

### Step 4: Googleシートへの書き込み

```
Operation: Append Row
Sheet: 週次KPIログ
Data:
  Week: {{ $json.week }}
  新規リード: {{ $json.newLeads }}
  PV: {{ $json.pageViews }}
  売上: {{ $json.revenue }}
  CV率: {{ $json.conversionRate }}
```

## ポイント・注意事項

- 並列HTTP Requestの後にMergeを配置するとき、`Wait for All`モードを使うと全ノードの完了を待てる
- 各APIに認証切れが発生した場合、部分的な失敗でデータが欠損する。Error Branchで検知する
- Googleシートの書き込みAPIにはレート制限（1分60件）があるため大量行更新には注意

## 関連機能

- [ロジック制御](./concepts_n8n_logic_flow.md)
- [HTTP Request・API連携](./concepts_n8n_http_api.md)
- [エラーハンドリング](./concepts_n8n_error_handling.md)
