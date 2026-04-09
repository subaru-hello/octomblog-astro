---
category: "概念"
order: 200
title: チームでのワークフロー共同管理フロー
description: n8nのユーザー管理・ロール設定・プロジェクト分離を使い、複数チームがそれぞれのワークフローを安全に管理できる組織運用の設定手順。
tags: ["n8n", "ユースケース", "チーム管理", "ロール管理", "マルチテナント", "セキュリティ", "権限管理"]
emoji: "👥"
date: "2026-04-09"
source: "https://docs.n8n.io/user-management/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

複数チーム（開発・営業・マーケ）が1つのn8nインスタンスを共有しながら、自チームのワークフローのみを操作できる環境を構築する。Credential（認証情報）の分離と適切なロール設定が鍵。

**解決する課題**: チームごとのn8nインスタンス分離はコストがかかる。単一インスタンスで安全に権限を分離したい

## ユーザーロールの設計

### n8nの標準ロール

| ロール | ワークフロー | Credential | ユーザー管理 | インスタンス設定 |
|---|---|---|---|---|
| Owner | 全WT操作 | 全Cred操作 | ✅ | ✅ |
| Admin | 全WT操作 | 全Cred操作 | ✅ | ❌ |
| Member | 自分のWTのみ | 自分のCredのみ | ❌ | ❌ |

### 推奨ロール運用

| 役割 | ロール | 備考 |
|---|---|---|
| n8n管理者 | Owner 1名 | システム管理者 |
| 各チームリーダー | Admin | ワークフロー全体監査 |
| チームメンバー | Member | 自チームWTのみ操作 |
| 外部委託 | Member | 特定WTのみ共有 |

## セットアップ手順

### Step 1: ユーザーの招待

```
Settings → Users → Invite User
Email: member@yourcompany.com
Role: Member
```

招待メールが送信され、初回ログイン時にパスワードを設定する。

### Step 2: ワークフローの共有設定

ワークフロー単位でアクセス権を設定できる。

```
ワークフロー → Share ボタン
→ Add User または Add Team
→ Permission: View / Edit
```

**View**: 実行・閲覧のみ（本番ワークフローの参照）
**Edit**: ワークフロー編集・実行・削除

### Step 3: Credentialの共有設定

APIキーなどのCredentialは必要なユーザーにのみ共有する。

```
Credential → Share ボタン
→ Add User または Add Team
→ Allowed to Use（使用可能、内容は非表示）
```

Memberはcredentialを「使用」はできるが「内容（API Key）を閲覧」はできない。これにより、個人ではなく組織の認証情報を安全に管理できる。

### Step 4: Tagによる分類管理

ワークフローにタグを付けてチーム・用途で分類する。

```
ワークフロー → Tags → Add Tag
例: sales, marketing, engineering, production
```

Tagsで検索してチーム別に一覧表示できる。

## チーム運用のベストプラクティス

### ワークフロー命名規則

```
[チーム]-[用途]-[詳細]
例:
  sales-lead-routing
  marketing-email-campaign
  engineering-github-sync
```

### 本番ワークフローの保護

本番ワークフローはOwner/AdminのみがEditできるよう設定し、Memberはview権限のみ付与する。

### Credentialの命名規則

```
[サービス名] - [環境] - [チーム]
例:
  Slack - Production - Engineering
  HubSpot - Production - Sales
  PostgreSQL - Dev - Shared
```

## SSO（シングルサインオン）設定

EnterpriseではSAML 2.0またはLDAP/Active Directoryと連携できる。

```
Settings → SSO
Provider: SAML 2.0
IdP Metadata URL: https://your-idp.com/saml/metadata
```

これにより社内の既存アカウント管理システムでn8nにログインできる。

## ポイント・注意事項

- Credential共有はCredential IDで管理される。Credentialを削除すると参照しているワークフローが全て失敗する
- チームが増えた場合のCredentialとワークフローの整理方針を事前に決めておく
- 全メンバーのワークフローを監査するため、Adminロールを持つ担当者を設定しておく

## 関連機能

- [エンタープライズ機能](./concepts_n8n_enterprise.md)
- [Gitバージョン管理](./concepts_n8n_usecase_git_version_control.md)
- [環境変数での切り替え](./concepts_n8n_usecase_env_staging.md)
