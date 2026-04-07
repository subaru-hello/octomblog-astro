---
title: セキュリティ概要・学習ロードマップ
category: "概念"
emoji: "🔒"
order: 800
date: "2026-04-06"
series: [セキュリティ]
tags: ["セキュリティ", "概要", "ロードマップ"]
---

## セキュリティとは何か

セキュリティとは「**資産を脅威から守る継続的な活動**」である。  
一度設定すれば終わりのものではなく、攻撃手法の進化に合わせて常にアップデートが必要。

セキュリティの目標は **CIA トライアド** で表現される。

| 目標 | 英語 | 意味 |
|---|---|---|
| 機密性 | Confidentiality | 許可されたユーザーだけが情報にアクセスできる |
| 完全性 | Integrity | 情報が改ざんされていない、正確である |
| 可用性 | Availability | 必要なときに情報・サービスにアクセスできる |

---

## セキュリティの6大領域

### 1. 脅威・攻撃の理解（Threat Intelligence）

「攻撃者がどう考えるか」を知ることが防御の出発点。

- **脅威モデリング** — STRIDE, DREAD, Attack Trees
- **攻撃手法の分類** — OWASP Top10, CWE, CVE/CVSS
- **具体的な攻撃** — SQLインジェクション, XSS, CSRF, SSRF
- **ソーシャルエンジニアリング** — Phishing, Spear Phishing

### 2. 防御・設計原則（Secure Design）

壊れにくいシステムを最初から設計するための原則群。

- **Defense in Depth** — 多層防御。1箇所突破されても次の壁がある
- **Zero Trust** — 「信頼しない、常に検証する」
- **Least Privilege** — 必要最低限の権限しか与えない
- **Fail Secure** — 障害発生時に安全側に倒れる設計

### 3. 認証・認可・暗号（Identity & Cryptography）

「誰が」「何をできるか」を正しく制御し、データを守る基盤。

- **認証** — OAuth2/OIDC, JWT, MFA, パスワードレス
- **認可** — RBAC, ABAC, PAM
- **暗号** — 対称/非対称暗号, ハッシュ関数, TLS/mTLS, PKI

### 4. 検知・対応（Detection & Response）

「侵入を前提」とした設計。侵入後に素早く気づき、封じ込める。

- **監視・ログ** — SIEM, ログ設計, 異常検知
- **インシデントレスポンス** — IR Lifecycle, Containment, Eradication
- **脅威インテリジェンス** — IOC, IOA, TTPs, MITRE ATT&CK

### 5. コンプライアンス・リスク管理（GRC）

組織レベルでセキュリティをガバナンスする枠組み。

- **フレームワーク** — NIST CSF, ISO 27001, CIS Controls
- **リスク管理** — リスクアセスメント, リスク受容・移転・軽減
- **規制** — GDPR, 個人情報保護法, SOC2, PCI DSS

### 6. ペネトレーションテスト・Red Team（Offensive Security）

「自分でやられてみる」ことで防御の穴を発見する。

- **手法論** — PTES, Red/Blue/Purple Team
- **ツール** — Burp Suite, Metasploit, OSINT
- **Bug Bounty** — 責任ある開示, CVSSスコアリング

---

## セキュリティを貫く思考パターン

### 攻撃者思考（Adversarial Thinking）

「どう守るか」より先に「どう壊せるか」を考える。  
防御側は全ての穴を塞がなければならないが、攻撃側は1つ見つければよい——この非対称性を常に意識する。

### Assume Breach（侵害を前提とする）

「侵入されない」ことを目標にするのではなく、「侵入されたときに被害を最小化する」設計を優先する。  
Zero Trust と組み合わせることで実現する。

### Shift Left（早い段階での対処）

セキュリティの問題は発見が遅れるほど修正コストが指数的に増加する。  
開発プロセスの早い段階（設計・コーディング時）にセキュリティを組み込む。

---

## 学習ロードマップ

```
Phase 1: 基礎固め
├── concepts_security_threat_modeling   脅威モデリング（STRIDE）
├── concepts_security_design_principles 設計原則（Zero Trust等）
├── concepts_security_owasp_top10       OWASP Top 10
├── concepts_security_auth              認証・認可（OAuth2, JWT）
└── concepts_security_cryptography      暗号の基礎

Phase 2: 実践
├── concepts_security_network           ネットワークセキュリティ
├── concepts_security_cloud             クラウドセキュリティ（AWS/GCP/Azure）
├── concepts_security_devsecops         DevSecOps / SAST / DAST
└── concepts_security_incident_response インシデントレスポンス

Phase 3: 発展
├── concepts_security_pentest           ペネトレーションテスト基礎
├── concepts_security_mitre_attack      MITRE ATT&CK フレームワーク
├── concepts_security_grc               GRC / リスク管理
└── concepts_security_malware           マルウェア分析基礎
```

---

## 関連する主要フレームワーク・標準

| フレームワーク | 用途 |
|---|---|
| OWASP Top 10 | Webアプリの代表的脆弱性リスト |
| MITRE ATT&CK | 攻撃者の戦術・技術のナレッジベース |
| NIST CSF | 組織のサイバーセキュリティ成熟度フレームワーク |
| ISO 27001 | 情報セキュリティ管理の国際標準 |
| CIS Controls | 優先度付きのセキュリティ対策リスト |
| PTES | ペネトレーションテストの標準手法論 |
