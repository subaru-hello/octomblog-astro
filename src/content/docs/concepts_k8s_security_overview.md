---
title: Kubernetes セキュリティ概要・脅威モデル
category: "概念"
emoji: "⎈"
order: 900
date: "2026-04-09"
series: [Kubernetesセキュリティ]
tags: ["セキュリティ", "Kubernetes", "コンテナ", "脅威モデル", "4C"]
source: "Kubernetes Security（Kaizhe Huang & Pranjal Jumde, 2021）/ CIS Kubernetes Benchmark v1.8 / NIST SP 800-190（Application Container Security Guide）/ Kubernetes Documentation（kubernetes.io/docs/concepts/security）"
---

## Kubernetes とは

**コンテナ化されたアプリケーションのデプロイ・スケーリング・管理を自動化するオーケストレーションシステム。**  
Google の内部システム「Borg」の知見をもとに設計され、2014年にオープンソース化された。

### コンテナとの関係

```
【コンテナ単体の問題】
  ・コンテナが落ちたとき誰が再起動するか？
  ・負荷が増えたとき誰がスケールアウトするか？
  ・複数ホストにまたがる通信をどう管理するか？

【Kubernetes が解決する】
  ・自己修復（落ちたら自動再起動）
  ・水平スケーリング（負荷に応じて Pod 数を増減）
  ・サービスディスカバリ・ロードバランシング
  ・ローリングアップデート・ロールバック
```

### Kubernetes の主要リソース

| リソース | 役割 |
|---|---|
| **Pod** | K8s の最小デプロイ単位。1つ以上のコンテナを内包 |
| **Deployment** | Pod の宣言的な管理（レプリカ数・更新戦略）|
| **Service** | Pod へのネットワークアクセスを安定化する仮想 IP |
| **Namespace** | クラスタ内の論理的な分割単位（チーム・環境ごとに分ける）|
| **ConfigMap** | 設定値の管理（機密でないデータ）|
| **Secret** | 機密情報の管理（パスワード・トークン）|
| **ServiceAccount** | Pod に紐づく K8s API へのアクセス ID |
| **RBAC** | Role / RoleBinding による権限管理 |

### Kubernetes クラスタの全体像

```
Developer / CI-CD
      │ kubectl / API
      ▼
┌─────────────────────────────────────────────────────┐
│  Control Plane（マスターノード）                     │
│                                                     │
│  ┌──────────────┐   ┌──────────┐   ┌─────────────┐  │
│  │  API Server  │──▶│  etcd   │   │  Scheduler  │  │
│  │  （唯一の   │   │（クラスタ│   │  Controller │  │
│  │   入口）    │   │ の状態DB）│   │  Manager    │  │
│  └──────┬───────┘   └──────────┘   └─────────────┘  │
│         │                                           │
└─────────┼───────────────────────────────────────────┘
          │ kubelet で通信
          ▼
┌─────────────────────────────────────────────────────┐
│  Worker Node × N                                    │
│                                                     │
│  ┌──────────┐  ┌─────────────────────────────────┐  │
│  │ kubelet  │  │  Pod    Pod    Pod    Pod        │  │
│  │（ノード  │  │ [App] [Sidecar] [Job] [DaemonSet]│  │
│  │ の代理） │  └─────────────────────────────────┘  │
│  └──────────┘                                       │
│  ┌────────────────────────────────────────────────┐ │
│  │  Container Runtime（containerd / CRI-O）       │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────┐
│  外部サービス        │
│  Cloud IAM / LB / PV │
└──────────────────────┘
```

---

## なぜ Kubernetes セキュリティが難しいか

Kubernetes は強力な分散オーケストレーションシステムだが、その複雑さがセキュリティリスクを生む。

```
複雑さの源泉:
  - 多数のコンポーネント（API Server・etcd・kubelet・CNI 等）
  - 動的に変化するワークロード（スケールアウト・ローリングアップデート）
  - デフォルト設定がセキュリティより利便性に寄っている
  - クラスタ管理者・開発者・DevOps の責任境界が曖昧になりやすい
```

---

## 4C モデル：Cloud Native Security の層構造

Kubernetes セキュリティは**4層のネスト構造**で捉える。  
内側の層は外側の層のセキュリティに依存する。外側が破られれば内側の保護は意味をなさない。

```
┌─────────────────────────────────────────────────────┐
│  Cloud / Data Center                                │
│  ┌───────────────────────────────────────────────┐  │
│  │  Cluster（Kubernetes）                        │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │  Container                              │  │  │
│  │  │  ┌───────────────────────────────────┐  │  │  │
│  │  │  │  Code（アプリケーション）          │  │  │  │
│  │  │  └───────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

| 層 | 主なリスク | 対策の例 |
|---|---|---|
| Cloud | IAM 設定ミス・VPC 設計 | 最小権限 IAM・VPC 分離 |
| Cluster | API Server への不正アクセス・RBAC 設定ミス | RBAC・ネットワークポリシー・監査ログ |
| Container | 脆弱なイメージ・root 実行 | Distroless・非 root・イメージスキャン |
| Code | アプリの脆弱性（OWASP Top 10） | SAST・DAST・依存関係管理 |

---

## Kubernetes の主要コンポーネントと攻撃対象

```
┌─────────────────────────────────────────────────────┐
│  Control Plane                                      │
│  ┌──────────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  API Server  │  │  etcd   │  │  Scheduler /  │  │
│  │  （玄関口）  │  │（秘密の │  │  Controller   │  │
│  └──────────────┘  │ 金庫）  │  └───────────────┘  │
│                    └──────────┘                     │
└─────────────────────────────────────────────────────┘
             ↕（kubelet で通信）
┌─────────────────────────────────────────────────────┐
│  Worker Node                                        │
│  ┌──────────┐  ┌───────────────┐  ┌──────────────┐  │
│  │ kubelet  │  │  kube-proxy   │  │  Pod / Pod  │  │
│  └──────────┘  └───────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────┘
```

| コンポーネント | 攻撃対象として重要な理由 |
|---|---|
| **API Server** | クラスタへの唯一の入口。認証・認可の要 |
| **etcd** | クラスタの全設定・Secrets が平文で保存される可能性がある |
| **kubelet** | ノード上のコンテナを制御。デフォルトで匿名アクセスが可能なバージョンもある |
| **Dashboard** | 過去に認証なしで公開されインシデントが多発 |

---

## Kubernetes 固有の脅威モデル（STRIDE 適用）

| 脅威 | Kubernetes での具体例 |
|---|---|
| **Spoofing** | 偽の kubelet がワーカーノードを乗っ取る / ServiceAccount の詐称 |
| **Tampering** | etcd への直接書き込みによるリソース改ざん |
| **Repudiation** | 監査ログが無効化されていて操作証跡がない |
| **Information Disclosure** | Secret が Base64 のみ（暗号化なし）で etcd に保存 |
| **Denial of Service** | リソース制限なし Pod によるノードのリソース枯渇 |
| **Elevation of Privilege** | `privileged: true` コンテナからのホストへのエスケープ |

---

## 実際のインシデント事例

### Tesla の Kubernetes クラスタへの不正侵入（2018年）

```
経緯:
  認証なしで公開されていた Kubernetes Dashboard を発見
  → Dashboard から AWS 認証情報を含む Secrets を取得
  → S3 バケットにアクセス（機密データの漏洩）
  → クラスタ内でクリプトマイニングを実行

根本原因:
  ① Kubernetes Dashboard に認証設定なし
  ② Secrets の不適切な管理
  ③ RBAC が設定されていない

教訓:
  管理 UI は必ず認証を設定する
  Dashboard はデフォルト無効化が推奨
```

### SolarWinds 型サプライチェーン攻撃（2020年）

コンテナイメージのビルドパイプラインが侵害されると、  
すべての Deployment にバックドアが混入するリスクがある。  
イメージの署名と検証（Supply Chain Security）が重要になる背景。

---

## GKE（Google Kubernetes Engine）でのセキュリティ

マネージド K8s サービスを使う場合、Control Plane の管理責任はプロバイダーが担うが、  
**ワークロードとクラスタ設定の責任はユーザーにある**（共有責任モデル）。

### GKE 固有のセキュリティ機能

| 機能 | 内容 |
|---|---|
| **Workload Identity** | Pod に GCP サービスアカウントを紐づける。SA キーファイル不要 |
| **Binary Authorization** | 署名済みイメージのみデプロイを許可するAdmission Control |
| **GKE Sandbox（gVisor）** | ユーザー空間カーネルで Pod を隔離（後述）|
| **Shielded GKE Nodes** | Secure Boot・vTPM でノードの整合性を保証 |
| **Config Sync** | GitOps でセキュリティポリシーをクラスタに同期 |
| **Security Posture** | クラスタの設定ミス・脆弱性を継続的にスキャン |

### Workload Identity の仕組み

```
# 従来（危険）: SA キーファイルを Secret として配布
kubectl create secret generic gcp-sa-key --from-file=key.json

# Workload Identity（安全）: キーファイル不要
# GKE の KSA（K8s Service Account）と GCP SA を紐づける
gcloud iam service-accounts add-iam-policy-binding \
  my-gcp-sa@project.iam.gserviceaccount.com \
  --member="serviceAccount:project.svc.id.goog[namespace/ksa-name]" \
  --role="roles/iam.workloadIdentityUser"
```

---

## Terraform によるセキュリティ設定の管理

Kubernetes のセキュリティ設定は YAML で記述するが、  
**インフラ（クラスタ自体・IAM・VPC）は Terraform で管理する**のが現代の標準。

### IaC でセキュリティを担保する利点

```
手動設定の問題:
  ・設定ドリフト（誰かが手動変更して正しい状態がわからなくなる）
  ・レビューできない（変更履歴が残らない）
  ・再現できない（別環境に同じ設定を適用できない）

Terraform の利点:
  ・設定を Git で管理 → レビュー・監査が可能
  ・PR で変更差分（plan）を確認してからapply
  ・tfsec / checkov でセキュリティ設定ミスを CI で検出
```

### GKE クラスタのセキュア設定例（Terraform）

```hcl
resource "google_container_cluster" "main" {
  name     = "production"
  location = "asia-northeast1"

  # デフォルトノードプールを無効化して管理ノードプールを別途定義
  remove_default_node_pool = true
  initial_node_count       = 1

  # Workload Identity の有効化
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # 限定公開クラスタ（API Server をインターネットに公開しない）
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false  # 外部からkubectlを使う場合はfalse
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  # Binary Authorization の有効化
  binary_authorization {
    evaluation_mode = "PROJECT_SINGLETON_POLICY_ENFORCE"
  }

  # 認証情報の Legacy Basic Auth を無効化
  master_auth {
    client_certificate_config {
      issue_client_certificate = false
    }
  }
}
```

```bash
# tfsec で設定ミスを検出
tfsec . --minimum-severity HIGH

# checkov でコンプライアンスチェック
checkov -d . --framework terraform --check CKV_GCP_24,CKV_GCP_25
```

---

## gVisor（GKE Sandbox）

**コンテナとホストカーネルの間にユーザー空間カーネルを挟んでシステムコールを仲介するサンドボックス技術。**

### なぜ必要か

通常のコンテナはホスト OS のカーネルを共有する。  
カーネルの脆弱性を突かれると**コンテナエスケープ**でホストを乗っ取られるリスクがある。

```
【通常のコンテナ】
  Pod のアプリ → システムコール → ホスト Linux カーネル
                                   （直接アクセス。エスケープリスクあり）

【gVisor（GKE Sandbox）】
  Pod のアプリ → システムコール → gVisor（runsc）
                                   ↓ 安全なサブセットのみ
                                   ホスト Linux カーネル
                                   （攻撃対象が大幅に縮小）
```

### RuntimeClass による使い分け

すべての Pod に gVisor を適用するとオーバーヘッドが生じるため、  
**リスクが高い Pod（外部入力を受ける・信頼度の低いコード）に限定して適用**するのがベストプラクティス。

```yaml
# RuntimeClass の定義（GKE では事前に設定済み）
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor
handler: runsc

---
# Pod で gVisor を指定
apiVersion: v1
kind: Pod
metadata:
  name: sandboxed-app
spec:
  runtimeClassName: gvisor   # ← これだけで gVisor が有効になる
  containers:
  - name: app
    image: my-app:latest
```

### gVisor の適用判断基準

```
適用すべき Pod:
  ・外部からのリクエストを直接受けるフロントエンド
  ・サードパーティコード・プラグインを実行するもの
  ・マルチテナント環境で他テナントのコードを実行するもの

適用しなくてよい Pod:
  ・内部のみで動くマイクロサービス（信頼済みコード）
  ・パフォーマンスに敏感なデータ処理（オーバーヘッドを避けたい）
```

---

## KEDA（Kubernetes Event-Driven Autoscaling）

**外部イベント（キューのメッセージ数・HTTP リクエスト数等）をトリガーに Pod をスケールする自動スケーラー。**  
標準の HPA（CPU/メモリベース）では対応できないイベント駆動なスケーリングを実現する。

### セキュリティ上の考慮点

KEDA はスケーリングのトリガーを読むために外部サービス（Pub/Sub・Kafka・Redis 等）に認証する。  
この認証情報の管理がセキュリティの要になる。

```yaml
# TriggerAuthentication: KEDA がスケールトリガーの認証に使う設定
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: pubsub-auth
  namespace: production
spec:
  podIdentity:
    provider: gcp   # Workload Identity を使用（キーファイル不要）

---
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: worker-scaler
spec:
  scaleTargetRef:
    name: worker-deployment
  triggers:
  - type: gcp-pubsub
    authenticationRef:
      name: pubsub-auth   # 上記の TriggerAuthentication を参照
    metadata:
      subscriptionName: "my-subscription"
      value: "10"         # キューに10メッセージ以上でスケールアウト
```

### KEDA のセキュリティベストプラクティス

```
・TriggerAuthentication には Workload Identity / IRSA を使う（静的キーを避ける）
・ScaledObject の maxReplicaCount を設定して無限スケールを防ぐ
・KEDA 自体の RBAC を最小権限に絞る
・KEDA のバージョンを定期的に更新する（CVE 管理）
```

---

## CIS Kubernetes Benchmark

CIS（Center for Internet Security）が提供する K8s のセキュリティ設定基準。  
Kubernetes の各バージョンに対応した推奨設定が詳細に定義されている。

### 主要チェックカテゴリ

| カテゴリ | 主なチェック内容 |
|---|---|
| Control Plane 設定 | API Server の認証・認可・TLS 設定 |
| etcd | 暗号化・TLS 通信・アクセス制限 |
| Policies | RBAC・Network Policy・Pod Security |
| Worker Node | kubelet の認証設定・ファイルパーミッション |

```bash
# kube-bench: CIS Benchmark の自動チェックツール
kubectl apply -f https://raw.githubusercontent.com/aquasecurity/kube-bench/main/job.yaml
kubectl logs job/kube-bench
```

---

## セキュリティ強化の優先順位

リソースが限られている場合、以下の順序で取り組むと効果が高い。

```
優先度 高
  1. RBAC の最小権限設定（ServiceAccount・ClusterRole）
  2. Pod のルート実行禁止（runAsNonRoot）
  3. Secrets の暗号化（etcd at-rest encryption）
  4. Network Policy による Pod 間通信の制限
  5. イメージスキャンの CI/CD 組み込み
  6. 監査ログの有効化と保存
  7. Admission Controller（OPA Gatekeeper / Kyverno）
  8. ランタイム検知（Falco）
優先度 低
```

---

## シリーズ構成（学習ロードマップ）

```
concepts_k8s_security_overview（本ドキュメント）
  │
  ├── concepts_k8s_security_rbac         RBAC・ServiceAccount
  ├── concepts_k8s_security_pod          Pod Security・SecurityContext
  ├── concepts_k8s_security_network_policy  NetworkPolicy
  ├── concepts_k8s_security_secrets      Secrets 管理・Vault
  ├── concepts_k8s_security_supply_chain イメージスキャン・cosign
  ├── concepts_k8s_security_runtime      Falco・eBPF
  └── concepts_k8s_security_audit        監査ログ・CIS Benchmark
```

---

## 参考文献

- Kaizhe Huang & Pranjal Jumde『Kubernetes Security』（Packt, 2021）— K8s セキュリティの体系的な入門書
- CIS Kubernetes Benchmark v1.8 — クラスタ設定の業界標準チェックリスト（cisecurity.org）
- NIST SP 800-190『Application Container Security Guide』（2017）— コンテナセキュリティの公式ガイドライン
- Kubernetes 公式ドキュメント Security セクション（kubernetes.io/docs/concepts/security）— 最新の設定例と推奨事項
- Google Cloud『GKE Security Overview』（公式ドキュメント）— GKE 固有のセキュリティ機能の解説
- gVisor 公式ドキュメント（gvisor.dev）— gVisor のアーキテクチャと RuntimeClass の設定方法
- KEDA 公式ドキュメント（keda.sh）— TriggerAuthentication と Workload Identity の設定例
