---
title: Kubernetes Secrets 管理
category: "概念"
emoji: "🗝️"
order: 904
date: "2026-04-09"
series: [Kubernetesセキュリティ]
tags: ["セキュリティ", "Kubernetes", "Secrets", "Vault", "External Secrets", "暗号化"]
source: "Kubernetes Documentation（kubernetes.io/docs/concepts/configuration/secret）/ HashiCorp Vault Documentation（developer.hashicorp.com/vault）/ External Secrets Operator Documentation（external-secrets.io）/ CIS Kubernetes Benchmark v1.8"
---

## Kubernetes Secret の本質的な問題

Kubernetes の Secret は**デフォルトで Base64 エンコードされているだけで暗号化されていない。**  
etcd に平文で保存されており、etcd への直接アクセスや `kubectl get secret -o yaml` で内容が読める。

```bash
# Secret の中身は誰でも（RBAC で許可されていれば）読める
kubectl get secret db-credentials -n production -o jsonpath='{.data.password}' | base64 -d
# → mypassword123  ← 平文で出力される
```

これは「暗号化」ではなく「難読化」に過ぎない。3つのレイヤーで対策が必要。

```
Layer 1: etcd の暗号化（at-rest encryption）← Kubernetes 側
Layer 2: 外部シークレット管理（Vault / GCP Secret Manager）← より安全
Layer 3: RBAC で Secret へのアクセスを最小化 ← 必須
```

---

## Layer 1: etcd の暗号化（at-rest encryption）

Secret を etcd に書き込む際に暗号化する。  
セルフホスト K8s では自分で設定が必要。GKE ではデフォルトで有効。

### EncryptionConfiguration の設定

```yaml
# /etc/kubernetes/encryption-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources:
  - secrets
  providers:
  - aescbc:           # AES-CBC で暗号化
      keys:
      - name: key1
        secret: <base64エンコードした32バイトのランダムキー>
  - identity: {}      # 暗号化なし（フォールバック。新規作成には使われない）
```

```bash
# 32バイトのランダムキーを生成
head -c 32 /dev/urandom | base64

# API Server の起動オプションに追加
--encryption-provider-config=/etc/kubernetes/encryption-config.yaml

# 既存の Secret を再暗号化（設定後に実行）
kubectl get secrets --all-namespaces -o json | kubectl replace -f -
```

### GKE での Application-layer Secrets Encryption

```hcl
# Terraform: GKE で Cloud KMS を使った Application-layer 暗号化
resource "google_container_cluster" "main" {
  database_encryption {
    state    = "ENCRYPTED"
    key_name = google_kms_crypto_key.k8s_secret_key.id
  }
}

resource "google_kms_key_ring" "k8s" {
  name     = "k8s-secrets"
  location = "asia-northeast1"
}

resource "google_kms_crypto_key" "k8s_secret_key" {
  name     = "k8s-secret-encryption-key"
  key_ring = google_kms_key_ring.k8s.id
  purpose  = "ENCRYPT_DECRYPT"

  rotation_period = "7776000s"   # 90日でキーローテーション
}
```

---

## Layer 2: 外部シークレット管理

etcd 暗号化より強力な方法。シークレットを Kubernetes の外に置き、必要なときだけ取得する。

### External Secrets Operator（ESO）

**GCP Secret Manager / AWS Secrets Manager / HashiCorp Vault などと Kubernetes を橋渡しするオペレーター。**  
シークレットの実体は外部に置き、ESO が定期的に同期して Kubernetes Secret を自動生成する。

```
外部シークレット管理サービス（GCP Secret Manager等）
          ↕ ESO が定期同期
Kubernetes Secret（自動生成・自動更新）
          ↕ マウント
Pod
```

```yaml
# SecretStore: 外部サービスへの接続設定
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: gcp-secret-store
  namespace: production
spec:
  provider:
    gcpsm:                        # GCP Secret Manager を使用
      projectID: my-project-id
      auth:
        workloadIdentity:
          clusterLocation: asia-northeast1
          clusterName: production-cluster
          serviceAccountRef:
            name: external-secrets-sa  # Workload Identity を使用

---
# ExternalSecret: 同期するシークレットの定義
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-credentials
  namespace: production
spec:
  refreshInterval: 1h             # 1時間ごとに最新値に同期
  secretStoreRef:
    name: gcp-secret-store
    kind: SecretStore
  target:
    name: db-credentials          # 生成する Kubernetes Secret 名
    creationPolicy: Owner         # ESO が管理（削除時は Secret も削除）
  data:
  - secretKey: password           # Kubernetes Secret のキー名
    remoteRef:
      key: production/db-password  # GCP Secret Manager のシークレット名
      version: latest
  - secretKey: username
    remoteRef:
      key: production/db-username
```

```bash
# ESO のインストール（Helm）
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
  --namespace external-secrets \
  --create-namespace
```

### HashiCorp Vault

**エンタープライズ向けの高機能シークレット管理プラットフォーム。**  
動的シークレット（使い捨ての認証情報を都度発行）が最大の特徴。

```
【静的シークレット（従来）】
  DB パスワード = "fixed_password_123"
  → 漏洩したら攻撃者が永続的にアクセスできる

【動的シークレット（Vault）】
  Pod 起動時: Vault が DB に一時ユーザーを作成
  → 認証情報を Pod に発行（有効期限: 1時間）
  → Pod 終了時: Vault が DB の一時ユーザーを自動削除
  → 漏洩しても有効期限が切れれば無効
```

```yaml
# Vault Agent Sidecar による自動インジェクション
apiVersion: v1
kind: Pod
metadata:
  name: app
  annotations:
    vault.hashicorp.com/agent-inject: "true"
    vault.hashicorp.com/role: "order-service"
    vault.hashicorp.com/agent-inject-secret-db: "database/creds/order-service"
    # /vault/secrets/db にシークレットが書き込まれる
    vault.hashicorp.com/agent-inject-template-db: |
      {{- with secret "database/creds/order-service" -}}
      DATABASE_URL=postgres://{{ .Data.username }}:{{ .Data.password }}@db:5432/orders
      {{- end }}
spec:
  serviceAccountName: order-service-sa
  containers:
  - name: app
    image: my-app:latest
    env:
    - name: DB_CREDENTIALS_FILE
      value: /vault/secrets/db
```

---

## Layer 3: RBAC による Secret アクセスの最小化

どの保存方法を使っても、Secret へのアクセス権限を絞ることは必須。

```yaml
# 特定の Secret のみ get できる Role（list は禁止）
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: db-secret-reader
  namespace: production
rules:
- apiGroups: [""]
  resources: ["secrets"]
  resourceNames: ["db-credentials"]   # 特定の Secret のみ
  verbs: ["get"]                      # list は与えない
```

**`list` を与えると Namespace 内の全 Secret 名が見える。**  
`get` だけでも `resourceNames` で対象を絞ることが重要。

---

## Secret の Pod への渡し方

### 環境変数（非推奨）

```yaml
env:
- name: DB_PASSWORD
  valueFrom:
    secretKeyRef:
      name: db-credentials
      key: password
```

環境変数は `kubectl describe pod` や子プロセスに継承されるため漏洩しやすい。  
また、アプリがクラッシュした際のスタックトレースに含まれることがある。

### ボリュームマウント（推奨）

```yaml
volumes:
- name: db-secret
  secret:
    secretName: db-credentials
    defaultMode: 0400   # 所有者のみ読み取り可能

containers:
- name: app
  volumeMounts:
  - name: db-secret
    mountPath: /etc/secrets
    readOnly: true
  # /etc/secrets/password にファイルとしてマウントされる
```

ファイルとして扱うことで、アプリが必要なタイミングだけ読み込める。  
ESO の `refreshInterval` と組み合わせれば、外部で更新されたシークレットが自動で反映される。

---

## Secret のライフサイクル管理

### ローテーション

```
手動ローテーションのリスク:
  忘れる・タイミングがずれる・ダウンタイムが発生する

自動ローテーションの実装:
  ① GCP Secret Manager / Vault でローテーションを設定
  ② ESO の refreshInterval で K8s Secret を自動更新
  ③ アプリがファイルの変更を監視してホットリロード（またはコンテナ再起動）
```

### シークレットの削除管理

```yaml
# ExternalSecret に ownerReference を設定すると
# ExternalSecret を削除したとき K8s Secret も自動削除される
spec:
  target:
    creationPolicy: Owner   # ESO が Owner = 連動して削除される
    deletionPolicy: Delete  # ExternalSecret 削除時に Secret も削除
```

---

## よくあるアンチパターン

```
❌ Dockerfile や docker-compose.yml にシークレットをハードコード
❌ ConfigMap にパスワードを保存（Secret ではなく ConfigMap を使う誤り）
❌ Secret を Git にコミット（.gitignore で除外するだけでは不十分。履歴に残る）
❌ default ServiceAccount に secrets の get 権限を付与
❌ 環境変数でシークレットを渡す（子プロセス・ログに漏洩リスク）
❌ refreshInterval を長く設定しすぎて漏洩時のローテーションが遅くなる
```

---

## チェックリスト

```
□ etcd の at-rest encryption を有効化している（GKE: Cloud KMS 連携）
□ シークレットは GCP Secret Manager / Vault など外部に保管している
□ ESO / Vault Agent でシークレットを自動同期している
□ シークレットは環境変数ではなくボリュームマウントで渡している
□ RBAC で secrets への get を resourceNames で絞っている
□ secrets への list 権限を不必要に付与していない
□ シークレットのローテーションを自動化している
□ シークレットが Git リポジトリにコミットされていないか定期スキャンしている
□ truffleHog / detect-secrets でヒストリーを含めてスキャンしている
```

---

## 参考文献

- Kubernetes 公式ドキュメント『Secrets』（kubernetes.io）— Secret の仕様・設定方法・セキュリティの注意点
- External Secrets Operator 公式ドキュメント（external-secrets.io）— SecretStore / ExternalSecret の設定リファレンス
- HashiCorp Vault 公式ドキュメント（developer.hashicorp.com/vault）— 動的シークレット・Vault Agent の設定方法
- CIS Kubernetes Benchmark v1.8 Section 5.4（Secrets Management）— シークレット管理のチェックリスト
- Google Cloud『Using Secret Manager with GKE』（公式ドキュメント）— ESO と Workload Identity を使った GKE 向け設定ガイド
