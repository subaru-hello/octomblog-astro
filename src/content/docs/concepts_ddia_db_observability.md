---
title: DBモニタリングとオブザーバビリティ
description: 本番PostgreSQLで何を監視すべきか。pg_stat_statements・スロークエリ・ロック待ちの検出、メトリクス設計とアラート閾値の考え方を理解する
category: "概念"
tags: ["データ設計", "モニタリング", "オブザーバビリティ", "PostgreSQL", "パフォーマンス", "DDIA"]
emoji: "📡"
date: "2026-04-08"
order: 836
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017) Chapter 1"
---

## 定義

DBのオブザーバビリティとは、外部から観測できる出力（メトリクス・ログ・トレース）によって、DBの内部状態を推測できる度合い。問題が起きてから調べるのではなく、問題が起きる前に検出し、起きた後に原因を追える設計が目標。

## 監視すべき4層

```
1. インフラ層:    CPU・メモリ・ディスクI/O・ネットワーク
2. 接続層:        コネクション数・待機数・プール利用率
3. クエリ層:      スロークエリ・実行回数・エラー率
4. トランザクション層: ロック待ち・デッドロック・レプリケーション遅延
```

## pg_stat_statements（クエリ統計）

最も重要な拡張機能。クエリごとの実行統計を蓄積する。

```sql
-- 有効化
CREATE EXTENSION pg_stat_statements;

-- postgresql.conf
-- shared_preload_libraries = 'pg_stat_statements'
-- pg_stat_statements.max = 10000
-- pg_stat_statements.track = all

-- 遅いクエリ上位10件（平均実行時間順）
SELECT
  LEFT(query, 100)         AS query,
  calls,
  ROUND(mean_exec_time::numeric, 2) AS avg_ms,
  ROUND(total_exec_time::numeric, 2) AS total_ms,
  ROUND(stddev_exec_time::numeric, 2) AS stddev_ms,
  rows / calls             AS avg_rows
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- キャッシュミス率が高いクエリ（ディスクI/Oが多い）
SELECT
  LEFT(query, 100) AS query,
  shared_blks_hit,
  shared_blks_read,
  ROUND(shared_blks_hit::numeric /
    NULLIF(shared_blks_hit + shared_blks_read, 0) * 100, 1) AS cache_hit_pct
FROM pg_stat_statements
ORDER BY shared_blks_read DESC
LIMIT 10;

-- 統計をリセット（定期的に）
SELECT pg_stat_statements_reset();
```

## ロック待ちの検出

```sql
-- 現在ロック待ちしているクエリ
SELECT
  blocked.pid,
  blocked.query,
  blocking.pid     AS blocking_pid,
  blocking.query   AS blocking_query,
  blocked_activity.wait_event_type,
  blocked_activity.wait_event
FROM pg_stat_activity AS blocked
JOIN pg_stat_activity AS blocking
  ON blocking.pid = ANY(pg_blocking_pids(blocked.pid))
JOIN pg_stat_activity AS blocked_activity
  ON blocked_activity.pid = blocked.pid
WHERE blocked.cardinality(pg_blocking_pids(blocked.pid)) > 0;

-- 長時間実行中のクエリ（5分以上）
SELECT
  pid,
  now() - query_start AS duration,
  state,
  LEFT(query, 200) AS query
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start < NOW() - INTERVAL '5 minutes'
ORDER BY duration DESC;

-- アイドルインTxのセッション（コネクションを占有している）
SELECT pid, now() - state_change AS idle_in_tx_duration, query
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND state_change < NOW() - INTERVAL '1 minute';
```

## テーブル・インデックスの統計

```sql
-- シーケンシャルスキャンが多いテーブル（インデックス追加を検討）
SELECT
  schemaname,
  tablename,
  seq_scan,
  idx_scan,
  ROUND(seq_scan::numeric / NULLIF(seq_scan + idx_scan, 0) * 100, 1) AS seq_pct,
  n_live_tup AS live_rows
FROM pg_stat_user_tables
WHERE seq_scan > 100
ORDER BY seq_scan DESC;

-- 使われていないインデックス（削除候補）
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS times_used,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan < 50
  AND indexrelid NOT IN (SELECT conindid FROM pg_constraint)  -- 制約インデックスは除外
ORDER BY pg_relation_size(indexrelid) DESC;

-- テーブルのブロート（デッドタプルが多いテーブル）
SELECT
  tablename,
  n_live_tup,
  n_dead_tup,
  ROUND(n_dead_tup::numeric / NULLIF(n_live_tup + n_dead_tup, 0) * 100, 1) AS dead_pct,
  last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY dead_pct DESC;
```

## レプリケーション監視

```sql
-- プライマリ側: スタンバイの遅延
SELECT
  client_addr,
  state,
  sent_lsn,
  write_lsn,
  flush_lsn,
  replay_lsn,
  pg_wal_lsn_diff(sent_lsn, replay_lsn) AS replay_lag_bytes,
  write_lag,
  flush_lag,
  replay_lag
FROM pg_stat_replication;

-- スタンバイ側: プライマリとの遅延
SELECT
  now() - pg_last_xact_replay_timestamp() AS replication_delay;
```

## キャッシュヒット率

```sql
-- DBレベルのキャッシュヒット率（95%以上が目標）
SELECT
  datname,
  blks_hit,
  blks_read,
  ROUND(blks_hit::numeric / NULLIF(blks_hit + blks_read, 0) * 100, 2) AS cache_hit_pct
FROM pg_stat_database
WHERE datname = current_database();

-- テーブルレベルのキャッシュヒット率
SELECT
  tablename,
  heap_blks_hit,
  heap_blks_read,
  ROUND(heap_blks_hit::numeric / NULLIF(heap_blks_hit + heap_blks_read, 0) * 100, 1) AS cache_pct
FROM pg_statio_user_tables
ORDER BY heap_blks_read DESC
LIMIT 20;
```

## Prometheusでのメトリクス収集

```yaml
# postgres_exporter（prometheus/postgres_exporter）の設定
# docker-compose.yml
services:
  postgres-exporter:
    image: prometheuscommunity/postgres-exporter
    environment:
      DATA_SOURCE_NAME: "postgresql://monitor_user:pass@postgres:5432/mydb?sslmode=disable"
    ports:
      - "9187:9187"
```

**主要なメトリクス**：

| メトリクス | 説明 | アラート閾値（目安） |
|---|---|---|
| `pg_stat_activity_count` | アクティブなコネクション数 | max_connections × 0.8 |
| `pg_stat_replication_lag_bytes` | レプリケーション遅延 | > 100MB |
| `pg_database_blks_hit_ratio` | キャッシュヒット率 | < 0.95 |
| `pg_stat_bgwriter_buffers_clean` | チェックポイント頻度 | 急増 |
| `pg_locks_count` | ロック数 | 急増 |

## ログ設定（postgresql.conf）

```
# スロークエリログ（100ms以上）
log_min_duration_statement = 100

# ロック待ちタイムアウトのログ
deadlock_timeout = 1s
log_lock_waits = on

# 接続・切断のログ
log_connections = off   # 高トラフィックでは無効に
log_disconnections = off

# チェックポイントのログ
log_checkpoints = on

# 一時ファイルのログ（work_memが不足しているサイン）
log_temp_files = 10MB   # 10MB以上の一時ファイルをログ
```

## 監視ダッシュボードの設計

```
Grafanaダッシュボードの推奨パネル:

Row 1 - 全体の健全性:
  ✅ キャッシュヒット率（>95%）
  ✅ アクティブコネクション数
  ✅ トランザクション数/秒
  ✅ コミット/ロールバック比率

Row 2 - パフォーマンス:
  ✅ クエリ実行時間p50/p95/p99
  ✅ ロック待ち数
  ✅ デッドロック数/分

Row 3 - ストレージ:
  ✅ ディスク使用量
  ✅ WALの生成速度
  ✅ ブロートの多いテーブル

Row 4 - レプリケーション:
  ✅ レプリカ遅延（バイト/秒）
  ✅ WALラグ
```

## 関連概念

- → [クエリオプティマイザー](./concepts_ddia_query_optimizer.md)（スロークエリの改善方法）
- → [MVCCとVACUUM](./concepts_ddia_mvcc.md)（デッドタプルのモニタリング）
- → [WALと論理レプリケーション](./concepts_ddia_wal_replication.md)（レプリケーション遅延の原因）
- → [コネクションプーリング](./concepts_ddia_connection_pooling.md)（コネクション数の監視）

## 出典・参考文献

- PostgreSQL Documentation, "Monitoring Database Activity" — postgresql.org/docs/current/monitoring.html
- Datadog, "Key metrics for PostgreSQL monitoring" — datadoghq.com
- Martin Kleppmann, *Designing Data-Intensive Applications* (2017) Chapter 1（信頼性）
