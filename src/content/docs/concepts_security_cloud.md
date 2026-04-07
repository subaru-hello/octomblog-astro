---
title: クラウドセキュリティ
category: "概念"
emoji: "☁️"
order: 807
date: "2026-04-08"
series: [セキュリティ]
tags: ["セキュリティ", "クラウド", "IAM", "AWS", "GCP", "Azure", "CSPM", "コンテナ"]
source: "Cloud Security Alliance（CSA）Cloud Controls Matrix v4 / AWS Security Best Practices（AWS Whitepaper）/ NIST SP 800-144（Guidelines on Security and Privacy in Public Cloud Computing）/ Google Cloud Security Foundations Guide"
---

## クラウドセキュリティの特性

クラウドはオンプレミスと比べてセキュリティの**責任境界が変わる**。  
「セキュリティの設定ミス（Misconfiguration）」が最大のリスクになる点がオンプレミスと異なる。

### 共有責任モデル（Shared Responsibility Model）

クラウドプロバイダーとユーザーでセキュリティ責任を分担する。

```
【IaaS（EC2等）】
プロバイダー: 物理インフラ・ハイパーバイザー・ネットワーク
ユーザー:     OS・ミドルウェア・アプリケーション・データ・設定

【PaaS（App Engine等）】
プロバイダー: OS・ランタイムまで
ユーザー:     アプリケーション・データ・設定

【SaaS（Gmail等）】
プロバイダー: ほぼすべて
ユーザー:     データ・アクセス管理・設定
```

サービスが上位レイヤーになるほどプロバイダーの責任範囲が広がるが、  
**設定（Configuration）の責任は常にユーザーにある**。

---

## IAM（Identity and Access Management）

クラウドセキュリティで最も重要な領域。  
AWS の調査では、クラウドインシデントの大半が IAM の設定ミスに起因する。

### IAM の構成要素

| 要素 | 説明 | 例 |
|---|---|---|
| プリンシパル | アクセスを要求するエンティティ | ユーザー・グループ・ロール・サービスアカウント |
| ポリシー | 許可・拒否するアクションのルール | JSON形式でリソース・アクション・条件を定義 |
| リソース | アクセス対象 | S3バケット・EC2インスタンス・Cloud Function |

### 最小権限の実装

```json
// 悪い例: すべてのS3操作を許可
{
  "Effect": "Allow",
  "Action": "s3:*",
  "Resource": "*"
}

// 良い例: 特定バケットのReadのみ許可
{
  "Effect": "Allow",
  "Action": ["s3:GetObject", "s3:ListBucket"],
  "Resource": [
    "arn:aws:s3:::my-bucket",
    "arn:aws:s3:::my-bucket/*"
  ]
}
```

### ロールとサービスアカウント

アプリケーションがクラウドリソースにアクセスする際、**長期クレデンシャル（アクセスキー）を使わない**。  
代わりにロール（AWS）またはサービスアカウント（GCP）を使い、一時的なトークンを自動取得する。

```
# 危険: アクセスキーをコードや環境変数にハードコード
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=abc123...

# 安全: EC2インスタンスにIAMロールをアタッチ → SDKが自動でIMDSから一時トークン取得
```

### 特権アクセス管理（PAM）

| 手法 | 内容 |
|---|---|
| JIT Access（Just-In-Time） | 管理者権限を必要なときだけ一時的に付与 |
| Break Glass アカウント | 緊急時専用の特権アカウント。使用時に必ずアラート |
| Privileged Access Workstation | 管理操作専用の隔離された端末 |

---

## ネットワーク分離（VPC）

クラウドのネットワークはデフォルトで分離されていない。  
VPC（Virtual Private Cloud）で論理的にネットワークを分割し、トラフィックを制御する。

### VPC 設計の原則

```
【パブリックサブネット】
- インターネットゲートウェイに接続
- 配置するもの: ロードバランサー・NATゲートウェイのみ
- アプリサーバー・DBを直接配置しない

【プライベートサブネット】
- インターネットから直接到達不可
- 配置するもの: アプリケーションサーバー・DBサーバー
- NATゲートウェイ経由でのみ外部通信可能
```

### セキュリティグループ vs ネットワークACL

| 比較軸 | セキュリティグループ | ネットワークACL |
|---|---|---|
| 適用単位 | インスタンス（ENI）単位 | サブネット単位 |
| ステート | ステートフル（戻りのトラフィックは自動許可） | ステートレス（Inbound/Outbound 両方設定必要） |
| デフォルト | すべて拒否 | すべて許可 |
| 用途 | 細かいアクセス制御 | サブネットレベルの粗い制御 |

---

## クラウド固有の攻撃ベクター

### IMDS（Instance Metadata Service）攻撃

SSRF脆弱性を利用して、EC2インスタンスのメタデータAPIから認証情報を窃取する攻撃。

```
# 攻撃者がSSRF経由でアクセス
http://169.254.169.254/latest/meta-data/iam/security-credentials/

# アタッチされたIAMロールの一時認証情報が返される
{
  "AccessKeyId": "ASIA...",
  "SecretAccessKey": "...",
  "Token": "..."
}
```

対策：IMDSv2 を強制する（トークンベースのリクエストが必須になる）。

### パブリック公開の設定ミス

```
よく起きるミス:
- S3バケットのパブリックアクセスブロックを無効化
- セキュリティグループで 0.0.0.0/0 からの SSH（22番）許可
- データベースをパブリックサブネットに配置
- Kubernetes APIサーバーをインターネットに公開

対策:
- S3 Block Public Access を組織全体で強制
- SSHはVPN/Bastionホスト経由のみ許可
- AWS Config / Security Command Center でルール違反を継続的に検出
```

### クレデンシャルの漏洩

```
漏洩経路:
- Gitリポジトリへの誤コミット
- Dockerイメージのレイヤーへの埋め込み
- ログへの出力

対策:
- git-secrets / truffleHog でコミット前にスキャン
- IAMロールを使用して長期クレデンシャルを持たない
- クレデンシャルが漏洩した場合は即時ローテーション
```

---

## CSPM（Cloud Security Posture Management）

クラウド環境全体のセキュリティ設定を**継続的に評価・修正する**ツール・プロセス。

| 機能 | 内容 |
|---|---|
| 設定評価 | CIS Benchmarks・NIST等のベストプラクティスと照合 |
| リスクの優先順位付け | 重大度スコアで修正順序を提示 |
| コンプライアンス管理 | PCI DSS・SOC2等の準拠状況をダッシュボードで可視化 |
| 自動修正 | 一部の設定ミスを自動で修正 |

代表的ツール：AWS Security Hub, Google Security Command Center, Microsoft Defender for Cloud, Wiz, Prisma Cloud。

---

## コンテナ・Kubernetes セキュリティ

### コンテナの脅威モデル

```
攻撃経路:
  脆弱なベースイメージ → コンテナ内でのコード実行 → コンテナエスケープ → ホスト侵害
```

### イメージセキュリティ

```dockerfile
# 悪い例
FROM ubuntu:latest      # 巨大なベースイメージに不要なツールが多数
RUN apt-get install -y curl wget netcat  # 攻撃ツールになりうる

# 良い例
FROM gcr.io/distroless/java17  # 最小限のランタイムのみ（シェルなし）
```

- Distroless / Alpine など最小ベースイメージを使用
- イメージスキャン（Trivy, Snyk Container）をCI/CDに組み込む
- イメージに署名（cosign / Sigstore）してサプライチェーンを保護

### Kubernetes RBAC

```yaml
# 最小権限のサービスアカウント設定例
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list"]   # readのみ。createやdeleteは与えない
```

### Pod Security Standards

| レベル | 制限内容 |
|---|---|
| Privileged | 制限なし（最も危険。システム用途のみ） |
| Baseline | 既知の特権エスカレーションをブロック |
| Restricted | ベストプラクティス準拠（最も安全） |

`privileged: true` や `hostNetwork: true` は原則禁止。コンテナエスケープに直結する。

### Secrets 管理

```
悪い例: Kubernetes Secret をそのまま使う（Base64エンコードのみで暗号化なし）
良い例:
  - External Secrets Operator + AWS Secrets Manager / GCP Secret Manager
  - HashiCorp Vault
  - etcd の暗号化を有効化（at-rest encryption）
```

---

## クラウドセキュリティのログと監視

| サービス | クラウド | 用途 |
|---|---|---|
| CloudTrail | AWS | APIコール（誰が何をしたか）の完全な記録 |
| Cloud Audit Logs | GCP | 管理アクティビティ・データアクセスの監査 |
| Azure Monitor | Azure | リソース操作・診断ログ |
| VPC Flow Logs | AWS/GCP | ネットワークトラフィックのメタデータ |
| GuardDuty | AWS | 脅威インテリジェンスベースの異常検知 |

CloudTrail / Cloud Audit Logs は**必ず有効化**し、別アカウントや書き込み専用バケットに保存する（削除・改ざん対策）。

---

## 参考文献

- Cloud Security Alliance（CSA）『Cloud Controls Matrix v4』— クラウドセキュリティのコントロール標準
- NIST SP 800-144『Guidelines on Security and Privacy in Public Cloud Computing』— クラウド利用時のセキュリティ原則
- AWS『Security Best Practices in IAM』（公式ドキュメント）— AWS IAM の設計ガイド
- Google Cloud『Security Foundations Guide』（公式ドキュメント）— GCP のセキュリティ基盤設計
- Liz Rice『Container Security』（O'Reilly, 2020）— コンテナ・Kubernetes セキュリティの実践書
