---
title: 認証・認可の実装ミス（セッション・JWT・OAuth）
category: "概念"
emoji: "🚪"
order: 1004
date: "2026-04-09"
series: [Webアプリセキュリティ]
tags: ["セキュリティ", "Webアプリ", "認証", "認可", "JWT", "OAuth", "セッション管理"]
source: "The Web Application Hacker's Handbook（Stuttard & Pinto, 2011）/ OWASP Authentication Cheat Sheet / OWASP Session Management Cheat Sheet / RFC 6749（OAuth 2.0）/ PortSwigger Web Security Academy"
---

## 認証・認可の失敗が最大のリスク

OWASP Top 10 2021 で **A01（Broken Access Control）**と **A07（Authentication Failures）** が上位を占める。  
暗号化・WAF・IDS があっても、認証・認可が破れれば意味をなさない。

```
よくある失敗パターン:
  ・管理者ページへの認証チェックが欠落（強制ブラウジング）
  ・他ユーザーのリソースへのアクセスを ID だけで許可（IDOR）
  ・JWT の署名を検証していない
  ・OAuth の state パラメータを使っていない（CSRF）
  ・パスワードリセットトークンの有効期限がない
```

---

## セッション管理の脆弱性

### セッション固定攻撃（Session Fixation）

```
攻撃フロー:
  1. 攻撃者が自分のセッション ID を取得（例: SESSIONID=attacker123）
  2. 被害者に attacker123 のセッション ID でログインさせる
     （URL パラメータ・Cookie injection 等）
  3. 被害者がログイン成功 → サーバーがセッション ID を再生成しなければ
     attacker123 が認証済みセッションになる
  4. 攻撃者が SESSIONID=attacker123 でアクセス → 被害者のセッションを使える

対策: ログイン成功後にセッション ID を必ず再生成する
```

```python
# Flask: ログイン後にセッションを再生成
from flask import session

@app.route('/login', methods=['POST'])
def login():
    user = authenticate(request.form['username'], request.form['password'])
    if user:
        # セッションを完全にクリアして新しい ID を発行
        session.clear()
        session['user_id'] = user.id
        session['logged_in_at'] = datetime.utcnow().isoformat()
        return redirect('/dashboard')
```

### セッションハイジャック

```
攻撃経路:
  ・XSS での Cookie 窃取（HttpOnly で防止）
  ・ネットワーク傍受（HTTPS で防止）
  ・セッション ID の予測（十分なエントロピーで防止）
  ・ログアウト後のセッション ID 再利用

セッション ID の要件:
  ・最低 128bit（16バイト）のエントロピー
  ・推測不可能な CSPRNG で生成
  ・ログアウト時にサーバー側で無効化
  ・有効期限を設定（アイドルタイムアウト + 絶対タイムアウト）
```

```python
# セッションの有効期限管理
from datetime import datetime, timedelta

def check_session_validity():
    if 'logged_in_at' not in session:
        return False

    login_time = datetime.fromisoformat(session['logged_in_at'])
    last_active = datetime.fromisoformat(session.get('last_active', session['logged_in_at']))
    now = datetime.utcnow()

    # 絶対タイムアウト: ログインから8時間
    if now - login_time > timedelta(hours=8):
        session.clear()
        return False

    # アイドルタイムアウト: 最終操作から30分
    if now - last_active > timedelta(minutes=30):
        session.clear()
        return False

    session['last_active'] = now.isoformat()
    return True
```

---

## JWT（JSON Web Token）の落とし穴

### 落とし穴1: アルゴリズム None 攻撃

```python
# 危険: アルゴリズムを指定せずに検証する
import jwt

# 攻撃者は alg を "none" に変えて署名なしのトークンを作成できる
# Header: {"alg": "none", "typ": "JWT"}
# Payload: {"sub": "admin", "role": "admin"}
# Signature: （空）

# 脆弱なコード
payload = jwt.decode(token, key, algorithms=None)  # 危険

# 安全なコード: アルゴリズムを明示的に指定
payload = jwt.decode(token, key, algorithms=["RS256"])  # 許可するアルゴリズムを明示
```

### 落とし穴2: RS256 → HS256 アルゴリズム混同攻撃

```
RS256: 非対称暗号（秘密鍵で署名・公開鍵で検証）
HS256: 対称暗号（同じ秘密鍵で署名・検証）

攻撃:
  1. サーバーが RS256 で署名し、公開鍵を公開している
  2. 攻撃者が alg を HS256 に変更し、サーバーの公開鍵を「HMAC の秘密鍵」として使って署名
  3. 脆弱なサーバーがアルゴリズムを動的に判定する場合、検証が通ってしまう

対策: アルゴリズムをホワイトリストで固定する
```

### 落とし穴3: 署名の未検証

```python
# 危険: トークンをデコードするだけで署名を検証しない
import base64, json

def decode_without_verify(token):
    payload = token.split('.')[1]
    # Base64 パディングを補完してデコード
    decoded = base64.urlsafe_b64decode(payload + '==')
    return json.loads(decoded)   # 署名を検証していない！

# 安全: ライブラリで署名を検証する
import jwt
try:
    payload = jwt.decode(
        token,
        PUBLIC_KEY,
        algorithms=["RS256"],
        options={"verify_exp": True}   # 有効期限も検証
    )
except jwt.ExpiredSignatureError:
    abort(401, "Token expired")
except jwt.InvalidTokenError:
    abort(401, "Invalid token")
```

### 落とし穴4: 機密情報のペイロードへの格納

```python
# JWT のペイロードは Base64 エンコードのみ（暗号化されていない）
# Base64 デコードすれば誰でも中身を読める

# 危険: 機密情報をペイロードに含める
payload = {
    "user_id": 123,
    "password_hash": "$2b$12$...",  # ← 危険（読める）
    "credit_card": "4111-...",       # ← 危険（読める）
}

# 安全: ペイロードには最小限の非機密情報のみ
payload = {
    "sub": "user_123",   # ユーザーID
    "role": "user",      # ロール
    "exp": 1234567890,   # 有効期限
    "iat": 1234560000,   # 発行時刻
}
```

### 落とし穴5: JWT のリボーク不可問題

```
JWT はステートレス（サーバーに状態を持たない）。
有効期限内のトークンは「強制失効」できない。

問題が発生するシナリオ:
  ・ユーザーが不正ログインに気づいてパスワード変更 → 旧トークンは使えてしまう
  ・ユーザーが強制ログアウトされても旧トークンは有効期限まで使える

対策:
  ① アクセストークンの有効期限を短くする（5〜15分）
  ② リフレッシュトークン（長命）をサーバー側で管理してリボーク可能にする
  ③ JTI（JWT ID）ブラックリストを Redis で管理する（ステートフルになるが安全）
```

```python
# Redis を使った JWT ブラックリスト
import redis
r = redis.Redis()

def revoke_token(jti: str, exp: int):
    # トークンの有効期限まで JTI をブラックリストに保存
    ttl = exp - int(datetime.utcnow().timestamp())
    r.setex(f"blacklist:{jti}", ttl, "revoked")

def is_token_revoked(jti: str) -> bool:
    return r.exists(f"blacklist:{jti}") > 0
```

---

## OAuth 2.0 の実装ミス

### ミス1: state パラメータの未使用（CSRF）

```
state パラメータ: CSRF 攻撃を防ぐためのランダムなトークン

攻撃フロー（state なし）:
  1. 攻撃者が自分の OAuth フローを途中で止め、コールバック URL を取得
     https://example.com/callback?code=ATTACKER_CODE
  2. 被害者にそのコールバック URL を踏ませる（CSRF）
  3. 被害者のアカウントに攻撃者の認証情報が紐づく → アカウント乗っ取り

対策: state を必ず使い、コールバック時に検証する
```

```python
import secrets
from flask import session, request, abort

# 認可リクエスト時: state を生成してセッションに保存
@app.route('/auth/start')
def auth_start():
    state = secrets.token_urlsafe(32)
    session['oauth_state'] = state
    auth_url = f"https://provider.com/oauth/authorize?client_id=...&state={state}"
    return redirect(auth_url)

# コールバック時: state を検証
@app.route('/auth/callback')
def auth_callback():
    received_state = request.args.get('state')
    expected_state = session.pop('oauth_state', None)

    if not received_state or received_state != expected_state:
        abort(403, "Invalid state: possible CSRF attack")

    code = request.args.get('code')
    # code を使ってアクセストークンを取得...
```

### ミス2: redirect_uri の不適切な検証

```
攻撃: redirect_uri を攻撃者のサーバーに変更して認可コードを横取りする

https://provider.com/oauth/authorize?
  client_id=app&
  redirect_uri=https://attacker.com/callback  ← 攻撃者のサーバー

対策:
  ・事前登録した redirect_uri と完全一致で検証する（前方一致ではなく）
  ・ワイルドカード・オープンリダイレクタは使わない

脆弱な検証（前方一致）:
  if redirect_uri.startswith("https://example.com"):  # 危険
      # https://example.com.evil.com が通ってしまう
```

### ミス3: 認可コードの再利用

```
認可コードは1回限り有効にする。

対策:
  ・使用済みのコードを無効化する
  ・有効期限を短くする（1〜10分）
  ・コードが2度使われた場合は発行済みトークンをすべて無効化する（OAuth 2.1 推奨）
```

### ミス4: オープンリダイレクト経由の認可コード漏洩

```
攻撃:
  1. 認可サーバーが redirect_uri の後段にリダイレクトを許可している
  2. Referer ヘッダーに認可コードが含まれる
  3. 攻撃者サーバーの Referer ログで認可コードを取得

対策:
  ・redirect_uri で外部リダイレクトを許可しない
  ・コールバックページに Referrer-Policy: no-referrer を設定
```

---

## 認可（アクセス制御）の実装ミス

### IDOR（Insecure Direct Object Reference）

```python
# 危険: ユーザーが指定した ID を検証なしで使う
@app.route('/api/orders/<int:order_id>')
def get_order(order_id):
    order = Order.query.get(order_id)
    return jsonify(order.to_dict())
    # → /api/orders/1235 で他人の注文が取得できる

# 安全: ログインユーザーのリソースかを検証
@app.route('/api/orders/<int:order_id>')
@login_required
def get_order(order_id):
    order = Order.query.filter_by(
        id=order_id,
        user_id=current_user.id   # ← オーナーシップを検証
    ).first_or_404()
    return jsonify(order.to_dict())
```

### 垂直権限昇格（Vertical Privilege Escalation）

```python
# 危険: ロールチェックが欠落
@app.route('/admin/users')
@login_required   # 認証だけで認可がない
def admin_users():
    return jsonify(User.query.all())

# 安全: ロールを検証
from functools import wraps

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role != 'admin':
            abort(403)
        return f(*args, **kwargs)
    return decorated

@app.route('/admin/users')
@admin_required
def admin_users():
    return jsonify(User.query.all())
```

### 水平権限昇格（Horizontal Privilege Escalation）

```python
# 危険: 同じロールの別ユーザーのデータにアクセスできる
@app.route('/api/profile/<int:user_id>', methods=['PUT'])
@login_required
def update_profile(user_id):
    user = User.query.get(user_id)
    user.update(request.json)   # ← 自分以外のユーザーも更新できる

# 安全: 自分自身のリソースのみ操作可能
@app.route('/api/profile/<int:user_id>', methods=['PUT'])
@login_required
def update_profile(user_id):
    if user_id != current_user.id:
        abort(403)
    current_user.update(request.json)
```

---

## パスワード管理のベストプラクティス

```python
# パスワードのハッシュ化（bcrypt）
from passlib.hash import bcrypt

# 登録時
hashed = bcrypt.hash(password)   # コストファクター: デフォルト12

# 検証時（タイミング攻撃を防ぐ定数時間比較）
is_valid = bcrypt.verify(password, hashed)

# パスワードリセットトークンの安全な生成
import secrets
token = secrets.token_urlsafe(32)   # 256bit のランダムトークン

# トークンをハッシュ化して DB に保存（トークン自体は1回だけメール送信）
import hashlib
token_hash = hashlib.sha256(token.encode()).hexdigest()

# 保存: {token_hash, user_id, expires_at: now + 1時間}
# 検証: 入力トークンを SHA256 してDBと比較 + 有効期限チェック
```

---

## チェックリスト

```
□ ログイン後にセッション ID を再生成している
□ セッションにアイドルタイムアウト（30分）と絶対タイムアウト（8時間）を設定している
□ JWT の検証でアルゴリズムをホワイトリスト指定している
□ JWT のペイロードに機密情報を含めていない
□ JWT の有効期限（exp）を短くしている（アクセストークンは15分以内）
□ OAuth の state パラメータを使い検証している
□ redirect_uri を登録済みURIと完全一致で検証している
□ API の全エンドポイントにオーナーシップ検証を実装している（IDOR 対策）
□ 管理者機能に認可チェック（ロール検証）を実装している
□ パスワードを bcrypt / Argon2id でハッシュ化している
□ パスワードリセットトークンに有効期限（1時間）を設定している
□ 認証失敗のログを記録してブルートフォース検知に活用している
```

---

## 参考文献

- OWASP Authentication Cheat Sheet — 認証実装の包括的なガイド（owasp.org）
- OWASP Session Management Cheat Sheet — セッション ID の要件・タイムアウト設計
- RFC 6749『OAuth 2.0 Authorization Framework』— OAuth 2.0 の公式仕様
- PortSwigger Web Security Academy『Authentication』『OAuth』— 認証の実装ミスを手を動かして学べる無料ラボ
- NIST SP 800-63B『Digital Identity Guidelines』— パスワード・MFA の現代的ガイドライン
