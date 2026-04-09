---
category: "概念"
order: 222
title: ループ処理でリストを走査し一括メール送信する
description: GoogleシートまたはDBから送信先リストを取得し、Loop Over Itemsで1件ずつパーソナライズされたメールを送信するバルクメールワークフロー。
tags: ["n8n", "ユースケース", "一括メール", "ループ", "SendGrid", "パーソナライズ", "バッチ処理"]
emoji: "📨"
date: "2026-04-09"
source: "https://docs.n8n.io/flow-logic/looping/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

Googleシートに登録した顧客リストを読み込み、Loop Over Itemsで1件ずつパーソナライズされたメールを送信する。送信レート制限に対応したバッチ処理付き。

**解決する課題**: 数百〜数千件のパーソナライズメールをコードなしで安全に一括送信する

**使用するn8nノード:**
- Schedule Trigger（定期実行）またはManual Trigger
- Google Sheets（リスト取得）
- Filter（未送信者のみ絞り込み）
- Loop Over Items（1件ずつ処理）
- SendGrid（メール送信）
- Wait（レート制限対応の待機）
- Google Sheets（送信済みフラグ更新）

## ワークフロー構成

```
[Schedule Trigger]
    ↓
[Google Sheets: 顧客リスト取得]
    ↓
[Filter: status == "未送信" のみ]
    ↓
[Loop Over Items: Batch Size=1]
  ├── [SendGrid: パーソナライズメール送信]
  │       ↓
  │   [Google Sheets: status を "送信済み" に更新]
  │       ↓
  │   [Wait: 1秒待機（レート制限対応）]
  └── （次のitemへ）
```

## 実装手順

### Step 1: Googleシートのリスト取得

```
Operation: Get Many Rows
Spreadsheet ID: your-spreadsheet-id
Sheet: 顧客リスト
Filters:
  status: 未送信
```

シートの列構成例:
```
| id | name    | email              | plan | status |
|----|---------|--------------------|----- |--------|
| 1  | Alice   | alice@example.com  | pro  | 未送信  |
| 2  | Bob     | bob@example.com    | free | 未送信  |
```

### Step 2: Loop Over Itemsの設定

```
Input Data Field Name: data
Batch Size: 1
```

バッチサイズを1にすることで、送信失敗時に1件だけ影響を受ける。

### Step 3: SendGridでパーソナライズメール送信

```
To Email: {{ $json.email }}
From: noreply@yourapp.com
Subject: {% if $json.plan == 'pro' %}Proプランの新機能についてのご案内{% else %}無料プランのアップグレードのご案内{% endif %}
Template ID: your-sendgrid-template-id
Dynamic Template Data:
  name: {{ $json.name }}
  plan: {{ $json.plan }}
```

### Step 4: 送信済みフラグを更新

```
Operation: Update Row
Spreadsheet ID: your-spreadsheet-id
Row Number: {{ $json.rowNumber }}
Update:
  status: 送信済み
  sent_at: {{ $now.toISO() }}
```

### Step 5: Waitノードで送信間隔調整

```
Wait Amount: 1
Wait Unit: Seconds
```

SendGridの無料プランは1日100通まで。レート制限は送信速度より総数に注意。

## ポイント・注意事項

- Googleシートへの「送信済み」フラグ更新は、送信成功後に実施する。失敗した場合は未送信のまま残すため再実行可能
- 大量送信（1000件以上）の場合、SendGridの有料プランまたはAmazon SESを検討する
- メール件名・本文に個人情報を含む場合、送信先リストのアクセス権限管理に注意する

## 関連機能

- [ロジック制御](./concepts_n8n_logic_flow.md)
- [主要インテグレーション](./concepts_n8n_integrations.md)
- [エラーハンドリング](./concepts_n8n_error_handling.md)
