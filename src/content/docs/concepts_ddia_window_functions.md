---
title: ウィンドウ関数
description: 行を集約せずに前後の行と比較・集計できるSQLのウィンドウ関数。ROW_NUMBER・RANK・LAG・LEAD・移動平均の使い方と、GROUP BYとの違いを理解する
category: "概念"
tags: ["データ設計", "SQL", "ウィンドウ関数", "PostgreSQL", "分析クエリ", "DDIA"]
emoji: "🪟"
date: "2026-04-08"
order: 839
series:
  - データ志向アプリケーション設計（DDIA）
source: "PostgreSQL Documentation / SQL:2003 Standard"
---

## 定義

**ウィンドウ関数（Window Function）**：現在の行に関連する「行のセット（ウィンドウ）」に対して計算を行い、各行に結果を返す関数。GROUP BYと違い、行が集約されない。

```sql
-- GROUP BY: 行が集約される（元の行がなくなる）
SELECT department, AVG(salary) FROM employees GROUP BY department;
-- → 部署ごとに1行になる

-- ウィンドウ関数: 行は集約されない
SELECT name, department, salary,
       AVG(salary) OVER (PARTITION BY department) AS dept_avg
FROM employees;
-- → 全行が残り、各行に部署平均が付加される
```

## 基本構文

```sql
関数名() OVER (
  PARTITION BY カラム  -- グループ分け（省略可）
  ORDER BY カラム      -- 順序（省略可）
  ROWS/RANGE フレーム  -- 集計範囲（省略可）
)
```

## ランキング関数

```sql
SELECT
  name,
  department,
  salary,
  ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) AS row_num,
  RANK()       OVER (PARTITION BY department ORDER BY salary DESC) AS rank,
  DENSE_RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS dense_rank
FROM employees;
```

```
name    | dept | salary | row_num | rank | dense_rank
--------+------+--------+---------+------+-----------
Alice   | Eng  | 1000   |    1    |  1   |     1
Bob     | Eng  | 800    |    2    |  2   |     2
Charlie | Eng  | 800    |    3    |  2   |     2  ← 同順位
Dave    | Eng  | 600    |    4    |  4   |     3  ← RANKは4、DENSE_RANKは3
```

### 実践パターン：各部署の上位N件

```sql
-- 各部署で給与上位3人だけ取得（GROUP BYでは不可能）
SELECT * FROM (
  SELECT *,
    ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) AS rn
  FROM employees
) ranked
WHERE rn <= 3;
```

## オフセット関数（前後の行を参照）

```sql
SELECT
  date,
  revenue,
  LAG(revenue, 1)  OVER (ORDER BY date) AS prev_revenue,   -- 前の行
  LEAD(revenue, 1) OVER (ORDER BY date) AS next_revenue,   -- 次の行
  revenue - LAG(revenue, 1) OVER (ORDER BY date) AS diff,  -- 前日比
  ROUND(
    (revenue - LAG(revenue, 1) OVER (ORDER BY date))
    / LAG(revenue, 1) OVER (ORDER BY date) * 100, 1
  ) AS growth_pct  -- 前日比(%)
FROM daily_sales
ORDER BY date;
```

```
date       | revenue | prev_revenue | diff  | growth_pct
-----------+---------+--------------+-------+-----------
2024-01-01 |  10000  |    NULL      | NULL  |   NULL
2024-01-02 |  12000  |    10000     | 2000  |   20.0
2024-01-03 |  11000  |    12000     | -1000 |   -8.3
2024-01-04 |  15000  |    11000     | 4000  |   36.4
```

### FIRST_VALUE / LAST_VALUE / NTH_VALUE

```sql
-- ユーザーの最初の注文と最新の注文を各行に付加
SELECT
  user_id,
  order_id,
  created_at,
  FIRST_VALUE(order_id) OVER (
    PARTITION BY user_id ORDER BY created_at
  ) AS first_order_id,
  LAST_VALUE(order_id) OVER (
    PARTITION BY user_id ORDER BY created_at
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
  ) AS last_order_id
FROM orders;
```

## フレーム指定（集計範囲の制御）

```sql
-- 移動平均（直近7日の平均）
SELECT
  date,
  revenue,
  AVG(revenue) OVER (
    ORDER BY date
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW  -- 現在行を含む過去7行
  ) AS moving_avg_7d
FROM daily_sales;

-- 累積合計
SELECT
  date,
  revenue,
  SUM(revenue) OVER (
    ORDER BY date
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS cumulative_revenue
FROM daily_sales;
```

### ROWS vs RANGE

```sql
-- ROWS: 物理的な行数で範囲を指定
ROWS BETWEEN 3 PRECEDING AND CURRENT ROW  -- 3行前〜現在行

-- RANGE: 値の範囲で指定（ORDER BYの値が基準）
RANGE BETWEEN INTERVAL '7 days' PRECEDING AND CURRENT ROW  -- 7日前〜現在

-- 同じ日付が複数行ある場合:
-- ROWS → 物理的に3行前まで
-- RANGE → 7日前の日付まで（複数行が同じ「範囲」に含まれる）
```

## 実践的な使用例

### コホート分析（ユーザーの継続率）

```sql
-- 各ユーザーの初回購入月を計算
WITH user_cohorts AS (
  SELECT
    user_id,
    DATE_TRUNC('month', MIN(created_at)) AS cohort_month
  FROM orders
  GROUP BY user_id
),
monthly_activity AS (
  SELECT
    o.user_id,
    c.cohort_month,
    DATE_TRUNC('month', o.created_at) AS activity_month,
    -- コホート月からの経過月数
    EXTRACT(MONTH FROM AGE(
      DATE_TRUNC('month', o.created_at),
      c.cohort_month
    )) AS months_since_start
  FROM orders o
  JOIN user_cohorts c ON c.user_id = o.user_id
)
SELECT
  cohort_month,
  months_since_start,
  COUNT(DISTINCT user_id) AS active_users
FROM monthly_activity
GROUP BY 1, 2
ORDER BY 1, 2;
```

### ギャップ検出（連続する番号の欠損）

```sql
-- 連続する注文番号の欠番を検出
SELECT
  order_number + 1 AS gap_start,
  LEAD(order_number) OVER (ORDER BY order_number) - 1 AS gap_end
FROM orders
WHERE
  LEAD(order_number) OVER (ORDER BY order_number) - order_number > 1;
```

### パーセンタイル

```sql
-- 各商品カテゴリの価格パーセンタイル
SELECT
  category,
  price,
  PERCENT_RANK() OVER (PARTITION BY category ORDER BY price) AS percentile,
  NTILE(4)       OVER (PARTITION BY category ORDER BY price) AS quartile
FROM products;
```

## パフォーマンスの注意点

```sql
-- 同じOVER句を複数回書くのは無駄（都度計算される）
SELECT
  name,
  salary,
  AVG(salary) OVER (PARTITION BY dept ORDER BY salary),  -- 計算1回
  SUM(salary) OVER (PARTITION BY dept ORDER BY salary),  -- 計算2回（同じウィンドウ）
  MAX(salary) OVER (PARTITION BY dept ORDER BY salary)   -- 計算3回
FROM employees;

-- WINDOW句で再利用（1回の計算で済む）
SELECT
  name,
  salary,
  AVG(salary) OVER w,
  SUM(salary) OVER w,
  MAX(salary) OVER w
FROM employees
WINDOW w AS (PARTITION BY dept ORDER BY salary);
```

## 関連概念

- → [クエリオプティマイザー](./concepts_ddia_query_optimizer.md)（ウィンドウ関数の実行計画）
- → [列指向ストレージ](./concepts_ddia_columnar_storage.md)（OLAPでのウィンドウ関数最適化）
- → [マテリアライズドビュー](./concepts_ddia_materialized_views.md)（重いウィンドウ関数を事前計算）

## 出典・参考文献

- PostgreSQL Documentation, "Window Functions" — postgresql.org/docs/current/tutorial-window.html
- Markus Winand, "Window Functions" — modern-sql.com/feature/window-functions
