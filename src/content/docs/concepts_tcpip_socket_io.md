---
category: "概念"
order: 206
title: ソケットAPIとI/Oモデル詳解
description: socket/epoll/io_uringまで。アプリがTCPを使う実装レイヤーを徹底解説。C10K問題とイベント駆動の原理。
tags: ["TCP/IP", "ソケット", "epoll", "非同期I/O", "C10K", "io_uring"]
emoji: "🔧"
date: "2026-04-09"
series:
  - TCPIPネットワーク
---

## ソケットとは何か

TCPスタックはカーネルの中にある。アプリケーションがネットワーク通信をするには、カーネルが提供する**ソケットAPI**を通じてアクセスする。

```
アプリケーション
  │  socket() / connect() / send() / recv() ...
  │  ←── システムコール（ユーザー空間 → カーネル空間）
  ↓
カーネル空間
  ├─ ソケット（ファイルディスクリプタ）
  ├─ 送信バッファ / 受信バッファ
  └─ TCP/IPスタック → NIC
```

ソケットは**ファイルディスクリプタ（fd）**として扱われる。`read()` / `write()` が使えるのは「すべてはファイル」というUnix哲学に基づく。

---

## ソケットAPIの基本フロー

### サーバー側

```c
// 1. ソケット作成
int fd = socket(AF_INET, SOCK_STREAM, 0);
//              ↑IPv4   ↑TCP         ↑自動選択

// 2. アドレス・ポートに紐付け
struct sockaddr_in addr = {
    .sin_family = AF_INET,
    .sin_port   = htons(8080),
    .sin_addr   = INADDR_ANY,  // 全NICで受け付け
};
bind(fd, (struct sockaddr*)&addr, sizeof(addr));

// 3. 接続待ちキューを作成（backlog=最大待機数）
listen(fd, 128);

// 4. クライアントからの接続を受け入れ（ブロッキング）
int client_fd = accept(fd, NULL, NULL);
// → client_fd で個別の通信ができる新しいfdが返る

// 5. データの送受信
char buf[4096];
ssize_t n = recv(client_fd, buf, sizeof(buf), 0);
send(client_fd, "HTTP/1.1 200 OK\r\n", 17, 0);

// 6. 切断
close(client_fd);
```

### クライアント側

```c
int fd = socket(AF_INET, SOCK_STREAM, 0);

struct sockaddr_in server = {
    .sin_family = AF_INET,
    .sin_port   = htons(80),
};
inet_pton(AF_INET, "93.184.216.34", &server.sin_addr);

// 3ウェイハンドシェイクがここで実行される
connect(fd, (struct sockaddr*)&server, sizeof(server));

send(fd, "GET / HTTP/1.1\r\nHost: example.com\r\n\r\n", 38, 0);

char buf[4096];
recv(fd, buf, sizeof(buf), 0);

close(fd);
```

### `listen()` の backlog とは

```
backlog = 完了キュー（ESTABLISHED）と未完了キュー（SYN_RCVD）の合計上限

SYNが届く → 未完了キューに積む → 3WHS完了 → 完了キューに移す
accept() を呼ぶ → 完了キューから取り出してアプリに渡す

backlog が小さすぎる + accept() が追いつかないとキューが溢れて
新規SYNをドロップ → クライアントからは「接続が繋がらない」

確認：ss -ltn で Recv-Q がbacklogに近い値なら要増加
```

---

## I/Oモデルの比較

「複数のコネクションをどう捌くか」がサーバー実装の核心。

### モデル1：1接続1スレッド（ブロッキングI/O）

```
Accept → Thread1: recv() (ブロック待ち)
Accept → Thread2: recv() (ブロック待ち)
Accept → Thread3: recv() (ブロック待ち)
...

問題：接続数 = スレッド数 → 数千接続でスレッド管理のオーバーヘッドが爆発
     スレッドのスタック = 数MB × 数千 = GBオーダーのメモリ消費
```

### モデル2：select / poll（同期多重化）

```c
// 複数fdをまとめて監視。どれかがreadyになったら返す
fd_set read_fds;
FD_SET(client_fd1, &read_fds);
FD_SET(client_fd2, &read_fds);

select(max_fd + 1, &read_fds, NULL, NULL, &timeout);
// ready な fd を調べてから recv()

問題：
  - fdを毎回カーネルに渡す（O(n)のコピーコスト）
  - select は fd数が 1024 上限（FD_SETSIZE）
  - readyな fd を自分で全走査する必要がある（O(n)）
```

### モデル3：epoll（Linuxの標準的な解）

```c
// epollインスタンス作成
int epfd = epoll_create1(0);

// 監視対象を登録（一度だけ）
struct epoll_event ev = {
    .events  = EPOLLIN,   // 読み込み可能になったら通知
    .data.fd = client_fd,
};
epoll_ctl(epfd, EPOLL_CTL_ADD, client_fd, &ev);

// イベント待機（readyになったfdだけ返ってくる）
struct epoll_event events[64];
int n = epoll_wait(epfd, events, 64, -1);
for (int i = 0; i < n; i++) {
    handle(events[i].data.fd);
}
```

```
selectとの違い：
  epoll: カーネルが監視リストを保持 → 変化したfdだけを返す（O(1)〜O(ready数)）
  select: 毎回全fdをコピーして全走査（O(n)）

epoll の動作モード：
  LT（Level Triggered）: データが残っている限り毎回通知（デフォルト）
  ET（Edge Triggered）: 状態変化時に1回だけ通知（高性能だが実装が複雑）
```

### モデル4：io_uring（Linux 5.1以降）

```
従来のepoll:
  1. epoll_wait() でデータ到着を検知
  2. recv() syscall でカーネル→ユーザー空間にコピー
  3. データ処理
  4. send() syscall でユーザー→カーネル空間にコピー

io_uring:
  共有リングバッファ（Submission Queue + Completion Queue）でsyscall回数を最小化
  複数のI/O操作を一括でカーネルに渡し、完了をまとめて受け取る
  ゼロコピー・カーネルポーリングモードも可能

効果：高負荷環境でCPU使用率が大幅に削減（特にNVMe SSD + ネットワーク混在）
```

---

## C10K問題とイベント駆動の誕生

2001年にDan Kegel が提示した「1台のサーバーで1万コネクションを同時に捌けるか」という問題。

```
1スレッド/接続モデルの限界：
  10,000コネクション × スレッドスタック2MB = 20GB のメモリが必要
  コンテキストスイッチのオーバーヘッドもO(n)

イベント駆動モデルの答え：
  1スレッドで epoll を使って全コネクションを監視
  I/Oが準備できたものだけを処理
  → 少ないスレッドで10万〜100万コネクションを捌ける
```

### 各言語ランタイムとの対応

| ランタイム | 内部の仕組み |
|---|---|
| Node.js | libuv（epoll/kqueue/IOCP）でイベントループ |
| Go | goroutine + netpoller（epoll）。OSスレッドは少数 |
| Rust tokio | mio（epoll/kqueue）ベースの非同期ランタイム |
| Nginx | epoll による master+worker プロセスモデル |
| Java NIO | Selector（epoll/kqueue のラッパー） |

```
Goのgoroutineが軽い理由：
  OSスレッドのスタック: 1〜8MB（固定）
  goroutineのスタック: 2KB〜（動的に拡張）
  → 100万goroutineでも2GBで収まる（OSスレッドなら不可能）
  内部でepollを使いI/O待ちgoroutineをパーク → CPUを別goroutineに
```

---

## ソケットオプション実践リファレンス

```c
// TCP_NODELAY: Nagleアルゴリズム無効化（低遅延が必要な場合）
int flag = 1;
setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &flag, sizeof(flag));

// SO_REUSEADDR: TIME_WAITのポート再利用（サーバー再起動時に必須）
setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &flag, sizeof(flag));

// SO_REUSEPORT: 複数プロセス/スレッドが同じポートでaccept（nginx worker等）
setsockopt(fd, SOL_SOCKET, SO_REUSEPORT, &flag, sizeof(flag));

// SO_KEEPALIVE: TCP Keep-Alive有効化
setsockopt(fd, SOL_SOCKET, SO_KEEPALIVE, &flag, sizeof(flag));

// SO_RCVBUF / SO_SNDBUF: 受信・送信バッファサイズの変更
int buf_size = 1 * 1024 * 1024;  // 1MB
setsockopt(fd, SOL_SOCKET, SO_RCVBUF, &buf_size, sizeof(buf_size));

// SO_LINGER: close()後のFINをどう扱うか（即RST送信など）
struct linger lg = { .l_onoff = 1, .l_linger = 0 };
setsockopt(fd, SOL_SOCKET, SO_LINGER, &lg, sizeof(lg));
```

### ノンブロッキングソケット

```c
// fdをノンブロッキングに設定
int flags = fcntl(fd, F_GETFL, 0);
fcntl(fd, F_SETFL, flags | O_NONBLOCK);

// ノンブロッキングでrecv()
ssize_t n = recv(fd, buf, len, 0);
if (n == -1 && errno == EAGAIN) {
    // データがまだない → epollで監視に戻る
}
```

---

## 実践：ソケット状態のデバッグ

```bash
# 全TCPソケットの状態確認
ss -tn

# 送受信バッファの状態（Recv-Q, Send-Qに注目）
ss -tn
# Recv-Q: アプリがまだread()していないデータ（=アプリ処理遅延）
# Send-Q: カーネルがまだ送信できていないデータ（=ネットワーク詰まり）

# ソケットの詳細情報（cwnd, RTT, retransなど）
ss -tin 'dst 203.0.113.5'

# ファイルディスクリプタの枯渇確認
cat /proc/sys/fs/file-max        # システム全体の上限
ulimit -n                        # 現在のプロセスの上限
ls /proc/<pid>/fd | wc -l        # プロセスが開いているfd数

# fd上限を増やす（高接続数サーバーでは必須）
ulimit -n 1000000
# /etc/security/limits.conf に永続化
```
