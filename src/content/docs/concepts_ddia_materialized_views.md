---
title: マテリアライズドビュー
description: クエリ結果をディスクに保存して高速に返すマテリアライズドビューの仕組みとリフレッシュ戦略。インクリメンタル更新・TimescaleDBのContinuous Aggregates・CQRSのRead Sideとの関係を理解する
category: "概念"
tags: ["データ設計", "マテリアライズドビュー", "PostgreSQL", "パフォーマンス", "CQRS", "DDIA"]
emoji: "📋"
date: "2026-04-08"
order: 835
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017) Chapter 3"
---

## 定義

**マテリアライズドビュー（Materialized View）**：クエリの結果をディスクに物理的に保存したビュー。通常のビュー（論理ビュー）がクエリのたびにSQLを実行するのに対し、マテリアライズドビューは事前計算済みの結果を返す。

```
通常のビュー:
  SELECT * FROM order_summary;  ← 実行のたびにJOINと集計が走る

マテリアライズドビュー:
  SELECT * FROM order_summary;  ← 保存済みの結果を返す（高速）
  ただし最新でない可能性がある（リフレッシュが必要）
```

## PostgreSQLでの作成

```sql
-- マテリアライズドビューの作成
CREATE MATERIALIZED VIEW monthly_revenue AS
SELECT
  DATE_TRUNC('month', created_at) AS month,
  customer_id,
  SUM(total_amount)               AS revenue,
  COUNT(*)                        AS order_count
FROM orders
WHERE status = 'completed'
GROUP BY 1, 2;

-- インデックスを張れる（通常のテーブルと同じ）
CREATE INDEX ON monthly_revenue (customer_id);
CREATE INDEX ON monthly_revenue (month DESC);

-- クエリ（事前計算済みなので高速）
SELECT * FROM monthly_revenue
WHERE customer_id = 1
ORDER BY month DESC;
```

## リフレッシュ戦略

### 完全リフレッシュ（Full Refresh）

```sql
-- ビュー全体を再計算して置き換える
REFRESH MATERIALIZED VIEW monthly_revenue;
-- → リフレッシュ中にビューがロック → 読み取り不可

-- CONCURRENTLY: ロックなしでリフレッシュ（ユニークインデックスが必要）
CREATE UNIQUE INDEX ON monthly_revenue (month, customer_id);
REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_revenue;
-- → リフレッシュ中も読み取り可能（古いデータが返る）
```

**問題**：テーブルが大きいほどリフレッシュに時間がかかる。毎分リフレッシュは現実的でない。

### スケジュール設定

```sql
-- pg_cronを使って定期リフレッシュ
SELECT cron.schedule(
  'refresh-monthly-revenue',
  '0 * * * *',  -- 毎時0分
  'REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_revenue'
);
```

## インクリメンタル更新の実装

PostgreSQLはインクリメンタル更新をネイティブサポートしていないが、トリガーで実現できる。

```sql
-- 注文が追加・更新されたとき集計を更新するトリガー
CREATE OR REPLACE FUNCTION update_monthly_revenue()
RETURNS TRIGGER AS $$
DECLARE
  v_month DATE := DATE_TRUNC('month', NEW.created_at);
BEGIN
  -- upsert で差分だけ更新
  INSERT INTO monthly_revenue (month, customer_id, revenue, order_count)
  VALUES (v_month, NEW.customer_id, NEW.total_amount, 1)
  ON CONFLICT (month, customer_id) DO UPDATE SET
    revenue      = monthly_revenue.revenue + EXCLUDED.revenue,
    order_count  = monthly_revenue.order_count + 1;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_revenue
AFTER INSERT ON orders
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION update_monthly_revenue();
```

**注意**：DELETE・UPDATEへの対応が複雑になる。[CRDTのPN-Counter](./concepts_ddia_crdt.md)の発想と似ている。

## TimescaleDBのContinuous Aggregates

[タイムシリーズDB](./concepts_ddia_timeseries_db.md)で触れたTimescaleDBは、インクリメンタル更新をネイティブサポートする。

```sql
-- 新しいデータが追加されるたびに差分だけ更新
CREATE MATERIALIZED VIEW hourly_sensor_avg
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  sensor_id,
  AVG(temperature) AS avg_temp,
  MAX(temperature) AS max_temp
FROM sensor_readings
GROUP BY bucket, sensor_id;

-- リフレッシュポリシー（直近2時間を自動更新）
SELECT add_continuous_aggregate_policy('hourly_sensor_avg',
  start_offset => INTERVAL '3 hours',
  end_offset   => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour'
);
```

## マテリアライズドビューとCQRS

[CQRS](./concepts_backend_cqrs.md)のRead Sideとマテリアライズドビューは同じ考え方。

```
CQRS の Read Side:
  書き込みイベントに基づいて読み取り専用のモデルを維持
  → アプリレベルの実装

マテリアライズドビュー:
  書き込みに基づいてDBが読み取り専用のモデルを維持
  → DBレベルの実装

どちらを選ぶか:
  シンプルな集計 → マテリアライズドビュー
  複雑なビジネスロジック → アプリ側のCQRS
  リアルタイム性が必要 → ストリーム処理 + マテリアライズドビュー
```

## ダッシュボードへの実践的な適用

```sql
-- ダッシュボード用の事前計算テーブル（マテリアライズドビュー的な役割）
CREATE TABLE dashboard_stats (
  tenant_id   UUID PRIMARY KEY,
  total_users INT,
  active_users_30d INT,
  total_revenue DECIMAL(15,2),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 夜間バッチで全件更新
INSERT INTO dashboard_stats (tenant_id, total_users, active_users_30d, total_revenue)
SELECT
  tenant_id,
  COUNT(*),
  COUNT(*) FILTER (WHERE last_active_at > NOW() - INTERVAL '30 days'),
  SUM(lifetime_revenue)
FROM users
GROUP BY tenant_id
ON CONFLICT (tenant_id) DO UPDATE SET
  total_users       = EXCLUDED.total_users,
  active_users_30d  = EXCLUDED.active_users_30d,
  total_revenue     = EXCLUDED.total_revenue,
  updated_at        = NOW();
```

## 通常ビューとの使い分け

| 観点 | 通常のビュー | マテリアライズドビュー |
|---|---|---|
| 常に最新 | ✅ | ❌（リフレッシュが必要） |
| 読み取り速度 | 遅い（毎回計算） | 速い（保存済み） |
| ストレージ | 不要 | 必要 |
| インデックス | 不可 | 可能 |
| 更新の複雑さ | なし | リフレッシュ戦略が必要 |
| 適した用途 | 複雑なクエリの簡略化 | 重い集計・ダッシュボード |

## 関連概念

- → [CQRS](./concepts_backend_cqrs.md)（アプリレベルのRead Side設計）
- → [ストレージとインデックス](./concepts_ddia_storage_indexing.md)（物理的なデータ保存との関係）
- → [タイムシリーズDB](./concepts_ddia_timeseries_db.md)（Continuous Aggregatesの詳細）
- → [バッチ処理](./concepts_ddia_batch_processing.md)（夜間バッチでの一括リフレッシュ）

## 出典・参考文献

- PostgreSQL Documentation, "Materialized Views" — postgresql.org/docs/current/rules-materializedviews.html
- Martin Kleppmann, *Designing Data-Intensive Applications* (2017) Chapter 3
- TimescaleDB Documentation, "Continuous Aggregates" — docs.timescale.com
