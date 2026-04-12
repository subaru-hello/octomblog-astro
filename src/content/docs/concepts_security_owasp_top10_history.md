---
title: "OWASP Top 10 全バージョン比較（2003〜2025）"
category: "概念"
emoji: "🕳️"
order: 801
date: "2026-04-12"
series: [セキュリティ]
tags: ["セキュリティ", "OWASP", "脆弱性", "Webアプリ", "歴史"]
source: "OWASP Top 10 公式リリースアーカイブ（owasp.org/www-project-top-ten）"
---

## OWASP Top 10 の歴史

OWASP（Open Web Application Security Project）が公開する、Webアプリケーションにおける最も重大な脆弱性カテゴリのランキング。
実際のデータ漏洩事例・CVE・セキュリティ専門家の調査をもとに構成され、3〜4年ごとに改訂される。

初版は2003年。以降8バージョンが公開されており、Webセキュリティのトレンドと脅威の変遷を反映している。

---

## バージョン一覧

| バージョン | リリース | 主な特徴 |
|-----------|---------|---------|
| [2003（RC1）](#2003) | 2003年 | 初版。バッファオーバーフロー・DoS・エラーハンドリングを含む |
| [2004](#2004) | 2004年 | 2003をほぼ踏襲。最初の正式リリース |
| [2007](#2007) | 2007年 | XSSが1位に浮上。CSRFが初登場 |
| [2010](#2010) | 2010年 | インジェクションが1位を獲得。構成が整理された |
| [2013](#2013) | 2013年 | Sensitive Data Exposureが独立カテゴリに |
| [2017](#2017) | 2017年 | XXE・Insecure Deserialization・Logging Failuresが新規追加 |
| [2021](#2021) | 2021年 | Broken Access Controlが1位に。Insecure Design・SSRFが新規追加 |
| [2025](#2025) | 2025年 | AIリスク・サプライチェーン攻撃・APIセキュリティ強化 |

---

## 全バージョン比較表

| カテゴリ | 2004 | 2007 | 2010 | 2013 | 2017 | 2021 |
|---------|:----:|:----:|:----:|:----:|:----:|:----:|
| Injection | A6 | A2 | A1 | A1 | A1 | A3 |
| XSS | A4 | A1 | A2 | A3 | A7 | A3（統合）|
| Broken Access Control | A2 | A4(IDOR) | A4(IDOR) | A4,A7 | A5 | **A1** |
| Auth & Session Failures | A3 | A7 | A3 | A2 | A2 | A7 |
| Security Misconfiguration | A10 | - | A6 | A5 | A6 | A5 |
| Sensitive Data / Crypto Failures | A8 | A8,A9 | A7,A9 | A6 | A3 | A2 |
| CSRF | - | A5 | A5 | A8 | - | - |
| Vulnerable Components | - | - | - | A9 | A9 | A6 |
| Logging / Monitoring Failures | - | - | - | - | A10 | A9 |
| XXE | - | - | - | - | A4 | A5（統合）|
| Insecure Deserialization | - | - | - | - | A8 | A8（名称変更）|
| Insecure Design | - | - | - | - | - | A4（新規）|
| SSRF | - | - | - | - | - | A10（新規）|
| Buffer Overflow / DoS | A5,A9 | - | - | - | - | - |

---

## 主要な転換点

### 2007年：XSSの台頭 {#2007-turning-point}

初版以来ランクインしていたバッファオーバーフローが消え、XSSが1位に浮上。
ブラウザとWebアプリの普及に伴い、クライアントサイド攻撃の脅威が高まった時期。
CSRFが初めてTop10入り。

### 2010年：インジェクションの支配 {#2010-turning-point}

SQLインジェクションを中心とするインジェクション攻撃が1位を獲得。
「不正入力」という曖昧な概念が整理され、分類がより精緻化された。

### 2013年：データ保護の重視 {#2013-turning-point}

Sensitive Data Exposure（機密データの漏洩）が独立したカテゴリとして登場。
クレジットカード・パスワードの平文保存事故が相次いだ時代背景を反映。

### 2017年：新たな攻撃面 {#2017-turning-point}

3つの新カテゴリが追加された、実質的に大幅改訂のバージョン。

- **XXE**（XMLの外部エンティティ参照）
- **Insecure Deserialization**（安全でないデシリアライズ）
- **Insufficient Logging & Monitoring**（ログ・監視不足）

### 2021年：設計とアーキテクチャへの着目 {#2021-turning-point}

Broken Access Controlが1位へ。「実装ミス」だけでなく「設計レベルの欠陥（Insecure Design）」が初登場。
クラウド環境特有のSSRF・サプライチェーン攻撃に対応したカテゴリも追加。

### 2025年：AIとエコシステムリスク {#2025-turning-point}

LLM・AIアプリケーション特有の脆弱性がWebセキュリティのトレンドに加わる。
ソフトウェアサプライチェーン攻撃の多様化・APIセキュリティの重要性がさらに増している。

---

## 脅威トレンドの変遷

| 時代 | 主な脅威 |
|-----|---------|
| 1990年代〜2000年代初頭 | バッファオーバーフロー、DoS、設定ミス |
| 2000年代中頃 | XSS・インジェクションの支配 |
| 2010年代 | 認証・アクセス制御・データ保護 |
| 2020年代前半 | 設計欠陥・サプライチェーン・クラウド特有の攻撃（SSRF）|
| 2020年代中頃〜 | AIリスク・LLM脆弱性・APIセキュリティ |

---

## 各バージョン詳細

### 2003・2004 {#2003} {#2004}

初版（2003 RC1）と正式版（2004）はほぼ同内容。

| 順位 | 2004年カテゴリ |
|-----|--------------|
| A1 | Unvalidated Input |
| A2 | Broken Access Control |
| A3 | Broken Authentication and Session Management |
| A4 | Cross Site Scripting (XSS) |
| A5 | Buffer Overflow |
| A6 | Injection Flaws |
| A7 | Improper Error Handling |
| A8 | Insecure Storage |
| A9 | Denial of Service |
| A10 | Insecure Configuration Management |

バッファオーバーフロー・DoS攻撃が上位に入っているのはこの時代の特徴。
現代のWebフレームワークでは多くが自動的に対処されるか、別の問題に置き換わっている。

---

### 2007 {#2007}

| 順位 | カテゴリ |
|-----|---------|
| A1 | Cross Site Scripting (XSS) |
| A2 | Injection Flaws |
| A3 | Malicious File Execution |
| A4 | Insecure Direct Object Reference |
| A5 | Cross Site Request Forgery (CSRF) |
| A6 | Information Leakage and Improper Error Handling |
| A7 | Broken Authentication and Session Management |
| A8 | Insecure Cryptographic Storage |
| A9 | Insecure Communications |
| A10 | Failure to Restrict URL Access |

XSSが初めて1位に。CSRF・IDOR・Failure to Restrict URL Accessなど、現在も重要なカテゴリが登場。

---

### 2010 {#2010}

| 順位 | カテゴリ |
|-----|---------|
| A1 | Injection |
| A2 | Cross-Site Scripting (XSS) |
| A3 | Broken Authentication and Session Management |
| A4 | Insecure Direct Object References |
| A5 | Cross-Site Request Forgery (CSRF) |
| A6 | Security Misconfiguration |
| A7 | Insecure Cryptographic Storage |
| A8 | Failure to Restrict URL Access |
| A9 | Insufficient Transport Layer Protection |
| A10 | Unvalidated Redirects and Forwards |

インジェクションが1位へ。Security Misconfigurationが独立したカテゴリとして初登場。

---

### 2013 {#2013}

| 順位 | カテゴリ |
|-----|---------|
| A1 | Injection |
| A2 | Broken Authentication and Session Management |
| A3 | Cross-Site Scripting (XSS) |
| A4 | Insecure Direct Object References |
| A5 | Security Misconfiguration |
| A6 | Sensitive Data Exposure |
| A7 | Missing Function Level Access Control |
| A8 | Cross-Site Request Forgery (CSRF) |
| A9 | Using Components with Known Vulnerabilities |
| A10 | Unvalidated Redirects and Forwards |

Sensitive Data Exposureが初登場。CSRFが後退し、コンポーネントの脆弱性管理が初めてランクイン。

---

### 2017・2021・2025（詳細ドキュメント）

詳細は各バージョンの専用ドキュメントを参照：

- [OWASP Top 10 2017](./concepts_security_owasp_top10_2017.md)
- [OWASP Top 10（2021年版）](./concepts_security_owasp_top10.md)
- [OWASP Top 10 2025](./concepts_security_owasp_top10_2025.md)

---

## 参考文献

- OWASP Top 10 公式アーカイブ — owasp.org/www-project-top-ten
- OWASP Top 10 2004/2007/2010/2013 各リリースノート
