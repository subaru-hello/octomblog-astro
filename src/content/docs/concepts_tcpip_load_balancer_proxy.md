---
category: "概念"
order: 208
title: ロードバランサー・リバースプロキシ詳解
description: L4/L7の違い・DSR・コネクションプーリング・ヘルスチェック・Nginxの動作原理まで。マイクロサービス設計の要。
tags: ["TCP/IP", "ロードバランサー", "リバースプロキシ", "Nginx", "L4", "L7"]
emoji: "⚖️"
date: "2026-04-09"
series:
  - TCPIPネットワーク
---

## ロードバランサーとリバースプロキシの位置づけ

```
クライアント
    │
    ▼
[ L4 ロードバランサー ]  ← TCP/UDPレベルで振り分け
    │  コネクションをそのまま流す or NATで転送
    ▼
[ L7 ロードバランサー / リバースプロキシ ]  ← HTTPレベルで振り分け
    │  リクエストを読んでから転送先を決める
    ▼
[ バックエンドサーバー群 ]
```

---

## L4ロードバランサー：TCPレベルの振り分け

### 動作原理

L4 LBはIPヘッダとTCPヘッダだけを見て転送先を決める。HTTPの中身は見ない。

```
【NAT方式（最も一般的）】

クライアント (1.2.3.4:54321)
    │ SYN → VIP (10.0.0.1:443)
    ▼
L4 LB
    ├─ 転送先を選択（例：Backend-B）
    └─ DNAT: dst を Backend-B (10.0.0.3:443) に書き換え
             src はそのまま or SNAT
    │ SYN → Backend-B (10.0.0.3:443)
    ▼
Backend-B
    └─ SYN-ACK → L4 LB → クライアントへ

特徴：
  ・コネクションの中身（HTTP）は読まない
  ・1クライアントのTCPコネクションは同じバックエンドに固定
  ・SSL終端できない（暗号化されたままバックエンドへ）
```

### DSR（Direct Server Return）

レスポンスが大きいサービス（動画配信など）でLBのボトルネックを回避する手法。

```
通常のNAT方式：
  Client → LB → Backend → LB → Client（全トラフィックがLBを通る）

DSR方式：
  Client → LB → Backend
                   └──→ Client（レスポンスはLBをバイパス）

実現方法：
  ・IP-in-IP カプセル化（LBがBackendのIPでラップ）
  ・MACアドレスの書き換えのみ（L2 DSR）
  ・Backendは VIP を lo インターフェースに設定（ARPは無効化）

効果：LBを通るのはリクエスト（小さい）のみ。大きいレスポンスはBackendから直接。
```

### LBアルゴリズム

| アルゴリズム | 説明 | 用途 |
|---|---|---|
| Round Robin | 順番に割り当て | 均質なサーバー群 |
| Weighted Round Robin | 重み付きで割り当て | スペック差があるサーバー群 |
| Least Connections | 接続数が最も少ないサーバーへ | 処理時間が不均一なリクエスト |
| IP Hash | クライアントIPで決定（固定） | セッション引き継ぎが難しいケース |
| Random | ランダム | シンプル・大規模環境 |
| ECMP | ルーティングテーブルで複数経路 | L3での並列分散 |

---

## L7ロードバランサー：HTTPレベルの振り分け

### L4との根本的な違い

```
L4 LB: TCPコネクションを見る
  Client ─[TCP接続]─ L4 LB ─[TCP接続]─ Backend
  （コネクションをそのまま流すか、NATするか）

L7 LB: HTTPリクエストを読んでから転送
  Client ─[TCP接続]─ L7 LB ─[TCP接続]─ Backend
  （LBでいったんHTTPを受け取り、新しい接続でBackendへ送る）

L7だからこそできること：
  ・URLパスやHostヘッダで振り分け先を変える
  ・SSLターミネーション（LBでTLSを終端し、バックエンドはHTTP）
  ・HTTPヘッダの書き換え・追加（X-Forwarded-For など）
  ・レート制限・WAF機能
  ・コネクションプーリング（バックエンドへの接続を再利用）
  ・gRPC・WebSocketの適切なハンドリング
```

### パスベース・ホストベースルーティング

```
リクエスト:  GET /api/users HTTP/1.1
             Host: example.com

L7 LBのルーティングルール：
  Host: api.example.com   → API サーバー群
  Host: example.com + /static/*  → CDN / 静的ファイルサーバー
  Host: example.com + /api/*     → API サーバー群
  Host: example.com + /          → フロントエンドサーバー群

これがALB（Application Load Balancer）やIngressの役割。
```

---

## コネクションプーリング

L7 LBの重要な最適化。バックエンドへのTCPコネクションを使い回す。

```
【プーリングなし】
クライアント100人 → 毎回 3WHS × 100 → バックエンドへ100コネクション
コネクション終了のたびに TIME_WAIT が積み重なる

【プーリングあり（LBがプールを管理）】
クライアント100人 → LBとの接続（各自のコネクション）
                      ↓
                  LBがバックエンドへのコネクションプールを保持
                  （例：10本のコネクションで100リクエストを処理）

効果：
  ・バックエンドの3WHSオーバーヘッドが激減
  ・TIME_WAITの問題がLB側に局所化（LBはSO_LINGER等で管理）
  ・バックエンドの最大接続数を制御できる
```

```nginx
# Nginxのupstreamでコネクションプーリング設定
upstream backend {
    server 10.0.0.1:8080;
    server 10.0.0.2:8080;
    keepalive 32;  # バックエンドへのkeepalivedコネクション数上限
}

server {
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;              # keepaliveにはHTTP/1.1が必要
        proxy_set_header Connection "";      # "close"ヘッダを削除
    }
}
```

---

## Nginxの動作原理

### Master + Worker プロセスモデル

```
nginx master process
├── 設定の読み込み・管理
├── Workerの起動・監視
│
├── worker process #1
│   └── epollで全コネクションを非同期に処理
├── worker process #2
│   └── epollで全コネクションを非同期に処理
├── worker process #3
│   └── epollで全コネクションを非同期に処理
└── worker process #4
    └── epollで全コネクションを非同期に処理

worker数 = CPUコア数（worker_processes auto;）
SO_REUSEPORT で全workerが同じポートでaccept（負荷分散）
```

### リクエスト処理フロー

```
① クライアントからTCP接続（epollがイベント検知）
② SSL Handshake（nginx側でTLS終端）
③ HTTPリクエスト受信・パース
④ locationブロックのマッチング
⑤ upstream（バックエンド）への接続（プールから取得 or 新規）
⑥ バックエンドへリクエスト転送
⑦ レスポンス受信
⑧ クライアントへレスポンス送信
⑨ access.log への書き込み（非同期）
```

### 設定の重要パラメータ

```nginx
# ワーカーとコネクション
worker_processes auto;            # CPUコア数に自動設定
worker_connections 10240;         # worker1つあたりの最大コネクション数
                                  # 最大総接続数 = worker_processes × worker_connections

# タイムアウト
proxy_connect_timeout  5s;        # バックエンドへの接続タイムアウト
proxy_send_timeout     60s;       # バックエンドへの送信タイムアウト
proxy_read_timeout     60s;       # バックエンドからの読み込みタイムアウト
keepalive_timeout      75s;       # クライアントとのkeepalive維持時間

# バッファ
proxy_buffer_size        16k;     # レスポンスの最初のバッファ（ヘッダ用）
proxy_buffers            8 16k;   # レスポンスボディのバッファ
proxy_busy_buffers_size  32k;

# 重要なヘッダ設定
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

---

## ヘルスチェックとフェイルオーバー

### パッシブヘルスチェック（デフォルト）

```nginx
upstream backend {
    server 10.0.0.1:8080 max_fails=3 fail_timeout=30s;
    server 10.0.0.2:8080 max_fails=3 fail_timeout=30s;
    # 30秒以内に3回失敗 → 30秒間除外
}
```

### アクティブヘルスチェック（nginx plus / 商用）

```nginx
# OSSのNginxではngx_http_upstream_check_moduleを使う
upstream backend {
    server 10.0.0.1:8080;
    server 10.0.0.2:8080;

    check interval=3000 rise=2 fall=3 timeout=1000 type=http;
    check_http_send "GET /health HTTP/1.0\r\n\r\n";
    check_http_expect_alive http_2xx;
}
```

### ヘルスチェックエンドポイントの設計

```
良いヘルスチェックエンドポイント：
  GET /health
  → DBへのping実行
  → キャッシュへの接続確認
  → 依存サービスの確認
  → 200 OK（詳細はJSON or プレーンテキスト）

悪いパターン：
  - 常に200を返すだけ（依存サービス障害を検知できない）
  - 重すぎる処理（ヘルスチェック自体がサーバーを遅くする）
  - 外部APIを呼ぶ（外部障害でサービス全体が切り離される）

原則：「このサーバーはリクエストを処理できるか」だけを確認する
```

---

## SSLターミネーション vs エンドツーエンドTLS

```
【SSLターミネーション（LBで復号）】

Client ─[TLS]─ LB ─[HTTP]─ Backend
                ↑ LBで復号

利点：
  ・証明書管理がLBだけで済む
  ・バックエンドの処理コスト削減
  ・L7の内容を読める（ルーティング、ログ）
欠点：
  ・LB〜Backend間は平文（内部ネットワークへの信頼が必要）

【エンドツーエンドTLS（パススルー）】

Client ─[TLS]─ LB ─[TLS]─ Backend
                ↑ LBは中身を読まない

利点：
  ・エンドツーエンドで暗号化（コンプライアンス要件）
欠点：
  ・L7ルーティング不可（SNIベースのL4ルーティングのみ）
  ・証明書管理が各バックエンドで必要
  ・コネクションプーリングの効果が薄れる
```

---

## サービスメッシュ：L7機能のサイドカー化

マイクロサービス環境でサービス間通信のL7機能をアプリから分離する。

```
従来：
  Service A ──[HTTP]── Service B
  （タイムアウト・リトライ・TLSをアプリコードに書く）

サービスメッシュ（Istio/Linkerdなど）：
  Service A → [Sidecar Proxy（Envoy）] ──[mTLS]── [Sidecar Proxy（Envoy）] → Service B
               ↑ アプリの隣で動くプロキシ                ↑
               タイムアウト・リトライ・サーキットブレーカー・
               メトリクス収集・mTLS をサイドカーが担う
```

```
サービスメッシュの主な機能：
  mTLS       : サービス間通信の暗号化・認証（証明書は自動管理）
  Retry      : 失敗したリクエストの自動再試行
  Timeout    : サービスごとのタイムアウト設定
  Circuit Breaker: 障害サービスへのリクエストを遮断して連鎖障害を防ぐ
  Observability  : 全サービス間のトレース・メトリクス・ログ（追加コード不要）
  Traffic Shifting: カナリアリリース（新バージョンに10%だけ流す）
```

---

## 実践：LB・プロキシのデバッグ

```bash
# Nginxのリアルタイムログ確認
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# upstreamへの接続タイムアウトをデバッグ
# access.logの $upstream_response_time を確認
# 設定例
log_format main '$remote_addr - $upstream_addr [$time_local] '
                '"$request" $status $body_bytes_sent '
                '$request_time $upstream_response_time';

# Nginxの接続数・状態確認
nginx -s status  # nginx_status モジュール
# Active connections: N
# accepts handled requests: X Y Z
# Reading: N Writing: N Waiting: N（keep-alive待機）

# バックエンドへの接続確認
ss -tn state established 'dport = :8080'
```

| ログ項目 | 意味 | 異常の判断 |
|---|---|---|
| `$request_time` | クライアントへの応答完了まで | アプリ全体の遅延 |
| `$upstream_response_time` | バックエンドからの応答時間 | バックエンドの遅延 |
| 差分（request - upstream） | NginxのI/O処理時間 | Nginxのバッファ遅延 |
| `499` ステータス | クライアントが切断 | タイムアウトが短い、バックエンドが遅い |
| `502` ステータス | バックエンドから不正レスポンス | バックエンドのクラッシュ・再起動 |
| `504` ステータス | バックエンドからタイムアウト | バックエンドの処理遅延 |
