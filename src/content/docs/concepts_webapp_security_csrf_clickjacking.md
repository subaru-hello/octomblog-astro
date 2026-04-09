---
title: CSRF・Clickjacking・CORS
category: "概念"
emoji: "🪤"
order: 1003
date: "2026-04-09"
series: [Webアプリセキュリティ]
tags: ["セキュリティ", "Webアプリ", "CSRF", "Clickjacking", "CORS", "SameSite"]
source: "The Web Application Hacker's Handbook（Stuttard & Pinto, 2011）/ OWASP CSRF Prevention Cheat Sheet / OWASP Clickjacking Defense Cheat Sheet / MDN Web Docs CORS / PortSwigger Web Security Academy"
---

## CSRF（Cross-Site Request Forgery）

### 攻撃の仕組み

**被害者がログイン中のサービスに対して、攻撃者が用意したサイトから意図しないリクエストを送らせる攻撃。**

ブラウザはリクエスト先のドメインに対応する Cookie を自動で送信する（SameSite 未設定の場合）。  
これを悪用して、被害者のセッションを使った正規リクエストを偽装する。

```
攻撃フロー:

  1. 被害者が example.com にログイン中（セッション Cookie を保持）

  2. 攻撃者が evil.com に以下の HTML を仕込む
     <img src="https://example.com/api/transfer?to=attacker&amount=100000">
     または
     <form action="https://example.com/api/transfer" method="POST">
       <input name="to" value="attacker">
       <input name="amount" value="100000">
     </form>
     <script>document.forms[0].submit()</script>

  3. 被害者が evil.com を訪問した瞬間にリクエストが送信される

  4. ブラウザは example.com の Cookie を自動添付 → サーバーは正規ユーザーの操作と判断
```

### CSRF が成立する条件

```
以下の3つがすべて揃うと成立:
  ① 被害者がターゲットサービスにログイン中
  ② ターゲットサービスがセッション Cookie のみで認証している
  ③ 攻撃者がリクエストのパラメータを予測できる（ランダムなトークンがない）
```

---

## 対策1: CSRF トークン

**リクエストにサーバー生成のランダムトークンを含め、サーバー側で検証する。**  
攻撃者はトークンを事前に知ることができないため、偽リクエストに含められない。

```python
# Flask-WTF での CSRF トークン実装
from flask_wtf import FlaskForm
from wtforms import StringField

class TransferForm(FlaskForm):
    to_account = StringField('振込先')
    amount = StringField('金額')
    # csrf_token フィールドが自動的に追加される

# テンプレート
<form method="POST">
  {{ form.csrf_token }}   <!-- 隠しフィールドとしてトークンが埋め込まれる -->
  {{ form.to_account() }}
  {{ form.amount() }}
  <button type="submit">送金</button>
</form>
```

```javascript
// SPA（React 等）での実装: カスタムヘッダーにトークンを含める
// ブラウザは Same-Origin 以外からのカスタムヘッダー送信を許可しない

// サーバーからトークンを取得（Cookie または API レスポンスで）
const token = document.cookie.match(/csrf_token=([^;]+)/)?.[1];

await fetch('/api/transfer', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': token    // カスタムヘッダーで送信
  },
  body: JSON.stringify({ to: 'account', amount: 1000 })
});
```

```python
# サーバー側での検証
from flask import request, session, abort

def verify_csrf_token():
    token = request.headers.get('X-CSRF-Token') or request.form.get('csrf_token')
    if not token or token != session.get('csrf_token'):
        abort(403, "CSRF token validation failed")
```

---

## 対策2: SameSite Cookie 属性（最も効果的な現代的対策）

**Cookie をクロスサイトリクエストで送信するかどうかをブラウザに指示する属性。**  
適切に設定するだけで CSRF の大部分を防げる。

| 値 | 動作 | CSRF 対策 |
|---|---|---|
| `Strict` | 同一サイトからのリクエストでのみ Cookie を送信 | 最も強力 |
| `Lax` | トップレベルナビゲーション（GET）は許可。POST・iframe は送信しない | 実用的（Chrome のデフォルト）|
| `None` | クロスサイトでも送信（`Secure` 必須）| CSRF 対策なし |

```python
# Flask: SameSite=Strict で Set-Cookie
response.set_cookie(
    'session',
    value=session_token,
    httponly=True,
    secure=True,
    samesite='Strict'   # ← クロスサイトリクエストでは Cookie を送らない
)
```

### SameSite=Lax の落とし穴

```
Lax は GET のトップレベルナビゲーションを許可する。
以下のケースでは CSRF が成立する場合がある:

  ・GET リクエストで状態変更を行っている場合
    例: <img src="https://example.com/delete?id=1">
    → GET なので Lax でも Cookie が送られる

対策: 状態変更には必ず POST / PUT / DELETE を使う（HTTP メソッドの正しい使用）
```

---

## 対策3: Origin / Referer ヘッダーの検証

```python
from flask import request, abort
from urllib.parse import urlparse

ALLOWED_ORIGINS = {'https://example.com', 'https://app.example.com'}

def check_origin():
    origin = request.headers.get('Origin')
    referer = request.headers.get('Referer')

    if origin:
        if origin not in ALLOWED_ORIGINS:
            abort(403, "Invalid origin")
    elif referer:
        parsed = urlparse(referer)
        if f"{parsed.scheme}://{parsed.netloc}" not in ALLOWED_ORIGINS:
            abort(403, "Invalid referer")
    else:
        # Origin も Referer もない場合は疑わしい（ただし一部のブラウザ・プロキシは省略する）
        abort(403, "Missing origin/referer")
```

---

## CSRF のバリエーション

### JSON CSRF

```
Content-Type: application/json のリクエストは HTML フォームから送れない。
しかし Content-Type を text/plain にすると送れる場合がある。

サーバー側が Content-Type を厳密にチェックしていない場合:
  <form method="POST" action="https://api.example.com/transfer"
        enctype="text/plain">
    <input name='{"to":"attacker","amount":100000,"padding":"' value='"}'>
  </form>
  → Body: {"to":"attacker","amount":100000,"padding":"="}

対策: Content-Type: application/json を厳密に検証する
```

### CSRF と XSS の組み合わせ

XSS が成立していれば CSRF トークンを JavaScript で読み取れるため、  
**XSS があると CSRF 対策が無効化される**。XSS の防止が前提。

---

## Clickjacking

**透明な iframe に標的サイトを埋め込み、被害者に別のコンテンツだと思わせてクリックさせる攻撃。**

```
攻撃の仕組み:

  evil.com の構造:
  ┌────────────────────────────────┐
  │  「今すぐプレゼントをゲット！」│  ← 被害者が見えているコンテンツ
  │  [クリック！]                  │
  └────────────────────────────────┘
        ↑ 実際は透明な iframe が重なっている
  ┌────────────────────────────────┐ opacity: 0
  │  example.com（ログイン済み）   │
  │  [アカウント削除] ← ここにクリックが当たる
  └────────────────────────────────┘
```

### 対策1: X-Frame-Options ヘッダー

```python
# Flask: X-Frame-Options を設定
@app.after_request
def set_x_frame_options(response):
    response.headers['X-Frame-Options'] = 'DENY'
    # DENY:       すべての iframe 埋め込みを禁止
    # SAMEORIGIN: 同一オリジンの iframe のみ許可
    return response
```

### 対策2: CSP の frame-ancestors（推奨）

X-Frame-Options より新しく、より細かい制御が可能。

```python
response.headers['Content-Security-Policy'] = "frame-ancestors 'none'"
# 'none':        すべて禁止
# 'self':        同一オリジンのみ許可
# 'self' https://partner.com: 同一オリジン + 特定ドメインを許可
```

### Frame Busting（JavaScript による対策）―非推奨

```javascript
// 古い対策（フレームバスティング）
if (top !== self) { top.location = self.location; }

// バイパス可能: sandbox 属性で JavaScript を無効化できる
// <iframe sandbox="allow-forms" src="https://example.com">
// → JavaScript が実行されないためバスティングコードが無効化される

// → CSP の frame-ancestors を使うべき
```

---

## CORS（Cross-Origin Resource Sharing）詳解

Same-Origin Policy の例外を制御する仕組み。設定ミスが多い。

### Simple Request vs Preflight

```
Simple Request（プリフライトなし）:
  条件: GET / POST / HEAD かつ安全なヘッダーのみかつ Content-Type が以下
        application/x-www-form-urlencoded / multipart/form-data / text/plain
  → そのままリクエストが送られる（ブラウザが Origin ヘッダーを付加）

Preflighted Request（事前確認あり）:
  条件: PUT / DELETE / PATCH または カスタムヘッダー または application/json
  → まず OPTIONS リクエストで許可を確認してから本リクエストを送る
```

```
Preflight リクエスト:
OPTIONS /api/transfer HTTP/1.1
Origin: https://app.example.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Content-Type, Authorization

Preflight レスポンス:
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: POST, GET
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400    ← プリフライト結果をキャッシュする秒数
```

### CORS の安全な実装

```python
# Flask-CORS を使った安全な設定
from flask_cors import CORS

app = Flask(__name__)

# 危険: すべてのオリジンを許可
CORS(app)  # origins="*" が設定される

# 安全: 許可するオリジンを明示
CORS(app,
    origins=["https://app.example.com", "https://admin.example.com"],
    methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
    supports_credentials=True,   # Cookie を含む場合に必要
    max_age=3600
)
```

### CORS の脆弱な実装パターン

```python
# 危険1: Origin をそのまま反射する
origin = request.headers.get('Origin', '')
response.headers['Access-Control-Allow-Origin'] = origin   # 全オリジンを許可するのと同じ

# 危険2: null オリジンを許可する
response.headers['Access-Control-Allow-Origin'] = 'null'
# → サンドボックス iframe や file:// から攻撃可能

# 危険3: 正規化せずにサブドメインを許可
if origin.endswith('.example.com'):   # attacker.example.com も通る
    response.headers['Access-Control-Allow-Origin'] = origin
# → evil.example.com のようなサブドメインを取られると突破される

# 安全: ホワイトリストで完全一致を確認
ALLOWED_ORIGINS = {'https://app.example.com', 'https://admin.example.com'}
origin = request.headers.get('Origin', '')
if origin in ALLOWED_ORIGINS:
    response.headers['Access-Control-Allow-Origin'] = origin
```

### credentials を含む CORS の注意点

```
Access-Control-Allow-Credentials: true の場合:
  ・Access-Control-Allow-Origin に * は使えない（ブラウザがブロック）
  ・必ず具体的なオリジンを指定する必要がある

credentials: 'include' でフェッチする場合:
  ・Cookie・Authorization ヘッダーがクロスオリジンリクエストに含まれる
  ・サーバー側の CORS 設定が不適切だと情報漏洩につながる
```

---

## まとめ：3つの攻撃と対策の対応表

| 攻撃 | 根本原因 | 主要対策 |
|---|---|---|
| **CSRF** | Cookie が自動送信される | SameSite=Strict / CSRF トークン |
| **Clickjacking** | iframe で任意サイトを埋め込める | frame-ancestors 'none' / X-Frame-Options |
| **CORS 脆弱性** | オリジン検証が不十分 | ホワイトリストで完全一致 + credentials に注意 |

---

## チェックリスト

```
□ セッション Cookie に SameSite=Strict または Lax を設定している
□ 状態変更操作（送金・削除等）に GET を使っていない
□ フォームに CSRF トークンを含めて検証している（または SameSite=Strict で代替）
□ SPA の API 呼び出しでカスタムヘッダー（X-CSRF-Token 等）を使っている
□ X-Frame-Options: DENY または CSP frame-ancestors 'none' を設定している
□ CORS の許可オリジンをホワイトリストで管理している
□ CORS で Origin を動的に反射していない
□ null オリジンを CORS で許可していない
□ CORS で credentials: true を使う場合に * を使っていない
□ Preflight のキャッシュ時間（Access-Control-Max-Age）を設定している
```

---

## 参考文献

- OWASP CSRF Prevention Cheat Sheet — CSRF トークン・SameSite の実装ガイド（owasp.org）
- OWASP Clickjacking Defense Cheat Sheet — frame-ancestors と X-Frame-Options の使い分け
- MDN Web Docs『Cross-Origin Resource Sharing（CORS）』— Preflight・credentials・CORS ヘッダーの公式仕様
- PortSwigger Web Security Academy『CSRF』『Clickjacking』『CORS』— 実際に手を動かして学べる無料ラボ
- Dafydd Stuttard & Marcus Pinto『The Web Application Hacker's Handbook』（Wiley, 2011）— CSRF・Clickjacking の攻撃パターンの体系的解説
