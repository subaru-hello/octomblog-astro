---
title: Kubernetes NetworkPolicy
category: "概念"
emoji: "🔌"
order: 903
date: "2026-04-09"
series: [Kubernetesセキュリティ]
tags: ["セキュリティ", "Kubernetes", "NetworkPolicy", "ゼロトラスト", "マイクロセグメンテーション"]
source: "Kubernetes Documentation（kubernetes.io/docs/concepts/services-networking/network-policies）/ CIS Kubernetes Benchmark v1.8 / Cilium Documentation（docs.cilium.io）/ NCC Group『Kubernetes Security Best Practices』"
---

## デフォルトの問題：フラットなネットワーク

NetworkPolicy を設定しない場合、Kubernetes のネットワークはデフォルトで**すべての Pod 間通信を許可する**フラットな状態になる。

```
【NetworkPolicy なし】
  frontend Pod  ←→  backend Pod   ← OK
  frontend Pod  ←→  database Pod  ← OK（本来は禁止すべき）
  payment Pod   ←→  logging Pod   ← OK（本来は禁止すべき）
  侵害された Pod ←→  全 Pod       ← 横断し放題
```

1つの Pod が侵害されるとクラスタ内を自由にラテラルムーブメントされる。  
NetworkPolicy によるマイクロセグメンテーションがその防壁になる。

---

## NetworkPolicy の仕組み

### 前提：CNI プラグインのサポートが必要

NetworkPolicy は Kubernetes の仕様だが、**実際のトラフィック制御は CNI（Container Network Interface）プラグインが行う。**  
CNI によっては NetworkPolicy がサポートされていない。

| CNI プラグイン | NetworkPolicy サポート | 特記事項 |
|---|---|---|
| Calico | ✅ | L3/L4 + Calico 独自の L7 ポリシー |
| Cilium | ✅ | eBPF ベース。L7（HTTP/gRPC）まで制御可能 |
| Weave Net | ✅ | シンプルな設定 |
| Flannel | ❌ | NetworkPolicy 非対応。別途 Calico 等が必要 |
| GKE（Dataplane V2） | ✅ | Cilium ベース |

---

## NetworkPolicy の基本構造

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: my-policy
  namespace: production
spec:
  podSelector:        # ポリシーを適用する Pod を選択
    matchLabels:
      app: backend

  policyTypes:        # Ingress・Egress どちらを制御するか
  - Ingress
  - Egress

  ingress:            # 受信トラフィックのルール
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 8080

  egress:             # 送信トラフィックのルール
  - to:
    - podSelector:
        matchLabels:
          app: database
    ports:
    - protocol: TCP
      port: 5432
```

### セレクターの種類

| セレクター | 用途 |
|---|---|
| `podSelector` | 同一 Namespace 内の Pod を選択 |
| `namespaceSelector` | 特定の Namespace を選択 |
| `ipBlock` | CIDR 範囲で外部 IP を選択 |

---

## デフォルト拒否ポリシー（最重要）

**まず全通信を拒否し、必要なものだけ許可する。** ゼロトラストの実装。

```yaml
# Ingress のデフォルト拒否
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: production
spec:
  podSelector: {}      # 全 Pod に適用
  policyTypes:
  - Ingress
  # ingress ルールなし = 全受信を拒否

---
# Egress のデフォルト拒否
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-egress
  namespace: production
spec:
  podSelector: {}
  policyTypes:
  - Egress
  # egress ルールなし = 全送信を拒否
```

**適用順序：**
```
① default-deny-ingress / default-deny-egress を先に適用
② 必要な通信を個別のポリシーで許可していく
```

---

## 実践的なポリシー設計

### 3層アーキテクチャの通信制御

```
インターネット → [frontend] → [backend] → [database]
```

```yaml
# frontend: インターネットからの 80/443 受信のみ許可
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: frontend-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: frontend
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - ports:                  # 送信元は制限しない（インターネット公開）
    - protocol: TCP
      port: 80
    - protocol: TCP
      port: 443
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: backend      # backend へのみ送信可
    ports:
    - protocol: TCP
      port: 8080
  - to:                     # DNS 解決を許可（これがないと名前解決できない）
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53

---
# backend: frontend からの受信と database への送信のみ許可
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: database
    ports:
    - protocol: TCP
      port: 5432
  - to:                     # DNS 解決
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53

---
# database: backend からの受信のみ許可。Egress は DNS のみ
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: database-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: database
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: backend
    ports:
    - protocol: TCP
      port: 5432
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53
```

### Namespace をまたぐ通信制御

```yaml
# monitoring Namespace の Prometheus が production の metrics を取得する
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-prometheus-scrape
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:           # monitoring Namespace からのみ
        matchLabels:
          kubernetes.io/metadata.name: monitoring
      podSelector:                 # かつ prometheus Pod からのみ（AND 条件）
        matchLabels:
          app: prometheus
    ports:
    - protocol: TCP
      port: 9090
```

**重要: `namespaceSelector` と `podSelector` を同じ `from` エントリに書くと AND 条件になる。**  
別々の `from` エントリに書くと OR 条件になる。

```yaml
# AND（同じ from エントリ）: monitoring Namespace の prometheus Pod のみ
ingress:
- from:
  - namespaceSelector:
      matchLabels:
        name: monitoring
    podSelector:
      matchLabels:
        app: prometheus

# OR（別々の from エントリ）: monitoring Namespace 全体 OR どこかの prometheus Pod
ingress:
- from:
  - namespaceSelector:
      matchLabels:
        name: monitoring
  - podSelector:
      matchLabels:
        app: prometheus
```

---

## 外部通信の制御（ipBlock）

```yaml
# 特定の外部 API（Stripe 等）へのみ Egress を許可
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: payment-egress
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: payment
  policyTypes:
  - Egress
  egress:
  - to:
    - ipBlock:
        cidr: 54.187.174.169/32    # Stripe の IP（例）
    ports:
    - protocol: TCP
      port: 443
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0            # インターネット全体を許可しつつ
        except:
        - 10.0.0.0/8               # 内部ネットワークへはブロック
        - 172.16.0.0/12
        - 192.168.0.0/16
```

---

## Cilium を使った L7 ポリシー

標準の NetworkPolicy は L4（IP・ポート）まで制御できる。  
**Cilium** の CiliumNetworkPolicy を使うと **L7（HTTP メソッド・パス・gRPC メソッド）**まで制御できる。

```yaml
# HTTP の GET /api/v1/orders のみ許可（POST・DELETE はブロック）
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: l7-policy
  namespace: production
spec:
  endpointSelector:
    matchLabels:
      app: order-service
  ingress:
  - fromEndpoints:
    - matchLabels:
        app: frontend
    toPorts:
    - ports:
      - port: "8080"
        protocol: TCP
      rules:
        http:
        - method: "GET"
          path: "/api/v1/orders"
        - method: "POST"
          path: "/api/v1/orders"
```

---

## GKE での NetworkPolicy 有効化

GKE では NetworkPolicy と Dataplane V2 の2つのオプションがある。

```hcl
# Terraform での設定
resource "google_container_cluster" "main" {
  # ...

  # オプション1: 標準 NetworkPolicy（Calico ベース）
  network_policy {
    enabled  = true
    provider = "CALICO"
  }

  # オプション2: Dataplane V2（Cilium ベース）。より高機能
  datapath_provider = "ADVANCED_DATAPATH"
  # Dataplane V2 を使う場合は network_policy は設定不要
}
```

---

## NetworkPolicy のテスト・デバッグ

```bash
# netshoot: ネットワーク診断用コンテナを一時起動して疎通確認
kubectl run netshoot --rm -it \
  --image=nicolaka/netshoot \
  --namespace=production \
  -- /bin/bash

# Pod 内から別 Pod への疎通テスト
curl http://backend-service:8080/health
nc -zv database-service 5432

# NetworkPolicy が適用されているか確認
kubectl get networkpolicy -n production
kubectl describe networkpolicy backend-policy -n production

# Cilium の場合: ポリシーの有効性を確認
cilium policy get
cilium monitor --type drop    # ドロップされたパケットをリアルタイム監視
```

---

## Terraform で NetworkPolicy を管理

```hcl
resource "kubernetes_network_policy" "default_deny_ingress" {
  metadata {
    name      = "default-deny-ingress"
    namespace = "production"
  }
  spec {
    pod_selector {}    # 全 Pod
    policy_types = ["Ingress"]
  }
}

resource "kubernetes_network_policy" "backend_policy" {
  metadata {
    name      = "backend-policy"
    namespace = "production"
  }
  spec {
    pod_selector {
      match_labels = { app = "backend" }
    }
    policy_types = ["Ingress", "Egress"]
    ingress {
      from {
        pod_selector {
          match_labels = { app = "frontend" }
        }
      }
      ports {
        protocol = "TCP"
        port     = "8080"
      }
    }
    egress {
      to {
        pod_selector {
          match_labels = { app = "database" }
        }
      }
      ports {
        protocol = "TCP"
        port     = "5432"
      }
    }
  }
}
```

---

## チェックリスト

```
□ 全 Namespace に default-deny-ingress / default-deny-egress を適用している
□ 許可する通信を最小限の個別ポリシーで定義している
□ Egress に DNS（UDP/TCP 53）の許可を忘れていない
□ namespaceSelector + podSelector の AND/OR 条件を正しく理解して設定している
□ 使用する CNI が NetworkPolicy をサポートしている（Flannel 単体は非対応）
□ ipBlock で外部通信先を制限している（必要な外部サービスのみ許可）
□ NetworkPolicy の設定を Terraform / GitOps で管理している
□ デプロイ後に netshoot 等で疎通確認をしている
□ L7 制御が必要な場合は Cilium CiliumNetworkPolicy を検討している
```

---

## 参考文献

- Kubernetes 公式ドキュメント『Network Policies』（kubernetes.io）— NetworkPolicy の仕様と設定例
- Cilium 公式ドキュメント『Network Policy』（docs.cilium.io）— L7 ポリシーの設定方法と eBPF の仕組み
- CIS Kubernetes Benchmark v1.8 Section 5.3（Network Policies and CNI）— NetworkPolicy に関するチェックリスト
- NCC Group『Kubernetes Security Best Practices』（2021, 無料公開）— マイクロセグメンテーションの設計指針
