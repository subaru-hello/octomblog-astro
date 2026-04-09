---
category: "概念"
order: 203
title: TCPの全機能詳解
description: 再送制御・フロー制御・輻輳制御・状態遷移・Nagleアルゴリズムまで。TCPが「信頼性」を実現する全メカニズム。
tags: ["TCP/IP", "TCP", "ネットワーク", "輻輳制御", "フロー制御"]
emoji: "🔄"
date: "2026-04-08"
source: "図解入門 TCP/IP・TCP/IPコンピューティング・ネットワーク入門"
series:
  - TCPIPネットワーク
---

## TCPの設計思想

TCPは「信頼性のある、順序保証されたバイトストリーム」を提供する。IPが「届けるかもしれないが保証しない」ベストエフォート型なのに対し、TCPはその上に以下を追加する。

```
TCPが保証すること：
  ✓ データが届く（再送制御）
  ✓ 順序通りに届く（SEQ番号による再組み立て）
  ✓ 重複せずに届く（SEQ番号で重複を排除）
  ✓ 破損していない（チェックサム）

TCPが保証しないこと：
  ✗ 速度（ネットワーク状況次第）
  ✗ 遅延（再送が起きると数百ms〜秒単位の遅延）
  ✗ 転送帯域（輻輳制御で調整される）
```

---

## TCPヘッダの全フィールド

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
├────────────────────────────────┬─────────────────────────────────┤
│         Source Port            │        Destination Port          │
├────────────────────────────────┴─────────────────────────────────┤
│                        Sequence Number                            │
├──────────────────────────────────────────────────────────────────┤
│                     Acknowledgment Number                         │
├──────────┬─────────┬──┬──┬──┬──┬──┬──┬──┬─────────────────────────┤
│Data Offset│Reserved │CW│EC│UR│AC│PS│RS│SY│FI│     Window Size      │
├──────────┴─────────┴──┴──┴──┴──┴──┴──┴──┴──┴─────────────────────┤
│            Checksum            │         Urgent Pointer            │
├────────────────────────────────┴──────────────────────────────────┤
│                   Options (variable, if Data Offset > 5)          │
└──────────────────────────────────────────────────────────────────┘
```

| フィールド | ビット | 説明 |
|---|---|---|
| Source Port | 16 | 送信元ポート番号（エフェメラルポート: 49152〜65535） |
| Destination Port | 16 | 宛先ポート番号（HTTP=80, HTTPS=443, SSH=22 等） |
| Sequence Number | 32 | このセグメントの先頭バイトのストリーム位置 |
| Acknowledgment Number | 32 | 「次にこのバイトを期待する」（受信済みバイト数+1） |
| Data Offset | 4 | TCPヘッダ長（32bit単位）。通常5=20バイト |
| CWR | 1 | Congestion Window Reduced（輻輳ウィンドウ縮小通知） |
| ECE | 1 | ECN-Echo（ネットワーク輻輳を受信側が通知） |
| URG | 1 | Urgent Pointer が有効 |
| ACK | 1 | Acknowledgment Number が有効 |
| PSH | 1 | Push：受信バッファを即座にアプリに渡す |
| RST | 1 | Reset：コネクションを強制切断 |
| SYN | 1 | コネクション確立要求 |
| FIN | 1 | コネクション終了要求 |
| Window Size | 16 | フロー制御用：「今これだけ受け取れる」バイト数 |
| Checksum | 16 | ヘッダ+データ+擬似ヘッダのチェックサム |
| Urgent Pointer | 16 | URG=1 時に緊急データの終端位置を示す |

---

## コネクション確立：3ウェイハンドシェイク（詳細）

```
Client                                    Server
  │                                          │
  │──── SYN ─────────────────────────────→  │
  │     seq=x（乱数で初期化：ISN）           │  ← Initial Sequence Number
  │     SYN=1, ACK=0                         │
  │                                          │
  │  ←── SYN-ACK ───────────────────────────│
  │       seq=y（サーバーのISN）             │
  │       ack=x+1（クライアントのISN+1を期待）│
  │       SYN=1, ACK=1                       │
  │                                          │
  │──── ACK ─────────────────────────────→  │
  │     seq=x+1                              │
  │     ack=y+1（サーバーのISN+1を期待）     │
  │     ACK=1                                │
  │                                          │
  │      ≪ ESTABLISHED（データ送受信可能）≫  │
```

**ISN（Initial Sequence Number）がなぜ乱数か：**
固定値だと古いコネクションの遅延パケットが新しいコネクションに混入するリスクがある。乱数にすることでSEQ番号の重複を防ぐ。

**SYN フラッド攻撃への対策 — SYN Cookie：**
```
攻撃：偽のSRC IPでSYNを大量送信 → サーバーのバックログキューを枯渇させる
対策：SYN-ACKのシーケンス番号自体にエンコードされた状態を使う
     → バックログにエントリを作らずにACKを検証できる
     sysctl net.ipv4.tcp_syncookies = 1
```

---

## コネクション切断：4ウェイハンドシェイク

```
Client                                    Server
  │                                          │
  │──── FIN ─────────────────────────────→  │  クライアント:「送信終わった」
  │     FIN=1, seq=u                         │
  │                                          │
  │  ←── ACK ───────────────────────────────│  サーバー:「了解」
  │       ack=u+1                            │  まだサーバー→クライアントのデータが残るかも
  │                                          │
  │         ～ サーバーが残りのデータを送信 ～  │
  │                                          │
  │  ←── FIN ───────────────────────────────│  サーバー:「こちらも送信終わった」
  │       FIN=1, seq=v                       │
  │                                          │
  │──── ACK ─────────────────────────────→  │  クライアント:「了解」
  │     ack=v+1                              │
  │                                          │
  │  ≪ TIME_WAIT（2MSL待機後にCLOSED）≫      │
```

**TIME_WAIT の理由：**
1. 最後のACKが相手に届かなかった場合に備えて、FINを再送できるよう待機
2. 同じ (src IP, src Port, dst IP, dst Port) のコネクションが再確立されたとき、古いパケットが混入しないよう時間を置く

**MSL（Maximum Segment Lifetime）**：パケットが生存できる最大時間（通常 30〜120秒）。TIME_WAIT は 2MSL = 60〜240秒。

---

## 再送制御：ACKが返らない時

### RTO（Retransmission Timeout）

```
送信 → ACK待ちタイマー（RTO）起動
       ↓
   タイムアウト → 再送
       ↓
   次のRTOは 2倍（指数バックオフ）
       ↓
   最大再送回数（linux: tcp_retries2 = 15）に達したらRST

RTOの計算（RFC 6298）：
  RTTVAR = 往復時間のばらつき（分散）
  SRTT   = 平滑化された往復時間（指数移動平均）
  RTO    = SRTT + 4 × RTTVAR
  初期値 = 1秒, 最小 = 200ms
```

### 高速再転送（Fast Retransmit）

RTO を待たずに再送を判断する仕組み。

```
Seg1 ──────────────────→ 受信側: ACK=2
Seg2 ──────────────────→ 受信側: ACK=3
Seg3 ──────── ✗（ロスト）
Seg4 ──────────────────→ 受信側: ACK=3（Seg3待ち、重複ACK1回目）
Seg5 ──────────────────→ 受信側: ACK=3（重複ACK2回目）
Seg6 ──────────────────→ 受信側: ACK=3（重複ACK3回目）
                                    ↑
                            3回連続で同じACK = Seg3がロスト判定
                            RTOを待たずに Seg3 を即再送
```

3つの重複ACKで高速再転送が起動する理由：1〜2回はパケット順序の入れ替わりでも起きうるため。

---

## フロー制御：受信側の処理速度に合わせる

受信側のバッファが溢れないよう、送信速度を受信側の処理能力に合わせる。

### スライディングウィンドウ

```
受信バッファ（例：65535バイト）：
┌────────────────────────────────────────────┐
│ 処理済み │ 受信済み未処理 │   空き（受け入れ可能）  │
└────────────────────────────────────────────┘
                              ↑ これが Window Size としてACKと一緒に通知される

送信側は Window Size 分だけ ACK待ちせずに送れる：

sent & acked │ sent & unacked │    can send    │  cannot send yet
─────────────┼────────────────┼────────────────┼────────────────
             └────────────────┘
               Window Size = 受信側が通知した値
```

### ゼロウィンドウとウィンドウプローブ

受信バッファが満杯になると `Window Size = 0` を通知。送信側は送信を停止する。

```
受信側: Window=0 通知 → 送信停止
         ↓
受信側がデータを処理してバッファが空くと Window を更新したいが...
（この通知が失われると永遠に待ち合い＝デッドロック）

対策：ZeroWindow Probe
  → 送信側が定期的に1バイトのプローブを送ってWindowの更新を促す
  → Wiresharkで [TCP ZeroWindow] や [TCP Window Update] として見える
```

---

## 輻輳制御：ネットワーク全体の混雑を回避する

フロー制御が「受信側との速度調整」なのに対し、輻輳制御は「ネットワーク経路の容量内に収まるよう調整」する。

### 輻輳ウィンドウ（cwnd）

実際の送信量 = min(受信ウィンドウ, 輻輳ウィンドウ)

```
┌─────────────────────────────────────────────────────┐
│  Slow Start（スロースタート）                         │
│  ・最初のcwnd = 1〜10 MSS（RFC 6928では10 MSSを推奨）  │
│  ・ACKのたびにcwnd を+1 MSS（指数的増加）             │
│  ・ssthresh（スロースタート閾値）に達したら切り替え    │
├─────────────────────────────────────────────────────┤
│  Congestion Avoidance（輻輳回避）                    │
│  ・1往復時間ごとにcwnd を+1 MSS（線形増加）           │
│  ・"Additive Increase"                               │
├─────────────────────────────────────────────────────┤
│  輻輳検出 → 反応                                     │
│  パターンA：タイムアウト                              │
│    ssthresh = cwnd / 2                               │
│    cwnd = 1 MSS（Slow Startに戻る）                  │
│  パターンB：3つの重複ACK（Fast Recovery）            │
│    ssthresh = cwnd / 2                               │
│    cwnd = ssthresh + 3 MSS                           │
│    Slow Startには戻らない（"Multiplicative Decrease"）│
└─────────────────────────────────────────────────────┘
```

### 輻輳ウィンドウの推移イメージ

```
cwnd
(MSS)
 32 │                  ●
 28 │               ●
 24 │            ●
 20 │         ●        ← Congestion Avoidance（線形増加）
 16 │──────────────────── ssthresh
 14 │      ●
  8 │   ●  ← Slow Start（指数増加）
  4 │●
  2 │ ●
  1 │  ●
  0 └──────────────────────────────→ time
     新規  指数 →  線形増加  →  輻輳  → 回復
```

### 主要な輻輳制御アルゴリズム

| アルゴリズム | 特徴 | Linux デフォルト |
|---|---|---|
| Reno | 古典的。3重複ACKで半減 | 旧 |
| CUBIC | 三次関数で増加。高BDP環境に強い | Linux デフォルト（現在） |
| BBR | RTTとスループットからボトルネックを推定。クラウド環境に強い | 新しい環境で採用増加 |

```bash
# 使用中の輻輳制御アルゴリズム確認
sysctl net.ipv4.tcp_congestion_control

# BBRに変更（カーネル4.9以降）
sysctl -w net.ipv4.tcp_congestion_control=bbr
```

---

## TCP状態遷移図

```
                    ┌──────────┐
                    │  CLOSED  │
                    └────┬─────┘
              passive     │       active
              open        │       open
                    ┌─────▼─────┐
           ┌───────→│  LISTEN  │
           │        └─────┬─────┘
           │         SYN  │       SYN
           │         rcvd │       sent
           │        ┌─────▼──────┐    ┌──────────────┐
           │        │  SYN_RCVD  │    │  SYN_SENT    │
           │        └─────┬──────┘    └──────┬───────┘
           │         ACK  │                  │ SYN+ACK
           │        ┌─────▼──────────────────▼───────┐
           │        │            ESTABLISHED          │
           │        └──────┬─────────────┬────────────┘
           │  FIN sent     │             │  FIN rcvd
           │        ┌──────▼──────┐ ┌───▼──────────┐
           │        │  FIN_WAIT_1 │ │  CLOSE_WAIT  │
           │        └──────┬──────┘ └───┬──────────┘
           │ ACK rcvd      │            │  close()
           │        ┌──────▼──────┐ ┌───▼──────────┐
           │        │  FIN_WAIT_2 │ │  LAST_ACK    │
           │        └──────┬──────┘ └───┬──────────┘
           │  FIN rcvd     │            │ ACK rcvd
           │        ┌──────▼──────┐     │
           │        │  TIME_WAIT  │─────┘
           │        └──────┬──────┘
           │  2MSL timeout │
           └───────────────┘
```

```bash
# TCPソケット状態の確認
ss -tn
# STATE, RECV-Q, SEND-Q, Local, Peer

# 状態別集計
ss -tn | awk 'NR>1 {print $1}' | sort | uniq -c | sort -rn
```

---

## Nagleアルゴリズムと TCP_NODELAY

小さいデータを大量に送る時の効率化アルゴリズム。

```
Nagleアルゴリズムのルール：
  ACK待ちのデータがある場合：
    → バッファにデータを貯めてMSS分たまるか、全ACKが返るまで送信しない

例：1バイトのキー入力を連続送信する場合
  Nagle OFF: 1バイト × 40回 = 40パケット（ヘッダが40回分の無駄）
  Nagle ON:  バッファに貯めて1MSS or ACK受信後まとめて送信
```

**問題になるケース：**
```
遅延ACK + Nagle の組み合わせ：
  送信側：Nagle = ACK待ちなのでバッファに貯める
  受信側：遅延ACK = 200ms待ってからACKを返す
  → 200ms以上の遅延が発生

対策：TCP_NODELAY でNagleを無効化（HTTP/2, gRPC, ゲーム通信等）
```

```go
// Go での TCP_NODELAY 設定例
conn, _ := net.Dial("tcp", "example.com:80")
tcpConn := conn.(*net.TCPConn)
tcpConn.SetNoDelay(true)  // Nagle無効化
```

```python
# Python での設定例
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
```

---

## TCP Keep-Alive：接続が生きているか確認する

長時間データを送らない接続（DBコネクションプール等）が「ゾンビ接続」になるのを防ぐ。

```bash
# Keep-Aliveパラメータ確認
sysctl net.ipv4.tcp_keepalive_time    # アイドル後最初のProbe送信まで（デフォルト7200秒）
sysctl net.ipv4.tcp_keepalive_intvl   # Probe間隔（デフォルト75秒）
sysctl net.ipv4.tcp_keepalive_probes  # 再試行回数（デフォルト9回）
```

デフォルトでは7200秒（2時間）＋ 75×9秒 = 約2時間12分後に切断を検知。

**アプリレベルでの Keep-Alive が推奨される理由：**
OSのKeep-Aliveはカーネル設定に依存し調整しにくい。アプリ側で定期的なハートビートパケットを実装する方が、タイムアウト時間の制御が容易。

---

## 実践：TCP問題の診断

```bash
# 再送の監視
watch -n 1 'ss -s'
# Retrans の数が増え続けていたら輻輳かパケットロス

# 特定のコネクションの輻輳ウィンドウ確認
ss -tin 'dst 203.0.113.5'
# cwnd: N  rcv_space: N  retrans: N/N

# RTTの確認
ss -tin | grep rtt

# SYN Backlogのあふれ確認（SYN floodや高負荷時）
netstat -s | grep -i 'syn'
# SYNs to LISTEN sockets dropped の値が増えたら要注意

# TIME_WAIT 過剰確認
ss -tn state time-wait | wc -l
```
