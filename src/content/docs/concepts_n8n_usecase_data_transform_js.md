---
category: "概念"
order: 200
title: JavaScriptで複雑なデータ変換処理を実装する
description: 複数のネストされたAPIレスポンスをCodeノードのJavaScriptで正規化・変換・結合する高度なデータ変換パターン。配列操作・オブジェクト変換・日付処理の実例を解説。
tags: ["n8n", "ユースケース", "Codeノード", "JavaScript", "データ変換", "正規化", "ETL"]
emoji: "🔧"
date: "2026-04-09"
source: "https://docs.n8n.io/code/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

外部APIから受け取った複雑なネスト構造のJSONを、データベースへの保存に適したフラットな構造に変換する。フィールド名の変換・型変換・配列のflatten・日付のフォーマット統一を一括処理する。

**解決する課題**: 組み込みノードでは対応できない複雑なデータ変換をCodeノードで柔軟に実装する

**使用するn8nノード:**
- HTTP Request（元データ取得）
- Code（変換処理）
- PostgreSQL / Airtable（変換後データの保存）

## よく使うデータ変換パターン

### パターン1: ネスト構造のflatten

```javascript
// APIレスポンス（ネスト構造）
// {
//   "user": { "id": 1, "profile": { "name": "Alice", "email": "alice@example.com" } },
//   "orders": [{ "id": 100, "total": 5000 }]
// }

return $input.all().map(item => {
  const { user, orders } = item.json;
  return {
    json: {
      userId: user.id,
      userName: user.profile.name,
      userEmail: user.profile.email,
      latestOrderId: orders[0]?.id ?? null,
      latestOrderTotal: orders[0]?.total ?? 0,
    }
  };
});
```

### パターン2: 配列を複数のitemに展開

```javascript
// 1つのitem（注文）を注文明細の数だけitemに展開する
const result = [];
for (const item of $input.all()) {
  for (const lineItem of item.json.lineItems) {
    result.push({
      json: {
        orderId: item.json.id,
        productId: lineItem.productId,
        quantity: lineItem.quantity,
        price: lineItem.price,
        subtotal: lineItem.quantity * lineItem.price,
      }
    });
  }
}
return result;
```

### パターン3: 日付の統一化

```javascript
// 複数フォーマットの日付をISO 8601に統一する
return $input.all().map(item => {
  const rawDate = item.json.createdDate; // "2026/04/09" or "April 9, 2026"
  const normalized = new Date(rawDate).toISOString();

  // Luxon（n8n組み込み）を使う場合
  const { DateTime } = require('luxon');
  const formatted = DateTime.fromISO(normalized)
    .setZone('Asia/Tokyo')
    .toFormat('yyyy-MM-dd HH:mm:ss');

  return {
    json: { ...item.json, createdDate: formatted }
  };
});
```

### パターン4: 集計・グループ化

```javascript
// カテゴリ別に売上を集計する
const items = $input.all().map(i => i.json);
const grouped = items.reduce((acc, item) => {
  const key = item.category;
  if (!acc[key]) acc[key] = { category: key, total: 0, count: 0 };
  acc[key].total += item.amount;
  acc[key].count += 1;
  return acc;
}, {});

return Object.values(grouped).map(g => ({
  json: {
    ...g,
    average: Math.round(g.total / g.count),
  }
}));
```

### パターン5: 前後のノードデータを結合

```javascript
// ユーザーAPIとオーダーAPIのデータをuserIdでJOINする
const users = $('GetUsers').all().map(i => i.json);
const orders = $('GetOrders').all().map(i => i.json);

const userMap = new Map(users.map(u => [u.id, u]));

return orders.map(order => ({
  json: {
    ...order,
    userName: userMap.get(order.userId)?.name ?? 'Unknown',
    userEmail: userMap.get(order.userId)?.email ?? '',
  }
}));
```

## ポイント・注意事項

- Codeノードのデフォルトは「Run Once for All Items」（全itemを一度に処理）。単一item処理の場合は「Run Once for Each Item」に切り替える
- エラーが発生した場合はCodeノード全体が失敗する。try-catchで個別itemのエラーを吸収できる
- `console.log()` でデバッグ出力できる。n8nの実行ログ「Output」タブで確認できる

## 関連機能

- [Codeノード・カスタム処理](./concepts_n8n_code_node.md)
- [HTTP Request・API連携](./concepts_n8n_http_api.md)
- [ロジック制御](./concepts_n8n_logic_flow.md)
