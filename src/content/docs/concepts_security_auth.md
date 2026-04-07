---
title: 認証・認可（Authentication & Authorization）
category: "概念"
emoji: "🔑"
order: 804
date: "2026-04-07"
series: [セキュリティ]
tags: ["セキュリティ", "認証", "認可", "OAuth2", "JWT", "MFA", "RBAC"]
source: "OAuth 2.0 in Action（Richer & Sanso, 2017）/ The JWT Handbook（Auth0, 2016）/ NIST SP 800-63B Digital Identity Guidelines / OpenID Connect Core 1.0 Specification"
---

## 認証と認可の違い

混同されやすいが、別の概念。

| 概念 | 英語 | 問い | 例 |
|---|---|---|---|
| **認証** | Authentication（AuthN） | 「あなたは誰か」 | ログイン・パスワード確認 |
| **認可** | Authorization（AuthZ） | 「あなたは何をできるか」 | 管理者ページへのアクセス可否 |

認証が先に成立し、その結果をもとに認可が判断される。  
認証なしに認可だけを設計することはできない。

---

## 認証の3要素

| 要素 | 分類 | 例 |
|---|---|---|
| 知識要素 | Something you know | パスワード、PIN、秘密の質問 |
| 所持要素 | Something you have | スマートフォン（TOTP）、物理トークン、スマートカード |
| 生体要素 | Something you are | 指紋、顔認証、虹彩 |

MFA（多要素認証）は**異なる要素を2つ以上組み合わせる**こと。  
同じ要素を2つ（パスワード + 秘密の質問）は2段階認証であっても多要素ではない。

---

## パスワード管理の原則（NIST SP 800-63B）

| 旧来の「常識」 | NIST 2017年改訂後の推奨 |
|---|---|
| 定期的なパスワード変更を強制する | 漏洩が確認されたときのみ変更を要求する |
| 大文字・数字・記号を含む複雑なパスワード | 長いパスフレーズを推奨（最低8文字以上） |
| パスワードヒントを設定させる | ヒントは禁止（推測を容易にする） |
| SMS OTPは安全 | SMS OTPは推奨しない（SIMスワッピング攻撃リスク） |

パスワード保存には必ず**ソルト付きの低速ハッシュ**を使う。

```
推奨: bcrypt（コストファクター12以上）, Argon2id, scrypt
禁止: MD5, SHA-1, SHA-256（パスワード保存目的では高速すぎる）
```

---

## OAuth 2.0

**「認可の委譲」を安全に行うためのプロトコル。**  
ユーザーがパスワードを第三者アプリに渡さずに、リソースへのアクセスを許可できる。

### 登場人物

| ロール | 説明 | 例 |
|---|---|---|
| Resource Owner | リソースの所有者 | ユーザー |
| Client | アクセスを要求するアプリ | サードパーティWebアプリ |
| Authorization Server | 認可サーバー | Google, GitHub, Zitadel |
| Resource Server | 保護されたリソースを持つサーバー | Google Drive API |

### Authorization Code フロー（最も安全・推奨）

```
User ──[1. ログインボタン押下]──▶ Client
Client ──[2. 認可リクエスト]──▶ Authorization Server
Authorization Server ──[3. ログイン画面表示]──▶ User
User ──[4. 同意]──▶ Authorization Server
Authorization Server ──[5. 認可コード発行]──▶ Client（リダイレクト）
Client ──[6. 認可コード + クライアントシークレットで交換]──▶ Authorization Server
Authorization Server ──[7. アクセストークン発行]──▶ Client
Client ──[8. アクセストークンでAPIコール]──▶ Resource Server
```

### PKCE（Proof Key for Code Exchange）

SPAやモバイルアプリのように**クライアントシークレットを安全に保管できない環境**では、  
認可コードの横取り攻撃を防ぐためにPKCEを使う。

```
Client生成: code_verifier（ランダム文字列）
         → code_challenge = BASE64URL(SHA256(code_verifier))

認可リクエスト時: code_challenge を送る
トークン交換時:  code_verifier を送る（Authorization Serverが検証）
```

### スコープ

アクセストークンが持てる権限の範囲。Least Privilege の原則を認可に適用する仕組み。

```
scope=read:profile           # プロフィール読み取りのみ
scope=read:orders write:cart # 注文読み取り + カート書き込み
```

---

## OpenID Connect（OIDC）

**OAuth 2.0の上に「認証」を追加したプロトコル。**  
OAuth 2.0は認可の仕組みであり、「このユーザーが誰か」を取得する標準的な方法がなかった。  
OIDCがその欠陥を補い、**IDトークン（JWT形式）**によってユーザー情報を提供する。

```
OAuth 2.0 のみ: "このトークンでAPIにアクセスできる"
OIDC:          "このトークンでAPIにアクセスできる" + "このユーザーはXXXである"
```

---

## JWT（JSON Web Token）

**情報をコンパクトかつ署名付きで伝達するトークン形式。**  
`ヘッダー.ペイロード.署名` の3パートがBase64URLエンコードされている。

```
eyJhbGciOiJSUzI1NiJ9          # ヘッダー（アルゴリズム）
.eyJzdWIiOiJ1c2VyMTIzIn0      # ペイロード（クレーム）
.SflKxwRJSMeKKF2QT4fwpMeJf36  # 署名
```

### クレーム（Payload の中身）

| クレーム | 意味 |
|---|---|
| `sub` | Subject（ユーザーID） |
| `iss` | Issuer（発行者） |
| `aud` | Audience（受信対象） |
| `exp` | Expiration（有効期限） |
| `iat` | Issued At（発行日時） |

### JWTのセキュリティ注意点

```
# 危険: アルゴリズムを "none" に変えられると署名検証がスキップされる
# 対策: サーバー側でアルゴリズムを明示的に指定する

# 危険: HS256（対称鍵）でRS256（非対称鍵）の公開鍵をシークレットとして使う攻撃
# 対策: アルゴリズムをホワイトリスト管理する

# JWTはBase64URLエンコードであり、暗号化ではない
# 機密情報（パスワード等）をペイロードに入れない
```

### アクセストークン vs リフレッシュトークン

| トークン | 有効期限 | 用途 |
|---|---|---|
| アクセストークン | 短い（5〜60分） | APIコール |
| リフレッシュトークン | 長い（数日〜数週間） | アクセストークンの再発行 |

アクセストークンを短命にすることで、漏洩時の被害期間を限定する。

---

## RBAC と ABAC

### RBAC（Role-Based Access Control）

ユーザーに**ロール**を割り当て、ロールに権限を紐づける。

```
User: Alice  ──▶  Role: editor  ──▶  Permission: [read, write]
User: Bob    ──▶  Role: viewer  ──▶  Permission: [read]
```

シンプルで管理しやすい。ロール数が爆発しやすい「ロール爆発」が課題。

### ABAC（Attribute-Based Access Control）

ユーザー・リソース・環境の**属性**をもとに動的にアクセスを判断する。

```
Policy: "department == 'engineering' AND resource.sensitivity == 'low' AND time BETWEEN 9:00-18:00"
```

柔軟で細かい制御が可能。設計と管理が複雑になる。

### ReBAC（Relationship-Based Access Control）

GoogleのZanzibar論文（2019）で公開された、**関係グラフに基づくアクセス制御**。  
「AはドキュメントBのオーナーである」「CはグループDのメンバーである」という関係から権限を計算する。  
Google Drive の共有権限モデルがこれに相当する。OpenFGAなどがOSSで実装している。

---

## セッション管理

### セッション固定攻撃（Session Fixation）

```
攻撃者が事前にセッションIDを取得 → 被害者にそのIDでログインさせる
→ 攻撃者がそのセッションIDを使ってアカウントを乗っ取る

対策: ログイン成功後に必ずセッションIDを再生成する
```

### セッションハイジャック対策

- Cookie に `HttpOnly`（JavaScriptからアクセス不可）を設定
- Cookie に `Secure`（HTTPS のみ送信）を設定
- Cookie に `SameSite=Strict` または `Lax` を設定（CSRF 対策も兼ねる）

---

## パスワードレス認証

パスワード自体をなくすことで、フィッシング・クレデンシャルスタッフィングのリスクをゼロにする。

| 方式 | 仕組み |
|---|---|
| **FIDO2 / WebAuthn** | デバイスの秘密鍵で署名。フィッシング耐性が最も高い |
| **Magic Link** | メールにワンタイムURLを送る。簡易だがメール乗っ取りリスク |
| **Passkey** | FIDO2をより使いやすくしたApple/Google/Microsoftの実装 |

---

## 参考文献

- Justin Richer & Antonio Sanso『OAuth 2.0 in Action』（Manning, 2017）— OAuth 2.0 の仕組みと実装を最も詳しく解説した書籍
- NIST SP 800-63B『Digital Identity Guidelines』（2017）— パスワード管理の現代的ガイドライン
- Auth0『The JWT Handbook』（2016, 無料公開）— JWT の構造とセキュリティの実践ガイド
- OpenID Connect Core 1.0 Specification — OIDC の公式仕様
- Zanzibar: Google's Consistent, Global Authorization System（2019）— ReBAC の概念を公開したGoogle論文
