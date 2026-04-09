---
title: Pod Security・SecurityContext
category: "概念"
emoji: "🛡️"
order: 902
date: "2026-04-09"
series: [Kubernetesセキュリティ]
tags: ["セキュリティ", "Kubernetes", "Pod Security", "SecurityContext", "コンテナエスケープ"]
source: "Kubernetes Documentation（kubernetes.io/docs/concepts/security/pod-security-standards）/ CIS Kubernetes Benchmark v1.8 / Liz Rice『Container Security』（O'Reilly, 2020）/ NCC Group『Understanding and Hardening Linux Containers』（2016）"
---

## なぜ Pod のセキュリティ設定が重要か

コンテナはホスト OS のカーネルを共有する。  
Pod のセキュリティ設定が不十分だと、アプリの脆弱性→コンテナ内コード実行→ホストへの脱出（コンテナエスケープ）という経路でノード全体が侵害される。

```
【コンテナエスケープの主な経路】
  privileged: true      → ホストデバイスへのフルアクセス
  hostPID: true         → ホストのプロセス空間を参照・操作
  hostNetwork: true     → ホストのネットワークスタックを使用
  hostPath マウント     → ホストファイルシステムへの書き込み
  root（UID 0）実行     → カーネル脆弱性悪用時の影響が最大化
```

---

## Pod Security Standards（PSS）

Kubernetes 1.25 で GA になった、クラスタ全体のセキュリティポリシーを Namespace 単位で強制する仕組み。  
（廃止された PodSecurityPolicy の後継）

### 3つのレベル

| レベル | 用途 | 制限内容 |
|---|---|---|
| **Privileged** | システム・インフラ用途のみ | 制限なし |
| **Baseline** | 一般的なアプリケーション | 明らかに危険な設定をブロック |
| **Restricted** | セキュリティ重視の本番環境 | ベストプラクティスを強制 |

### Namespace へのラベル付けで有効化

```yaml
# Namespace にラベルを付けるだけで適用できる
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    # enforce: ポリシー違反の Pod を拒否（本番）
    pod-security.kubernetes.io/enforce: restricted

    # warn: 違反を警告するが拒否しない（移行期間中）
    pod-security.kubernetes.io/warn: restricted

    # audit: 監査ログに記録するが拒否しない（現状把握）
    pod-security.kubernetes.io/audit: restricted
```

**段階的移行の戦略:**
```
Step 1: audit モードで現状の違反を洗い出す
Step 2: warn モードで開発者に気づかせる
Step 3: enforce モードで強制する
```

---

## SecurityContext

Pod・コンテナ単位でセキュリティ設定を細かく制御するフィールド。  
PSS の強制に加えて、SecurityContext で個別の設定を行う。

### Pod レベルと Container レベルの違い

```yaml
spec:
  securityContext:          # Pod レベル（全コンテナに適用）
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 3000
    fsGroup: 2000           # ボリュームのグループ所有者
    seccompProfile:
      type: RuntimeDefault  # seccomp プロファイルを有効化

  containers:
  - name: app
    securityContext:        # Container レベル（このコンテナだけに適用）
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop: ["ALL"]       # 全 Linux ケーパビリティを削除
        add: ["NET_BIND_SERVICE"]  # 必要なものだけ追加
```

---

## 重要な SecurityContext フィールド

### runAsNonRoot / runAsUser

```yaml
securityContext:
  runAsNonRoot: true   # root（UID 0）での実行を禁止
  runAsUser: 1000      # 実行ユーザーの UID を指定
  runAsGroup: 3000     # 実行グループの GID を指定
```

root で動くコンテナがカーネル脆弱性を突かれた場合、ホストへのフルアクセスにつながる。  
**すべての本番コンテナは非 root で実行するのが原則。**

Dockerfile 側でも対応が必要：

```dockerfile
FROM gcr.io/distroless/java17

# 非 root ユーザーを作成
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

# 必要なファイルをコピーしてから権限を変更
COPY --chown=appuser:appgroup app.jar /app/app.jar

# 非 root ユーザーに切り替え
USER appuser

CMD ["java", "-jar", "/app/app.jar"]
```

### allowPrivilegeEscalation

```yaml
securityContext:
  allowPrivilegeEscalation: false
```

`sudo` や `setuid` バイナリ経由での権限昇格を禁止する。  
`runAsNonRoot: true` でも、この設定がないと SUID バイナリで root に昇格できる場合がある。

### readOnlyRootFilesystem

```yaml
securityContext:
  readOnlyRootFilesystem: true
```

コンテナのルートファイルシステムを読み取り専用にする。  
マルウェアがファイルを書き込んでパーシステンスを確立することを防ぐ。

書き込みが必要な場合は emptyDir を明示的にマウントする：

```yaml
securityContext:
  readOnlyRootFilesystem: true
volumeMounts:
- name: tmp
  mountPath: /tmp            # 一時書き込みだけ許可
- name: cache
  mountPath: /app/cache
volumes:
- name: tmp
  emptyDir: {}
- name: cache
  emptyDir: {}
```

### Linux Capabilities

root 権限を細分化したもの。必要な権限だけを付与する。

```yaml
securityContext:
  capabilities:
    drop: ["ALL"]                 # まずすべて削除
    add: ["NET_BIND_SERVICE"]     # 80/443 番ポートのバインドだけ追加
```

| capability | 意味 | 危険度 |
|---|---|---|
| `NET_ADMIN` | ネットワーク設定の変更 | 高 |
| `SYS_ADMIN` | ほぼ root 相当の汎用権限 | 非常に高（使用禁止推奨）|
| `SYS_PTRACE` | プロセスのデバッグ・トレース | 高 |
| `NET_BIND_SERVICE` | 1024 以下のポートをバインド | 低（一般的な用途で使用可）|
| `CHOWN` | ファイル所有者の変更 | 中 |

### seccomp プロファイル

コンテナが呼び出せるシステムコールを制限する。  
攻撃者がコンテナ内でコードを実行しても、危険なシステムコールを呼べなくする。

```yaml
securityContext:
  seccompProfile:
    type: RuntimeDefault    # コンテナランタイムのデフォルトプロファイルを使用
    # type: Localhost       # カスタムプロファイルをノードから読み込む場合
    # localhostProfile: profiles/my-profile.json
```

---

## 完全な Restricted レベルの Pod 設定例

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
  namespace: production
spec:
  serviceAccountName: order-service-sa
  automountServiceAccountToken: false

  # Pod レベルのセキュリティ設定
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 3000
    fsGroup: 2000
    seccompProfile:
      type: RuntimeDefault

  containers:
  - name: app
    image: my-app:v1.2.3@sha256:abc123...   # ダイジェスト指定（タグは可変なため）
    
    # Container レベルのセキュリティ設定
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop: ["ALL"]

    # リソース制限（DoS 対策・ノード保護）
    resources:
      requests:
        cpu: "100m"
        memory: "128Mi"
      limits:
        cpu: "500m"
        memory: "256Mi"

    # 書き込みが必要なパスのみ emptyDir でマウント
    volumeMounts:
    - name: tmp
      mountPath: /tmp

  volumes:
  - name: tmp
    emptyDir: {}
```

---

## リソース制限（Resource Limits）

**設定しないとノード全体のリソースを使い果たす DoS リスクがある。**  
また、Requests がない Pod は適切なノードにスケジュールされない。

```yaml
resources:
  requests:      # スケジューリングの基準値（最低保証）
    cpu: "100m"  # 0.1 vCPU
    memory: "128Mi"
  limits:        # 上限値。超えると CPU スロットリング / OOM Kill
    cpu: "500m"
    memory: "256Mi"
```

### LimitRange で Namespace のデフォルト値を設定

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: production
spec:
  limits:
  - type: Container
    default:          # limits のデフォルト値
      cpu: "500m"
      memory: "256Mi"
    defaultRequest:   # requests のデフォルト値
      cpu: "100m"
      memory: "128Mi"
    max:              # 個別コンテナが設定できる上限
      cpu: "2"
      memory: "1Gi"
```

---

## Admission Controller による強制

PSS だけでは細かいポリシーを表現しきれない場合、  
**OPA Gatekeeper** または **Kyverno** でカスタムポリシーを作成する。

### Kyverno でルート実行を禁止する例

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-non-root
spec:
  validationFailureAction: Enforce   # 違反時に拒否
  rules:
  - name: check-run-as-non-root
    match:
      any:
      - resources:
          kinds: ["Pod"]
    validate:
      message: "Pod は非 root ユーザーで実行しなければなりません"
      pattern:
        spec:
          securityContext:
            runAsNonRoot: true
          containers:
          - securityContext:
              allowPrivilegeEscalation: false
```

### OPA Gatekeeper でイメージレジストリを制限する例

```yaml
# 承認済みのレジストリからのイメージのみ許可
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sAllowedRepos
metadata:
  name: allowed-repos
spec:
  match:
    kinds:
    - apiGroups: [""]
      kinds: ["Pod"]
  parameters:
    repos:
    - "asia-northeast1-docker.pkg.dev/my-project/"
    - "gcr.io/distroless/"
```

---

## チェックリスト

```
□ runAsNonRoot: true を全 Pod に設定している
□ allowPrivilegeEscalation: false を全コンテナに設定している
□ readOnlyRootFilesystem: true を設定し、書き込みは emptyDir に限定している
□ capabilities: drop: ["ALL"] を設定し、必要なものだけ add している
□ privileged: true を使用していない（使う場合は理由と承認が必要）
□ hostPID / hostNetwork / hostIPC を使用していない
□ seccompProfile を設定している
□ リソースの requests と limits を全コンテナに設定している
□ LimitRange で Namespace のデフォルト値を設定している
□ Namespace に PSS ラベル（restricted）を設定している
□ Admission Controller（Kyverno / Gatekeeper）でポリシーを強制している
□ イメージはタグではなくダイジェスト（sha256）で指定している
```

---

## 参考文献

- Kubernetes 公式ドキュメント『Pod Security Standards』（kubernetes.io）— PSS の3レベルと Namespace ラベルの設定方法
- Liz Rice『Container Security』（O'Reilly, 2020）— Linux ケーパビリティ・seccomp・namespace の仕組みを詳しく解説
- NCC Group『Understanding and Hardening Linux Containers』（2016, 無料公開）— コンテナセキュリティの技術的背景の定番文書
- CIS Kubernetes Benchmark v1.8 Section 5.2（Pod Security Policies）— PSS に関するチェックリスト
- Kyverno 公式ドキュメント（kyverno.io）— ClusterPolicy の設定例と Pod セキュリティのベストプラクティス集
