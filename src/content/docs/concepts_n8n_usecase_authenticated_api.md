---
category: "概念"
order: 226
title: Bearer認証付きAPIを呼び出してデータ同期する
description: 有効期限付きのアクセストークンを自動リフレッシュしながら、認証が必要な外部APIを安全に呼び出してデータ同期するワークフロー。
tags: ["n8n", "ユースケース", "Bearer認証", "OAuth2", "トークンリフレッシュ", "API認証", "セキュリティ"]
emoji: "🔐"
date: "2026-04-09"
source: "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

OAuth2のアクセストークンが有効期限切れの場合に自動でリフレッシュし、認証済み状態でAPIを呼び出してデータを取得・同期する堅牢なパターン。

**解決する課題**: トークン期限切れによるAPI呼び出し失敗を自動でリカバリし、24時間安定して動作する自動化を実現する

**使用するn8nノード:**
- HTTP Request（トークンリフレッシュ）
- HTTP Request（実際のAPI呼び出し）
- IF（401エラー検知）
- n8n Credential（トークン安全管理）

## ワークフロー構成

**パターン1: OAuth2 Credential利用（推奨）**

```
[任意のTrigger]
    ↓
[HTTP Request: Predefined Credential = OAuth2サービス]
（n8nが自動でトークンリフレッシュを管理）
```

n8nのOAuth2 Credentialは自動でトークンリフレッシュを行うため、手動管理は不要。

**パターン2: カスタムトークン管理**

```
[Trigger]
    ↓
[HTTP Request: API呼び出し（Error Output有効）]
  ├── 成功 → 後続処理
  └── エラー → [IF: statusCode == 401]
                  ├── true  → [HTTP Request: トークンリフレッシュ]
                  │               ↓
                  │           [HTTP Request: API再呼び出し]
                  └── false → [エラー通知]
```

## 実装手順（パターン2: カスタム管理）

### Step 1: n8nのCredentialにリフレッシュトークンを保存

```
Credential Type: Generic → HTTP Request Auth
Auth Type: Header Auth
Name: X-Api-Token（またはAuthorization）
Value: Bearer {{ $env.ACCESS_TOKEN }}
```

### Step 2: API呼び出し（エラー出力を有効化）

```
Method: GET
URL: https://api.example.com/v1/data
Authentication: Generic Credential → Header Auth
Settings → On Error: Continue (Error Output)
```

### Step 3: 401エラーの検知

```
Condition: {{ $json.error.httpCode }} equals "401"
```

### Step 4: トークンリフレッシュ

```
Method: POST
URL: https://auth.example.com/oauth/token
Body:
  grant_type: refresh_token
  refresh_token: {{ $env.REFRESH_TOKEN }}
  client_id: {{ $credentials.clientId }}
  client_secret: {{ $credentials.clientSecret }}
```

### Step 5: 新しいアクセストークンを環境変数に保存（注意）

セルフホストの場合、n8nの変数ストアに保存するか、外部シークレットマネージャー（Vault等）を使う。

```javascript
// Codeノード: 新トークンを次のリクエストに引き渡す
const newToken = $json.access_token;
return [{ json: { ...$json, token: newToken } }];
```

## ポイント・注意事項

- n8nのOAuth2 Credentialを使えばトークン管理は自動。カスタム実装は本当に必要な時だけにする
- リフレッシュトークン自体が期限切れになる場合は、再認証フローをエラー通知に組み込む
- アクセストークンをログやSlackメッセージに出力しない。n8nのマスキング機能を活用する

## 関連機能

- [HTTP Request・API連携](./concepts_n8n_http_api.md)
- [エラーハンドリング](./concepts_n8n_error_handling.md)
- [エンタープライズ機能](./concepts_n8n_enterprise.md)
