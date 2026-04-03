---
title: "Authorization Code Flowの調査・使い所・実装例"
date: 2025-08-27T23:16:15+09:00
image: images/feature2/oauth2.0.png
author: subaru
tags:
  - rfc
  - network
categories:
  - network
---


> **TL;DR**
> バックエンドを持つ秘密クライアント構成なら **Authorization Code Flow（+ PKCE）** 一択。
> マルチIdP対応・標準準拠・セキュリティの観点で拡張しやすく、ライブラリ（openid-client）で実装負荷も下がる。

---

## 調査した背景

バックエンドサーバーを持つ、**Client Secret を安全に保持できる（= 秘密クライアント）** 構成のサービスを開発中。大抵のWebアプリケーションはバックエンドサーバーを持つよね。
この前提から、最終的に **Authorization Code Flow** を採用しました。

![](https://storage.googleapis.com/zenn-user-upload/cf0bf061fdce-20250816.png)
（参考: RFC 6749 §4.1 https://datatracker.ietf.org/doc/html/rfc6749）

> なお、要件定義の初期段階では、**Implicit Grant**（クライアントが直接IdPにリクエストし、アクセストークンがそのままフロントに返る方式）も検討したが、CSRFの可能性がある点とアクセストークンがWebブラウザに漏れ出してしまう問題があると分かったので不採用にした。知識がなかったら実装の楽さから採用してたかも・・？知識って大事。

---

## 調査：Authorization Code Flow の要点

### ざっくりの流れ（2段階）

1. クライアント（アプリ）はユーザーを **/authorize** へリダイレクト
2. ユーザーがIdPで認証 → **認可コード** をクライアントに返す
3. バックエンドが **認可コード + Client Secret**（+ **PKCE**）で **/token** に交換リクエスト
4. IdP が **アクセストークン（+必要ならリフレッシュトークン）** を返す

**ポイント**：アクセストークンを直接フロントに渡さず、**短命の認可コード** → **トークン交換** の2段階にすることで、**漏洩面を狭める**。

### PKCEの併用

* **code\_verifier / code\_challenge（S256）** を使い、認可コードの奪取・差替えに耐性を上げる
* SPAのような**パブリッククライアント**だけでなく、**秘密クライアントでもPKCE併用は広く推奨**

### セキュリティ設計の要点（チェックリスト）

* **state**：CSRF対策（サーバー保存 & 一致検証、使い捨て）
* **redirect\_uri**：完全一致（動的にしない）
* **scope**：最小権限（必要最小のスコープに限定）
* **nonce**：OIDCのIDトークンを使う場合は必須（リプレイ対策）
* **PKCE**：`S256` を使用、`plain` は避ける
* **トークン管理**：HttpOnly/Secure/SameSiteなクッキー、ログに出さない、保存期間を短く
* **エラーハンドリング**：`error` / `error_description` を丁寧に処理

---

## 使い所（選定基準）

### Authorization Code Flow を選ぶべきケース

* **バックエンドがあり、Client Secret を安全に保持できる**
* **複数のIdP（Google / Microsoft / Box など）と統合**したい
* **将来的にスコープ追加やリフレッシュトークン運用**が想定される
* **標準準拠（OAuth 2.0 / OIDC）をベース**に可搬性を確保したい

### 初期案の Implicit Grant を退けた理由

* **アクセストークンがフロントに直帰** → 盗難の面が広い
* **リフレッシュトークン運用や長期セッション管理が難しい**
* **標準の潮流としても非推奨へ**（セキュリティ面の懸念が主因）
* **マルチIdP対応時の複雑性**が増しがち

---

## 実装例（TypeScript + Node.js + Hono + openid-client）

> 今回は軽量なWebフレームワーク **Hono** と **openid-client** を組み合わせ、**PKCE対応**のセキュアな実装を行いました。
> *注：以下のAPI名はプロジェクトのラッパやライブラリ版によって差異があるため、手元の環境に合わせて適宜読み替えてください。*

### /authorize：フロー開始（PKCE生成・state保存・リダイレクトURL発行）

```ts
import * as client from 'openid-client'

// POST /oauth/authorize
app.post('/oauth/authorize', async (c) => {
  const provider = c.req.query('provider') as Provider
  
  // プロバイダー設定
  const oauthConfig = config[provider]
  
  // OIDCディスカバリー
  const issuerUrl = new URL(oauthConfig.issuer)
  const oauthClient = await client.discovery(
    issuerUrl,
    oauthConfig.clientId,
    oauthConfig.clientSecret
  )

  // PKCE & state
  const state = client.randomState()
  const codeVerifier = client.randomPKCECodeVerifier()
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier)

  stateStore.set(state, { provider, codeVerifier })

  // 認証URL生成
  const authParams: Record<string, string> = {
    client_id: oauthConfig.clientId,
    redirect_uri: `${process.env.BASE_URL}/oauth/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  }

  if (provider === 'microsoft') {
    authParams.response_mode = 'query'
  }

  const authorizationUrl = client.buildAuthorizationUrl(oauthClient, authParams)
  return c.json({ authorizationUrl: authorizationUrl.href })
})
```

**ポイント**

* `.well-known/openid-configuration` から自動設定（ディスカバリー）
* `state` は **CSRF対策**として保存＆後続で必ず検証
* `code_verifier` はサーバー側で保持、`code_challenge` をIdPへ送る

### /callback：コード受領 → トークン交換

```ts
// GET /oauth/callback
app.get('/oauth/callback', async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state')
  const error = c.req.query('error')
  const errorDescription = c.req.query('error_description')

  if (error) {
    return c.html(`<h1>認証エラー</h1><p>${error}: ${errorDescription}</p>`)
  }

  // state検証
  const oauthState = stateStore.get(state)
  if (!oauthState) {
    return c.html(`<h1>セッションエラー</h1><p>無効または期限切れのstateです</p>`)
  }

  try {
    const oauthConfig = config[oauthState.provider]
    const issuerUrl = new URL(oauthConfig.issuer)
    const oauthClient = await client.discovery(
      issuerUrl,
      oauthConfig.clientId,
      oauthConfig.clientSecret
    )

    // 認可コード → アクセストークン
    const currentUrl = new URL(`${process.env.BASE_URL}/oauth/callback`)
    currentUrl.searchParams.set('code', code)
    
    const tokens = await client.authorizationCodeGrant(
      oauthClient, 
      currentUrl, 
      { pkceCodeVerifier: oauthState.codeVerifier }
    )

    stateStore.delete(state)

    return c.html(`
      <h1>認証成功</h1>
      <p>アクセストークン: ${tokens.access_token ? '✅ 取得済み' : '❌ なし'}</p>
      <p>IDトークン: ${tokens.id_token ? '✅ 取得済み' : '❌ なし'}</p>
      <p>有効期限: ${tokens.expires_in}秒</p>
    `)
  } catch (error) {
    console.error('Callback error:', error)
    return c.html(`<h1>トークン交換エラー</h1>`)
  }
})
```

**ポイント**

* `state` 一致でCSRF防止
* PKCE検証は **`pkceCodeVerifier`** を必ず添えて実施
* OIDC利用時は **IDトークン（JWT）** でユーザー情報を取得可能

### 設定と環境変数（例）

```env
PORT=3000
BASE_URL=http://localhost:3000

# Google
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_ISSUER=https://accounts.google.com

# Microsoft Entra ID
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
MICROSOFT_TENANT_ID=common
MICROSOFT_ISSUER=https://login.microsoftonline.com/common/v2.0

# Box
BOX_CLIENT_ID=your-box-client-id
BOX_CLIENT_SECRET=your-box-client-secret
BOX_ISSUER=https://account.box.com
```

```ts
type Provider = 'google' | 'microsoft' | 'box'

interface OAuthConfig {
  clientId: string
  clientSecret?: string
  issuer: string
}

const config: Record<Provider, OAuthConfig> = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    issuer: process.env.GOOGLE_ISSUER || 'https://accounts.google.com',
  },
  microsoft: {
    clientId: process.env.MICROSOFT_CLIENT_ID || '',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    issuer:
      process.env.MICROSOFT_ISSUER ||
      `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/v2.0`,
  },
  box: {
    clientId: process.env.BOX_CLIENT_ID || '',
    clientSecret: process.env.BOX_CLIENT_SECRET,
    issuer: process.env.BOX_ISSUER || 'https://account.box.com',
  },
}
```

---

## 動作確認

### 1) 認証URLの取得

```bash
# Google認証の例
curl -X POST "http://localhost:3000/oauth/authorize?provider=google"
```

**レスポンス例**

```json
{
  "authorizationUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=xxx&redirect_uri=http://localhost:3000/oauth/callback&response_type=code&scope=openid%20email%20profile&state=abc123&code_challenge=xyz789&code_challenge_method=S256"
}
```

→ ブラウザで開くとGoogleのログイン画面へ。

### 2) コールバックの確認

```
http://localhost:3000/oauth/callback?code=4/0AeaXXXXX&state=abc123&scope=email%20profile%20openid
```

成功時の表示例：

```html
<h1>🎉 認証成功</h1>
<p>アクセストークン: ✅ 取得済み</p>
<p>リフレッシュトークン: ✅ 取得済み</p>
<p>IDトークン: ✅ 取得済み</p>
<p>有効期限: 3599秒</p>
```

### 3) Microsoft Graph でのリソース取得（例）

```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  https://graph.microsoft.com/v1.0/me
```

---

## まとめ

* **秘密クライアント + バックエンド**なら、**Authorization Code Flow（+PKCE）** が実務上の第一候補。
* **セキュリティ（トークン露出の最小化、CSRF/PKCE/nonce）** と **標準準拠** を保ちながら、**マルチIdP** にも拡張しやすい。
* 実装は **openid-client** などのライブラリを用いれば、**ディスカバリー・認証URL生成・コード交換** までの骨格を短時間で作れる。
* 本記事のスコープは **“フローの骨格”**。リフレッシュトークン運用やトークン失効、同意管理、ユーザー情報の検証は、別記事で掘り下げる。

---

