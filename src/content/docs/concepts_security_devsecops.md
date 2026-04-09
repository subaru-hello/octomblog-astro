---
title: DevSecOps / Shift Left
category: "概念"
emoji: "🔄"
order: 808
date: "2026-04-08"
series: [セキュリティ]
tags: ["セキュリティ", "DevSecOps", "SAST", "DAST", "SCA", "Shift Left", "CI/CD"]
source: "DevSecOps: A Leader's Guide（Glenn Wilson, 2021）/ The Phoenix Project（Kim et al., 2013）/ OWASP DevSecOps Guideline / NIST SP 800-218（Secure Software Development Framework）/ Accelerate（Forsgren et al., 2018）"
---

## DevSecOps とは

**Development・Security・Operations を統合し、セキュリティを開発・運用の全工程に組み込む文化・実践。**

従来のウォーターフォール開発では、セキュリティチェックはリリース直前の「門番」だった。  
DevSecOps は「セキュリティは全員の責任」とする文化に変え、問題を**早期に発見・修正**することを目指す。

```
【従来モデル】
開発 ──────────────── セキュリティレビュー（リリース直前）──── 運用
                              ↑
                     ここで大量の指摘 → 手戻りコスト大

【DevSecOps】
設計 → コード → ビルド → テスト → デプロイ → 運用
 ↑     ↑       ↑       ↑       ↑       ↑
セキュリティが各フェーズに組み込まれている
```

---

## Shift Left の原則

**セキュリティを開発プロセスの「左側（早い段階）」に移動させる。**

IBM のシステムサイエンス研究（2008年）によれば、  
設計フェーズで発見した脆弱性の修正コストを1とすると、本番環境での修正コストは**30倍**になる。

```
コスト比較（相対値）:
  設計フェーズ   : ×1
  コーディング   : ×6
  テスト         : ×15
  リリース後     : ×30〜100
```

---

## セキュリティテストの4種類

### SAST（Static Application Security Testing）

**ソースコードを実行せずに静的解析する。**  
コミット時・PR時に自動で実行し、脆弱なコードパターンを検出する。

| 特徴 | 内容 |
|---|---|
| 実行タイミング | コーディング中・PR時 |
| メリット | 早期発見。ソースコードの文脈で問題を指摘できる |
| デメリット | 誤検知（False Positive）が多い。実行時の問題は見えない |

代表的ツール：Semgrep, SonarQube, Checkmarx, CodeQL（GitHub）, Bandit（Python）

```yaml
# GitHub Actions での SAST 例（Semgrep）
- name: Run Semgrep
  uses: semgrep/semgrep-action@v1
  with:
    config: p/owasp-top-ten
```

### DAST（Dynamic Application Security Testing）

**動作中のアプリケーションに対して外部からリクエストを送り、脆弱性を検出する。**

| 特徴 | 内容 |
|---|---|
| 実行タイミング | ステージング環境・デプロイ後 |
| メリット | 実際の攻撃に近い形でテスト。ランタイムの問題を検出 |
| デメリット | 実行環境が必要。テスト時間が長い |

代表的ツール：OWASP ZAP（無料）, Burp Suite Pro, Nikto

```yaml
# GitHub Actions での DAST 例（OWASP ZAP）
- name: ZAP Scan
  uses: zaproxy/action-full-scan@v0.9.0
  with:
    target: 'https://staging.example.com'
```

### SCA（Software Composition Analysis）

**使用しているOSS・ライブラリの脆弱性・ライセンスリスクを検出する。**

現代のアプリはコードベースの70〜90%がOSSで構成されており、SCAはサプライチェーン攻撃対策として必須。

| 特徴 | 内容 |
|---|---|
| 実行タイミング | 依存関係追加時・定期スキャン |
| メリット | 既知のCVEを自動検出・PRで通知 |
| デメリット | 推移的依存（依存の依存）まで管理が複雑 |

代表的ツール：Dependabot（GitHub）, Snyk, OWASP Dependency-Check, Trivy

```yaml
# dependabot.yml の例（GitHub）
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
```

### IAST（Interactive Application Security Testing）

アプリケーション内にエージェントを埋め込み、テスト実行中にリアルタイムで脆弱性を検出する。  
SASTとDASTのハイブリッドで、誤検知が少ない。CI/CDへの統合コストが高いのが課題。

---

## セキュリティをCI/CDに組み込む

### パイプラインの設計

```
PR作成
  │
  ├─ SAST（Semgrep / CodeQL）        ← 数秒〜数分
  ├─ SCA（Dependabot / Snyk）        ← 数秒〜数分
  ├─ Secrets スキャン（git-secrets）  ← 数秒
  │
マージ
  │
  ├─ コンテナイメージスキャン（Trivy）
  │
ステージングデプロイ
  │
  ├─ DAST（OWASP ZAP）               ← 数分〜数十分
  │
本番デプロイ
```

### フェイルファスト戦略

```
# 重大度に応じてパイプラインを止める
CRITICAL   → パイプライン即時停止（マージブロック）
HIGH       → PR にコメント + 担当者通知
MEDIUM     → チケット自動作成
LOW / INFO → 週次レポートに集約
```

すべての指摘でパイプラインを止めると開発速度が落ちる。  
閾値設計が DevSecOps 導入の成否を左右する。

---

## Secrets 管理

### やってはいけないこと

```bash
# コードへのハードコード
const apiKey = "sk-prod-abc123xyz";

# 環境変数への直接埋め込み（Dockerfileや.envをコミット）
ENV DATABASE_URL=postgres://user:password@host/db

# ログへの出力
console.log("Connecting with key:", apiKey);
```

### Secrets 検出ツール

```bash
# git-secrets: コミット前フックで検出
git secrets --scan

# truffleHog: Gitヒストリーをスキャン
trufflehog git https://github.com/org/repo

# detect-secrets: Yelp製。ベースラインを管理できる
detect-secrets scan > .secrets.baseline
```

### Secrets の正しい管理

| 環境 | 推奨手法 |
|---|---|
| ローカル開発 | `.env`（`.gitignore`に追加）, direnv |
| CI/CD | プロバイダーのSecretsストア（GitHub Actions Secrets等）|
| 本番環境 | AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault |

---

## SDL（Security Development Lifecycle）

Microsoft が提唱した、SDLC の各フェーズにセキュリティ活動を組み込むフレームワーク。

| フェーズ | セキュリティ活動 |
|---|---|
| 要件定義 | セキュリティ要件の定義。プライバシー要件の特定 |
| 設計 | 脅威モデリング。攻撃対象領域の最小化 |
| 実装 | セキュアコーディングルールの適用。SAST |
| 検証 | DAST・ペネトレーションテスト・ファジング |
| リリース | インシデントレスポンス計画の準備 |
| 運用 | 監視・パッチ管理・脆弱性対応 |

---

## Security Champion 制度

セキュリティチームだけでセキュリティを担うのは組織規模が大きくなるとスケールしない。  
各開発チームに**セキュリティに精通したメンバー（Security Champion）**を配置し、橋渡し役にする。

```
セキュリティチーム（ガイドライン策定・支援）
       │
  ─────┼─────────────────────────
       │
Security Champion（各チームに1名）
  ├── チーム内のセキュリティレビュー
  ├── 脅威モデリングのファシリテーション
  └── セキュリティインシデントの一次対応
```

---

## Infrastructure as Code（IaC）セキュリティ

Terraform / CloudFormation などの IaC も脆弱な設定をコードレビューで検出できる。

```bash
# tfsec: Terraformの設定ミスを検出
tfsec .

# checkov: 複数のIaCフォーマットに対応
checkov -d . --framework terraform

# 検出例
[HIGH] Resource 'aws_s3_bucket.data' has logging disabled
[CRITICAL] Resource 'aws_security_group.web' allows unrestricted ingress on port 22
```

---

## メトリクスで測る DevSecOps の成熟度

| メトリクス | 測定対象 |
|---|---|
| Mean Time to Remediate（MTTR） | 脆弱性発見から修正完了までの平均時間 |
| 脆弱性の発見フェーズ | 何割を本番前（設計・実装段階）に発見できているか |
| Critical/High の未対応件数 | 高リスク脆弱性の滞留数 |
| パイプラインのセキュリティゲート通過率 | セキュリティチェックを通過してデプロイされた割合 |

Accelerate（Forsgren et al., 2018）の研究では、  
セキュリティを組み込んだ高パフォーマンスなチームは**デプロイ頻度が高く、変更失敗率も低い**ことが示されている。

---

## 参考文献

- Glenn Wilson『DevSecOps: A Leader's Guide』（Packt, 2021）— DevSecOps の文化・プロセス・ツールを組織的に導入するガイド
- OWASP DevSecOps Guideline — CI/CDへのセキュリティ統合の実践ガイド（owasp.org）
- NIST SP 800-218『Secure Software Development Framework（SSDF）』（2022）— セキュアな開発プロセスのフレームワーク
- Nicole Forsgren, Jez Humble, Gene Kim『Accelerate』（IT Revolution, 2018）— DevOps パフォーマンスの科学的研究。セキュリティと開発速度の両立を実証
- Gene Kim et al.『The Phoenix Project』（IT Revolution, 2013）— DevOpsの概念をストーリー形式で解説した定番書
