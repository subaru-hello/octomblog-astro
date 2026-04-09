---
category: "概念"
order: 309
title: n8n 教育・EdTech業界の活用ガイド
description: 学校・塾・オンライン学習プラットフォームにおける入学手続き・出席管理・課題リマインダー・保護者連絡をn8nで自動化するユースケースガイド。
tags: ["n8n", "教育", "EdTech", "LMS", "学習管理", "保護者連絡", "出席管理", "業種別"]
emoji: "📚"
date: "2026-04-09"
source: "https://n8n.io/workflows/6998-automated-student-progress-reports-from-lms-to-parents-via-gmail-and-google-sheets/"
series:
  - n8n業種別ユースケース
---

## 教育・EdTechの自動化ポイント

教育機関では**入学受付→出席管理→課題追跡→保護者連絡→成績報告**に膨大な手作業が発生する。

## 主要ユースケース一覧

### 入学・受講申込の自動処理

申込フォームの回答を受け取り、LMSアカウント作成・教材送付・ガイダンス案内を自動で実行する。

```
[Typeform/Google Forms Trigger: 申込フォーム送信]
    ↓
[Code: 受講コース確認・受講料確認]
    ↓
[HTTP Request: LMS API（Canvas/TalentLMS）にユーザー作成]
    ↓（並列）
[Gmail: ウェルカムメール + ログイン情報]
[Notion/Airtable: 生徒情報を登録]
[Slack: 担当講師に新規生徒の通知]
```

**効果**: 手動処理3〜5件/日 × 15分 = 約375時間/年を削減

---

### 学習進捗レポートの自動生成・配信

週次または月次で各生徒のLMSの学習データを集計し、保護者へ進捗レポートメールを自動送付する。

**使用ノード**: Schedule Trigger → HTTP Request（LMS API）→ Code（達成率・学習時間集計）→ OpenAI（コメント生成）→ Gmail（保護者に送付）

---

### 課題締め切りリマインダー

未提出の課題を検出し、生徒に自動でリマインダーを送る。

```
[Schedule Trigger: 毎日17:00]
    ↓
[HTTP Request: LMS API（翌日締め切りの課題一覧）]
    ↓
[HTTP Request: 未提出の生徒一覧を取得]
    ↓
[Loop Over Items: 生徒ごとに処理]
    ↓
[Gmail/Twilio: 「明日締め切りです」リマインダー]
```

---

### 欠席・遅刻の自動保護者通知

出席管理システムと連携し、欠席・遅刻が記録された際に保護者へ自動でSMSやメールを送る。

**使用ノード**: Webhook（出席システムから遅刻・欠席イベント）→ IF（欠席種別判定）→ Gmail/Twilio（保護者への連絡）→ Google Sheets（欠席記録）

---

### 模試・テスト結果の自動レポート

試験採点が完了した際に、個人の結果と全体平均・偏差値を計算してPDFレポートを自動作成・配布する。

| ステップ | 内容 |
|---|---|
| テスト結果の取り込み | Google Sheets / CSV |
| 統計計算 | Code（平均・偏差値）|
| PDFレポート生成 | Code（pdfkit） |
| 生徒・保護者への配布 | Gmail（添付） |
| 低成績者フラグ | Slack（担当講師に通知） |

---

### オンラインセミナー・ウェビナーの自動運用

参加登録→リマインダー→当日ZoomURL配信→アンケート送付→録画共有を全自動化する。

```
[Zoom / EventbriteのWebhook: 参加登録]
    ↓
[Gmail: 確認メール + Zoom URL]
    ↓
[Wait: 前日15:00]
    ↓
[Gmail: リマインダー + 参加用リンク再送]
    ↓
[Wait: 開催後3時間]
    ↓
[Typeform: アンケートリンク送付]
    ↓
[Wait: 録画公開後]
    ↓
[Gmail: 録画URLと資料を送付]
```

---

## おすすめ連携サービス

| サービス | 用途 |
|---|---|
| Canvas / TalentLMS / Moodle | LMS（学習管理システム）API |
| Zoom / Google Meet | オンライン授業 |
| Twilio | SMS通知 |
| Google Forms / Typeform | 申込・アンケート |
| Google Sheets / Notion | 生徒情報管理 |
| LINE Official Account | 保護者・生徒連絡 |

## 参照ドキュメント

- [トリガーの種類](./concepts_n8n_triggers.md)
- [一括メール送信のユースケース](./concepts_n8n_usecase_bulk_email_loop.md)
- [PDF自動生成のユースケース](./concepts_n8n_usecase_pdf_generation.md)
