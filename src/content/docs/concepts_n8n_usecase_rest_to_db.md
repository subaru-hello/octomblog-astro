---
category: "概念"
order: 200
title: 外部REST APIからデータを取得してDBに保存する
description: HTTP Requestノードで外部REST APIからJSONデータをページネーション付きで取得し、PostgreSQLデータベースへ自動保存するデータ取り込みワークフロー。
tags: ["n8n", "ユースケース", "REST API", "PostgreSQL", "データ取り込み", "ページネーション", "ETL"]
emoji: "🗄️"
date: "2026-04-09"
source: "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

外部サービスのREST APIから全データをページネーション付きで取得し、PostgreSQLにupsert保存する。毎日定期実行で最新データを同期する。

**解決する課題**: 外部APIのデータを手動でExportせずに自動的にDB同期し、常に最新データを社内で利用できるようにする

**使用するn8nノード:**
- Schedule Trigger（毎日実行）
- HTTP Request（ページネーション付きAPI呼び出し）
- Code（データ正規化）
- PostgreSQL（upsert保存）

## ワークフロー構成

```
[Schedule Trigger: 毎日02:00]
    ↓
[HTTP Request: 外部API（全ページ自動取得）]
    ↓
[Code: データ正規化・型変換]
    ↓
[PostgreSQL: UPSERT（重複時は更新）]
```

## 実装手順

### Step 1: Schedule Triggerの設定

```
Rule: Every Day
Hour: 2
Minute: 0
```

夜間バッチとして実行。

### Step 2: HTTP Requestのページネーション設定

```
Method: GET
URL: https://api.example.com/v1/products

Pagination:
  Pagination Mode: Update a Parameter
  Parameter Type: Query
  Parameter Name: page
  Initial Value: 1
  Increment By: 1
  
  Complete When:
    Type: Receive Specific Status Code
    Status Code: 204
    
    または
    
    Type: Other
    Expression: {{ $response.body.data.length === 0 }}
```

### Step 3: データ正規化（Codeノード）

```javascript
return $input.all().map(item => ({
  json: {
    external_id: String(item.json.id),
    name: item.json.name?.trim() ?? '',
    price: Number(item.json.price) || 0,
    category: item.json.category ?? 'uncategorized',
    updated_at: new Date(item.json.updated_at).toISOString(),
    raw_data: JSON.stringify(item.json)
  }
}));
```

### Step 4: PostgreSQLへのUPSERT

```sql
INSERT INTO products (external_id, name, price, category, updated_at, raw_data)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (external_id)
DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  category = EXCLUDED.category,
  updated_at = EXCLUDED.updated_at,
  raw_data = EXCLUDED.raw_data
```

**PostgreSQLノードの設定:**
```
Operation: Execute Query
Query: 上記SQL
Parameters:
  $1: {{ $json.external_id }}
  $2: {{ $json.name }}
  ... （各フィールド）
```

## ポイント・注意事項

- HTTP Requestのページネーション自動処理を使うと、全ページを自動で取得してitemとして展開できる
- `ON CONFLICT ... DO UPDATE`（UPSERT）を使うことで冪等性を保つ。何度実行しても同じ結果になる
- 大量データ（10万件以上）の場合はバッチサイズを設定し、メモリ超過を防ぐ

## 関連機能

- [HTTP Request・API連携](./concepts_n8n_http_api.md)
- [Codeノード](./concepts_n8n_code_node.md)
- [エラーハンドリング](./concepts_n8n_error_handling.md)
