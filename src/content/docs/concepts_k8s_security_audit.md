---
title: Kubernetes 監査ログ・SIEM 連携・CIS Benchmark
category: "概念"
emoji: "📋"
order: 907
date: "2026-04-09"
series: [Kubernetesセキュリティ]
tags: ["セキュリティ", "Kubernetes", "監査ログ", "SIEM", "CIS Benchmark", "コンプライアンス"]
source: "Kubernetes Documentation（kubernetes.io/docs/tasks/debug/debug-cluster/audit）/ CIS Kubernetes Benchmark v1.8 / Google Cloud『GKE Audit Logging』ドキュメント / NIST SP 800-92（Guide to Computer Security Log Management）"
---

## なぜ監査ログが重要か

セキュリティの3大問いに「誰が・何を・いつやったか」を答えるのが監査ログ。

```
インシデント発生時に答えなければならない問い:

  ・最初の侵入はいつ、どのリソースへのアクセスから始まったか？
  ・攻撃者はどの ServiceAccount / ユーザーを使ったか？
  ・どの Secret・ConfigMap・Deployment が変更されたか？
  ・誰が kubectl exec でコンテナ内に入ったか？

これらを答えられないと「何が盗まれたか」「どこまで被害が及んだか」がわからない。
```

---

## Kubernetes 監査ログの仕組み

API Server を通過するすべてのリクエストが監査ログの対象。

```
リクエスト（kubectl / SDK / 内部コンポーネント）
    ↓
API Server
    ↓
監査バックエンド
  ├── Log ファイル（/var/log/audit/）
  └── Webhook（外部サービスへリアルタイム転送）
```

### 監査ポリシー（Audit Policy）

何をどの詳細度でログに残すかを定義する。ログ量と詳細度のトレードオフを制御する。

```yaml
# audit-policy.yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
# Stage の定義
# RequestReceived: リクエスト受信時
# ResponseStarted: レスポンスヘッダー送信時（長いレスポンスのみ）
# ResponseComplete: レスポンス完了時
# Panic: パニック発生時

# Secret・ConfigMap へのアクセスはメタデータのみ記録（中身は記録しない）
- level: Metadata
  resources:
  - group: ""
    resources: ["secrets", "configmaps"]

# Pod の exec・port-forward は全リクエスト内容を記録
- level: Request
  resources:
  - group: ""
    resources: ["pods/exec", "pods/portforward", "pods/proxy"]

# ServiceAccount のトークン作成は詳細を記録
- level: RequestResponse
  resources:
  - group: ""
    resources: ["serviceaccounts/token"]

# Node・Pod の読み取りは記録しない（ノイズが多い）
- level: None
  users: ["system:nodes"]
  verbs: ["get", "list", "watch"]
  resources:
  - group: ""
    resources: ["nodes", "pods"]

# その他すべてはメタデータのみ
- level: Metadata
```

### ログレベル（Level）

| Level | 記録される内容 |
|---|---|
| None | 記録しない |
| Metadata | リクエストのメタデータのみ（誰が・何を・いつ）|
| Request | メタデータ + リクエストボディ |
| RequestResponse | メタデータ + リクエスト + レスポンスボディ |

---

## GKE での監査ログ

GKE では **Cloud Audit Logs** が自動的に有効化される。

### 3種類の監査ログ

| 種類 | 内容 | デフォルト |
|---|---|---|
| Admin Activity | リソースの作成・変更・削除（kubectl apply 等）| 常に有効 |
| Data Access | リソースの読み取り（kubectl get 等）| 無効（有効化推奨）|
| System Event | GKE 自動スケーリング等のシステム操作 | 常に有効 |

```hcl
# Terraform: Data Access ログを有効化
resource "google_project_iam_audit_config" "k8s_audit" {
  project = var.project_id
  service = "container.googleapis.com"

  audit_log_config {
    log_type = "ADMIN_READ"
  }
  audit_log_config {
    log_type = "DATA_READ"
  }
  audit_log_config {
    log_type = "DATA_WRITE"
  }
}
```

### Cloud Logging でのクエリ例

```sql
-- kubectl exec の実行を検出
resource.type="k8s_cluster"
protoPayload.methodName="io.k8s.core.v1.pods.exec.create"
timestamp > "2026-04-01T00:00:00Z"

-- Secret への get アクセスを検出
resource.type="k8s_cluster"
protoPayload.methodName=~"io.k8s.core.v1.secrets.(get|list)"
protoPayload.authenticationInfo.principalEmail!="system:serviceaccount:kube-system:"

-- 深夜（JST 22:00〜06:00）の管理者操作
resource.type="k8s_cluster"
protoPayload.authorizationInfo.permission=~".*\\.create|.*\\.delete|.*\\.update"
timestamp >= "2026-04-08T13:00:00Z"
timestamp <= "2026-04-08T21:00:00Z"

-- ClusterRoleBinding の変更（権限昇格の試み）
resource.type="k8s_cluster"
protoPayload.methodName=~"io.k8s.rbac.v1.clusterrolebindings\.(create|update|patch)"
```

---

## SIEM との連携

### GCP ログを SIEM に転送するアーキテクチャ

```
GKE クラスタ
    ↓ Cloud Audit Logs + Falco アラート
Cloud Logging
    ↓ Log Sink（エクスポート）
Cloud Pub/Sub
    ↓ サブスクリプション
SIEM（Elastic / Splunk / Chronicle 等）
    ↓ 相関分析・アラート
SOC アナリスト
```

```hcl
# Terraform: Cloud Logging → Pub/Sub へのシンクを作成
resource "google_logging_project_sink" "k8s_to_pubsub" {
  name        = "k8s-audit-to-siem"
  destination = "pubsub.googleapis.com/projects/${var.project_id}/topics/k8s-audit"

  filter = <<-EOT
    resource.type="k8s_cluster"
    (
      protoPayload.methodName=~".*\\.create|.*\\.delete|.*\\.update"
      OR protoPayload.methodName=~".*pods\\.exec.*"
      OR severity >= WARNING
    )
  EOT

  unique_writer_identity = true
}

resource "google_pubsub_topic" "k8s_audit" {
  name = "k8s-audit"
  message_retention_duration = "604800s"   # 7日間保持
}
```

### 重要な相関ルール例

```
Rule 1: 認証失敗の連続（ブルートフォース）
  条件: 同一 IP から 5分以内に 10回以上の認証失敗
  優先度: HIGH

Rule 2: 通常時間外の特権操作
  条件: 業務時間外（22:00〜06:00 JST）に ClusterRole / Secret の変更
  優先度: HIGH

Rule 3: 新しいサービスアカウントへの cluster-admin 付与
  条件: ClusterRoleBinding の作成 AND roleRef.name == "cluster-admin"
  優先度: CRITICAL

Rule 4: コンテナ内からの K8s API アクセス
  条件: Pod の ServiceAccount が通常使わない API（secrets.get 等）を呼び出し
  優先度: HIGH

Rule 5: 大量の Secret 読み取り
  条件: 同一 ServiceAccount が 10分以内に 20件以上の Secret を get
  優先度: CRITICAL（クレデンシャル収集の可能性）
```

---

## CIS Kubernetes Benchmark

CIS が提供する K8s 設定のセキュリティ基準。**本番クラスタの定期チェックに使う。**  
セクションは Control Plane・etcd・Worker Node・Policies・Managed Services（GKE 等）に分かれる。

### kube-bench による自動チェック

```bash
# クラスタ全体をチェック
kubectl apply -f https://raw.githubusercontent.com/aquasecurity/kube-bench/main/job.yaml
kubectl logs -f job/kube-bench

# 出力例
[INFO] 1 Control Plane Security Configuration
[INFO] 1.2 API Server
[PASS] 1.2.1 Ensure that the --anonymous-auth argument is set to false
[FAIL] 1.2.6 Ensure that the --kubelet-certificate-authority argument is set
[WARN] 1.2.14 Ensure that the admission control plugin NodeRestriction is set
...
[INFO] Summary:
23 checks PASS
8 checks FAIL
6 checks WARN
```

```bash
# GKE 向けのチェック（マネージドコントロールプレーンは一部スキップ）
kubectl apply -f https://raw.githubusercontent.com/aquasecurity/kube-bench/main/job-gke.yaml

# JSON 形式で出力（SIEM やダッシュボードに取り込む）
kube-bench --json | jq '.Controls[].tests[].results[] | select(.status == "FAIL")'
```

### 主要なチェック項目（セクション別）

**1. Control Plane（API Server）**

```
✅ 1.2.1  anonymous-auth = false（匿名アクセス無効）
✅ 1.2.2  token-auth-file を使用していない
✅ 1.2.6  kubelet 証明書の検証
✅ 1.2.9  admission-control に AlwaysPullImages を含む
✅ 1.2.16 audit-log-path が設定されている
✅ 1.2.22 request-timeout = 300 秒以下
```

**2. etcd**

```
✅ 2.1  etcd に --cert-file と --key-file が設定されている（TLS）
✅ 2.2  --client-cert-auth = true
✅ 2.6  --peer-client-cert-auth = true
✅ 2.7  etcd データの暗号化が有効
```

**3. Worker Node（kubelet）**

```
✅ 4.2.1  anonymous-auth = false
✅ 4.2.2  authorization-mode = Webhook（匿名認証なし）
✅ 4.2.6  streaming-connection-idle-timeout = 0 以外
✅ 4.2.10 rotateKubeletServerCertificate = true
```

**4. Policies（RBAC・Pod Security）**

```
✅ 5.1.1  cluster-admin ロールの使用を最小化している
✅ 5.1.3  システムコンポーネント用 ServiceAccount のシークレット作成を最小化
✅ 5.2.2  Privileged コンテナの使用を最小化している（PSS: Baseline 以上）
✅ 5.2.6  runAsRoot コンテナを最小化している
✅ 5.3.2  全 Namespace に NetworkPolicy が存在する
✅ 5.4.1  優先 Secret を環境変数として使用していない
```

---

## ログの保存・改ざん防止

```
監査ログを同一クラスタ内に保存するのは危険:
  攻撃者がクラスタを制御した場合、ログを削除・改ざんできる

推奨: 別の場所に転送して保存
  ├── Cloud Logging（GCP）: デフォルト30日、設定で最長10年保存可能
  ├── 別プロジェクトの Cloud Storage バケット（削除保護付き）
  └── SIEM（Elastic / Splunk）: インデックスの不変化設定を使う

保存期間の目安:
  ├── セキュリティ監査ログ: 最低1年（法令によっては3〜7年）
  └── アクセスログ: 90日〜1年
```

```hcl
# Terraform: 監査ログの長期保存（GCS バケット + 削除ロック）
resource "google_storage_bucket" "audit_logs" {
  name          = "${var.project_id}-k8s-audit-logs"
  location      = "asia-northeast1"
  force_destroy = false

  retention_policy {
    retention_period = 31536000   # 1年間は削除不可
    is_locked        = true       # ロックを有効化（一度ロックすると無効化できない）
  }

  versioning {
    enabled = true
  }
}
```

---

## セキュリティダッシュボードの設計

監査ログ・Falco アラート・kube-bench 結果を統合したダッシュボードで全体像を把握する。

```
推奨ダッシュボード構成（Grafana / Looker Studio 等）:

  Panel 1: リアルタイムアラート
    ├── Falco CRITICAL / HIGH アラートの件数（過去24時間）
    └── SIEM 相関ルールの発火件数

  Panel 2: アクセス監視
    ├── API Server へのユニークユーザー数（時系列）
    ├── kubectl exec の実行件数（コンテナ名・ユーザー別）
    └── Secret へのアクセス件数（ServiceAccount 別）

  Panel 3: セキュリティ態勢
    ├── kube-bench PASS / FAIL 率（時系列）
    ├── PSS 違反の Pod 数（Namespace 別）
    └── 署名されていないイメージの Deployment 数

  Panel 4: インシデント対応
    └── オープン中のインシデント・MTTR の推移
```

---

## セキュリティ定期レビューのサイクル

```
日次:
  ├── Falco CRITICAL アラートのレビュー
  ├── 深夜・業務時間外のアクセス確認
  └── Secret への異常アクセスの確認

週次:
  ├── RBAC の変更履歴レビュー
  ├── 新規追加された ClusterRoleBinding の確認
  └── イメージスキャン結果の未修正 CVE 確認

月次:
  ├── kube-bench による設定チェック
  ├── RBAC の棚卸し（不要な権限の削除）
  └── Falco ルールの見直し・false positive の削減

四半期:
  ├── ペネトレーションテスト
  ├── Tabletop Exercise（インシデント対応訓練）
  └── セキュリティポリシーのレビュー
```

---

## チェックリスト

```
□ Kubernetes 監査ポリシーを設定し、重要な操作をログに記録している
□ GKE の Data Access ログを有効化している
□ 監査ログをクラスタ外（Cloud Logging / SIEM）に転送している
□ ログに削除保護・保持ポリシーを設定している（最低1年）
□ SIEM に相関ルールを設定し、重要アラートを自動検知している
□ kube-bench を定期的に実行し CIS Benchmark への準拠を確認している
□ セキュリティダッシュボードで全体の態勢を可視化している
□ 日次・週次・月次のレビューサイクルを運用している
□ インシデント対応 Playbook を整備し定期的に訓練している
□ ログの保存期間が法令・コンプライアンス要件を満たしている
```

---

## 参考文献

- Kubernetes 公式ドキュメント『Auditing』（kubernetes.io）— 監査ポリシーの仕様と設定例
- CIS Kubernetes Benchmark v1.8（cisecurity.org）— 全チェック項目と推奨設定値（無料公開）
- NIST SP 800-92『Guide to Computer Security Log Management』— ログ管理の全般的なガイドライン
- Google Cloud『GKE 監査ログ』公式ドキュメント — Cloud Logging との連携・Data Access ログの設定
- aquasecurity/kube-bench（GitHub）— CIS Benchmark 自動チェックツールのソースとドキュメント
