---
title: ネットワークセキュリティ
category: "概念"
emoji: "🌐"
order: 806
date: "2026-04-08"
series: [セキュリティ]
tags: ["セキュリティ", "ネットワーク", "Firewall", "WAF", "IDS", "IPS", "VPN", "ゼロトラスト"]
source: "Network Security Essentials（William Stallings, 2022）/ The Practice of Network Security Monitoring（Richard Bejtlich, 2013）/ NIST SP 800-41（Guidelines on Firewalls）/ Cloud Security Alliance（CSA）ガイドライン"
---

## ネットワークセキュリティの目的

ネットワークセキュリティは「**通信経路そのものを保護する**」領域。

アプリケーションがどれほど安全でも、通信経路が無防備なら盗聴・改ざん・なりすましが可能になる。  
また、境界防御だけに頼ると内部からの攻撃やラテラルムーブメントを防げない。

---

## ネットワーク分離の基本概念

### DMZ（非武装地帯）

インターネットと内部ネットワークの間に置く中間ゾーン。  
公開サーバー（Webサーバー・メールサーバー）をDMZに配置し、内部ネットワークへの直接アクセスを遮断する。

```
インターネット
    │
  外部Firewall
    │
  DMZ（Webサーバー・リバースプロキシ）
    │
  内部Firewall
    │
  内部ネットワーク（DBサーバー・業務システム）
```

### マイクロセグメンテーション

DMZ のような粗い分割ではなく、**ワークロード単位で細かくセグメントを分割**する手法。  
ゼロトラストネットワークの実装手段として使われる。

```
【従来の境界防御】
外部 ─[Firewall]─ 内部（フラットなネットワーク）
→ 1台侵害されると内部を自由に横断できる

【マイクロセグメンテーション】
外部 ─[Firewall]─ [Zone A] ─[ポリシー]─ [Zone B] ─[ポリシー]─ [Zone C]
→ 1台侵害されても横断（ラテラルムーブメント）を抑制できる
```

---

## ファイアウォール（Firewall）

**ネットワークトラフィックをルールに基づいてフィルタリングする装置・ソフトウェア。**

### 種類と比較

| 種類 | フィルタリング対象 | 特徴 |
|---|---|---|
| パケットフィルタリング | IPアドレス・ポート・プロトコル | 高速・シンプル。アプリ層は見えない |
| ステートフルインスペクション | 通信セッションの状態 | 確立済みセッションのみ許可。現在の主流 |
| 次世代Firewall（NGFW） | アプリケーション識別・IPS統合 | DPI（Deep Packet Inspection）でアプリ層まで検査 |
| Webアプリケーションファイアウォール（WAF） | HTTP/HTTPSの内容 | OWASP攻撃（XSS・SQLi等）をアプリ層で検出 |

### デフォルト拒否の原則

```
# 危険: すべて許可してから、危険なものを拒否
Allow ALL → Deny known-bad

# 安全: すべて拒否してから、必要なものだけ許可
Deny ALL → Allow known-good（ホワイトリスト方式）
```

---

## WAF（Web Application Firewall）

**HTTPリクエスト・レスポンスを検査し、Webアプリケーション固有の攻撃をブロックする。**

### 検知モード

| モード | 動作 |
|---|---|
| 検知モード（Detection） | 攻撃を検知してもブロックせず、ログのみ記録。導入初期に使用 |
| 防御モード（Prevention） | 攻撃を検知したらリクエストをブロック |

### WAFの限界

WAFは補助的な防御層であり、**安全なコーディングの代替にはならない**。  
WAFのルールはバイパス可能なケースがあるため、Defense in Depth の1層として位置づける。

---

## IDS / IPS

| 種類 | 意味 | 動作 |
|---|---|---|
| IDS（Intrusion Detection System） | 侵入検知システム | 不正を検知してアラート。トラフィックには介入しない |
| IPS（Intrusion Prevention System） | 侵入防止システム | 不正を検知したら自動でブロック |

### 検知方式

| 方式 | 仕組み | 特徴 |
|---|---|---|
| シグネチャベース | 既知の攻撃パターンと照合 | 誤検知が少ない。ゼロデイ攻撃は検知できない |
| アノマリベース | 正常な通信の基準値から逸脱を検知 | 未知の攻撃を検知できる。誤検知が多い |
| ハイブリッド | 両方を組み合わせ | 現在の主流 |

---

## VPN（Virtual Private Network）

**パブリックネットワーク上に暗号化された仮想的な専用回線を作る技術。**

### 主要プロトコル

| プロトコル | 特徴 |
|---|---|
| IPsec | トンネルモードでIP層を暗号化。サイト間VPNで広く使用 |
| TLS/SSL VPN | HTTPS上で動作。ファイアウォールを通りやすい |
| WireGuard | 新世代。シンプル・高速・最新暗号（ChaCha20・X25519）を使用 |
| OpenVPN | オープンソース。TLS/SSL ベース。設定の柔軟性が高い |

### Split Tunneling の注意点

```
【Full Tunnel】
すべての通信をVPN経由 → 企業のセキュリティポリシーが適用される

【Split Tunnel】
社内リソースのみVPN経由、インターネットは直接通信
→ 攻撃者が端末を経由してVPN内部に侵入できるリスクがある
```

---

## DNS セキュリティ

DNSは攻撃の経路として頻繁に悪用される。

### 主要な攻撃と対策

| 攻撃 | 仕組み | 対策 |
|---|---|---|
| DNS キャッシュポイズニング | 偽のDNSレコードをキャッシュに注入 | DNSSEC（レコードに署名） |
| DNS スプーフィング | DNSレスポンスを偽装してフィッシングサイトへ誘導 | DNSSEC, 暗号化DNS |
| DNS トンネリング | DNSクエリにデータを埋め込んでファイアウォールを回避 | DNS通信の監視・異常検知 |
| DNS ハイジャック | DNSサーバー自体を乗っ取る | DNSサーバーへのアクセス制御 |

### 暗号化DNS

| 規格 | 説明 |
|---|---|
| DoT（DNS over TLS） | DNSクエリをTLSで暗号化（ポート853） |
| DoH（DNS over HTTPS） | DNSクエリをHTTPS上で送信。ファイアウォールに見えにくい |

---

## 主要なネットワーク攻撃

### MITM（Man-in-the-Middle）攻撃

```
正常: Client ──────────────────── Server
MITM: Client ── 攻撃者（傍受・改ざん） ── Server

攻撃手法:
  - ARP ポイズニング（ローカルネットワーク内）
  - 偽のWi-Fiアクセスポイント
  - SSL ストリッピング（HTTPSをHTTPに降格）

対策:
  - TLS（証明書ピンニングで強化）
  - HSTS（HTTP Strict Transport Security）
```

### DDoS（Distributed Denial of Service）

大量のトラフィックをターゲットに送りつけてサービスを停止させる攻撃。

| 種類 | 仕組み |
|---|---|
| ボリューム型 | 大量パケットで帯域を枯渇（UDP Flood等） |
| プロトコル型 | TCP SYN Flood でサーバーリソースを枯渇 |
| アプリ層型（L7） | HTTP GETを大量送信。少ないトラフィックで効果大 |

対策：CDN（Cloudflare等）によるスクラビング、レートリミット、エニーキャストルーティング。

### ラテラルムーブメント（横断的移動）

侵入後に攻撃者が**内部ネットワーク内を横断して被害を拡大**する行為。

```
初期侵害（1台） ──▶ 認証情報の窃取 ──▶ 他システムへの侵入 ──▶ 高価値ターゲット（DC等）
```

対策：マイクロセグメンテーション、最小権限、異常な内部通信の検知（East-West トラフィック監視）。

---

## ネットワーク監視

### East-West vs North-South トラフィック

```
North-South: 外部 ↕ 内部（従来のFWが監視）
East-West:   内部 ↔ 内部（従来は見えていた盲点）
```

ゼロトラストとマイクロセグメンテーションにより、East-Westの監視が重要になった。

### フローデータ（NetFlow/sFlow）

パケット全体を保存せず、通信の「フローメタデータ」（送信元IP・宛先IP・ポート・通信量）を収集する。  
SIEMと組み合わせてベースラインから逸脱した通信を検知するのに使う。

---

## ゼロトラストネットワークアクセス（ZTNA）

**VPNの代替として注目される、アクセス制御の現代的アーキテクチャ。**

| 比較軸 | 従来VPN | ZTNA |
|---|---|---|
| アクセス単位 | ネットワーク全体 | アプリケーション単位 |
| 前提 | ネットワーク接続 = 信頼 | 常に検証（Assume Breach） |
| ラテラルムーブメント | 侵害後の横断が容易 | セグメントで抑制 |
| ユーザー体験 | 接続後に全リソースへアクセス可 | 許可されたアプリのみ表示 |

---

## 参考文献

- William Stallings『Network Security Essentials』（Pearson, 2022）— ネットワークセキュリティの体系的教科書
- Richard Bejtlich『The Practice of Network Security Monitoring』（No Starch Press, 2013）— NSMの実践書。ネットワーク監視の標準的参考文献
- NIST SP 800-41『Guidelines on Firewalls and Firewall Policy』— ファイアウォール設計の公式ガイドライン
- Evan Gilman & Doug Barth『Zero Trust Networks』（O'Reilly, 2017）— ZTNAの実装アーキテクチャ
- Cloud Security Alliance（CSA）Software Defined Perimeter Working Group — ZTNA の仕様と実装パターン
