---
category: "概念"
order: 104
title: n8n HTTP Request・API連携
description: n8nのHTTP Requestノードで任意のREST/GraphQL APIを呼び出す方法。認証設定・ページネーション・レスポンス処理の実践的な使い方を解説。
tags: ["n8n", "HTTP Request", "REST API", "GraphQL", "API連携"]
emoji: "🌐"
date: "2026-04-09"
source: "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/"
series:
  - n8nワークフロー自動化
---

## HTTP Requestノードとは

n8nに専用ノードがないサービスでも、HTTP Requestノードで直接API呼び出しができる。REST・GraphQL・SOAPに対応。

## 基本設定

| 設定項目 | 説明 |
|---|---|
| Method | GET / POST / PUT / PATCH / DELETE |
| URL | エンドポイントURL（式で動的指定可） |
| Authentication | 認証方式（後述） |
| Headers | HTTPヘッダー |
| Body | リクエストボディ（JSON / Form Data / Binary） |
| Query Parameters | URLクエリパラメータ |

## 認証設定

n8nのCredential（認証情報）を使い、シークレットをワークフローに直書きしない。

| 認証方式 | 設定内容 |
|---|---|
| None | 認証不要 |
| Generic Credential Type → Header Auth | `Authorization: Bearer {token}` |
| Generic Credential Type → Basic Auth | ユーザー名/パスワード |
| OAuth2 | クライアントID・シークレット・スコープ |
| Predefined Credential | n8n組み込みの認証（GitHub, Slack等） |

## GraphQL APIの呼び出し

```
Method: POST
URL: https://api.github.com/graphql
Headers:
  Authorization: Bearer {{ $credentials.githubToken }}
  Content-Type: application/json
Body (JSON):
{
  "query": "query { repository(owner: \"n8n-io\", name: \"n8n\") { stargazerCount } }"
}
```

## ページネーション処理

大量データを持つAPIのページネーションを自動処理できる。

**設定:**
```
Pagination:
  Pagination Mode: Update a Parameter
  Next URL: {{ $response.body.next_page_url }}
  Complete When: next_page_url is empty
```

## レスポンスの扱い

| 設定 | 説明 |
|---|---|
| Response Format | JSON / Text / File / Auto-detect |
| Put Output in Field | レスポンスを格納するフィールド名 |
| Split Into Items | 配列レスポンスをitemに展開 |

## エラーレスポンスの処理

デフォルトでは4xx/5xxエラー時にワークフローが停止する。

```
Settings → On Error: Continue → 後続ノードでstatusCodeを確認
```

またはIF分岐で `{{ $response.statusCode }}` を条件に使う。

## ユースケース

| ユースケース | 説明 | リンク |
|---|---|---|
| REST API→DB保存 | 外部APIデータを取得してDBへ | [→ doc](./concepts_n8n_usecase_rest_to_db.md) |
| GraphQL×GitHub | IssueをGraphQLで取得・加工 | [→ doc](./concepts_n8n_usecase_graphql_github.md) |
| 認証付きAPI同期 | Bearer認証APIを呼び出す | [→ doc](./concepts_n8n_usecase_authenticated_api.md) |

## 公式ドキュメント

- https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/
