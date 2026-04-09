---
category: "概念"
order: 205
title: アプリケーション層詳解（DNS・HTTP・TLS）
description: DNS解決フロー・HTTP/1.1〜3の進化・TLSハンドシェイクまで。ブラウザがリクエストを送るまでの全過程。
tags: ["TCP/IP", "HTTP", "DNS", "TLS", "HTTPS", "HTTP3", "QUIC"]
emoji: "🌍"
date: "2026-04-08"
source: "図解入門 TCP/IP・TCP/IPコンピューティング・ネットワーク入門"
series:
  - TCPIPネットワーク
---

## アプリケーション層の責務

TCP/IP 4層モデルの最上位。**ユーザーのデータをどう表現・交換するか**を定義する。

```
ブラウザで https://api.example.com/users を開くまでに起きること：

1. DNS解決          → api.example.com = 203.0.113.5 を取得
2. TCP接続          → 203.0.113.5:443 に SYN
3. TLSハンドシェイク → 暗号化チャネルを確立
4. HTTPリクエスト    → GET /users HTTP/1.1
5. HTTPレスポンス    → 200 OK + JSON

このうち 1〜3 は「アプリのデータ」を送る前の準備段階。
```

---

## DNS：名前解決の全過程

### 再帰クエリとイテレーティブクエリ

```
ブラウザ / アプリ
  │
  │── 再帰クエリ（"api.example.com を調べて全部やって"）
  ↓
フルサービスリゾルバ（プロバイダや 8.8.8.8）
  │
  │── イテレーティブクエリ（自分で各サーバーを順番に問い合わせる）
  │
  ├── ① ルートDNSサーバー（a.root-servers.net など、世界13台）
  │       「.com は a.gtld-servers.net へ」
  │
  ├── ② .com TLD サーバー
  │       「example.com は ns1.example.com へ」
  │
  └── ③ example.com の権威 DNS サーバー
            「api.example.com = 203.0.113.5（TTL: 300秒）」
  │
  └── 結果をキャッシュして ブラウザへ返却
```

### DNSレコードの種類

| レコード | 用途 | 例 |
|---|---|---|
| A | ホスト名 → IPv4アドレス | `api.example.com → 203.0.113.5` |
| AAAA | ホスト名 → IPv6アドレス | `api.example.com → 2001:db8::1` |
| CNAME | 別名（エイリアス） | `www.example.com → example.com` |
| MX | メールサーバー | `example.com → mail.example.com (priority 10)` |
| NS | 権威DNSサーバー | `example.com → ns1.example.com` |
| TXT | 任意テキスト | SPF, DKIM, DMARC, 認証トークン |
| SOA | ゾーンの管理情報 | プライマリNS, シリアル番号, TTL |
| PTR | IPアドレス → ホスト名（逆引き） | `5.113.0.203.in-addr.arpa → api.example.com` |

### TTLとキャッシュ戦略

```
TTL（Time to Live）= DNSレコードをキャッシュして良い時間（秒）

TTL 短い（60秒〜300秒）：
  + 変更が素早く伝播する
  - 名前解決のたびにDNS問い合わせが増える（レイテンシ↑）

TTL 長い（3600秒〜86400秒）：
  + キャッシュ効率が高く高速
  - IPアドレス変更やフェイルオーバーの伝播に時間がかかる

実践：DNS変更前にTTLを一時的に短く（60秒）しておく → 変更後に元に戻す
```

### DNSSEC と DoH/DoT

```
DNSSEC：DNSレスポンスに電子署名を付けて改ざんを検出
DoH（DNS over HTTPS）：DNS通信を HTTPS で暗号化（ポート443）
DoT（DNS over TLS）：DNS通信を TLS で暗号化（ポート853）

なぜ必要か：
  通常のDNSは平文UDP → 中間者攻撃でDNSスプーフィングが可能
  （偽のIPアドレスを返して不正サイトへ誘導）
```

---

## TLSハンドシェイク：暗号化チャネルの確立

### TLS 1.3 のハンドシェイク（現代の標準）

```
Client                                    Server
  │                                          │
  │──── ClientHello ──────────────────────→ │
  │     ・対応するTLSバージョン              │
  │     ・対応する暗号スイート一覧           │
  │     ・クライアントのランダム値           │
  │     ・サポートするキー交換グループ       │
  │     ・鍵共有用パラメータ（key_share）    │
  │                                          │
  │←── ServerHello ───────────────────────  │
  │    ・選択した暗号スイート                │
  │    ・サーバーのランダム値                │
  │    ・鍵共有パラメータ（key_share）       │
  │                                          │
  ≪ ここでクライアント・サーバー双方が      ≫
  ≪ 共有鍵を計算できる（ECDHE鍵合意）      ≫
  │                                          │
  │←── Certificate ───────────────────────  │
  │    ・サーバー証明書（公開鍵 + 署名）     │
  │←── CertificateVerify ─────────────────  │
  │    ・証明書に対する電子署名              │
  │←── Finished ──────────────────────────  │
  │    ・ここまでのメッセージのMAC（改ざん検出）│
  │                                          │
  │──── Finished ──────────────────────→   │
  │                                          │
  │ ≪ 暗号化通信開始 ≫                      │
```

TLS 1.3 では **1-RTT**（往復1回）でハンドシェイクが完了。TLS 1.2 では 2-RTT 必要だった。

### 証明書の検証プロセス

```
サーバー証明書 = { サーバーの公開鍵 + ドメイン名 + 有効期限 + CAの署名 }
                                                              ↑
                                              認証局（CA）が「このドメインのこの公開鍵は本物」と署名

検証ステップ：
  1. 証明書チェーンをルートCA（ブラウザ/OS内蔵）まで辿る
  2. 各証明書の署名を上位CAの公開鍵で検証
  3. ドメイン名が接続先と一致するか確認
  4. 有効期限の確認
  5. CRLまたはOCSPで失効確認

証明書の種類：
  DV（ドメイン検証）：ドメイン所有権のみ確認（Let's Encryptなど自動化可能）
  OV（組織検証）：組織実在を確認
  EV（拡張検証）：厳格な組織確認（ブラウザのアドレスバーに組織名表示）
```

### ECDHE鍵合意のざっくりした仕組み

```
なぜ「公開しても秘密鍵が守られるか」

楕円曲線 Diffie-Hellman：
  クライアント秘密 a → 公開鍵 A = a × G（楕円曲線上の点の加算）
  サーバー秘密   b → 公開鍵 B = b × G

  互いに公開鍵を交換した後：
  クライアント：S = a × B = a × b × G
  サーバー：    S = b × A = b × a × G
  ← 同じ S が得られる（共有鍵）

  盗聴者は A, B, G を知っていても
  離散対数問題（G から a を逆算）は現実的に解けない
```

---

## HTTP/1.1：Webの基礎

### リクエスト・レスポンスの構造

```
HTTPリクエスト：
GET /api/users?limit=10 HTTP/1.1
Host: api.example.com
Accept: application/json
Authorization: Bearer eyJhbGci...
Connection: keep-alive
(空行)

HTTPレスポンス：
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Content-Length: 512
Cache-Control: max-age=60
(空行)
{"users": [...]}
```

### Keep-Alive とパイプライニング

```
HTTP/1.0（接続の都度TCP確立）：
  TCP SYN → SYN-ACK → ACK → Request → Response → TCP FIN
  TCP SYN → SYN-ACK → ACK → Request → Response → TCP FIN
  ↑ 毎回3ウェイハンドシェイクのコスト

HTTP/1.1 Keep-Alive（コネクション再利用）：
  TCP SYN → SYN-ACK → ACK
    → Request1 → Response1
    → Request2 → Response2   ← 同じTCPコネクションを再利用
    → ...
  TCP FIN（長時間アイドルで自動切断）

HTTP/1.1 パイプライニング（課題あり）：
  Request1 ─────────────────→
  Request2 ─────────────────→  （ACK待ちせずに連続送信）
              ←──────── Response1
              ←──────── Response2  ← 順序通りに返す必要がある
              ↑ Response1 が遅いと Response2 も待たされる（HoLブロッキング）
```

---

## HTTP/2：多重化と圧縮

### ストリーム多重化

```
HTTP/1.1（直列）：
  [Req1][Resp1][Req2][Resp2][Req3][Resp3]
                     ↑ 前が終わらないと次が始まらない

HTTP/2（並列）：
  ストリーム1: [Req1]─────────────────→[Resp1]
  ストリーム2:    [Req2]──────────────────→[Resp2]
  ストリーム3:        [Req3]───────→[Resp3]
  ← 1つのTCPコネクション上で並列処理
```

### フレーム構造

HTTP/2 はテキストではなくバイナリの「フレーム」を単位として通信する。

```
HTTP/2 フレーム形式：
┌─────────────────┬──────────┬────────┬─────────────────────────────┐
│  Length（24bit） │ Type（8） │Flags(8)│    Stream ID（31bit）        │
├─────────────────┴──────────┴────────┴─────────────────────────────┤
│                        Payload                                      │
└──────────────────────────────────────────────────────────────────┘

主要フレームタイプ：
  HEADERS  : リクエスト/レスポンスのヘッダ（HPACKで圧縮）
  DATA     : ボディ
  SETTINGS : コネクション設定の交換
  PING     : Keep-Alive
  RST_STREAM : 特定ストリームのリセット
  GOAWAY   : コネクション終了
```

### HPACKヘッダ圧縮

```
HTTP/1.1 の問題：同じヘッダを毎リクエスト繰り返し送る
  GET /api/1  → Host, Accept, Authorization, User-Agent...（数百バイト）
  GET /api/2  → Host, Accept, Authorization, User-Agent...（また同じ）

HPACK の仕組み：
  ・静的テーブル（62個の標準ヘッダをインデックスで参照）
  ・動的テーブル（コネクション内で使われたヘッダを記憶）
  → 同じヘッダは1〜2バイトのインデックスだけで送れる

効果：HTTPヘッダを 85〜88% 圧縮できる場合がある
```

### Server Push

```
サーバーが「これも必要でしょ」と先送りする機能（実際には廃止傾向）：
  Client: GET /index.html
  Server: 200 OK（HTML）
         PUSH /style.css （HTMLを解析する前に先送り）
         PUSH /app.js
```

---

## HTTP/3：QUICベースの最新プロトコル

### HTTP/2 が抱えていた問題

```
HTTP/2 のHoLブロッキング：
  ストリーム多重化はしているが、下層はTCP
  → 1つのパケットロスで全ストリームが停止
  → ロスが多い環境（モバイル、Wi-Fi）では HTTP/1.1 より遅い場合も

HTTP/3 の解決：
  QUIC（UDP上）でストリームごとに独立した信頼性
  → 1ストリームのロスが他のストリームに影響しない
```

### 0-RTT 接続

```
初回接続（1-RTT）：
  QUIC Handshake（TLS 1.3 内包） 1-RTT
  → データ送信

2回目以降（0-RTT）：
  前回のセッションチケットを使って
  ハンドシェイクなしでいきなりデータを送り始める
  → レイテンシが大幅に改善

0-RTTの注意点：
  リプレイ攻撃のリスク（同じリクエストを再送される可能性）
  → GETなど冪等なリクエストのみ 0-RTT で送るべき
```

### HTTP/3 の現在

```bash
# HTTP/3 対応確認
curl --http3 https://cloudflare.com -v

# ブラウザでのプロトコル確認（ChromeのDevTools）
# Network タブ → Protocol 列を確認（h3 と表示されればHTTP/3）

# サイトのHTTP/3対応確認
curl -s -I https://api.example.com | grep -i alt-svc
# alt-svc: h3=":443" と返れば H3 対応
```

---

## アプリケーション層の実践まとめ

```bash
# DNS診断
dig api.example.com +trace    # 再帰的に解決過程を表示
dig -x 203.0.113.5            # 逆引き
dig api.example.com TXT       # TXTレコード確認（SPF/DKIM確認に）

# TLS診断
openssl s_client -connect api.example.com:443
# 証明書の内容、有効期限、証明書チェーンを確認

openssl s_client -connect api.example.com:443 -tls1_3
# TLS 1.3 強制接続

# HTTP診断
curl -v https://api.example.com/users   # 全ヘッダ表示
curl -w "%{time_namelookup} %{time_connect} %{time_appconnect} %{time_total}\n" \
  -o /dev/null -s https://api.example.com
# ↑ DNS解決/TCP接続/TLS確立/全体の時間を計測

# 各フェーズの内訳：
# time_namelookup  : DNS解決にかかった時間
# time_connect     : TCP 3ウェイハンドシェイク完了まで
# time_appconnect  : TLS ハンドシェイク完了まで
# time_total       : レスポンス受信完了まで
```

### パフォーマンス改善のポイント

| 問題 | 原因レイヤー | 改善策 |
|---|---|---|
| 初回アクセスが遅い | DNS解決 | DNS TTL調整、DNS Prefetch |
| HTTPSが遅い | TLS | Session Resumption, TLS 1.3, OCSP Stapling |
| 多数の小さいリソースが遅い | HTTP/1.1 | HTTP/2 or HTTP/3 採用 |
| モバイルで不安定 | TCP パケットロス | QUIC/HTTP/3 採用検討 |
| 同一接続の後続リクエストが遅い | TCP 輻輳制御 | Keep-Alive 最大化、Connection Pooling |
