---
title: タイムシリーズDB
description: メトリクス・IoT・ログに特化したTimescaleDB/InfluxDBの設計思想。時間パーティション・ダウンサンプリング・TTLが通常のRDBとどう違うかを理解する
category: "概念"
tags: ["データ設計", "タイムシリーズ", "TimescaleDB", "InfluxDB", "メトリクス", "DDIA"]
emoji: "📈"
date: "2026-04-07"
order: 827
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017) Chapter 3"
---

## 定義

**タイムシリーズDB（TSDB）**：時刻をキーとして、時系列に並んだデータの書き込み・読み取り・集計に最適化されたデータベース。メトリクス収集・IoTセンサーデータ・アプリケーションログに使われる。

## なぜ通常のRDBでは不十分か

```
タイムシリーズデータの特性:
  - 書き込みが圧倒的に多い（常にAppend）
  - 過去のデータは変更しない（イミュータブル）
  - 古いデータほど重要性が低い（自動削除したい）
  - クエリが時間範囲を指定する（WHERE timestamp BETWEEN A AND B）
  - 高頻度な集計（5分ごとの平均CPUなど）

通常のRDBの問題:
  - 1秒1000件 × 1000センサー = 100万行/秒 → 書き込みボトルネック
  - インデックスのメンテナンスコストが高い
  - 古いデータの削除が遅い（行単位の削除はVACUUMが必要）
  - 集計クエリの最適化が限定的
```

## 主要なタイムシリーズDB

### TimescaleDB

PostgreSQLの拡張として動作する。SQLをそのまま使えるのが最大の特徴。

```sql
-- ハイパーテーブルの作成（通常のテーブルを時間パーティション化）
CREATE TABLE sensor_data (
  time        TIMESTAMPTZ NOT NULL,
  sensor_id   INT NOT NULL,
  temperature DOUBLE PRECISION,
  humidity    DOUBLE PRECISION
);

SELECT create_hypertable('sensor_data', 'time');
-- → 内部的に時間チャンクに分割される（デフォルト7日ごと）
```

### InfluxDB

タイムシリーズ専用DB。独自のデータモデルとクエリ言語（Flux）を持つ。

```
InfluxDBのデータモデル:
  Measurement（テーブルに相当）: cpu_usage
  Tags（インデックス付き文字列）: host=server01, region=jp
  Fields（値）: usage_percent=75.2, idle=24.8
  Timestamp: 2024-01-15T10:00:00Z

ラインプロトコル:
  cpu_usage,host=server01,region=jp usage_percent=75.2,idle=24.8 1705312800000000000
```

### その他

| DB | 特徴 |
|---|---|
| Prometheus | メトリクス収集専用、PullベースのScraping |
| VictoriaMetrics | Prometheusの10倍効率、圧縮率が高い |
| ClickHouse | 汎用列指向DBだが時系列にも最適 |
| QuestDB | 高速なSQL対応TSDB |

## 時間パーティション（チャンキング）

タイムシリーズDBの最重要最適化。

```
sensor_data テーブル:
  chunk_2024_01_01: 2024-01-01〜2024-01-07のデータ
  chunk_2024_01_08: 2024-01-08〜2024-01-14のデータ
  chunk_2024_01_15: 2024-01-15〜2024-01-21のデータ（現在の書き込み対象）

メリット:
  書き込み: 常に最新チャンクにAppend → ランダムI/Oなし
  削除: チャンクごとドロップ → 行単位削除より数百倍速い
  クエリ: 時間範囲に応じて対象チャンクだけスキャン（チャンクプルーニング）
```

```sql
-- TimescaleDBでの確認
SELECT * FROM timescaledb_information.chunks
WHERE hypertable_name = 'sensor_data'
ORDER BY range_start DESC;
```

## ダウンサンプリング（Continuous Aggregates）

高頻度データを低解像度の集計に変換して保持。

```
元データ: 1秒ごとのCPU使用率 → 1日で86400行
                              → 1年で3000万行

ダウンサンプリング:
  1分集計: AVG, MAX, MIN を1分ごとに保存 → 1日で1440行（1/60）
  1時間集計: さらに集約 → 1日で24行（1/3600）
  
古い高頻度データは削除、集計データは長期保持
```

```sql
-- TimescaleDB のContinuous Aggregate
CREATE MATERIALIZED VIEW hourly_cpu
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  sensor_id,
  AVG(cpu_usage)  AS avg_cpu,
  MAX(cpu_usage)  AS max_cpu,
  MIN(cpu_usage)  AS min_cpu
FROM metrics
GROUP BY bucket, sensor_id;

-- 自動的に新しいデータが到着するたびに更新される
```

## データ保持ポリシー（TTL / Retention Policy）

```sql
-- TimescaleDB: 90日以上古いデータを自動削除
SELECT add_retention_policy('sensor_data', INTERVAL '90 days');

-- InfluxDB: バケットレベルで設定
-- 生データ: 30日保持
-- 1時間集計: 1年保持
-- 1日集計: 永久保持
```

## クエリパターン

```sql
-- 直近1時間の5分ごとの平均CPU
SELECT
  time_bucket('5 minutes', time) AS bucket,
  AVG(cpu_usage) AS avg_cpu
FROM metrics
WHERE
  time >= NOW() - INTERVAL '1 hour'
  AND sensor_id = 'server01'
GROUP BY bucket
ORDER BY bucket;

-- ギャップフィル（データがない時間帯に0やNULLを埋める）
SELECT
  time_bucket_gapfill('5 minutes', time) AS bucket,
  LOCF(AVG(cpu_usage)) AS avg_cpu  -- Last Observation Carried Forward
FROM metrics
WHERE time >= NOW() - INTERVAL '1 hour'
GROUP BY bucket;
```

## タイムシリーズの設計パターン

### カーディナリティ問題

```
InfluxDBなどTagベースのDBでの問題:
  Tag: user_id=12345（数百万ユーザー）
  → ユニークなTag組み合わせ = 高カーディナリティ
  → メモリとインデックスを大量消費
  
対策:
  高カーディナリティな値（user_id）はFieldにする（インデックスなし）
  Tagには低カーディナリティな値（region, host, env）を使う
```

### ライトアヘッドデータとレイトアライバル

```
通常: データはほぼリアルタイムに到達する
問題: モバイルやオフライン機器から古いタイムスタンプのデータが遅れて届く
     → 既にクローズされたチャンクへの書き込みが発生
     → バッファリングのコストが上がる

設定例（TimescaleDB）:
  compress_after = '7 days'  → 7日以上古いチャンクを圧縮
  compress_orderby = 'time'  → 圧縮後の時系列アクセスを最適化
```

## 通常のRDB vs タイムシリーズDB

| 観点 | PostgreSQL | TimescaleDB | InfluxDB |
|---|---|---|---|
| 書き込み速度 | 普通 | 高速（自動パーティション） | 超高速（専用） |
| SQL対応 | ✅ | ✅（PostgreSQL互換） | ❌（Flux言語） |
| 圧縮 | 限定的 | 高（列指向圧縮） | 最高 |
| ダウンサンプリング | 手動 | 自動（Continuous Aggregate） | 自動（Flux） |
| 既存ツール連携 | ✅ | ✅（PostgreSQL互換） | 専用ツール必要 |

## 採用判断

```
TimescaleDBが向いている:
  - 既存のPostgreSQLスタックに追加したい
  - SQLで分析したい
  - 業務データと時系列データを同じDBで管理したい

InfluxDB/VictoriaMetricsが向いている:
  - 純粋なメトリクス収集（Prometheus代替）
  - 超高頻度書き込み（100万点/秒超）
  - 独立したモニタリングスタック

ClickHouseが向いている:
  - 時系列 + 複雑な分析クエリ
  - ログ分析との統合
```

## 関連概念

- → [列指向ストレージ](./concepts_ddia_columnar_storage.md)（TSDBの圧縮・スキャン最適化の基盤）
- → [パーティショニング](./concepts_ddia_partitioning.md)（時間パーティションとの類比）
- → [ストリーム処理](./concepts_ddia_stream_processing.md)（リアルタイムメトリクスとの統合）

## 出典・参考文献

- TimescaleDB Documentation — docs.timescale.com
- InfluxDB Documentation — docs.influxdata.com
- Martin Kleppmann, *Designing Data-Intensive Applications* (2017) Chapter 3
