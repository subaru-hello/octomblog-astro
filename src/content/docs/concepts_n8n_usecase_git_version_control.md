---
category: "概念"
order: 239
title: Gitでワークフローをバージョン管理する
description: n8nのSource Control機能（Git連携）を使い、ワークフローをGitHubで管理し、ブランチ戦略でdev/staging/prod環境へのデプロイを制御するセットアップ手順。
tags: ["n8n", "ユースケース", "Git", "バージョン管理", "Source Control", "デプロイ", "CI/CD"]
emoji: "🗂️"
date: "2026-04-09"
source: "https://docs.n8n.io/source-control-environments/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

n8nのSource Control機能でGitHubリポジトリと接続し、ワークフローの変更をGitで管理する。環境ごとにブランチを分け、PRレビューを経て本番適用する運用フローを構築する。

**解決する課題**: ワークフローの変更履歴が追えず、誰がいつ変更したか不明・壊れた場合のロールバックができない問題を解決する

**前提条件**: n8n Enterprise版またはn8n Cloud Businessプラン以上

## ブランチ戦略

```
main（本番）
  ↑ マージ（PRレビュー必須）
staging（検証）
  ↑ マージ
develop（開発）
  ↑ 機能ブランチ
feature/xxx
```

各環境のn8nインスタンスが対応するブランチを参照する。

## セットアップ手順

### Step 1: GitHubリポジトリの作成

```bash
# GitHubでリポジトリ作成後
git init
git branch -M main
```

### Step 2: n8nとGitの接続

```
n8n管理画面 → Settings → Source Control

Provider: GitHub
Repository URL: https://github.com/your-org/n8n-workflows
Branch: develop（開発環境の場合）
SSH Key: [自動生成されたSSH公開鍵をGitHubに登録]
```

### Step 3: SSHキーをGitHubに登録

n8nが生成した公開鍵を GitHubのリポジトリ → Settings → Deploy Keys に追加する。
開発・本番のPushが必要な場合は Write access を有効にする。

### Step 4: 初回Push（既存ワークフローのコミット）

```
Settings → Source Control → Push to remote
Commit Message: "initial: 既存ワークフローをGit管理に移行"
```

生成されるファイル構成:
```
.n8n/
  workflows/
    my-workflow-1.json
    order-processing.json
  credentials/
    *.json（暗号化済み）
  variables.json
```

## 開発フロー

### 日常的な変更管理

```
1. developブランチで変更
2. Push: Settings → Source Control → Push
3. PRをGitHubで作成・レビュー
4. staging ブランチにマージ → staging環境でテスト
5. main ブランチにマージ → 本番環境でPull適用
```

### 本番へのデプロイ（Pull）

```
本番n8n → Settings → Source Control → Pull from remote
```

mainブランチの最新状態が本番n8nに反映される。

## ポイント・注意事項

- Credential（認証情報）はGitに保存されるが**暗号化**される。暗号化キーは各環境で別々に管理し、Gitには含めない
- `variables.json` にはDB接続文字列等の環境別値が含まれる。`.gitignore` で除外するか、値を環境変数参照（`{{ $env.VAR_NAME }}`）にする
- ワークフローの `isActive`（アクティブ/非アクティブ）状態はGitに含まれる。本番Pullで意図せずワークフローがアクティブ化されないよう注意する

## 関連機能

- [エンタープライズ機能](./concepts_n8n_enterprise.md)
- [環境変数による切り替え](./concepts_n8n_usecase_env_staging.md)
