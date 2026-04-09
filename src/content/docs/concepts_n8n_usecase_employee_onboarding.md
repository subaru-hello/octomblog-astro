---
category: "概念"
order: 249
title: 新入社員オンボーディングを完全自動化する
description: 内定承諾から入社初日・初月まで、アカウント作成・書類送付・ウェルカムメール・オリエンテーション案内・メンターアサインを時系列で自動実行するオンボーディングワークフロー。
tags: ["n8n", "ユースケース", "オンボーディング", "人事自動化", "入社手続き", "HR", "Slack"]
emoji: "🎉"
date: "2026-04-09"
source: "https://docs.n8n.io/integrations/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

新入社員の内定承諾日から入社初日・初月までのオンボーディングタスクを自動化する。HRの手作業（チェックリスト20項目以上）を大幅に削減し、新入社員の体験も向上させる。

**解決する課題**: 採用担当が毎回手動でやっている「内定→入社の間の手続き」（1人あたり3〜5時間）を自動化し、漏れをなくす

**使用するn8nノード:**
- Webhook Trigger（内定承諾イベント）
- Google Workspace Admin API（Gmailアカウント作成）
- Slack（チャンネル招待・ウェルカム投稿）
- Notion（新入社員ページ作成）
- Gmail（各種連絡メール）
- Wait（時系列スケジューリング）

## ワークフロー構成

```
[Webhook: 内定承諾フォーム送信]
    ↓
【フェーズ1: 即時処理（当日）】
[Google Workspace: 社用メール作成]
[Slack: 入社予定者チャンネル招待]
[Notion: オンボーディングページ作成]
[Gmail: 内定承諾御礼メール + 入社の手引き]
    ↓
[Wait: 入社1週間前]

【フェーズ2: 入社1週間前】
[Gmail: 入社準備リマインダー（持ち物・初日スケジュール）]
[Slack: 担当チームに「来週入社します」通知]
[Google Calendar: 入社初日のオリエンテーション予約]
    ↓
[Wait: 入社前日]

【フェーズ3: 入社前日】
[Gmail: 明日の詳細案内（集合場所・時間）]
[Slack: メンターに「明日入社します」DM]
    ↓
[Wait: 入社当日09:00]

【フェーズ4: 入社初日】
[Slack: #general に「本日○○が入社しました」投稿]
[Slack: 入社者に「おはようございます！」ウェルカムDM]
    ↓
[Wait: 入社1週間後]

【フェーズ5: 1週間後フォロー】
[Gmail: 「1週間経ちましたが、いかがですか？」フォローメール]
[Typeform: オンボーディング満足度アンケート送信]
```

## 実装手順

### Step 1: Webhook Trigger（内定承諾フォーム）

内定承諾時にHRが入力する情報フォームからワークフローを起動する。

```json
{
  "name": "田中花子",
  "email_personal": "hanako@gmail.com",
  "email_company": "h.tanaka",
  "department": "engineering",
  "manager": "suzuki@yourcompany.com",
  "startDate": "2026-05-01",
  "role": "バックエンドエンジニア",
  "mentorId": "U0987654321"
}
```

### Step 2: 社用Gmailアカウントの作成

```
Method: POST
URL: https://admin.googleapis.com/admin/directory/v1/users
Headers: Authorization: Bearer {{ $credentials.googleWorkspaceToken }}
Body:
{
  "primaryEmail": "{{ $json.email_company }}@yourcompany.com",
  "name": { "fullName": "{{ $json.name }}" },
  "password": "{{ ランダム初期パスワード }}",
  "changePasswordAtNextLogin": true,
  "orgUnitPath": "/{{ $json.department }}"
}
```

### Step 3: Slackへの招待とウェルカム準備

```javascript
// 入社者の部署に応じたSlackチャンネルリストを定義
const channelMap = {
  engineering: ['C_ENGINEERING', 'C_GENERAL', 'C_DEV_RANDOM'],
  sales: ['C_SALES', 'C_GENERAL', 'C_CRMDISCUSSION'],
  marketing: ['C_MARKETING', 'C_GENERAL', 'C_CONTENT']
};

const channels = channelMap[$json.department] ?? ['C_GENERAL'];
return channels.map(channelId => ({ json: { channelId, ...$json } }));
```

### Step 4: Notionにオンボーディングページ作成

```
Database: 入社者オンボーディングDB
Page Title: {{ $json.name }} オンボーディング計画
Properties:
  入社日: {{ $json.startDate }}
  部署: {{ $json.department }}
  ロール: {{ $json.role }}
  マネージャー: {{ $json.manager }}
  ステータス: 準備中
Blocks (コンテンツ):
  ## Day 1 チェックリスト
  - [ ] 社員証受け取り
  - [ ] PCセットアップ
  - [ ] 各種アカウント確認
  ## Week 1 目標
  - チームメンバー全員と1on1
  - 開発環境構築完了
```

### Step 5: 入社初日のSlack一斉通知

```
Channel: #general
Text:
🎉 *本日 {{ $json.name }} が入社しました！*
役割: {{ $json.role }}（{{ $json.department }}部門）

みなさん、温かく迎えてあげてください！
Slackでの自己紹介投稿をお楽しみに ✨
```

### Step 6: オンボーディング満足度アンケート（1週間後）

```
Gmail:
件名: 入社1週間、いかがでしたか？
本文:
{{ $json.name }} さん

入社から1週間が経ちました。
ぜひ率直なご意見をお聞かせください（3分で完了します）。

[アンケートに回答する] → {{ Typeform/Google FormsのURL }}

みなさんの声がオンボーディング改善につながります。
```

## ポイント・注意事項

- `Wait` ノードは長時間待機ができるが、n8nの実行タイムアウト設定に注意。24時間以上の待機には `Resume from Webhook` モードを使う
- 入社日変更などの突発事情に対応するため、Notionの入社日フィールドを更新したら再トリガーされる仕組みを検討する
- 個人メールへの連絡は入社前、社用メールへの連絡は入社後という棲み分けをする

## 関連機能

- [人事担当向けガイド](./concepts_n8n_role_hr.md)
- [AI履歴書スクリーニング](./concepts_n8n_usecase_resume_screening.md)
- [トリガーの種類](./concepts_n8n_triggers.md)
