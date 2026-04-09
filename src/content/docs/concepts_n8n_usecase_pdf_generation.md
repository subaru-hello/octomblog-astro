---
category: "概念"
order: 237
title: npmライブラリを使ったPDF自動生成フロー
description: n8nのCodeノードでpdfkitなどのnpmライブラリを使って見積書・請求書・レポートPDFを自動生成し、メールに添付してGoogleDriveに保存するワークフロー。
tags: ["n8n", "ユースケース", "PDF生成", "Codeノード", "pdfkit", "請求書", "自動化"]
emoji: "📄"
date: "2026-04-09"
source: "https://docs.n8n.io/code/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

注文データや見積もりデータを受け取り、CodeノードでPDFを動的に生成してメール添付・Google Driveへの保存を自動化する。請求書・見積書・月次レポートなどに活用できる。

**解決する課題**: PDF生成のためにバックエンドサーバーを立てる必要をなくし、n8nで完結させる

**使用するn8nノード:**
- Webhook Trigger（注文データ受信）
- Code（PDF生成 - pdfkit使用）
- Gmail（PDF添付メール送信）
- Google Drive（PDF保存）

## 事前設定: npmパッケージの許可

セルフホストのn8nでpdfkitを使うには環境変数を設定する。

```bash
# docker-compose.yml
environment:
  - NODE_FUNCTION_ALLOW_EXTERNAL=pdfkit,pdfkit-table
```

Cloudの場合はn8n Cloudが許可するライブラリリストを確認する。

## ワークフロー構成

```
[Webhook Trigger: POST /generate-invoice]
    ↓
[Code: pdfkitでPDF生成 → Binary dataとして出力]
    ↓
[Gmail: PDF添付でメール送信]
    ↓
[Google Drive: PDFファイルを保存]
```

## 実装手順

### Step 1: Webhookで注文データを受信

```json
{
  "invoiceNumber": "INV-2026-001",
  "customer": { "name": "株式会社Example", "email": "billing@example.com" },
  "items": [
    { "name": "Proプラン", "quantity": 1, "price": 50000 },
    { "name": "オプション機能A", "quantity": 2, "price": 10000 }
  ],
  "issueDate": "2026-04-09",
  "dueDate": "2026-04-30"
}
```

### Step 2: PDF生成（Codeノード）

```javascript
const PDFDocument = require('pdfkit');

const data = $json;
const doc = new PDFDocument({ margin: 50 });

// バッファに書き込むためのPromise化
const getBuffer = () => new Promise((resolve) => {
  const chunks = [];
  doc.on('data', chunk => chunks.push(chunk));
  doc.on('end', () => resolve(Buffer.concat(chunks)));

  // ヘッダー
  doc.fontSize(20).text('請 求 書', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`請求番号: ${data.invoiceNumber}`);
  doc.text(`発行日: ${data.issueDate}`);
  doc.text(`支払期限: ${data.dueDate}`);
  doc.moveDown();
  doc.text(`請求先: ${data.customer.name}`);
  doc.moveDown();

  // 明細
  doc.text('＜明細＞');
  let total = 0;
  for (const item of data.items) {
    const subtotal = item.quantity * item.price;
    total += subtotal;
    doc.text(`${item.name}: ¥${item.price.toLocaleString()} × ${item.quantity} = ¥${subtotal.toLocaleString()}`);
  }
  doc.moveDown();
  doc.fontSize(14).text(`合計（税抜）: ¥${total.toLocaleString()}`, { align: 'right' });
  doc.text(`消費税（10%）: ¥${(total * 0.1).toLocaleString()}`, { align: 'right' });
  doc.text(`合計（税込）: ¥${(total * 1.1).toLocaleString()}`, { align: 'right' });

  doc.end();
});

const buffer = await getBuffer();
const base64 = buffer.toString('base64');

return [{
  json: { invoiceNumber: data.invoiceNumber, customerEmail: data.customer.email },
  binary: {
    invoice: {
      data: base64,
      mimeType: 'application/pdf',
      fileName: `${data.invoiceNumber}.pdf`,
    }
  }
}];
```

### Step 3: Gmailで添付送信

```
To: {{ $json.customerEmail }}
Subject: 【請求書】{{ $json.invoiceNumber }}
Attachments: Binary Field = invoice
```

### Step 4: Google Driveに保存

```
Operation: File → Upload
File Name: {{ $json.invoiceNumber }}.pdf
Input Data Field Name: invoice
Folder: 請求書/2026年
```

## ポイント・注意事項

- pdfkitは英語フォントがデフォルト。日本語表示には日本語フォントファイルを登録する必要がある
- Codeノードでのファイル生成はBinaryデータとして出力する。`binary` キーに含める
- 複雑なレイアウトが必要な場合はHTMLテンプレート→Puppeteer PDF変換の方が柔軟

## 関連機能

- [Codeノード・カスタム処理](./concepts_n8n_code_node.md)
- [主要インテグレーション](./concepts_n8n_integrations.md)
- [トリガーの種類](./concepts_n8n_triggers.md)
