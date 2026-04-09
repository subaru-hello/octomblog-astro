---
category: "概念"
order: 109
title: n8nエンタープライズ機能（ソース管理・シークレット・チーム管理）
description: n8nのエンタープライズ向け機能。Gitによるソース管理・外部シークレット管理・ユーザーロール・SSO連携の設定と運用方法を解説。
tags: ["n8n", "エンタープライズ", "ソース管理", "Git", "シークレット管理", "セキュリティ"]
emoji: "🏢"
date: "2026-04-09"
source: "https://docs.n8n.io/source-control-environments/"
series:
  - n8nワークフロー自動化
---

## エンタープライズ機能の概要

n8nのエンタープライズ版（またはセルフホスト版の一部機能）では、チームでの本格運用に必要な機能が提供される。

| 機能 | 説明 |
|---|---|
| Source Control | GitでワークフローをバージョンCR管理 |
| External Secrets | Vault/AWS Secrets Managerと連携 |
| User Management | ユーザーロール・権限管理 |
| SSO | SAML/LDAPでのシングルサインオン |
| Log Streaming | 実行ログを外部システムに転送 |
| Workers | 実行処理をスケールアウト |

## Source Control（Gitによるワークフロー管理）

ワークフローをGitリポジトリで管理し、環境間（dev/staging/prod）でのデプロイを制御する。

### セットアップ

```
Settings → Source Control → Connect to Git repository
```

- **Branch戦略**: 環境ごとにbranchを分ける（main=prod, develop=dev）
- **対象リソース**: ワークフロー・Credential（暗号化）・変数

### Push / Pull

```
変更をGitに保存: Settings → Source Control → Push
最新をGitから取得: Settings → Source Control → Pull
```

### 環境変数による切り替え

```
# .env（開発）
N8N_ENVIRONMENT_NAME=development
DB_HOST=localhost

# .env（本番）
N8N_ENVIRONMENT_NAME=production
DB_HOST=prod-db.example.com
```

ワークフロー内では `{{ $env.DB_HOST }}` で参照する。

## External Secrets（外部シークレット管理）

APIキーやパスワードをn8n内部ではなく外部のシークレットマネージャーで管理する。

**対応サービス:**
- HashiCorp Vault
- AWS Secrets Manager
- Azure Key Vault
- GCP Secret Manager
- Infisical

```
Settings → External Secrets → Add Provider
```

ワークフロー内では `{{ $secrets.OPENAI_API_KEY }}` で参照できる。

## ユーザーロール管理

| ロール | 権限 |
|---|---|
| Owner | 全権限。インスタンス設定変更可 |
| Admin | ユーザー管理・全ワークフロー操作 |
| Member | 自分のワークフローのみ操作 |
| Viewer | 閲覧のみ（ワークフロー実行不可） |

## Workersによるスケールアウト

実行処理を複数のWorkerプロセスに分散させる。

```yaml
# docker-compose.yml
services:
  n8n:
    command: start
  n8n-worker:
    command: worker
    environment:
      - QUEUE_BULL_REDIS_HOST=redis
```

RedisをキューとしてWorkerが実行タスクを処理する。

## ユースケース

| ユースケース | 説明 | リンク |
|---|---|---|
| Gitバージョン管理 | ワークフローをGitで管理・デプロイ | [→ doc](./concepts_n8n_usecase_git_version_control.md) |
| 環境切り替え | 本番・ステージングを環境変数で分離 | [→ doc](./concepts_n8n_usecase_env_staging.md) |
| チーム共同管理 | ロールとシークレット管理によるチーム運用 | [→ doc](./concepts_n8n_usecase_team_collaboration.md) |

## 公式ドキュメント

- https://docs.n8n.io/source-control-environments/
- https://docs.n8n.io/external-secrets/
- https://docs.n8n.io/user-management/
