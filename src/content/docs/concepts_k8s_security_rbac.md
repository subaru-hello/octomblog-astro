---
title: Kubernetes RBAC・ServiceAccount
category: "概念"
emoji: "🎫"
order: 901
date: "2026-04-09"
series: [Kubernetesセキュリティ]
tags: ["セキュリティ", "Kubernetes", "RBAC", "ServiceAccount", "最小権限"]
source: "Kubernetes Documentation（kubernetes.io/docs/reference/access-authn-authz/rbac）/ CIS Kubernetes Benchmark v1.8 / Kubernetes Security（Kaizhe Huang & Pranjal Jumde, 2021）/ Google Cloud『GKE RBAC Best Practices』"
---

## Kubernetes の認証・認可フロー

kubectl や Pod からのすべての API リクエストは以下の順序で処理される。

```
リクエスト
    │
    ▼
①認証（Authentication）
    誰か？
    ─ X.509 クライアント証明書
    ─ Bearer Token（ServiceAccount Token）
    ─ OIDC（外部 IdP との連携）
    │
    ▼
②認可（Authorization）
    何をしてよいか？
    ─ RBAC（Role-Based Access Control）← 現在の標準
    ─ ABAC / Webhook（特殊用途）
    │
    ▼
③Admission Control
    ポリシーに準拠しているか？
    ─ OPA Gatekeeper / Kyverno
    │
    ▼
④etcd への永続化 / 実行
```

---

## RBAC の4リソース

Kubernetes の RBAC は4つのリソースで構成される。

| リソース | スコープ | 役割 |
|---|---|---|
| **Role** | Namespace 内 | 権限の定義 |
| **ClusterRole** | クラスタ全体 | 権限の定義（Namespace をまたぐ）|
| **RoleBinding** | Namespace 内 | Role を Subject に紐づける |
| **ClusterRoleBinding** | クラスタ全体 | ClusterRole を Subject に紐づける |

```
Subject（誰が）
  ├── User
  ├── Group
  └── ServiceAccount
        ↓ RoleBinding / ClusterRoleBinding
Role / ClusterRole（何ができるか）
  └── rules:
        apiGroups・resources・verbs の組み合わせ
```

---

## Role / ClusterRole の設計

### verbs（動詞）の種類

| verb | 対応する操作 |
|---|---|
| `get` | 単一リソースの取得 |
| `list` | リソース一覧の取得 |
| `watch` | リソースの変更を監視 |
| `create` | 新規作成 |
| `update` | 既存リソースの更新 |
| `patch` | 部分更新 |
| `delete` | 削除 |
| `deletecollection` | 複数削除 |
| `*` | すべての操作（使用は最小限に）|

### 最小権限の Role 設計例

```yaml
# NG: ワイルドカードで全権限を付与
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: bad-role
  namespace: production
rules:
- apiGroups: ["*"]
  resources: ["*"]
  verbs: ["*"]

---
# OK: 必要な操作のみ列挙
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: production
rules:
- apiGroups: [""]           # core API グループ
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list"]
```

### ClusterRole の使いどころ

```yaml
# Namespace をまたいでログを読む監視ツール用 ClusterRole
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: log-reader
rules:
- apiGroups: [""]
  resources: ["pods", "pods/log", "namespaces"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list"]
```

---

## ServiceAccount

**Pod が Kubernetes API にアクセスするための ID。**  
ユーザーアカウント（人間）に対して、ServiceAccount はワークロード（Pod）用のアカウント。

### デフォルト ServiceAccount の問題

```yaml
# 指定しない場合、Pod は Namespace の "default" ServiceAccount を使う
spec:
  containers:
  - name: app
    image: my-app:latest
# ↑ default SA は何もしないように見えるが、
#   クラスタによっては予想以上の権限を持っている場合がある
```

**原則: Pod には専用の ServiceAccount を作成し、default SA は使わない。**

### 専用 ServiceAccount の作成と紐づけ

```yaml
# 1. 専用 ServiceAccount を作成
apiVersion: v1
kind: ServiceAccount
metadata:
  name: order-service-sa
  namespace: production
  annotations:
    # GKE の場合: Workload Identity で GCP SA と紐づける
    iam.gke.io/gcp-service-account: order-sa@project.iam.gserviceaccount.com

---
# 2. 最小権限の Role を作成
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: order-service-role
  namespace: production
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get"]            # ConfigMap の読み取りのみ

---
# 3. RoleBinding で紐づける
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: order-service-binding
  namespace: production
subjects:
- kind: ServiceAccount
  name: order-service-sa
  namespace: production
roleRef:
  kind: Role
  apiGroupt: rbac.authorization.k8s.io
  name: order-service-role

---
# 4. Pod に ServiceAccount を指定
spec:
  serviceAccountName: order-service-sa
  automountServiceAccountToken: false  # API アクセス不要なら Token をマウントしない
  containers:
  - name: order-service
    image: order-service:latest
```

### automountServiceAccountToken の制御

デフォルトでは ServiceAccount の JWT トークンが `/var/run/secrets/kubernetes.io/serviceaccount/token` に自動マウントされる。  
**API アクセスが不要な Pod にはマウント自体を無効化する。**

```yaml
# ServiceAccount レベルで無効化（この SA を使う全 Pod に適用）
apiVersion: v1
kind: ServiceAccount
metadata:
  name: no-api-access-sa
automountServiceAccountToken: false

# Pod レベルで無効化（個別に制御したい場合）
spec:
  automountServiceAccountToken: false
```

---

## Projected Volume による短命トークン

古いバージョンでは SA トークンに有効期限がなかった。  
現在は **Bound Service Account Token**（Projected Volume）で有効期限付きトークンを発行する。

```yaml
spec:
  volumes:
  - name: token
    projected:
      sources:
      - serviceAccountToken:
          path: token
          expirationSeconds: 3600   # 1時間で期限切れ
          audience: my-service      # 対象サービスを限定
  containers:
  - name: app
    volumeMounts:
    - mountPath: /var/run/secrets/tokens
      name: token
```

---

## よくある RBAC の設定ミス

### cluster-admin の乱用

```yaml
# 危険: 全ユーザーにクラスタ管理者権限を付与
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: dangerous-binding
subjects:
- kind: Group
  name: system:authenticated   # 認証済み全ユーザー！
roleRef:
  kind: ClusterRole
  name: cluster-admin          # 最高権限
  apiGroup: rbac.authorization.k8s.io
```

### secrets の get 権限の見落とし

```yaml
# 注意: secrets への get 権限は非常に強力
rules:
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get", "list"]   # list だけでも全 Secret の名前がわかる
                            # get があれば Secret の中身を読める
```

Secret への権限は特に慎重に設計する。CI/CD パイプラインや監視ツールでも  
`secrets` リソースへの `get` が本当に必要かを必ず問い直す。

### escalate / bind verb の危険性

```yaml
# escalate: 自分が持っていない権限を含む Role を作れる
# bind: 自分より高い権限を他者に付与できる
# → どちらも実質的な権限昇格につながる
# → これらの verb は cluster-admin 相当のユーザーのみに限定する
```

---

## RBAC の検査・監査ツール

```bash
# 特定ユーザー・SA が何をできるか確認
kubectl auth can-i create pods --as=system:serviceaccount:production:order-service-sa
kubectl auth can-i '*' '*' --as=system:serviceaccount:default:default

# Namespace 内の全権限を確認
kubectl auth can-i --list --namespace=production \
  --as=system:serviceaccount:production:order-service-sa

# rbac-lookup: SA や User の権限を人間が読みやすい形で表示
rbac-lookup order-service-sa -k serviceaccount -n production

# rakkess: リソースごとにどの操作が可能かをマトリクス表示
rakkess --sa production:order-service-sa

# audit2rbac: 監査ログから最小権限の RBAC を自動生成
audit2rbac --filename audit.log --serviceaccount production:order-service-sa
```

---

## Terraform による RBAC 管理

RBAC の設定も Terraform（kubernetes provider）で管理することでドリフトを防ぐ。

```hcl
resource "kubernetes_service_account" "order_service" {
  metadata {
    name      = "order-service-sa"
    namespace = "production"
    annotations = {
      "iam.gke.io/gcp-service-account" = "order-sa@${var.project_id}.iam.gserviceaccount.com"
    }
  }
  automount_service_account_token = false
}

resource "kubernetes_role" "order_service" {
  metadata {
    name      = "order-service-role"
    namespace = "production"
  }
  rule {
    api_groups = [""]
    resources  = ["configmaps"]
    verbs      = ["get"]
  }
}

resource "kubernetes_role_binding" "order_service" {
  metadata {
    name      = "order-service-binding"
    namespace = "production"
  }
  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.order_service.metadata[0].name
    namespace = "production"
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.order_service.metadata[0].name
  }
}
```

---

## チェックリスト

```
□ Pod に専用の ServiceAccount を割り当てている（default SA を使っていない）
□ automountServiceAccountToken: false を API 不要な Pod に設定している
□ ワイルドカード（*）を使わず必要な verb のみ許可している
□ secrets リソースへのアクセス権限を最小限にしている
□ cluster-admin を一般ユーザーや SA に付与していない
□ ClusterRoleBinding より RoleBinding（Namespace スコープ）を優先している
□ kubectl auth can-i で定期的に権限の棚卸しをしている
□ RBAC 設定を Terraform / GitOps で管理しドリフトを防いでいる
```

---

## 参考文献

- Kubernetes 公式ドキュメント『Using RBAC Authorization』（kubernetes.io）— RBAC の仕様と設定例の公式リファレンス
- CIS Kubernetes Benchmark v1.8 Section 5（Policies）— RBAC に関するセキュリティチェックリスト
- Kaizhe Huang & Pranjal Jumde『Kubernetes Security』（Packt, 2021）— ServiceAccount とトークン管理の実践的解説
- Google Cloud『GKE RBAC Best Practices』（公式ドキュメント）— Workload Identity と RBAC を組み合わせた GKE 向けガイド
