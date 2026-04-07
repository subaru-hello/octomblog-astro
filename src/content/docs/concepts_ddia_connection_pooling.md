---
title: コネクションプーリング
description: なぜDB接続は高コストか、PgBouncerがどうコネクション枯渇を防ぐか。Transaction/Session/Statementモードの違いと、接続数のチューニング指針を理解する
category: "概念"
tags: ["データ設計", "コネクションプーリング", "PostgreSQL", "PgBouncer", "スケーラビリティ", "DDIA"]
emoji: "🔌"
date: "2026-04-07"
order: 823
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017) / PgBouncer Documentation"
---

## 定義

**コネクションプーリング**：DBへの接続を使い回すことで、接続確立のオーバーヘッドと同時接続数の上限問題を解決する仕組み。

## なぜDB接続は高コストか

```
PostgreSQL の接続確立コスト:
  1. TCP 3-way handshake
  2. TLS ハンドシェイク（暗号化有効時）
  3. 認証（パスワード検証）
  4. プロセスのフォーク（PostgreSQLは接続ごとに1プロセス）
  5. バックエンドプロセスの初期化（メモリ確保など）

→ 接続確立に 1〜5ms かかる
→ 1秒間に1000リクエストなら接続コストだけで1〜5秒分の遅延
```

### PostgreSQLの接続モデル

```
他のDB（MySQL, Oracle）: スレッドベース（接続 = スレッド）
PostgreSQL:              プロセスベース（接続 = プロセス）

PostgreSQLのプロセスあたりのメモリ:
  work_mem（デフォルト4MB） × 接続数 = 4MB × 500 = 2GB
  
  接続数が増えるほどメモリを大量消費
  max_connections デフォルト = 100（本番では増やすが上限あり）
```

## コネクション枯渇の問題

```
状況:
  APIサーバーが100台、各サーバーがDB接続を10本持つ
  → 1000接続（max_connectionsを超える）

症状:
  "sorry, too many clients already"
  → 新しいリクエストが全部エラーになる
  → アプリ再起動しても解消しない（接続が残っている）
```

## PgBouncer の仕組み

```
Before:
  APIサーバー100台 × 10接続 = 1000接続 → PostgreSQL

After:
  APIサーバー100台 → PgBouncer（コネクションプール） → PostgreSQL
  PgBouncer: DB接続は20〜50本で維持

PgBouncerが1000クライアントを20〜50本のDB接続で捌く
```

### 3つのプーリングモード

#### Session モード

```
クライアント1 ← → DB接続A（クライアントが切断するまで専有）
クライアント2 ← → DB接続B（同上）

特徴: アプリ透過（全機能使える）
問題: 接続削減効果が小さい。アイドル中でも接続を占有
用途: アプリを全く変更できない場合
```

#### Transaction モード（最も一般的）

```
クライアント1 がTx開始 → DB接続A を割り当て
クライアント1 がTx完了 → DB接続A をプールに返却
クライアント2 が別のTxを開始 → DB接続A を再利用

特徴: Txの間だけDB接続を占有 → 接続の使い回し効率が高い
制限: セッションレベルの状態が使えない
```

**Transaction モードで使えない機能**：
```sql
-- ❌ プリペアドステートメント（セッションに紐づく）
PREPARE my_stmt AS SELECT * FROM users WHERE id = $1;
EXECUTE my_stmt(1);

-- ❌ セッション変数
SET search_path = myschema;

-- ❌ アドバイザリロック
SELECT pg_advisory_lock(1);

-- ❌ LISTEN/NOTIFY
LISTEN my_channel;
```

#### Statement モード

```
1つのSQLごとに接続を割り当て・返却
制限が最も多い（マルチステートメントTxが使えない）
用途: ほぼ使われない
```

## 適切な接続数の計算

```
PostgreSQLの推奨:
  max_connections = (CPUコア数 × 2) + ディスク数
  
  例: 4コア、1ディスク → max_connections = 9
  
  実際には:
    OLTP向け: max_connections = 100〜200
    OLAP向け: max_connections = 20〜50（長時間クエリ）

PgBouncerのプール設定:
  pool_size = max_connections × 0.8（安全マージン）
  
  APIサーバー100台から 1000接続を受けても
  DB側は pool_size = 80 本の接続で処理する
```

## PgBouncer の設定例

```ini
[databases]
mydb = host=127.0.0.1 port=5432 dbname=mydb

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000    ; クライアントからの最大接続数
default_pool_size = 25    ; DBへの接続数

; 接続が足りないとき最大何秒待つか
query_wait_timeout = 120

; アイドル接続をキープする時間
server_idle_timeout = 600

; DBへの接続でTLSを使う
server_tls_sslmode = require
```

## コネクションプールの監視

```sql
-- PgBouncer の状態確認（psql で pgbouncer DBに接続）
SHOW POOLS;
-- cl_active: アクティブなクライアント接続数
-- sv_active: アクティブなDB接続数
-- sv_idle:   アイドルのDB接続数
-- sv_used:   最近使われたが返却済みのDB接続数

SHOW STATS;
-- total_requests: 総リクエスト数
-- avg_wait_time:  平均待ち時間（これが増えてきたら接続不足）
```

## アプリ側のコネクションプール（クライアントサイド）

PgBouncerはサーバーサイドのプール。Node.js/Python側にもプールがある。

```typescript
// Node.js（pg ライブラリ）
import { Pool } from 'pg';

const pool = new Pool({
  host: 'pgbouncer-host',
  max: 10,          // このプロセスからの最大接続数
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// 接続を明示的に管理
async function runTransaction() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE ...');
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
  } finally {
    client.release(); // 必ずプールに返す
  }
}
```

## Serverless 環境の問題

```
Lambda / Cloud Run などのサーバーレス環境:
  リクエストごとにプロセスが起動 → 接続プールが使いにくい
  コールドスタート時に毎回接続確立 → 遅い

解決策:
  1. PgBouncer を必ず間に挟む
  2. RDS Proxy（AWS）/ Cloud SQL Proxy（GCP）を使う
     → マネージドプールをクラウド側で提供
  3. Supabase / Neon などのサーバーレス対応PaaS
```

## 関連概念

- → [パーティショニング](./concepts_ddia_partitioning.md)（水平スケールとの組み合わせ）
- → [レプリケーション](./concepts_ddia_replication.md)（読み取りレプリカへの接続分散）
- → [トランザクション](./concepts_ddia_transactions.md)（Transaction モードの制限との関係）

## 出典・参考文献

- PgBouncer Documentation — pgbouncer.org
- Citus Data, "Tuning Your PostgreSQL Server" — citusdata.com
- Hironobu Suzuki, "The Internals of PostgreSQL" — interdb.jp/pg
