---
title: Webアプリセキュリティ概要
category: "概念"
emoji: "🌍"
order: 1000
date: "2026-04-09"
series: [Webアプリセキュリティ]
tags: ["セキュリティ", "Webアプリ", "HTTP", "OWASP", "脅威モデル"]
source: "The Web Application Hacker's Handbook（Stuttard & Pinto, 2011）/ OWASP Testing Guide v4.2 / HTTP: The Definitive Guide（Gourley & Totty, 2002）/ MDN Web Docs Security"
---

## なぜ Webアプリは攻撃されやすいか

```
インターネットに公開されている = 世界中の誰でもリクエストを送れる

・入力値はすべて攻撃者が制御可能
・HTTP はステートレスで「誰からのリクエストか」を本来区別しない
・複雑なビジネスロジックは想定外の使われ方をされる
・フロントエンド・バックエンド・DB・クラウドが絡み合う攻撃対象
```

サーバー・ネットワーク・OS はほぼ自動でパッチが当たる時代になったが、  
**アプリケーションの脆弱性は開発者が自ら作り込む**ため、なくならない。

---

## HTTP の仕組みとセキュリティの関係

Web セキュリティの多くは HTTP の特性から生まれる問題。基礎を押さえておく。

### リクエスト・レスポンスの構造

```
【HTTPリクエスト】
POST /api/login HTTP/1.1
Host: example.com
Content-Type: application/json
Cookie: session=abc123
Authorization: Bearer eyJhbGci...

{"username": "alice", "password": "secret"}
  ↑
  攻撃者はこのすべてを改ざんできる

【HTTPレスポンス】
HTTP/1.1 200 OK
Content-Type: application/json
Set-Cookie: session=xyz789; HttpOnly; Secure; SameSite=Strict
X-Content-Type-Options: nosniff

{"token": "eyJhbGci..."}
```

### 攻撃者が制御できる入力の全範囲

```
URL パス:          /api/users/../../admin
クエリパラメータ:  ?id=1 OR 1=1--
リクエストボディ:  {"name": "<script>alert(1)</script>"}
HTTP ヘッダー:     X-Forwarded-For: 127.0.0.1
Cookie:            session=forged_token
ファイルアップロード: Content-Type: image/jpeg + 実体は PHP
```

**すべてのユーザー入力は信頼できない。** サーバー側で常に検証・無害化する。

---

## Webアプリの攻撃対象領域（Attack Surface）

```
┌─────────────────────────────────────────────────────────┐
│  ブラウザ（クライアント）                                │
│  ├── JavaScript の DOM 操作（DOM XSS）                  │
│  ├── Cookie・LocalStorage（セッション窃取）              │
│  └── フォーム・URL（CSRF・オープンリダイレクト）         │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP/HTTPS
┌────────────────────▼────────────────────────────────────┐
│  CDN / WAF / ロードバランサー                            │
│  ├── HTTP ヘッダーのバイパス                             │
│  └── キャッシュポイズニング                              │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  Webアプリケーションサーバー                              │
│  ├── 認証・認可の欠陥（OWASP A01・A07）                  │
│  ├── インジェクション（OWASP A03）                       │
│  ├── セキュリティの設定ミス（OWASP A05）                 │
│  ├── SSRF（OWASP A10）                                   │
│  └── 脆弱なコンポーネント（OWASP A06）                   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  データストア                                            │
│  ├── SQL インジェクション → DB 全取得                    │
│  ├── NoSQL インジェクション（MongoDB 等）                 │
│  └── 機密データの平文保存                                │
└─────────────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  外部連携                                                │
│  ├── SSRF → クラウドメタデータ API 攻撃                  │
│  ├── OAuth の設定ミス → アカウント乗っ取り               │
│  └── サードパーティ API の脆弱性                         │
└─────────────────────────────────────────────────────────┘
```

---

## セキュリティの基本原則（Web 文脈）

### 入力の検証と出力のエンコード

```
【インジェクション系脆弱性の根本原因】
  データとコードの混同

  SELECT * FROM users WHERE id = '${userInput}'
                                    ↑
                            ここに SQL が混入する

【対策の考え方】
  入力: 型・長さ・許容文字を検証（ホワイトリスト）
  処理: パラメータ化クエリ・エスケープでデータとコードを分離
  出力: 出力先（HTML・JS・SQL・URL）に合わせてエンコード
```

### コンテキストに依存したエンコード

同じ文字列でも、**どこに出力されるか**によって適切なエンコード方法が異なる。

| 出力コンテキスト | エンコード方法 | 対象脆弱性 |
|---|---|---|
| HTML 本文 | HTMLエンティティ（`<` → `&lt;`）| XSS |
| HTML 属性値 | 属性エンコード（引用符を含む）| XSS |
| JavaScript | `\uXXXX` Unicode エスケープ | XSS |
| URL | パーセントエンコード（`%XX`）| オープンリダイレクト |
| SQL | プリペアドステートメント | SQLi |
| OS コマンド | シェルエスケープ / API 使用 | コマンドインジェクション |

---

## Webアプリを守る多層防御

```
Layer 1: セキュアコーディング
  └── インジェクション対策・入力検証・出力エンコード

Layer 2: 認証・認可
  └── 強固な認証・最小権限・RBAC

Layer 3: セキュリティヘッダー
  └── CSP・HSTS・X-Frame-Options・CORS

Layer 4: WAF
  └── 既知の攻撃パターンのブロック（補助的）

Layer 5: 監視・ログ
  └── 異常なリクエストの検知・インシデント対応

Layer 6: 定期テスト
  └── SAST・DAST・ペネトレーションテスト
```

---

## OWASP Top 10 との対応

このシリーズで扱うトピックと OWASP Top 10 2021 の対応関係。

| OWASP | 説明 | 本シリーズで扱うドキュメント |
|---|---|---|
| A01 | Broken Access Control | `webapp_security_authn_authz` |
| A02 | Cryptographic Failures | `webapp_security_headers`（TLS）|
| A03 | Injection | `webapp_security_injection` |
| A04 | Insecure Design | 本ドキュメント（設計原則）|
| A05 | Security Misconfiguration | `webapp_security_headers` |
| A06 | Vulnerable Components | `webapp_security_overview`（SCA）|
| A07 | Auth Failures | `webapp_security_authn_authz` |
| A08 | Integrity Failures | `webapp_security_api` |
| A09 | Logging Failures | `webapp_security_testing` |
| A10 | SSRF | `webapp_security_api` |

---

## ブラウザのセキュリティモデル

Webアプリのセキュリティはブラウザのセキュリティモデルの上に成り立つ。

### Same-Origin Policy（同一オリジンポリシー）

```
オリジン = スキーム + ホスト + ポート

https://example.com:443 と https://example.com:443 → 同一オリジン ✅
https://example.com     と http://example.com      → 異なる（スキームが違う）❌
https://example.com     と https://api.example.com → 異なる（ホストが違う）❌
https://example.com     と https://example.com:8080→ 異なる（ポートが違う）❌

ブラウザは異なるオリジンへの:
  ・JavaScript からの fetch/XHR リクエストの結果を読み取れない
  ・DOM へのアクセスを禁止する
→ XSS・CSRF が成立する条件と対策の根拠
```

### CORS（Cross-Origin Resource Sharing）

Same-Origin Policy の例外を安全に許可する仕組み。  
設定ミスが CORS 関連の脆弱性に直結する。

```
# 危険な設定
Access-Control-Allow-Origin: *                    # 全オリジンを許可
Access-Control-Allow-Origin: null                 # null オリジンを許可（サンドボックス iframe 等）
Access-Control-Allow-Credentials: true
Access-Control-Allow-Origin: *                    # credentials と * の組み合わせ（ブラウザはブロックするが）

# 安全な設定
Access-Control-Allow-Origin: https://app.example.com   # 明示的に許可するオリジンを指定
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST
Access-Control-Allow-Headers: Authorization, Content-Type
```

---

## シリーズ構成（学習ロードマップ）

```
concepts_webapp_security_overview（本ドキュメント）
  │
  ├── concepts_webapp_security_injection        SQLi・コマンドインジェクション
  ├── concepts_webapp_security_xss              XSS・CSP
  ├── concepts_webapp_security_csrf_clickjacking CSRF・Clickjacking・CORS
  ├── concepts_webapp_security_authn_authz      セッション・JWT・OAuth の落とし穴
  ├── concepts_webapp_security_api              API セキュリティ・OWASP API Top 10
  ├── concepts_webapp_security_headers          セキュリティヘッダー完全ガイド
  └── concepts_webapp_security_testing          Burp Suite 実践・テストチェックリスト
```

---

## 参考文献

- Dafydd Stuttard & Marcus Pinto『The Web Application Hacker's Handbook』（Wiley, 2011）— Webアプリ攻撃の体系的な解説書。攻撃者視点でWebセキュリティを学ぶ定番
- OWASP Testing Guide v4.2（owasp.org）— Webアプリのセキュリティテスト手法の公式ガイド
- MDN Web Docs Security（developer.mozilla.org）— Same-Origin Policy・CORS・CSP 等のブラウザセキュリティの公式リファレンス
- OWASP Top 10 2021（owasp.org/Top10）— Webアプリの最重要脆弱性カテゴリ
