---
category: "概念"
order: 246
title: 予約リマインダーを自動送信してノーショーを削減する
description: Google CalendarまたはCalendlyの予約情報を毎日チェックし、24時間前・1時間前にSMS/メール/LINEでリマインダーを自動送信するノーショー対策ワークフロー。
tags: ["n8n", "ユースケース", "予約リマインダー", "ノーショー対策", "Twilio", "LINE", "カレンダー"]
emoji: "🔔"
date: "2026-04-09"
source: "https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.googlecalendar/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

クリニック・美容院・コンサルタント・コーチなど「予約ビジネス」において、当日のすっぽかし（ノーショー）と直前キャンセルを減らすためのリマインダー自動化ワークフロー。

**解決する課題**: 手動でリマインダーを送る手間（1件3分）を削減しつつ、ノーショー率を最大40%削減する

**使用するn8nノード:**
- Schedule Trigger（毎日定時実行）
- Google Calendar（翌日の予約取得）
- Twilio（SMS送信）
- Gmail（メール送信）
- Code（LINE Messaging APIとの連携）
- IF（連絡手段の分岐）

## ワークフロー構成

```
[Schedule Trigger: 毎日17:00]
    ↓
[Google Calendar: 翌日（09:00〜18:00）の予約を取得]
    ↓
[Loop Over Items: 予約ごとに処理]
    ↓
[IF: 顧客の希望連絡手段]
  ├── SMS    → [Twilio: SMS送信]
  ├── LINE   → [HTTP Request: LINE Messaging API]
  └── メール → [Gmail: リマインダーメール]
    ↓
[Airtable: リマインダー送信ログを記録]
```

加えて、当日朝にも1時間前リマインダーを送る。

## 実装手順

### Step 1: Google Calendarの予約イベント取得

```
Resource: Event
Operation: Get Many
Calendar: 予約管理カレンダー
Time Min: {{ $now.setZone('Asia/Tokyo').startOf('day').plus({days: 1}).toISO() }}
Time Max: {{ $now.setZone('Asia/Tokyo').endOf('day').plus({days: 1}).toISO() }}
```

### Step 2: 予約データの整形（Codeノード）

GoogleカレンダーのイベントのDescriptionに顧客情報（名前・電話番号・メール・LINE ID）を記入しておき、パースする。

```javascript
return $input.all().map(item => {
  const event = item.json;
  // Description形式: "名前:田中様\n電話:090-XXXX-XXXX\n連絡:SMS"
  const desc = event.description ?? '';
  const getName = desc.match(/名前:(.+)/)?.[1]?.trim() ?? '顧客';
  const getPhone = desc.match(/電話:(.+)/)?.[1]?.trim() ?? '';
  const getContact = desc.match(/連絡:(.+)/)?.[1]?.trim() ?? 'email';
  const startTime = new Date(event.start.dateTime)
    .toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });

  return {
    json: {
      eventId: event.id,
      customerName: getName,
      phone: getPhone,
      email: event.attendees?.[0]?.email ?? '',
      contactMethod: getContact,
      appointmentTime: startTime,
      serviceType: event.summary
    }
  };
});
```

### Step 3: SMSリマインダー（Twilio）

```
From: +81-XXXX-XXXX（TwilioのJapan番号）
To: {{ $json.phone }}
Body:
【リマインダー】
{{ $json.customerName }} 様

明日 {{ $json.appointmentTime }} のご予約のご確認です。

「{{ $json.serviceType }}」
場所: 〇〇院（東京都渋谷区...）

キャンセルの場合は前日18:00までにご連絡ください。
TEL: 03-XXXX-XXXX
```

### Step 4: LINE リマインダー

```javascript
// HTTP RequestノードのBodyに設定するJSONを生成
const lineUserId = $json.lineUserId; // LINE IDを別途管理
return [{
  json: {
    to: lineUserId,
    messages: [{
      type: 'text',
      text: `【予約リマインダー】\n${$json.customerName} 様\n\n明日 ${$json.appointmentTime} のご予約のご確認です。\n\nご変更はこちら: https://booking.yoursite.com/cancel/${$json.eventId}`
    }]
  }
}];
```

### Step 5: キャンセルリンクの設定

メッセージにキャンセル専用Webhookへのリンクを含める。

```
キャンセルURL: https://your-n8n.com/webhook/cancel?event={{ $json.eventId }}&token={{ $json.cancelToken }}
```

キャンセルリンクをクリックすると別のn8nワークフローが起動し、カレンダーから予約を削除してスロットを空ける。

## ポイント・注意事項

- 日本でのSMS送信にはTwilioのJapan番号が必要。月額数ドル＋送信料
- 直前キャンセル防止のため「48時間前以降はキャンセル不可」ルールを設ける場合は、IFでキャンセルリンクの有効/無効を切り替える
- LINEリマインダーは公式アカウントが必要。LINE Messaging APIの月間無料メッセージ数（200通）を超えると有料

## 関連機能

- [医療・クリニック業界のガイド](./concepts_n8n_industry_healthcare.md)
- [飲食・ホスピタリティ業界のガイド](./concepts_n8n_industry_hospitality.md)
- [トリガーの種類](./concepts_n8n_triggers.md)
