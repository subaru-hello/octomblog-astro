---
category: "概念"
order: 123
title: n8n主要インテグレーション（Slack・Gmail・GitHub）
description: n8nの400以上の組み込みインテグレーションの使い方。Slack・Gmail・GitHubなど頻繁に使うサービスの認証設定と代表的な操作を解説。
tags: ["n8n", "インテグレーション", "Slack", "Gmail", "GitHub", "Notion"]
emoji: "🔗"
date: "2026-04-09"
source: "https://docs.n8n.io/integrations/"
series:
  - n8nワークフロー自動化
---

## インテグレーションとは

n8nでは400以上のサービスに対して専用ノードが用意されている。各ノードは**操作（Action）**と**トリガー（Trigger）**の2種類を持つ。

## 認証情報（Credentials）の管理

サービスごとの認証情報はn8nの「Credentials」に一元管理する。ワークフロー内にトークンを直書きしない。

```
Settings → Credentials → New Credential → サービス選択
```

認証方式はサービスによって異なる:
- **OAuth2**: Slack, Gmail, Google Sheets, Notion
- **API Key**: Stripe, Airtable, OpenAI, SendGrid
- **Personal Access Token**: GitHub, GitLab

## 主要サービス別の操作一覧

### Slack

| 操作 | 説明 |
|---|---|
| Message → Send | チャンネル・DMにメッセージ送信 |
| Message → Get | メッセージ取得 |
| Channel → Get Many | チャンネル一覧取得 |
| User → Get | ユーザー情報取得 |

**認証**: OAuth2（Slack App作成が必要）

### Gmail

| 操作 | 説明 |
|---|---|
| Message → Send | メール送信（HTML対応） |
| Message → Get Many | メール一覧取得（検索クエリ対応） |
| Label → Add | ラベル付与 |
| Draft → Create | 下書き作成 |

**認証**: OAuth2（Google Cloud Console設定が必要）

### GitHub

| 操作 | 説明 |
|---|---|
| Issue → Create | Issue作成 |
| Pull Request → Get Many | PR一覧取得 |
| File → Get | ファイル内容取得 |
| Repository → Get | リポジトリ情報取得 |

**認証**: Personal Access Token

### Notion

| 操作 | 説明 |
|---|---|
| Database Item → Create | ページ作成 |
| Database Item → Get Many | ページ一覧取得（フィルタ対応） |
| Page → Update | ページ更新 |
| Block → Append | ブロック追加 |

**認証**: OAuth2またはIntegration Token

### Google Sheets

| 操作 | 説明 |
|---|---|
| Row → Append | 行追加 |
| Row → Get Many | 行取得 |
| Sheet → Clear | シートクリア |

**認証**: OAuth2またはService Account

## コミュニティノード

公式にないサービスはコミュニティノードとして公開されている。

```
Settings → Community Nodes → Install
```

パッケージ名は `n8n-nodes-{service}` 形式が多い。

## ユースケース

| ユースケース | 説明 | リンク |
|---|---|---|
| Slack×Notion タスク管理 | Slackメンションで自動Notionチケット作成 | [→ doc](./concepts_n8n_usecase_slack_notion_tasks.md) |
| Gmail×HubSpot CRM連携 | メール受信でHubSpotリード自動作成 | [→ doc](./concepts_n8n_usecase_gmail_hubspot_crm.md) |
| GitHub デプロイ通知 | Push/DeployイベントをSlackへ通知 | [→ doc](./concepts_n8n_usecase_github_deploy_notify.md) |

## 公式ドキュメント

- https://docs.n8n.io/integrations/
- https://docs.n8n.io/integrations/community-nodes/
