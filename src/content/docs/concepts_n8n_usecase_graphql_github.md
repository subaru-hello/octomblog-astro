---
category: "概念"
order: 200
title: GraphQL APIでGitHubのIssueを取得・加工する
description: HTTP RequestノードでGitHub GraphQL APIを呼び出し、特定リポジトリのIssueを取得してNotionデータベースへ同期するワークフロー。
tags: ["n8n", "ユースケース", "GraphQL", "GitHub", "API", "Notion", "Issue管理"]
emoji: "🔍"
date: "2026-04-09"
source: "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

GitHub GraphQL APIでオープンなIssueを取得し、ラベル・優先度に応じてNotionのプロジェクトDBに同期する。GitHubの管理を維持しながらNotionでも俯瞰できる環境を作る。

**解決する課題**: エンジニア（GitHub）とビジネスチーム（Notion）が同じIssue情報を別々のツールで参照できる

**使用するn8nノード:**
- Schedule Trigger（定期同期）
- HTTP Request（GitHub GraphQL API）
- Loop Over Items（Issue一覧の処理）
- Notion（Issue sync）

## ワークフロー構成

```
[Schedule Trigger: 毎時0分]
    ↓
[HTTP Request: GitHub GraphQL API]
    ↓
[Code: GraphQLレスポンスをflattenする]
    ↓
[Loop Over Items: Issue一覧]
  └── [Notion: Database Item → Upsert]
```

## 実装手順

### Step 1: GitHub GraphQL APIの呼び出し

```
Method: POST
URL: https://api.github.com/graphql
Headers:
  Authorization: Bearer {{ $credentials.githubPat }}
  Content-Type: application/json
Body (JSON):
{
  "query": "query($owner: String!, $repo: String!, $cursor: String) { repository(owner: $owner, name: $repo) { issues(first: 50, after: $cursor, states: OPEN, orderBy: {field: UPDATED_AT, direction: DESC}) { pageInfo { endCursor hasNextPage } nodes { number title body state labels(first: 5) { nodes { name } } assignees(first: 3) { nodes { login } } createdAt updatedAt url } } } }",
  "variables": {
    "owner": "your-org",
    "repo": "your-repo",
    "cursor": null
  }
}
```

### Step 2: レスポンスのflatten処理（Codeノード）

GraphQLのネストされたレスポンスをitemの配列に展開する。

```javascript
const issues = $json.data.repository.issues.nodes;
return issues.map(issue => ({
  json: {
    number: issue.number,
    title: issue.title,
    state: issue.state,
    labels: issue.labels.nodes.map(l => l.name).join(', '),
    assignees: issue.assignees.nodes.map(a => a.login).join(', '),
    url: issue.url,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  }
}));
```

### Step 3: NotionへのUpsert

```
Operation: Database Item → Create (or Update if exists)
Database: GitHub Issues DB
Properties:
  Issue番号: {{ $json.number }}
  タイトル: {{ $json.title }}
  ラベル: {{ $json.labels }}
  担当者: {{ $json.assignees }}
  GitHub URL: {{ $json.url }}
  最終更新: {{ $json.updatedAt }}
```

## ポイント・注意事項

- GitHub GraphQL APIはREST APIより柔軟にフィールドを指定できる。必要なフィールドだけを取得してレスポンスを小さくする
- ページネーションは `pageInfo.hasNextPage` と `endCursor` を使ったカーソルページネーションで実装する
- GitHub PAT（Personal Access Token）は `repo` スコープが必要

## 関連機能

- [HTTP Request・API連携](./concepts_n8n_http_api.md)
- [Codeノード](./concepts_n8n_code_node.md)
- [主要インテグレーション](./concepts_n8n_integrations.md)
