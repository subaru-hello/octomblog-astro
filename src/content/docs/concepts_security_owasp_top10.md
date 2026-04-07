---
title: OWASP Top 10
category: "概念"
emoji: "🕳️"
order: 803
date: "2026-04-07"
series: [セキュリティ]
tags: ["セキュリティ", "OWASP", "脆弱性", "Webアプリ"]
source: "OWASP Top 10 2021（owasp.org）/ The Web Application Hacker's Handbook（Stuttard & Pinto, 2011）/ OWASP Testing Guide v4.2"
---

## OWASP Top 10 とは

OWASP（Open Web Application Security Project）が3〜4年ごとに更新する、  
**Webアプリケーションにおける最も重大な脆弱性カテゴリのトップ10**。

実際のデータ漏洩事例・CVE・セキュリティ専門家の調査をもとに順位が決まる。  
開発・設計・テストのチェックリストとして世界標準で参照される。

---

## OWASP Top 10 2021

| 順位 | カテゴリ | 概要 |
|---|---|---|
| A01 | Broken Access Control | アクセス制御の不備 |
| A02 | Cryptographic Failures | 暗号化の失敗 |
| A03 | Injection | インジェクション攻撃 |
| A04 | Insecure Design | 安全でない設計 |
| A05 | Security Misconfiguration | セキュリティの設定ミス |
| A06 | Vulnerable and Outdated Components | 脆弱・陳腐化したコンポーネント |
| A07 | Identification and Authentication Failures | 認証・識別の失敗 |
| A08 | Software and Data Integrity Failures | ソフトウェア・データ整合性の失敗 |
| A09 | Security Logging and Monitoring Failures | ログ・監視の失敗 |
| A10 | Server-Side Request Forgery（SSRF） | サーバーサイドリクエストフォージェリ |

---

## A01: Broken Access Control（アクセス制御の不備）

2021年に**1位に浮上**。最も広範に悪用されているカテゴリ。

### 攻撃例

- **IDOR（Insecure Direct Object Reference）**  
  `/api/orders/1234` のIDを `1235` に変えて他人の注文を取得できる

- **強制ブラウジング**  
  `/admin` ページにURLを直打ちしてアクセスできてしまう

- **権限の垂直昇格**  
  一般ユーザーが管理者専用APIを呼び出せる

### 対策

- サーバー側でセッションに紐づくユーザー権限を毎回検証する（クライアント側の制御だけでは不十分）
- デフォルトはアクセス拒否（Deny by Default）
- リソースのオーナーシップ検証をロジックに組み込む

---

## A02: Cryptographic Failures（暗号化の失敗）

以前の「Sensitive Data Exposure」から名称変更。原因に焦点を当てた。

### 攻撃例

- HTTPでパスワード・クレジットカード番号を平文送信
- MD5/SHA-1 など破られたハッシュ関数でパスワードを保存
- 自己署名証明書の不適切な検証スキップ

### 対策

- 通信は必ずTLS 1.2以上を使用
- パスワード保存には **bcrypt / Argon2 / scrypt**（ソルト付き）を使用
- 暗号化が不要なデータは保持しない（Data Minimization）

---

## A03: Injection（インジェクション）

SQLインジェクション・コマンドインジェクション・LDAPインジェクションなどを含む。  
2021年に3位へ（2017年は1位）。対策の普及により順位が下がった。

### SQLインジェクションの例

```sql
-- 脆弱なクエリ
SELECT * FROM users WHERE name = '${userInput}';

-- 入力値: ' OR '1'='1
-- 実行されるクエリ: SELECT * FROM users WHERE name = '' OR '1'='1';
-- 全ユーザー情報が返る
```

### 対策

- **プリペアドステートメント**（パラメータ化クエリ）を使う
- ORMを使う場合も生クエリ埋め込みに注意
- コマンドインジェクション対策として、外部コマンド実行時はシェル経由を避ける

---

## A04: Insecure Design（安全でない設計）

2021年に新規追加。実装の問題ではなく**設計レベルの欠陥**に起因する脆弱性。

### 例

- パスワードリセットで「秘密の質問」方式を採用 → ソーシャルエンジニアリングで突破可能な設計
- 在庫確認APIに認証なし → 競合他社のスクレイピングを防げない

### 対策

- 脅威モデリングを設計フェーズに組み込む（[脅威モデリング](./concepts_security_threat_modeling.md)参照）
- ユースケースと同時に**ミスユースケース（Misuse Case）**も設計する
- セキュリティ要件をユーザーストーリーとして定義する

---

## A05: Security Misconfiguration（セキュリティの設定ミス）

**最も発生頻度が高い**カテゴリの一つ。正しい機能を間違った設定で使うことで生まれる。

### 例

- デフォルトの管理者パスワードを変更していない
- 本番環境でデバッグモードが有効のままになっている
- S3バケットがパブリックアクセス可能になっている
- 不要なポート・サービスが開放されている

### 対策

- IaC（Infrastructure as Code）で設定を管理し、レビュー・バージョン管理する
- CIS Benchmarks に沿ったハードニング
- 本番デプロイ時の設定チェックリストを自動化する

---

## A06: Vulnerable and Outdated Components（脆弱・陳腐化したコンポーネント）

ライブラリ・フレームワーク・OSのパッチ適用漏れ。  
2021年の**Log4Shell（CVE-2021-44228）**はこのカテゴリの典型例。

### 対策

- 依存関係の継続的なスキャン（Dependabot, Snyk, OWASP Dependency-Check）
- SCA（Software Composition Analysis）をCI/CDに組み込む
- EOL（End of Life）を迎えたコンポーネントの早期置き換え計画

---

## A07: Identification and Authentication Failures（認証・識別の失敗）

セッション管理・クレデンシャル管理の不備。

### 例

- パスワードリセットトークンが予測可能
- セッションIDがログアウト後も無効化されない
- ブルートフォース攻撃への対策なし（レートリミットなし）
- 弱いパスワードポリシー

### 対策

- **MFA（多要素認証）**を必須化
- セッションはログアウト時・タイムアウト時に無効化
- パスワードリセットトークンに十分なエントロピー（128bit以上）を確保
- 認証に関しては既成の実績あるライブラリ・IdP を使う（自前実装は避ける）

---

## A08: Software and Data Integrity Failures（ソフトウェア・データ整合性の失敗）

2021年に新規追加。CI/CDパイプラインやシリアライズ処理の整合性チェック欠如。

### 例

- **サプライチェーン攻撃** — npm パッケージが乗っ取られ悪意あるコードが混入
- 安全でないデシリアライゼーション — 信頼できないデータをデシリアライズしてコード実行される

### 対策

- パッケージの署名・ハッシュ検証（npm audit, sigstore）
- CI/CDパイプラインへのアクセス制御を厳格に
- デシリアライズは信頼できるデータのみに適用する

---

## A09: Security Logging and Monitoring Failures（ログ・監視の失敗）

攻撃の**検知・対応を遅らせる**原因。侵害の平均検出期間は世界平均で197日（IBM Cost of a Data Breach 2023）。

### 対策

- ログに含めるべき情報: タイムスタンプ, ユーザーID, IPアドレス, 操作内容, 結果（成功/失敗）
- 認証失敗・権限エラーは必ずアラートを発火させる
- ログを改ざん不可なストレージに保存する
- SIEM でのリアルタイム相関分析

---

## A10: SSRF（Server-Side Request Forgery）

**サーバーに任意のURLへリクエストを送らせる攻撃**。  
クラウド環境でのメタデータAPI（`169.254.169.254`）へのアクセスで認証情報を盗める。

### 攻撃例

```
# 攻撃者がAPIのURLパラメータに内部URLを指定
GET /api/fetch?url=http://169.254.169.254/latest/meta-data/iam/security-credentials/

# クラウドのIMDS（Instance Metadata Service）からクレデンシャルが返る
```

### 対策

- 許可するURLをホワイトリスト管理する
- サーバーからの外部リクエストをファイアウォールで制限する
- クラウドではIMDSv2（トークン必須）を使用する

---

## 変遷：2017年 vs 2021年

| 2017年 | 2021年 |
|---|---|
| A1: Injection | A1: Broken Access Control ↑ |
| A2: Broken Authentication | A2: Cryptographic Failures |
| A3: Sensitive Data Exposure | A3: Injection ↓ |
| A4: XML External Entities (XXE) | A4: Insecure Design（新規）|
| A5: Broken Access Control | A5: Security Misconfiguration |
| A6: Security Misconfiguration | A6: Vulnerable Components |
| A7: XSS | A7: Auth Failures |
| A8: Insecure Deserialization | A8: Integrity Failures（新規）|
| A9: Vulnerable Components | A9: Logging & Monitoring Failures |
| A10: Insufficient Logging | A10: SSRF（新規）|

---

## 参考文献

- OWASP Top 10 2021 — owasp.org/Top10（公式ドキュメント）
- Dafydd Stuttard & Marcus Pinto『The Web Application Hacker's Handbook』（Wiley, 2011）— Webアプリ攻撃の体系的解説書
- OWASP Testing Guide v4.2 — テスト手法の公式ガイド
- IBM『Cost of a Data Breach Report 2023』— 侵害の検出・対応コストの統計データ
