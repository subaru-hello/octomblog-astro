---
title: "OWASP Top 10 2017"
category: "概念"
emoji: "🕳️"
order: 802
date: "2026-04-12"
series: [セキュリティ]
tags: ["セキュリティ", "OWASP", "脆弱性", "Webアプリ"]
source: "OWASP Top 10 2017（owasp.org/www-project-top-ten/2017）"
---

## OWASP Top 10 2017 とは

2013年版から4年ぶりの改訂。**3つの新カテゴリ**（XXE・Insecure Deserialization・Insufficient Logging & Monitoring）が追加された。
Webフレームワークの普及でXSSやインジェクションの対策は進んだ一方、
設計・シリアライズ・監視の不備という新たな攻撃面が顕在化した版。

全バージョンの変遷比較は [全バージョン比較](./concepts_security_owasp_top10_history.md) を参照。

---

## OWASP Top 10 2017 一覧

| 順位 | カテゴリ | 概要 |
|---|---|---|
| A1 | Injection | インジェクション攻撃（SQLi・コマンドインジェクション等）|
| A2 | Broken Authentication | 認証・セッション管理の不備 |
| A3 | Sensitive Data Exposure | 機密データの漏洩 |
| A4 | XML External Entities (XXE) | XML外部エンティティ参照（**新規**）|
| A5 | Broken Access Control | アクセス制御の不備（2013年版の A4+A7 を統合）|
| A6 | Security Misconfiguration | セキュリティ設定ミス |
| A7 | Cross-Site Scripting (XSS) | クロスサイトスクリプティング |
| A8 | Insecure Deserialization | 安全でないデシリアライゼーション（**新規**）|
| A9 | Using Components with Known Vulnerabilities | 既知の脆弱性を持つコンポーネントの使用 |
| A10 | Insufficient Logging & Monitoring | ログ・監視の不足（**新規**）|

---

## A1: Injection

SQLインジェクション・OSコマンドインジェクション・LDAPインジェクションなどを含む。
2013年に続き1位を維持。

### 攻撃例

```sql
-- 脆弱なクエリ（文字列を直接連結）
SELECT * FROM users WHERE email = '${email}' AND password = '${password}';

-- 攻撃者の入力: anything' OR '1'='1
-- 認証を完全にバイパスする
```

### 対策

- プリペアドステートメント（パラメータ化クエリ）を必ず使う
- ORM使用時も生クエリへの文字列埋め込みは避ける
- 入力値のホワイトリスト検証

---

## A2: Broken Authentication

セッション管理・クレデンシャル管理の不備。2021年では「Identification and Authentication Failures（A7）」に改名。

### 主な問題例

- セッションIDがURLに含まれてリファラー経由で漏洩
- ログアウト後もセッションが有効なまま残る
- パスワードリセットトークンが短すぎる・有効期限が長すぎる
- ブルートフォース攻撃へのレートリミットなし

### 対策

- MFA（多要素認証）の導入
- セッションIDの再生成（ログイン後・権限変更後）
- パスワードは bcrypt / Argon2 でハッシュ化
- ログアウト時にサーバー側でセッションを無効化

---

## A3: Sensitive Data Exposure

暗号化の失敗や不適切なデータ保護による機密情報の漏洩。
2021年では「Cryptographic Failures（A2）」に改名。原因（暗号化の失敗）に着目した命名に変わった。

### 主な問題例

- クレジットカード番号・パスワードを平文でDBに保存
- HTTPで認証情報を送信
- 古い暗号化アルゴリズム（MD5, SHA-1）の使用
- ブラウザキャッシュに機密データが残る

### 対策

- 保存時: bcrypt（パスワード）/ AES-256（機密データ）
- 通信時: TLS 1.2以上を強制（HSTS設定含む）
- 不要なデータは保持しない（Data Minimization）

---

## A4: XML External Entities (XXE)【新規】

XMLパーサーが外部エンティティを処理する際に悪用される脆弱性。
2021年版ではリストから削除され、Security Misconfiguration（A5）に統合された（設定で防げる問題として分類）。

### 攻撃例

```xml
<!-- 攻撃者が送り込む悪意あるXML -->
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<root>&xxe;</root>

<!-- パーサーが /etc/passwd の内容を返してしまう -->
```

クラウド環境では `file://` の代わりに `http://169.254.169.254/` を使ってメタデータAPIに到達する攻撃も存在する。

### 対策

- XMLパーサーで外部エンティティを無効化（DTD処理をオフ）
- 可能であればXMLではなくJSONを使う
- 入力XMLのスキーマ検証

---

## A5: Broken Access Control

2013年版では「Insecure Direct Object References（A4）」と「Missing Function Level Access Control（A7）」に分散していたものが統合。
2021年ではA1に昇格。最も広範に悪用されるカテゴリとなった。

### 主な問題例

- IDを変えて他ユーザーのリソースにアクセス（IDOR）
- `/admin` ページへURLを直打ちするとアクセスできる
- JWTのロールを改ざんして管理者権限を取得
- CORSの設定ミスによるクロスオリジンアクセス

### 対策

- サーバー側でリクエストごとにアクセス権を検証
- デフォルト拒否（Deny by Default）
- リソースのオーナーシップをビジネスロジックに組み込む

---

## A6: Security Misconfiguration

誤った設定・デフォルト設定のまま運用することで生まれる脆弱性。2021年でも同じ位置（A5）に残る。

### 主な問題例

- デフォルトの管理者パスワードが未変更
- 本番環境でスタックトレース付きエラーを返す
- 不要なポートやサービスが開放されている
- クラウドストレージへのパブリックアクセスが許可されている

### 対策

- IaC（Infrastructure as Code）で設定をコード化・レビュー
- デプロイ時の設定チェックリストを自動化
- CIS Benchmarks に沿ったハードニング

---

## A7: Cross-Site Scripting (XSS)

2013年では3位だったが、フレームワークの自動エスケープ普及により7位に後退。
2021年版ではInjectionカテゴリ（A3）に統合された。

### 主な種類

| 種類 | 概要 |
|-----|------|
| Reflected XSS | URLパラメータ等の入力がそのままHTMLに出力される |
| Stored XSS | DBに保存された悪意あるスクリプトが他ユーザーに配信される |
| DOM-based XSS | JavaScriptがDOMを操作する際にスクリプトが実行される |

### 対策

- テンプレートエンジンの自動エスケープを活用（手動エスケープに頼らない）
- CSP（Content Security Policy）で実行できるスクリプトの範囲を制限
- innerHTML等のDangerousな操作を避ける

---

## A8: Insecure Deserialization【新規】

信頼できないデータをデシリアライズすることで任意コード実行・権限昇格・DoSが起きる脆弱性。
2021年では「Software and Data Integrity Failures（A8）」に概念が発展・改名された。

### 攻撃例

```
# JavaのreadObject()やPHPのunserialize()が対象になりやすい
# 攻撃者が細工したシリアライズオブジェクトを送信
# → デシリアライズ時にガジェットチェーンが実行される

# 有名な例: Apache Commons Collections の脆弱性（CVE-2015-4852）
# リモートコード実行（RCE）につながる
```

### 対策

- 信頼できないソースからのデータはデシリアライズしない
- 整合性チェック（デジタル署名・HMACによる検証）でデータの改ざんを検知
- Java の場合: ObjectInputFilter でデシリアライズ対象クラスを制限

---

## A9: Using Components with Known Vulnerabilities

依存ライブラリ・フレームワーク・OSのパッチ適用漏れ。
2021年では「Vulnerable and Outdated Components（A6）」に改名（「陳腐化」も含む概念に拡張）。

### 典型例

Log4Shell（CVE-2021-44228）は2021年末に発覚した史上最大級の脆弱性の一つ。
Apache Log4j という広く使われているJavaのロギングライブラリに存在し、
影響を受けたシステムは世界中に数十億あると言われた。

### 対策

- Dependabot / Snyk / OWASP Dependency-Check で継続的にスキャン
- SCA（Software Composition Analysis）をCI/CDに組み込む
- EOLコンポーネントの置き換えを計画的に実施

---

## A10: Insufficient Logging & Monitoring【新規】

攻撃の検知・対応を遅らせる根本原因。2017年版で初めてTop10入り。
IBM Cost of a Data Breach Report によれば侵害の平均検出期間は197日（2023年版）。

### 何をログに残すか

- タイムスタンプ
- ユーザーID・セッションID
- IPアドレス
- 操作内容（認証試行・権限変更・データアクセス等）
- 成否（成功/失敗）

### 対策

- 認証失敗・権限エラーはリアルタイムアラートを設定
- ログは改ざん不可なストレージに保存（S3 Object Lock等）
- SIEMでのリアルタイム相関分析

---

## 2013年 vs 2017年 変遷

| 2013年 | 2017年 |
|--------|--------|
| A1: Injection | A1: Injection（維持）|
| A2: Broken Authentication | A2: Broken Authentication（維持）|
| A3: XSS | A3: Sensitive Data Exposure（↑）|
| A4: Insecure Direct Object Reference | A4: XXE（**新規**）|
| A5: Security Misconfiguration | A5: Broken Access Control（統合・昇格）|
| A6: Sensitive Data Exposure | A6: Security Misconfiguration（↓）|
| A7: Missing Function Level Access Control | A7: XSS（↓）|
| A8: CSRF | A8: Insecure Deserialization（**新規**）|
| A9: Using Components with Known Vulns | A9: Using Components with Known Vulns（維持）|
| A10: Unvalidated Redirects and Forwards | A10: Insufficient Logging & Monitoring（**新規**）|

2013年に存在したCSRFとUnvalidated Redirectsは2017年でリスト外へ（対策の普及で相対的な脅威度が下がった）。

---

## 関連ドキュメント

- [OWASP Top 10 全バージョン比較](./concepts_security_owasp_top10_history.md)
- [OWASP Top 10（2021年版）](./concepts_security_owasp_top10.md)
- [OWASP Top 10 2025](./concepts_security_owasp_top10_2025.md)

---

## 参考文献

- OWASP Top 10 2017 — owasp.org/www-project-top-ten/2017
- OWASP Testing Guide v4.2
- IBM Cost of a Data Breach Report 2023
