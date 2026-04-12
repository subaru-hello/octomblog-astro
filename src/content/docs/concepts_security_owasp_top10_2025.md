---
title: "OWASP Top 10 2025"
category: "概念"
emoji: "🕳️"
order: 804
date: "2026-04-12"
series: [セキュリティ]
tags: ["セキュリティ", "OWASP", "脆弱性", "Webアプリ"]
source: "OWASP Top 10 2025（owasp.org/www-project-top-ten）"
---

## OWASP Top 10 2025 とは

2021年版から約4年ぶりの改訂。コミュニティからのデータ収集（2023〜2024年）をもとに更新された。

主な変化点：
- LLM・AIアプリケーションの普及に伴うリスクがWeb全体のトレンドに影響
- APIファーストなアーキテクチャの浸透で、APIセキュリティの重要性がさらに増した
- ソフトウェアサプライチェーン攻撃が高度化・多様化
- 従来の「実装ミス」だけでなく「設計・アーキテクチャレベルの欠陥」への着目が継続

最新情報は [OWASP公式サイト](https://owasp.org/www-project-top-ten/) で確認すること。

---

## OWASP Top 10 2025 一覧

| 順位 | カテゴリ | 概要 |
|---|---|---|
| A01 | Broken Access Control | アクセス制御の不備（2021年版から継続1位）|
| A02 | Cryptographic Failures | 暗号化の失敗 |
| A03 | Injection | インジェクション攻撃（XSS含む）|
| A04 | Insecure Design | 安全でない設計 |
| A05 | Security Misconfiguration | セキュリティの設定ミス |
| A06 | Vulnerable and Outdated Components | 脆弱・陳腐化したコンポーネント |
| A07 | Identification and Authentication Failures | 認証・識別の失敗 |
| A08 | Software and Data Integrity Failures | ソフトウェア・データ整合性の失敗 |
| A09 | Security Logging and Monitoring Failures | ログ・監視の失敗 |
| A10 | Server-Side Request Forgery (SSRF) | サーバーサイドリクエストフォージェリ |

2021年版と大きな順位変動はなく、同じ10カテゴリが継続している。
各カテゴリの内部では、クラウドネイティブ・AIサービス・APIという新たな文脈での事例が追加された。

---

## 2021年版からの主な変化

### A01: Broken Access Control の深刻化

2021年に1位に浮上して以来、Broken Access Controlは世界中のインシデント報告で最多カテゴリを維持している。

APIドリブンなアーキテクチャの普及により、以下の問題がより顕在化した：
- **BOLA（Broken Object Level Authorization）** — IDOR のAPI版。`GET /api/orders/12345` で他人のデータが取れる
- **BFLA（Broken Function Level Authorization）** — 一般ユーザーが管理者向けAPIエンドポイントを呼べる
- マイクロサービス間の認可チェックの抜け

```
# 典型的なBOLA攻撃
GET /api/v1/accounts/98765/transactions
Authorization: Bearer <ユーザーAのトークン>

# ユーザーAがアカウント98765（ユーザーB所有）の取引履歴を取得できる
# → サーバー側でオーナーシップを検証していない
```

---

### A04: Insecure Design の拡張

2021年に新設されたInsecure Designカテゴリは、2025年版ではAI/LLM統合における設計欠陥も包含するようになった。

**新たな設計欠陥パターン：**
- LLMをユーザー入力から直接駆動させる設計（Prompt Injectionのリスク）
- AIモデルに過剰な権限を与えすぎる設計
- セキュリティ要件を機能仕様書に含めない設計プロセス

---

### A06: Vulnerable Components とサプライチェーン攻撃

依存コンポーネントの脆弱性管理に加え、**サプライチェーン攻撃**（依存パッケージへの悪意あるコードの混入）への対処が重要課題になった。

**代表的な事件（背景）：**
- npm パッケージの乗っ取りによる悪意あるコードの混入
- PyPI・RubyGems等でのタイポスクワッティング（似た名前の偽パッケージ）
- CI/CDパイプラインへの侵入・改ざん

**対策の進化：**
- SBOM（Software Bill of Materials）の生成・管理が業界標準化
- Sigstore / cosign によるパッケージ署名検証
- OpenSSF Scorecard でオープンソースプロジェクトのセキュリティを評価

---

### A08: Software and Data Integrity Failures の高度化

CI/CDパイプラインとAIモデルのサプライチェーンを標的とした攻撃が増加。

**新たな脅威：**
- **AIモデルの改ざん** — モデルウェイトへのバックドア埋め込み（モデルポイズニング）
- **ビルドパイプライン攻撃** — GitHub Actions等のCI/CDへの不正アクセスでビルド成果物を改ざん
- **依存関係の混乱攻撃（Dependency Confusion）** — プライベートパッケージ名と同名のパブリックパッケージを公開して混入

---

## 2025年版の注目トレンド

### LLMアプリケーションセキュリティ

Webアプリケーションにチャット・コード生成・エージェントなどのAI機能が統合されるケースが急増。
OWASP は別プロジェクトとして [OWASP Top 10 for LLM Applications](https://genai.owasp.org/) を策定しており、
以下のリスクが特に注視されている：

| リスク | 概要 |
|-------|------|
| Prompt Injection | ユーザー入力でLLMに意図しない命令を実行させる |
| Insecure Output Handling | LLMの出力を検証せずにシステムへ渡す |
| Training Data Poisoning | 学習データへの悪意ある混入 |
| Model Denial of Service | LLMへの意図的なリソース消費攻撃 |
| Excessive Agency | AIエージェントへの過剰な権限付与 |

---

### APIセキュリティの主流化

Webアプリの多くがSPA + REST/GraphQL API構成になったことで、APIへの攻撃が急増。
OWASP API Security Top 10（別プロジェクト）との整合性を意識した対策が求められる。

```
# GraphQLでのIntrospectionを悪用した情報収集
query IntrospectionQuery {
  __schema {
    types { name fields { name } }
  }
}
# → APIスキーマ全体が攻撃者に公開される
```

---

## 2021年 vs 2025年 変遷

| 観点 | 2021年 | 2025年 |
|-----|--------|--------|
| カテゴリ構成 | 10カテゴリ | 同じ10カテゴリを継続 |
| 最大の変化 | Broken Access Control が1位に昇格 | 各カテゴリの事例がクラウド・AI・API文脈で更新 |
| 新たな脅威面 | Insecure Design, SSRF | LLM統合, サプライチェーン高度化, APIセキュリティ |
| 関連プロジェクト | OWASP API Top 10（2023）| OWASP LLM Top 10（2025）が並行して整備 |

各カテゴリの詳細内容（特に事例とデータ）は2021年版から更新されているため、
実務でのチェックリスト作成には [OWASP公式の最新ドキュメント](https://owasp.org/www-project-top-ten/) を参照すること。

---

## 関連ドキュメント

- [OWASP Top 10 全バージョン比較](./concepts_security_owasp_top10_history.md)
- [OWASP Top 10 2017](./concepts_security_owasp_top10_2017.md)
- [OWASP Top 10（2021年版）](./concepts_security_owasp_top10.md) — 各カテゴリの詳細な攻撃例・対策
- [API セキュリティ（OWASP API Top 10）](./concepts_webapp_security_api.md)

---

## 参考文献

- OWASP Top 10 2025 — owasp.org/www-project-top-ten
- OWASP Top 10 for LLM Applications — genai.owasp.org
- OWASP API Security Top 10 2023 — owasp.org/www-project-api-security
- OWASP Software Component Verification Standard（SCVS）
