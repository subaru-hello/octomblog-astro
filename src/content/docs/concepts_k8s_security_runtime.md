---
title: Kubernetes ランタイムセキュリティ（Falco・eBPF）
category: "概念"
emoji: "👁️"
order: 906
date: "2026-04-09"
series: [Kubernetesセキュリティ]
tags: ["セキュリティ", "Kubernetes", "Falco", "eBPF", "ランタイム検知", "SIEM"]
source: "Falco 公式ドキュメント（falco.org）/ Brendan Gregg『BPF Performance Tools』（Addison-Wesley, 2019）/ Sysdig『Falco: Cloud-Native Runtime Security』（2023）/ Cilium eBPF Documentation（docs.cilium.io）"
---

## ランタイムセキュリティとは

**コンテナが実際に動いている最中の不審な挙動をリアルタイムで検知する。**

予防的なセキュリティ（イメージスキャン・RBAC・NetworkPolicy）は「既知の問題を事前に防ぐ」。  
ランタイムセキュリティは「**侵入されたときにいち早く気づく**」ための検知層。  
Assume Breach の思想を実装する最後の砦。

```
【予防層だけでは不十分な理由】
  ・ゼロデイ脆弱性はスキャンで検出できない
  ・正規の認証情報で侵入した場合は認可チェックを通過する
  ・内部からの攻撃（Insider Threat）は境界防御で止まらない

【ランタイム検知が補完するもの】
  「予防をすり抜けた攻撃者の行動」をシステムコールレベルで監視する
```

---

## eBPF（extended Berkeley Packet Filter）

**Linux カーネル内で安全にプログラムを実行するサンドボックス技術。**  
カーネルモジュールのようにカーネルに組み込まれるが、安全性の検証（Verifier）を経るため安全。

```
【従来のカーネルモジュール】
  カーネルに直接組み込み → クラッシュリスク・セキュリティリスクが高い

【eBPF】
  カーネル内 Verifier が安全性を確認してから実行
  → カーネルの任意のフックポイントにアタッチ可能
  → システムコール・ネットワーク・ファイルアクセスをゼロオーバーヘッドで観察
```

### セキュリティでの eBPF の活用

| 用途 | 説明 |
|---|---|
| システムコール監視 | コンテナが呼び出す全 syscall を観察（Falco）|
| ネットワーク制御 | L4/L7 のトラフィックをカーネルレベルでフィルタ（Cilium）|
| プロファイリング | CPU・メモリ・I/O の詳細計測（bpftrace）|
| コンテナエスケープ検知 | namespace 脱出・privileged 操作の即時検知 |

---

## Falco

**CNCF 卒業プロジェクト。eBPF を使ったコンテナ・Kubernetes のランタイム脅威検知エンジン。**

```
システムコール（syscall）
    ↓
eBPF プローブ（カーネル内でイベントを捕捉）
    ↓
Falco エンジン（ルールとマッチング）
    ↓
アラート（stdout / Slack / Falcosidekick 経由で SIEM / PagerDuty 等）
```

### インストール

```bash
# Helm でインストール（DaemonSet として全ノードに配置）
helm repo add falcosecurity https://falcosecurity.github.io/charts
helm install falco falcosecurity/falco \
  --namespace falco \
  --create-namespace \
  --set driver.kind=ebpf \           # eBPF ドライバを使用（カーネルモジュール不要）
  --set falcosidekick.enabled=true \ # アラート転送
  --set falcosidekick.config.slack.webhookurl=$SLACK_WEBHOOK
```

---

## Falco ルールの構造

```yaml
# rules/custom_rules.yaml

- rule: Terminal Shell in Container
  desc: コンテナ内でシェルが起動された（侵入後の操作に多用される）
  condition: >
    spawned_process
    and container
    and shell_procs                    # bash / sh / zsh 等
    and not proc.pname in (shell_binaries)
  output: >
    Shell spawned in container
    (user=%user.name container=%container.name
     image=%container.image.repository
     cmd=%proc.cmdline)
  priority: WARNING
  tags: [container, shell, mitre_execution]
```

### ルールの構成要素

| 要素 | 説明 |
|---|---|
| `condition` | Falco フィルタ言語で記述するイベントの条件 |
| `output` | アラートに含めるフィールド（コンテナ名・イメージ・コマンド等）|
| `priority` | EMERGENCY / ALERT / CRITICAL / ERROR / WARNING / NOTICE / INFO / DEBUG |
| `tags` | MITRE ATT&CK タグなどでの分類 |

---

## 重要なデフォルトルール

Falco は豊富なデフォルトルールを持つ。代表的なものを把握しておく。

### コンテナ内のシェル実行

```yaml
- rule: Terminal Shell in Container
  condition: spawned_process and container and shell_procs and terminal.is_interactive
  priority: NOTICE
  # 侵入後の攻撃者が最初に取る行動。本番環境では発生しないはず
```

### 機密ファイルへのアクセス

```yaml
- rule: Read sensitive file untrusted
  condition: >
    open_read
    and sensitive_files            # /etc/shadow, /etc/passwd 等
    and not proc.name in (trusted_binaries)
  priority: WARNING
  # パスワードファイルや SSH 鍵の読み取りを検知
```

### コンテナエスケープの試み

```yaml
- rule: Privileged Container Launched
  condition: container and container.privileged = true
  priority: INFO

- rule: Mount Sensitive Host Paths
  condition: >
    container
    and mount
    and (evt.arg.target startswith /proc
         or evt.arg.target startswith /sys
         or evt.arg.target = /)
  priority: ERROR
  # ホストの /proc・/sys・/ をマウントしようとする試み
```

### 外部への不審な通信

```yaml
- rule: Unexpected Outbound Connection
  condition: >
    outbound
    and container
    and not fd.sport in (allowed_outbound_ports)
    and not proc.name in (allowed_outbound_binaries)
  priority: NOTICE
  # 想定外のポートへの送信通信（C2 通信の可能性）
```

---

## カスタムルールの実装例

### ランサムウェアの挙動を検知

```yaml
- rule: Mass File Encryption Activity
  desc: 大量のファイルが短時間で書き換えられた（ランサムウェアの兆候）
  condition: >
    open_write
    and container
    and fd.name endswith ".encrypted"
  output: >
    Possible ransomware activity detected
    (file=%fd.name container=%container.name
     image=%container.image.repository)
  priority: CRITICAL
  tags: [ransomware, mitre_impact]

---
- rule: Shadow Copy Deletion
  desc: VSS シャドウコピーの削除（ランサムウェアが復旧を妨げるために行う）
  condition: >
    spawned_process
    and proc.name = "vssadmin"
    and proc.args contains "delete shadows"
  priority: CRITICAL
```

### Kubernetes API への不審なアクセス

```yaml
- rule: K8s Secret Accessed via API
  desc: コンテナ内から Kubernetes API 経由で Secret を取得
  condition: >
    spawned_process
    and container
    and proc.name = "curl"
    and proc.args contains "secrets"
    and proc.args contains "kubernetes.default"
  output: >
    Kubernetes Secret accessed from container
    (cmd=%proc.cmdline container=%container.name)
  priority: HIGH
  # 侵害されたコンテナが SA トークンを使って Secret を窃取しようとする挙動
```

---

## Falcosidekick によるアラートの転送

Falcosidekick は Falco のアラートを様々な出力先に転送するミドルウェア。

```yaml
# falcosidekick の設定（values.yaml）
falcosidekick:
  enabled: true
  config:
    slack:
      webhookurl: https://hooks.slack.com/...
      minimumpriority: WARNING      # WARNING 以上を Slack に通知

    elasticsearch:
      hostport: http://elasticsearch:9200
      index: falco-events
      minimumpriority: DEBUG        # 全イベントを Elasticsearch に保存

    pagerduty:
      routingkey: <PagerDuty routing key>
      minimumpriority: CRITICAL     # CRITICAL のみ PagerDuty でオンコール

    gcp:
      pubsub:
        projectid: my-project
        topic: falco-alerts         # GCP Pub/Sub 経由で Cloud SIEM に転送
```

---

## MITRE ATT&CK との対応

Falco のルールには MITRE ATT&CK のタグが付与されており、  
検知したイベントを ATT&CK の戦術・技術に対応させることができる。

| Falco ルール | ATT&CK 技術 |
|---|---|
| Terminal Shell in Container | T1059（Command and Scripting Interpreter）|
| Read sensitive file | T1003（OS Credential Dumping）|
| Outbound Connection to C2 | T1071（Application Layer Protocol）|
| Privilege Escalation via Sudo | T1548（Abuse Elevation Control Mechanism）|
| Container Escape via Privileged | T1611（Escape to Host）|

```yaml
# タグを付与してルールと ATT&CK を紐づける
- rule: Sensitive File Read
  condition: open_read and sensitive_files
  priority: WARNING
  tags:
  - container
  - mitre_credential_access    # TA0006
  - T1003                      # OS Credential Dumping
```

---

## GKE での Falco 運用

```bash
# GKE の場合、Falco は DaemonSet として各ノードに配置
# eBPF ドライバは GKE のカーネルバージョンに対応している

# Workload Identity を使った GCP Pub/Sub への転送
kubectl annotate serviceaccount falco \
  --namespace falco \
  iam.gke.io/gcp-service-account=falco-sa@project.iam.gserviceaccount.com
```

---

## ランタイムセキュリティの限界と補完

```
Falco が検知できること:
  ✅ syscall レベルの不審な操作
  ✅ ファイル・ネットワーク・プロセスの異常な挙動
  ✅ コンテナエスケープの試み
  ✅ 既知の攻撃パターン

Falco だけでは不十分な領域:
  ❌ 暗号化された通信の中身（TLS インスペクションは別途必要）
  ❌ 正規ツールを使った LOLBins（Living-off-the-Land）攻撃の全パターン
  ❌ アプリケーションレイヤーのロジック異常
  ❌ 長期潜伏（ゆっくりとした異常は閾値を超えない）

補完する仕組み:
  ・SIEM（Falco ログを相関分析）
  ・Threat Hunting（定期的な能動的調査）
  ・Network 監視（Cilium Hubble でフロー可視化）
```

---

## Cilium Hubble によるネットワーク観測

Cilium と組み合わせて使う eBPF ベースのネットワーク可視化ツール。

```bash
# Hubble UI を起動してネットワークフローを可視化
cilium hubble ui

# CLI でリアルタイムのフローを確認
hubble observe --namespace production --follow

# ドロップされたパケットを確認
hubble observe --verdict DROPPED --namespace production

# サービス間の通信マップを確認
hubble observe --output json | jq '.flow | {src: .source.labels, dst: .destination.labels, verdict: .verdict}'
```

---

## チェックリスト

```
□ Falco を DaemonSet として全ノードに配置している
□ eBPF ドライバを使用している（カーネルモジュールより安全・安定）
□ Falcosidekick で CRITICAL アラートを PagerDuty / Slack に転送している
□ 全イベントを Elasticsearch / SIEM に保存して相関分析できる状態にしている
□ デフォルトルールに加えてサービス固有のカスタムルールを追加している
□ ルールの優先度を適切に設定し、アラート疲れを防いでいる
□ Falco のルールを定期的に見直し、誤検知（false positive）を減らしている
□ MITRE ATT&CK タグでルールを分類し、SOC の分析に活用できる状態にしている
□ Cilium Hubble でネットワークフローを可視化している（Cilium を使う場合）
□ Falco アラートへの対応 Playbook を用意している
```

---

## 参考文献

- Falco 公式ドキュメント（falco.org）— ルールの仕様・インストール・Falcosidekick の設定
- Sysdig『Falco: Cloud-Native Runtime Security』（2023, 無料公開）— Falco の設計思想と実装の詳細
- Brendan Gregg『BPF Performance Tools』（Addison-Wesley, 2019）— eBPF の仕組みと bpftrace の使い方の決定版
- Cilium eBPF Documentation（docs.cilium.io）— Hubble によるネットワーク観測と eBPF ネットワーキング
- Liz Rice『Learning eBPF』（O'Reilly, 2023）— eBPF の入門書。カーネルレベルの仕組みをコード例で解説
