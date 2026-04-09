---
category: "概念"
order: 308
title: n8n 飲食・ホスピタリティ業界の活用ガイド
description: レストラン・ホテル・宿泊施設における予約管理・ゲストコミュニケーション・口コミ収集・スタッフ管理をn8nで自動化するユースケースガイド。
tags: ["n8n", "飲食", "ホスピタリティ", "ホテル", "レストラン", "予約管理", "口コミ", "業種別"]
emoji: "🍽️"
date: "2026-04-09"
source: "https://n8n.io/workflows/"
series:
  - n8n業種別ユースケース
---

## 飲食・ホスピタリティの自動化ポイント

飲食・宿泊業では**予約受付→確認→リマインダー→当日対応→口コミ依頼**のサイクルが毎日繰り返される。

## 主要ユースケース一覧

### 予約確認・リマインダーの自動化

予約受付時の確認メール/SMS送信と、前日リマインダーを完全自動化する。

```
[Webhook: 予約システムから予約確定イベント]
    ↓
[Gmail/Twilio: 予約確認メール/SMS（即時）]
    ↓
[Wait: 予約前日09:00まで待機]
    ↓
[Twilio/LINE: リマインダーSMS/LINEメッセージ]
```

**効果**: スタッフの手作業ゼロ、ノーショー削減

---

### Googleビジネスプロフィール口コミ依頼

会計完了後にお礼メッセージとGoogleレビューへの誘導リンクを自動送信する。

**使用ノード**: POSシステムWebhook（会計完了）→ Wait（2時間後）→ Gmail/SMS（「本日はありがとうございました。口コミ投稿のお願い」）

---

### 悪い口コミへの素早い対応アラート

Google・食べログ・TripAdvisorへの低評価投稿を検知し、オーナー/店長にSlackで即時通知する。

```
[Schedule Trigger: 毎時]
    ↓
[HTTP Request: Google My Business API / 食べログAPI]
    ↓
[Filter: 評価3以下の新規レビューのみ]
    ↓
[OpenAI: レビュー内容を要約・問題点を特定]
    ↓
[Slack: 店長・オーナーに緊急通知]
```

---

### スタッフシフトの自動管理

希望シフト収集→調整→配信→欠員アラートを自動化する。

| ステップ | 内容 | ノード |
|---|---|---|
| 希望収集 | Google Formsで収集 | Google Forms Trigger |
| 集計 | 勤務時間・希望を集計 | Code |
| 不足シフト特定 | 必要人数との差分確認 | Code + Filter |
| シフト配信 | 完成シフトをSlackに投稿 | Slack |
| 欠員補充 | 欠員発生時に代替者へ連絡 | Twilio/LINE |

---

### 食材発注の自動化

POSデータから使用食材量を集計し、在庫が減った際に仕入れ先に自動発注する。

```
[Schedule Trigger: 毎日閉店後]
    ↓
[HTTP Request: POSシステムの売上API]
    ↓
[Code: 使用食材量を計算・在庫予測]
    ↓
[Filter: 翌日分の在庫が不足する食材]
    ↓
[Gmail: 仕入れ先（八百屋・肉屋・酒屋）に発注メール]
```

---

### アレルギー対応の確認フロー

予約時のアレルギー情報をキッチンに自動共有し、当日の準備に活かす。

**使用ノード**: 予約フォーム（アレルギー入力欄あり）→ Google Sheets（アレルギー情報記録）→ 当日07:00にSlack（#kitchen-prep に「本日のアレルギー対応が必要なお客様」として共有）

---

## おすすめ連携サービス

| サービス | 用途 |
|---|---|
| Tablecheck / OpenTable | 予約管理システム |
| Square / Airレジ | POSシステム |
| LINE Official Account | ゲストとの連絡 |
| Twilio | SMS通知 |
| Google Business Profile API | 口コミ管理 |
| 食べログ / TripAdvisor | 口コミ監視 |

## 参照ドキュメント

- [トリガーの種類](./concepts_n8n_triggers.md)
- [ロジック制御](./concepts_n8n_logic_flow.md)
- [予約リマインダーのユースケース](./concepts_n8n_usecase_appointment_reminder.md)
