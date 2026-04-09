---
category: "概念"
order: 207
title: コンテナ・クラウドネットワーキング詳解
description: Docker/Kubernetesのネットワークモデル・veth/bridge/VXLAN・CNI・AWSのVPC設計まで。現代インフラの必須知識。
tags: ["TCP/IP", "Docker", "Kubernetes", "VPC", "CNI", "VXLAN", "クラウド"]
emoji: "☁️"
date: "2026-04-09"
series:
  - TCPIPネットワーク
---

## なぜコンテナネットワークを理解するか

コンテナが「なぜ通信できるのか」「なぜ通信できないのか」を理解するには、Linuxのネットワーク仮想化の仕組みが必要。DockerやKubernetesは既存のLinuxカーネル機能（veth・bridge・iptables・network namespace）を組み合わせて実現されている。

```
コンテナネットワークの構成要素：
  Network Namespace → コンテナごとの独立したネットワークスタック
  veth pair         → Namespace間をつなぐ仮想ケーブル
  bridge            → コンテナ間を繋ぐ仮想スイッチ
  iptables/NAT      → コンテナ←→外部ネットワークの変換
```

---

## Linuxのネットワーク名前空間（Network Namespace）

コンテナの「ネットワーク隔離」を実現する基盤技術。

```
ホスト
├── Network Namespace: default（ホスト）
│   eth0: 192.168.1.10
│   lo:   127.0.0.1
│
├── Network Namespace: container_A
│   eth0: 172.17.0.2（コンテナ内から見えるNIC）
│   lo:   127.0.0.1
│
└── Network Namespace: container_B
    eth0: 172.17.0.3
    lo:   127.0.0.1
```

各Namespaceは独立したルーティングテーブル・iptables・インターフェースを持つ。

```bash
# Namespaceの操作（概念確認用）
ip netns add myns
ip netns exec myns ip addr show   # Namespace内でコマンド実行
ip netns list
```

---

## veth pair：Namespace間の仮想ケーブル

veth（Virtual Ethernet）は「必ず2つセットで作られる仮想NIC」。片方に入れると必ずもう片方から出てくる。

```
コンテナ Namespace         ホスト Namespace
┌────────────────┐        ┌─────────────────────┐
│  eth0          │        │  veth_A              │
│  (172.17.0.2)  │════════│  (bridgeに接続)       │
└────────────────┘        └─────────────────────┘
        ↑                          ↑
   コンテナ内から見えるNIC      ホスト側の片割れ

veth pair の作成：
ip link add veth0 type veth peer name veth1
ip link set veth1 netns container_A   ← veth1をコンテナのNSに移動
```

---

## Dockerのネットワークモード

### bridge モード（デフォルト）

```
ホスト
├── docker0 (bridge: 172.17.0.1/16)    ← 仮想スイッチ
│   ├── veth_A ←→ container_A (172.17.0.2)
│   ├── veth_B ←→ container_B (172.17.0.3)
│   └── veth_C ←→ container_C (172.17.0.4)
│
└── eth0 (192.168.1.10) ← 物理NIC

コンテナ間通信：
  container_A → docker0 bridge → container_B
  （同じbridgeに繋がっていれば直接通信可能）

コンテナ → 外部通信：
  container_A (172.17.0.2) → docker0 → iptables MASQUERADE（SNAT）→ eth0 → Internet
  
外部 → コンテナ（ポートフォワーディング）：
  -p 8080:80 → iptables DNAT: ホストの8080 → コンテナの80
```

```bash
# Dockerのiptablesルールを確認
iptables -t nat -L -n -v
# DOCKER チェーンにDNATルールが積まれている

# コンテナのネットワーク情報確認
docker inspect <container> | jq '.[0].NetworkSettings'

# Dockerネットワーク一覧
docker network ls
docker network inspect bridge
```

### host モード

コンテナがホストのNetwork Namespaceをそのまま使う。NATがなくなりパフォーマンスが上がるが隔離はない。

### none モード

ネットワークを持たないコンテナ。セキュリティが必要なバッチ処理などに使う。

---

## Kubernetesのネットワークモデル

### 3つの要件（Kubernetesの仕様）

```
1. すべてのPodはNATなしに他のすべてのPodと通信できる
2. すべてのNodeはNATなしにすべてのPodと通信できる
3. PodがPod自身のIPアドレスとして見るIPは他のPodが見るIPと同じ

→ フラットIPネットワーク（仮想的なL2/L3ネットワーク上に全Podが存在するイメージ）
```

### PodのIPとNamespaceの仕組み

```
Node
├── Podのためのbridgeネットワーク (cbr0: 10.244.0.0/24)
│   ├── veth ←→ Pod A (10.244.0.2)
│   │              └─ PauseコンテナがNetworkNSを保持
│   │                 AppコンテナはそのNSを共有
│   └── veth ←→ Pod B (10.244.0.3)
│
└── eth0 (Node IP: 192.168.1.10)
```

**Pauseコンテナ（infra container）**：PodのNetwork Namespaceの「器」。AppコンテナはこのNSを借用するため、Pod内のコンテナはlocalhostで通信できる。

### CNI（Container Network Interface）

PodのネットワークをどうセットアップするかはCNIプラグインに委譲されている。

| CNIプラグイン | 方式 | 特徴 |
|---|---|---|
| Flannel | VXLAN / host-gw | シンプル・軽量 |
| Calico | BGP / IPIP | NetworkPolicy, 高パフォーマンス |
| Cilium | eBPF | 高機能・可観測性・L7ポリシー |
| Weave | VXLAN | 自動メッシュ探索 |

### Service：PodへのL4ロードバランシング

PodのIPは再起動のたびに変わる。Serviceは安定したIPと負荷分散を提供する。

```
ClusterIP（クラスター内通信）：
  Service IP: 10.96.0.1（仮想IP、実態はiptables/eBPFルール）
  → kube-proxyがiptables DNAT/ipvsルールで実際のPod IPに転送

NodePort（外部からの接続）：
  全Nodeの特定ポート（30000〜32767）をServiceに紐付け
  → NodeのIPとポートを通じてServiceにアクセス

LoadBalancer（クラウドのLBと連携）：
  クラウドプロバイダのLBを自動プロビジョニング

kube-proxyの実装：
  iptablesモード（デフォルト）: iptables DNAT でPodへ転送
  ipvsモード: Linux IPVS（カーネルレベルLB）でより高速
  eBPFモード（Cilium）: iptablesをバイパスして最速
```

---

## オーバーレイネットワーク：VXLAN

複数Nodeをまたぐコンテナ通信は、物理ネットワークの上に仮想L2ネットワークを作る（オーバーレイ）。

```
Node A (192.168.1.10)               Node B (192.168.1.20)
┌─────────────────────┐            ┌─────────────────────┐
│  Pod A (10.244.0.2) │            │  Pod B (10.244.1.2) │
│    ↓                │            │    ↑                │
│  cbr0 bridge        │            │  cbr0 bridge        │
│    ↓                │            │    ↑                │
│  VTEP (flannel.1)   │            │  VTEP (flannel.1)   │
│  ↓ VXLAN encap      │            │  VXLAN decap ↑      │
│  eth0               │════════════│  eth0               │
│  192.168.1.10       │ 物理ネット  │  192.168.1.20       │
└─────────────────────┘            └─────────────────────┘

VXLAN カプセル化：
  元パケット: src=10.244.0.2, dst=10.244.1.2
  → UDPでラップ: src=192.168.1.10:xxxxx, dst=192.168.1.20:4789
  → 物理NICから送出
  → Node Bで受信・デカプセル → 元パケットをPod Bに転送
```

**VXLANのオーバーヘッド**：50バイト程度の追加ヘッダ。MTUを1450バイト程度に下げないとフラグメントが発生する場合がある。

---

## AWSのVPC設計

クラウドのネットワーク設計はオンプレのルーター・スイッチ・ファイアウォールをSDN（Software Defined Networking）で実現したもの。

### VPCの構成要素

```
VPC (10.0.0.0/16)
├── AZ-a
│   ├── Public Subnet (10.0.1.0/24)
│   │   └── EC2: WebServer (10.0.1.10)
│   │       ↑ Internet Gateway 経由でインターネットへ
│   └── Private Subnet (10.0.2.0/24)
│       └── EC2: AppServer (10.0.2.10)
│           ↑ NAT Gateway 経由でインターネットへ（アウトバウンドのみ）
│
└── AZ-b（同様の構成 for HA）
    ├── Public Subnet (10.0.3.0/24)
    └── Private Subnet (10.0.4.0/24)
```

### Security Group vs NACL の違い

| 項目 | Security Group | NACL |
|---|---|---|
| 適用対象 | ENI（インターフェース） | サブネット |
| ステートフル | ✓（返り通信は自動許可） | ✗（インバウンド・アウトバウンド別々に設定） |
| ルール評価 | 全ルールを評価（OR） | 番号順に評価（最初一致で終了） |
| デフォルト | 全拒否（許可ルールのみ追加） | 全許可 |
| 用途 | アプリのアクセス制御（主役） | サブネット単位の粗いブロック |

```
実践的な設計例：
  ALB Security Group:    inbound 80/443 from 0.0.0.0/0
  App Security Group:    inbound 8080 from ALB-SG のみ
  DB Security Group:     inbound 5432 from App-SG のみ

→ Security Groupを「送信元SG参照」で連鎖させると
  IPアドレスに依存せず柔軟に制御できる
```

### VPCピアリング vs Transit Gateway

```
VPCピアリング：
  2つのVPCを1対1で接続
  推移的ルーティング不可（A↔B、B↔C でも A→C は不可）

Transit Gateway：
  ハブ＆スポーク型。多数のVPCを中央TGWに接続
  VPC間・オンプレ・VPN を一元管理
  推移的ルーティング可能
```

---

## 診断コマンド：コンテナ・クラウドネットワーク

```bash
# Pod のネットワーク確認
kubectl exec -it <pod> -- ip addr
kubectl exec -it <pod> -- ip route
kubectl exec -it <pod> -- ss -tn

# Service の転送先確認
kubectl get endpoints <service>

# Pod 間疎通確認
kubectl exec -it pod-a -- ping <pod-b-ip>

# kube-proxy の iptables ルール確認
iptables -t nat -L KUBE-SERVICES -n
iptables -t nat -L KUBE-SVC-<hash> -n

# Dockerブリッジの確認
brctl show
ip link show type bridge

# veth pairの追跡（コンテナのvethがホスト側で何番か）
# コンテナ内で
cat /sys/class/net/eth0/iflink
# ホスト側で
ip link | grep <番号>
```
