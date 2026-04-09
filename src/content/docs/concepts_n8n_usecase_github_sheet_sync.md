---
category: "概念"
order: 216
title: GitHubのPRをGoogleシートに自動記録する
description: GitHub Triggerで新規PR作成を検知し、PR情報（タイトル・作者・ステータス）をGoogleスプレッドシートに自動追記するワークフロー。
tags: ["n8n", "ユースケース", "GitHub", "Google Sheets", "PR管理", "自動記録"]
emoji: "📊"
date: "2026-04-09"
source: "https://docs.n8n.io/integrations/builtin/trigger-nodes/n8n-nodes-base.githubtrigger/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

GitHubでPRが作成・更新・マージされると自動的にGoogleシートに記録する。PRトラッキングやリリース管理の自動化に活用できる。

**解決する課題**: 手動でのPR状況記録作業をなくし、常にリアルタイムの情報をシートに反映する

**使用するn8nノード:**
- GitHub Trigger（PR作成・更新を検知）
- IF（PRの状態で分岐）
- Google Sheets（行追加・更新）

## ワークフロー構成

```
[GitHub Trigger: pull_request イベント]
    ↓
[IF: action == "opened"]
  ├── true  → [Google Sheets: 新規行を追加]
  └── false → [IF: action == "closed" AND merged == true]
                ├── true  → [Google Sheets: マージ日時を更新]
                └── false → スキップ
```

## 実装手順

### Step 1: GitHub Triggerの設定

```
Repository Owner: your-org
Repository Name: your-repo
Events: Pull Request
Authentication: GitHub Personal Access Token
```

受信するPRイベント:
- `opened`（新規作成）
- `closed`（クローズ・マージ）
- `edited`（タイトル・説明変更）

### Step 2: IFノードで状態を判定

```
Condition 1: {{ $json.action }} equals "opened"
```

### Step 3: 新規行をGoogleシートに追加

```
Operation: Append Row
Spreadsheet ID: your-spreadsheet-id
Sheet: PR追跡シート
Data:
  PR番号: {{ $json.pull_request.number }}
  タイトル: {{ $json.pull_request.title }}
  作者: {{ $json.pull_request.user.login }}
  作成日: {{ $json.pull_request.created_at }}
  ステータス: Open
  URL: {{ $json.pull_request.html_url }}
```

### Step 4: マージ時にステータスを更新

```
Operation: Update Row
Where Column: PR番号
Where Value: {{ $json.pull_request.number }}
Update Columns:
  ステータス: Merged
  マージ日: {{ $json.pull_request.merged_at }}
```

## ポイント・注意事項

- GitHub TriggerはWebhookベース。n8nが外部からアクセス可能なURLである必要がある
- セルフホスト環境ではngrokまたはCloudflare Tunnelで外部公開する
- Google Sheetsの「Update Row」にはGoogleシートAPIのバッチレート制限に注意

## 関連機能

- [ワークフローの基本](./concepts_n8n_workflow_basics.md)
- [主要インテグレーション](./concepts_n8n_integrations.md)
- [ロジック制御](./concepts_n8n_logic_flow.md)
