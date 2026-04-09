---
category: "概念"
order: 200
title: カスタムバリデーションロジックをCodeノードで実装する
description: Webhookで受信したデータに複雑なビジネスロジックのバリデーションをCodeノードで実装し、エラー詳細を返却して後続処理を制御するパターン。
tags: ["n8n", "ユースケース", "バリデーション", "Codeノード", "入力検証", "エラーハンドリング", "データ品質"]
emoji: "✔️"
date: "2026-04-09"
source: "https://docs.n8n.io/code/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

Webhookで受け取ったデータに対して、必須項目チェック・型チェック・ビジネスロジック（有効期限・在庫確認等）のバリデーションをCodeノードで実装する。エラー時は詳細なエラーメッセージを返却する。

**解決する課題**: 組み込みノードの単純な条件チェックでは対応できない複雑なビジネスルールの検証をCodeで実装する

**使用するn8nノード:**
- Webhook Trigger（データ受信）
- Code（バリデーション実行）
- IF（バリデーション結果で分岐）
- Respond to Webhook（エラーレスポンス返却）
- 後続処理ノード（バリデーション成功時）

## ワークフロー構成

```
[Webhook Trigger: POST /orders]
    ↓
[Code: バリデーション実行]
    ↓
[IF: isValid == true]
  ├── true  → [後続ノード: 注文処理]
  └── false → [Respond to Webhook: 400エラーレスポンス]
```

## 実装手順

### Step 1: バリデーションロジック（Codeノード）

```javascript
const data = $json;
const errors = [];

// ===== 必須項目チェック =====
const required = ['customerId', 'items', 'shippingAddress'];
for (const field of required) {
  if (!data[field]) {
    errors.push({ field, message: `${field}は必須です` });
  }
}

// ===== 型チェック =====
if (data.items !== undefined) {
  if (!Array.isArray(data.items)) {
    errors.push({ field: 'items', message: 'itemsは配列である必要があります' });
  } else if (data.items.length === 0) {
    errors.push({ field: 'items', message: '注文は1件以上必要です' });
  } else {
    // 各itemの検証
    data.items.forEach((item, index) => {
      if (!item.productId) {
        errors.push({ field: `items[${index}].productId`, message: '商品IDは必須です' });
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        errors.push({ field: `items[${index}].quantity`, message: '数量は1以上の整数である必要があります' });
      }
    });
  }
}

// ===== ビジネスロジック =====
// 1注文あたりの上限金額チェック
if (data.totalAmount > 1000000) {
  errors.push({ field: 'totalAmount', message: '1注文の上限金額（100万円）を超えています' });
}

// 配送先の郵便番号形式チェック（日本形式: 000-0000）
if (data.shippingAddress?.postalCode) {
  const postalCodeRegex = /^\d{3}-\d{4}$/;
  if (!postalCodeRegex.test(data.shippingAddress.postalCode)) {
    errors.push({ field: 'shippingAddress.postalCode', message: '郵便番号の形式が不正です（例: 123-4567）' });
  }
}

return [{
  json: {
    ...data,
    isValid: errors.length === 0,
    validationErrors: errors,
  }
}];
```

### Step 2: バリデーション結果の分岐（IFノード）

```
Condition: {{ $json.isValid }} equals true
```

### Step 3: エラーレスポンスの返却

バリデーション失敗時はWebhookに400レスポンスを返す。

```
Node: Respond to Webhook
Response Code: 400
Response Body (JSON):
{
  "success": false,
  "message": "バリデーションエラーが発生しました",
  "errors": {{ JSON.stringify($json.validationErrors) }}
}
```

呼び出し元が受け取るレスポンス例:
```json
{
  "success": false,
  "message": "バリデーションエラーが発生しました",
  "errors": [
    { "field": "items[0].quantity", "message": "数量は1以上の整数である必要があります" },
    { "field": "shippingAddress.postalCode", "message": "郵便番号の形式が不正です" }
  ]
}
```

### Step 4: 成功時の後続処理

バリデーション成功時は `$json.validationErrors` フィールドを除いて後続ノードに渡す。

```javascript
// Codeノードでバリデーション用フィールドを除去
const { isValid, validationErrors, ...cleanData } = $json;
return [{ json: cleanData }];
```

## ポイント・注意事項

- バリデーションエラーは全件収集してから返却する（最初のエラーだけでなく全エラーをまとめて返す）
- Respond to WebhookノードはWebhook Triggerと対になる。必ずWebhook Triggerの `Response Mode: When Last Node Finishes` または `Using Respond to Webhook Node` を設定する
- バリデーションルールは変更頻度が高い。コメントを充実させるか、ルールを外部設定（Googleシート等）から読み込む

## 関連機能

- [Codeノード・カスタム処理](./concepts_n8n_code_node.md)
- [ロジック制御](./concepts_n8n_logic_flow.md)
- [エラーハンドリング](./concepts_n8n_error_handling.md)
