---
category: "概念"
order: 245
title: Shopify注文処理を完全自動化する（在庫・配送・顧客通知）
description: Shopifyの新規注文トリガーで倉庫への出荷指示・在庫更新・顧客への注文確認・配送追跡通知まで一連の注文処理フローを自動化するワークフロー。
tags: ["n8n", "ユースケース", "Shopify", "EC自動化", "注文処理", "在庫管理", "配送通知"]
emoji: "📦"
date: "2026-04-09"
source: "https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.shopify/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

Shopifyで注文が入った瞬間に倉庫システムへの出荷指示・在庫数更新・顧客への確認メール・Slackへの通知を同時に実行する。注文増加に対して人的リソースを増やさず対応できる。

**解決する課題**: 1日50件の注文を手動処理していたECオーナーが、自動化でスタッフ不要の受注処理体制を構築する

**使用するn8nノード:**
- Shopify Trigger（注文確定イベント）
- HTTP Request（倉庫システムAPI・配送業者API）
- Google Sheets（在庫更新）
- Gmail（顧客通知）
- Slack（店舗スタッフ通知）
- IF（在庫アラート）

## ワークフロー構成

```
[Shopify Trigger: 注文確定 (orders/paid)]
    ↓（並列処理）
[HTTP Request: 倉庫WMSに出荷指示]     ─┐
[Google Sheets: 在庫数を-1更新]       ─┤→ 完了後
[Gmail: 顧客に注文確認メール]          ─┤
[Slack: #orders チャンネルに通知]     ─┘
    ↓
[IF: 在庫が5個以下]
  └── [Slack: #inventory アラート送信]
```

## 実装手順

### Step 1: Shopify Triggerの設定

```
Event: Orders - Paid（支払い確定後）
```

受信データ例:
```json
{
  "id": 820982911946154500,
  "email": "customer@example.com",
  "total_price": "4500.00",
  "line_items": [
    { "title": "ブルーTシャツ L", "sku": "SHIRT-BLUE-L", "quantity": 2, "price": "2250.00" }
  ],
  "shipping_address": {
    "name": "田中太郎",
    "address1": "東京都渋谷区...",
    "zip": "150-0001"
  }
}
```

### Step 2: 倉庫WMSへの出荷指示

```
Method: POST
URL: https://your-wms.example.com/api/orders
Headers: Authorization: Bearer {{ $credentials.wmsApiKey }}
Body:
{
  "order_id": "{{ $json.id }}",
  "items": {{ JSON.stringify($json.line_items.map(i => ({ sku: i.sku, quantity: i.quantity }))) }},
  "shipping_address": {
    "name": "{{ $json.shipping_address.name }}",
    "address": "{{ $json.shipping_address.address1 }}",
    "zip": "{{ $json.shipping_address.zip }}"
  }
}
```

### Step 3: 在庫をGoogleシートで更新（Codeノード）

```javascript
// 注文された全SKUの在庫を更新するためのデータを生成
return $json.line_items.map(item => ({
  json: {
    sku: item.sku,
    quantity: item.quantity,
    orderId: $json.id
  }
}));
```

その後、各SKUに対してGoogle Sheets「Update Row」ノードを実行する。

### Step 4: 顧客への注文確認メール

```
To: {{ $json.email }}
Subject: 【ご注文確認】注文番号 #{{ $json.order_number }}

本文（HTML）:
{{ $json.shipping_address.name }} 様

この度はご注文いただきありがとうございます。

■ ご注文内容
{{ $json.line_items.map(i => `${i.title} × ${i.quantity} ... ¥${(i.price * i.quantity).toLocaleString()}`).join('\n') }}

■ 合計金額
¥{{ parseInt($json.total_price).toLocaleString() }}

■ お届け先
{{ $json.shipping_address.address1 }}

発送後、追跡番号をお送りします。
```

### Step 5: 配送後の追跡番号通知

倉庫から発送完了Webhookを受け取り、追跡番号を顧客にメール通知する。

```
[Webhook: 倉庫からの発送完了通知]
    ↓
[Gmail: 顧客に追跡番号メール]
[Shopify: フルフィルメント情報を更新]
```

## ポイント・注意事項

- Shopifyのワークフローは `orders/paid` イベントを使う。`orders/create` だとクレジットカード未確認の注文も含まれる
- 複数商品の注文では `line_items` 配列をループして在庫更新する必要がある
- 繁忙期（セール時）に注文が殺到した場合のレート制限に注意。WMSのAPIコール上限を事前確認する

## 関連機能

- [EC・小売業界のガイド](./concepts_n8n_industry_ecommerce.md)
- [ロジック制御](./concepts_n8n_logic_flow.md)
- [エラーハンドリング](./concepts_n8n_error_handling.md)
