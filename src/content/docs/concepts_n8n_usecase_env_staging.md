---
category: "概念"
order: 200
title: 環境変数で本番・ステージングを切り替える
description: n8nの環境変数・Variables機能を使い、同一ワークフローが本番・ステージング・開発環境で異なるエンドポイント・認証情報を参照するように設定する手順。
tags: ["n8n", "ユースケース", "環境変数", "マルチ環境", "ステージング", "デプロイ", "セキュリティ"]
emoji: "🌍"
date: "2026-04-09"
source: "https://docs.n8n.io/source-control-environments/environments/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

開発・ステージング・本番で異なるAPIエンドポイント・データベース・Slackチャンネルを使い分けるために、n8nのVariables機能と環境変数を組み合わせて環境ごとの設定を管理する。

**解決する課題**: ワークフローに直書きされた本番URL・DBホストを環境ごとに書き換えるリスクをなくし、コードは同じで設定だけを切り替える

## 環境設定の方法（3パターン）

### パターン1: n8n Variables（推奨）

n8n管理画面内で環境変数を管理する。

```
Settings → Variables → Create Variable
```

| Key | Value（dev） | Value（prod） |
|---|---|---|
| API_BASE_URL | https://api-dev.example.com | https://api.example.com |
| DB_HOST | dev-db.internal | prod-db.internal |
| SLACK_CHANNEL | #dev-alerts | #prod-alerts |
| LOG_LEVEL | debug | error |

ワークフロー内での参照:
```
URL: {{ $vars.API_BASE_URL }}/v1/orders
```

### パターン2: .envファイル（セルフホスト）

```bash
# .env（開発環境）
N8N_ENV=development
API_BASE_URL=https://api-dev.example.com
DB_HOST=localhost
SLACK_CHANNEL=#dev-alerts

# .env（本番環境）
N8N_ENV=production
API_BASE_URL=https://api.example.com
DB_HOST=prod-db.internal
SLACK_CHANNEL=#prod-alerts
```

ワークフロー内での参照:
```
URL: {{ $env.API_BASE_URL }}/v1/orders
```

### パターン3: External Secrets（エンタープライズ）

HashiCorp VaultやAWS Secrets Managerで一元管理する。

```
Settings → External Secrets → Add Provider
```

参照:
```
{{ $secrets.API_KEY }}
```

## 具体的な設定例

### HTTP Requestノードの環境別URL切り替え

```
URL: {{ $vars.API_BASE_URL }}/v1/orders
Headers:
  Authorization: Bearer {{ $vars.API_KEY }}
```

開発と本番で同じワークフローを使い、Variablesだけを環境ごとに変える。

### Slack通知の送信先切り替え

```
Channel: {{ $vars.SLACK_CHANNEL }}
```

開発環境では `#dev-test` に通知し、本番では `#production` に送る。

### DB接続の切り替え

PostgreSQLノードのCredentialを環境別に作成しておく:
- `PostgreSQL - Development`
- `PostgreSQL - Production`

n8n VariablesでCredential名を切り替えるよりも、Credentialを直接環境別に選択する方が安全。

## デプロイ時の確認チェックリスト

```
□ Variables が本番値に設定されているか
□ Credentialが本番用のものを指しているか
□ Error WorkflowのSlack通知先が本番チャンネルか
□ Schedule Triggerの時刻がJST/UTCどちらで設定されているか
□ Webhookのパスが本番用のものか（テスト用パスを使っていないか）
```

## ポイント・注意事項

- n8n VariablesはGitのSource Controlに含まれる。本番の実際の値は環境変数（.env）か外部Secretsで上書きする運用が安全
- `$env` は実行環境のOS環境変数を参照する。Docker/ECS等のコンテナ環境ではコンテナの環境変数を設定する
- テスト・デバッグ中にVariablesを本番値に変更しないよう、開発者各自がローカルのn8nインスタンスを持つことを推奨する

## 関連機能

- [エンタープライズ機能](./concepts_n8n_enterprise.md)
- [Gitバージョン管理](./concepts_n8n_usecase_git_version_control.md)
- [エラーハンドリング](./concepts_n8n_error_handling.md)
