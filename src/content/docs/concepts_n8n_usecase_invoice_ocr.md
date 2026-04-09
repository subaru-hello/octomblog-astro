---
category: "概念"
order: 243
title: 請求書PDFをOCRで自動データ入力・会計ソフト登録する
description: メールに添付された請求書PDFをOpenAI VisionでOCR解析し、取引先名・金額・振込期日を自動抽出してfreee/マネーフォワードに仕訳登録するワークフロー。
tags: ["n8n", "ユースケース", "請求書OCR", "経理自動化", "freee", "マネーフォワード", "PDF", "会計"]
emoji: "🧾"
date: "2026-04-09"
source: "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

仕入れ先から届く請求書メールをGmailトリガーで検知し、OpenAI VisionでPDFを読み取り・データ抽出してfreee/マネーフォワードに自動で仕訳登録する。

**解決する課題**: 1件10分かかっていた請求書手動入力作業を30秒に短縮。月100件なら約15時間の削減

**使用するn8nノード:**
- Gmail Trigger（請求書メール受信）
- Code（PDFをbase64エンコード）
- OpenAI Chat Model with Vision（OCR解析）
- Code（データ整形・バリデーション）
- HTTP Request（会計ソフトAPI）
- Slack（担当者への確認通知）

## ワークフロー構成

```
[Gmail Trigger: 請求書ラベル付きメール]
    ↓
[Code: 添付PDFをbase64エンコード]
    ↓
[OpenAI Vision: 請求書からデータ抽出（JSON出力）]
    ↓
[Code: データバリデーション・整形]
    ↓
[IF: 信頼度スコア >= 90%]
  ├── 高信頼 → [freee/MF API: 自動登録]
  │                [Slack: 登録完了通知]
  └── 低信頼 → [Slack: 人間による確認依頼]
```

## 実装手順

### Step 1: Gmail Triggerのフィルタ設定

請求書メールを自動的にフィルタリングするため、Gmail側でラベルを設定する。

```
Gmailフィルタ:
  from: (請求書を送るドメインリスト)
  subject: (請求書 OR 御請求書 OR invoice)
  → ラベル「請求書処理待ち」を自動付与
```

n8n設定:
```
Gmail Trigger → Filter → Label: 請求書処理待ち
```

### Step 2: PDFのbase64変換（Codeノード）

```javascript
// 添付ファイルの最初のPDFを取得
const attachments = $input.first().binary;
const pdfKey = Object.keys(attachments).find(k => 
  attachments[k].mimeType === 'application/pdf'
);

if (!pdfKey) throw new Error('PDF添付ファイルが見つかりません');

return [{
  json: {
    ...$json,
    pdfBase64: attachments[pdfKey].data,
    fileName: attachments[pdfKey].fileName
  }
}];
```

### Step 3: OpenAI Visionで請求書OCR

```
Model: gpt-4o（Vision対応が必要）
System Prompt:
請求書画像から以下の情報をJSONで抽出してください。
不明な場合は null を返してください。

{
  "vendorName": "取引先名",
  "vendorRegistrationNumber": "インボイス登録番号（T+13桁）",
  "invoiceNumber": "請求書番号",
  "invoiceDate": "請求日（YYYY-MM-DD形式）",
  "dueDate": "支払期限（YYYY-MM-DD形式）",
  "subtotal": 税抜金額の数値,
  "taxAmount": 消費税額の数値,
  "totalAmount": 税込合計金額の数値,
  "items": [
    { "description": "品目", "quantity": 数量, "unitPrice": 単価, "amount": 金額 }
  ],
  "confidence": 0-100の整数（抽出の信頼度）
}

User Message Type: Image
Image Data: data:application/pdf;base64,{{ $json.pdfBase64 }}
```

### Step 4: データバリデーション（Codeノード）

```javascript
const data = $json;

// 金額チェック: 小計 + 税額 ≒ 合計
const calculatedTotal = (data.subtotal ?? 0) + (data.taxAmount ?? 0);
const totalDiff = Math.abs(calculatedTotal - (data.totalAmount ?? 0));
const isValid = totalDiff <= 10; // 10円以内の誤差は許容

return [{
  json: {
    ...data,
    isValid,
    validationNote: isValid ? 'OK' : `金額不一致: 計算値¥${calculatedTotal} vs 請求書¥${data.totalAmount}`
  }
}];
```

### Step 5: freee APIへの仕訳登録

```
Method: POST
URL: https://api.freee.co.jp/api/1/deals
Headers:
  Authorization: Bearer {{ $credentials.freeeToken }}
Body:
{
  "company_id": {{ $vars.FREEE_COMPANY_ID }},
  "issue_date": "{{ $json.invoiceDate }}",
  "due_date": "{{ $json.dueDate }}",
  "type": "expense",
  "partner_name": "{{ $json.vendorName }}",
  "details": [
    {
      "account_item_id": 受取手形のID,
      "amount": {{ $json.subtotal }}
    }
  ]
}
```

### Step 6: Slack確認通知

```
Channel: #accounting
Message:
✅ 請求書登録完了
取引先: {{ $json.vendorName }}
金額: ¥{{ $json.totalAmount?.toLocaleString() }}
期日: {{ $json.dueDate }}
信頼度: {{ $json.confidence }}%

{{ $json.isValid ? '' : '⚠️ 金額不一致のため確認が必要です。' }}
freee: {{ $('freee').first().json.deal.id }}
```

## ポイント・注意事項

- インボイス制度（適格請求書）対応のため、「インボイス登録番号（T+13桁）」の抽出も実装する
- 信頼度が90%未満の場合は自動登録せず人間に確認依頼。ゴミデータを会計ソフトに入れない
- freee・マネーフォワードの無料プランはAPIコールが制限される場合がある。プランを確認する

## 関連機能

- [経理・財務担当向けガイド](./concepts_n8n_role_finance.md)
- [Codeノード](./concepts_n8n_code_node.md)
- [カスタムバリデーション](./concepts_n8n_usecase_custom_validation.md)
