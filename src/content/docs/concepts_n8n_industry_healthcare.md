---
category: "概念"
order: 304
title: n8n 医療・クリニックの活用ガイド
description: クリニック・医療機関における予約管理・リマインダー・患者コミュニケーション・スタッフ業務をn8nで自動化する実践的なユースケースガイド。
tags: ["n8n", "医療", "クリニック", "予約管理", "患者コミュニケーション", "業種別"]
emoji: "🏥"
date: "2026-04-09"
source: "https://n8n.io/workflows/9446-medical-triage-and-appointment-automation-with-gpt-4-and-jotform/"
series:
  - n8n業種別ユースケース
---

## 医療・クリニックの自動化ポイント

クリニック業務では受付・予約・患者連絡・事務処理に多くの手作業が発生する。n8nで以下を改善できる。

> **プライバシー注意**: 患者情報は個人情報保護法・医療情報の取扱い指針に従い、セルフホスト環境の使用を推奨。

## 主要ユースケース一覧

### 予約リマインダーの自動送信

前日・当日に予約確認メール/SMSを自動送信。ノーショー（無断キャンセル）を大幅に削減。

```
[Schedule Trigger: 毎日17:00]
    ↓
[Google Calendar または 予約システムAPI: 翌日の予約一覧取得]
    ↓
[Loop Over Items: 患者ごとに処理]
    ↓
[IF: メール通知 or SMS通知を希望]
  ├── メール → [Gmail: リマインダーメール]
  └── SMS   → [Twilio: SMS送信]
```

**効果**: ノーショー率を最大40%削減（業界統計）

---

### 初診問診フォームの自動処理

Web問診票の回答をAIが解析し、診療科への事前振り分けとカルテ下書きを自動生成する。

**使用ノード**: Jotform/Typeform Trigger → OpenAI（症状分析・優先度判定）→ Google Sheets（記録）→ 担当医へSlack通知

---

### キャンセル待ちの自動管理

キャンセルが発生した際、キャンセル待ちリストの患者に自動で連絡し、最初の返信者に枠を割り当てる。

```
[Webhookまたはフォーム: キャンセル発生]
    ↓
[Airtable: キャンセル待ちリスト取得（優先順）]
    ↓
[Gmail/Twilio: 最上位の患者に連絡]
    ↓
[Wait: 2時間待機]
    ↓
[IF: 返信あり] → 予約確定 → カレンダー更新
[IF: 返信なし] → 次の患者へ連絡
```

---

### 処方箋・検査結果の通知

検査結果が出た際に患者へ「結果が出ました。受診のご予約をお願いします。」という通知を自動送信する。

**使用ノード**: DB/カルテシステムWebhook → IF（緊急度判定）→ Gmail/SMS → 要フォロー患者を医師にSlack通知

---

### スタッフシフト管理

スタッフの希望シフトを集計し、必要人数を確認してシフト表をSlack/メールで配信する。

| 自動化内容 | 使用ノード |
|---|---|
| 希望シフト収集フォーム | Typeform/Jotform |
| シフト集計・調整 | Code（JavaScript） |
| スタッフへの配信 | Slack / Gmail |
| 祝日・休診日の自動反映 | Google Calendar |

---

## おすすめ連携サービス

| サービス | 用途 |
|---|---|
| Calenista / Mindbody | 予約管理システム連携 |
| Twilio | SMS・電話自動化 |
| LINE Official Account | 患者との連絡 |
| Google Calendar | 予約・シフト管理 |
| Airtable | 患者情報管理（非カルテ情報） |

## 参照ドキュメント

- [トリガーの種類](./concepts_n8n_triggers.md)
- [ロジック制御](./concepts_n8n_logic_flow.md)
- [予約リマインダーのユースケース](./concepts_n8n_usecase_appointment_reminder.md)
