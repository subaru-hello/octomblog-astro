---
title: "Amazon Athena SQL 完全ガイド"
description: "S3上のデータをSQLで分析できるAmazon Athenaの使い方を、テーブル定義からクエリ・関数・コスト最適化まで網羅的に解説する"
date: 2023-07-12T08:19:23+09:00
tags: ["AWS", "Athena", "SQL", "データ分析", "S3"]
categories: ["TECH"]
image: images/blog-covers/athena-sql.png
---

## Amazon Athenaとは

Amazon Athenaは、S3に保存されたデータをサーバーレスで直接SQLクエリできるインタラクティブなクエリサービス。インフラの管理が不要で、実行したクエリのスキャンデータ量に応じた従量課金モデルになっている。

### 料金

- **クエリ課金**: スキャンデータ 1TB あたり $5.00
- **最小課金**: 10MB（それ以下でも10MB分として課金）
- Parquet / ORC などの列指向フォーマットを使うとスキャン量を大幅削減できる

---

## データベースとテーブル定義

### データベース作成

```sql
CREATE DATABASE my_database;
```

### テーブル作成（CSV）

```sql
CREATE EXTERNAL TABLE IF NOT EXISTS my_database.logs (
  request_id STRING,
  timestamp  BIGINT,
  user_id    STRING,
  action     STRING
)
ROW FORMAT DELIMITED
  FIELDS TERMINATED BY ','
  LINES TERMINATED BY '\n'
STORED AS TEXTFILE
LOCATION 's3://my-bucket/logs/'
TBLPROPERTIES ('skip.header.line.count'='1');
```

### テーブル作成（JSON）

```sql
CREATE EXTERNAL TABLE events (
  event_type STRING,
  event_time STRING,
  payload    STRING
)
ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe'
STORED AS TEXTFILE
LOCATION 's3://my-bucket/events/';
```

### テーブル作成（Parquet）

列指向フォーマットで圧縮率・クエリ速度ともに最良。

```sql
CREATE EXTERNAL TABLE sales (
  order_id   STRING,
  product_id STRING,
  amount     DOUBLE,
  order_date DATE
)
STORED AS PARQUET
LOCATION 's3://my-bucket/sales-parquet/'
TBLPROPERTIES ('parquet.compress'='SNAPPY');
```

### CTAS（クエリ結果からテーブル作成）

```sql
CREATE TABLE sales_parquet
WITH (
  format         = 'PARQUET',
  external_location = 's3://my-bucket/sales-parquet/',
  parquet_compression = 'SNAPPY'
) AS
SELECT * FROM sales_csv
WHERE YEAR(order_date) = 2023;
```

### テーブル変更（カラム追加）

```sql
ALTER TABLE my_database.logs
ADD COLUMNS (
  ip_address STRING,
  user_agent STRING
);
```

### テーブル削除

```sql
DROP TABLE IF EXISTS my_database.logs;
```

---

## パーティション

### パーティション付きテーブル作成

```sql
CREATE EXTERNAL TABLE access_logs (
  host       STRING,
  identity   STRING,
  user       STRING,
  request    STRING,
  status     INT,
  size       BIGINT
)
PARTITIONED BY (
  year  STRING,
  month STRING,
  day   STRING
)
ROW FORMAT SERDE 'org.apache.hadoop.hive.serde2.RegexSerDe'
WITH SERDEPROPERTIES (
  'serialization.format' = '1',
  'input.regex' = '([^ ]*) ([^ ]*) ([^ ]*) \\[([^\\]]*)\\] "([^"]*)" (-|[0-9]*) (-|[0-9]*)'
)
LOCATION 's3://my-bucket/access-logs/';
```

### パーティション手動追加

```sql
ALTER TABLE access_logs
ADD PARTITION (year='2023', month='07', day='12')
LOCATION 's3://my-bucket/access-logs/year=2023/month=07/day=12/';
```

### パーティション自動検出

```sql
MSCK REPAIR TABLE access_logs;
```

### パーティションプロジェクション（自動パーティション）

```sql
CREATE EXTERNAL TABLE events_projected (
  event_id   STRING,
  event_type STRING
)
PARTITIONED BY (dt STRING)
LOCATION 's3://my-bucket/events/'
TBLPROPERTIES (
  'projection.enabled'         = 'true',
  'projection.dt.type'         = 'date',
  'projection.dt.range'        = '2023-01-01,NOW',
  'projection.dt.format'       = 'yyyy-MM-dd',
  'projection.dt.interval'     = '1',
  'projection.dt.interval.unit'= 'DAYS',
  'storage.location.template'  = 's3://my-bucket/events/dt=${dt}/'
);
```

---

## クエリ構文

### 基本構文

```sql
[ WITH with_query [, ...] ]
SELECT [ ALL | DISTINCT ] select_expression [, ...]
[ FROM from_item [, ...] ]
[ WHERE condition ]
[ GROUP BY [ ALL | DISTINCT ] grouping_element [, ...] ]
[ HAVING condition ]
[ { UNION | INTERSECT | EXCEPT } [ ALL | DISTINCT ] select ]
[ ORDER BY expression [ ASC | DESC ] [ NULLS FIRST | NULLS LAST ] [, ...] ]
[ OFFSET count [ ROW | ROWS ] ]
[ LIMIT [ count | ALL ] ]
```

### WITH句（CTE）

```sql
WITH
monthly_revenue AS (
  SELECT
    DATE_TRUNC('month', order_date) AS month,
    SUM(amount) AS revenue
  FROM sales
  GROUP BY 1
),
prev_month AS (
  SELECT
    month,
    revenue,
    LAG(revenue) OVER (ORDER BY month) AS prev_revenue
  FROM monthly_revenue
)
SELECT
  month,
  revenue,
  prev_revenue,
  (revenue - prev_revenue) / prev_revenue * 100 AS growth_rate
FROM prev_month
ORDER BY month;
```

### GROUP BY / HAVING

```sql
SELECT
  product_id,
  COUNT(*)        AS order_count,
  SUM(amount)     AS total_amount,
  AVG(amount)     AS avg_amount
FROM sales
GROUP BY product_id
HAVING SUM(amount) > 10000
ORDER BY total_amount DESC;
```

### WINDOW関数

```sql
SELECT
  order_id,
  product_id,
  amount,
  SUM(amount)  OVER (PARTITION BY product_id ORDER BY order_date) AS running_total,
  RANK()       OVER (PARTITION BY product_id ORDER BY amount DESC) AS rank_in_product,
  LAG(amount)  OVER (PARTITION BY product_id ORDER BY order_date)  AS prev_amount
FROM sales;
```

### CAST

```sql
SELECT DISTINCT process_id
FROM impressions
WHERE CAST(process_id AS INT) BETWEEN 1500 AND 1800
ORDER BY process_id;
```

### 日付フォーマット変換

```sql
-- 文字列 → DATE
SELECT DATE_PARSE('2023-07-12', '%Y-%m-%d') AS parsed_date;

-- DATE → 文字列
SELECT DATE_FORMAT(order_date, '%Y/%m/%d') AS formatted;

-- UNIX時刻 → タイムスタンプ
SELECT FROM_UNIXTIME(1689123456) AS ts;

-- タイムスタンプ → UNIX時刻
SELECT TO_UNIXTIME(NOW()) AS unix_ts;
```

---

## 関数リファレンス

### 文字列関数

| 関数 | 説明 | 例 |
|------|------|-----|
| `LOWER(s)` | 小文字化 | `LOWER('Hello')` → `'hello'` |
| `UPPER(s)` | 大文字化 | `UPPER('hello')` → `'HELLO'` |
| `LENGTH(s)` | 文字列長 | `LENGTH('abc')` → `3` |
| `SUBSTR(s, pos, len)` | 部分文字列 | `SUBSTR('abcdef', 2, 3)` → `'bcd'` |
| `REPLACE(s, search, replace)` | 置換 | `REPLACE('a-b-c', '-', '/')` |
| `TRIM(s)` | 前後空白除去 | `TRIM('  hi  ')` → `'hi'` |
| `SPLIT(s, delim)` | 区切り文字で配列化 | `SPLIT('a,b,c', ',')` → `['a','b','c']` |
| `REGEXP_LIKE(s, pattern)` | 正規表現マッチ | `REGEXP_LIKE(url, '^https')` |
| `REGEXP_EXTRACT(s, pattern, group)` | 正規表現抽出 | `REGEXP_EXTRACT(path, '/([^/]+)$', 1)` |
| `CONCAT(s1, s2, ...)` | 文字列結合 | `CONCAT(first, ' ', last)` |

### 日付・時刻関数

```sql
-- 現在日時
SELECT NOW(), CURRENT_DATE, CURRENT_TIMESTAMP;

-- 切り捨て
SELECT DATE_TRUNC('month', NOW());   -- 月初
SELECT DATE_TRUNC('year',  NOW());   -- 年初

-- 日付加算
SELECT DATE_ADD('day',  7, CURRENT_DATE);   -- 7日後
SELECT DATE_ADD('month', 1, CURRENT_DATE);  -- 1ヶ月後

-- 差分
SELECT DATE_DIFF('day',  DATE '2023-01-01', DATE '2023-07-12');  -- 日数差
SELECT DATE_DIFF('month', DATE '2023-01-01', DATE '2023-07-12'); -- 月数差

-- 抽出
SELECT
  YEAR(order_date)    AS yr,
  MONTH(order_date)   AS mo,
  DAY(order_date)     AS dy,
  HOUR(event_time)    AS hr,
  MINUTE(event_time)  AS mi;
```

### 数値関数

```sql
SELECT
  ROUND(3.14159, 2),    -- 3.14
  CEIL(3.1),            -- 4
  FLOOR(3.9),           -- 3
  ABS(-5),              -- 5
  MOD(10, 3),           -- 1
  POWER(2, 10),         -- 1024
  SQRT(16),             -- 4.0
  LN(2.718281828),      -- 1.0（自然対数）
  LOG(10, 100);         -- 2.0（底10の対数）
```

### 集計関数

```sql
SELECT
  COUNT(*)                          AS total_rows,
  COUNT(DISTINCT user_id)           AS unique_users,
  SUM(amount)                       AS total,
  AVG(amount)                       AS average,
  MIN(amount)                       AS minimum,
  MAX(amount)                       AS maximum,
  APPROX_DISTINCT(user_id)          AS approx_users,   -- 高速な近似COUNT DISTINCT
  APPROX_PERCENTILE(amount, 0.95)   AS p95_amount;     -- パーセンタイル
```

### JSON関数

```sql
-- JSONフィールド抽出
SELECT
  json_extract_scalar(payload, '$.user_id')     AS user_id,
  json_extract_scalar(payload, '$.event_type')  AS event_type,
  CAST(json_extract_scalar(payload, '$.amount') AS DOUBLE) AS amount
FROM raw_events;

-- JSON配列の展開
SELECT
  order_id,
  item
FROM orders
CROSS JOIN UNNEST(
  CAST(json_extract(items_json, '$') AS ARRAY(VARCHAR))
) AS t(item);
```

---

## Prepared Statement（クエリ再利用）

```sql
-- 作成
PREPARE get_user_orders FROM
  SELECT order_id, amount, order_date
  FROM sales
  WHERE user_id = ? AND order_date >= DATE ?;

-- 実行
EXECUTE get_user_orders USING 'user-123', '2023-01-01';

-- 削除
DEALLOCATE PREPARE get_user_orders;
```

---

## データ型

| 型 | 説明 |
|----|------|
| `BOOLEAN` | TRUE / FALSE |
| `TINYINT` | -128 〜 127 |
| `SMALLINT` | -32768 〜 32767 |
| `INT` / `INTEGER` | 32ビット整数 |
| `BIGINT` | 64ビット整数 |
| `FLOAT` / `REAL` | 32ビット浮動小数点 |
| `DOUBLE` | 64ビット浮動小数点 |
| `DECIMAL(p, s)` | 固定精度小数（金額計算向け） |
| `VARCHAR` / `STRING` | 可変長文字列 |
| `CHAR(n)` | 固定長文字列 |
| `DATE` | 日付（yyyy-MM-dd） |
| `TIMESTAMP` | 日時（yyyy-MM-dd HH:mm:ss.SSS） |
| `ARRAY<T>` | 配列 |
| `MAP<K,V>` | マップ |
| `STRUCT<f:T,...>` | 構造体 |

---

## コスト最適化

### 1. 列指向フォーマットへ変換

CSV/JSON → Parquet/ORC に変換することでスキャン量を 10〜100倍削減できる。

```sql
-- CTASでParquetに変換
CREATE TABLE optimized_sales
WITH (
  format = 'PARQUET',
  external_location = 's3://my-bucket/optimized-sales/',
  parquet_compression = 'SNAPPY'
) AS SELECT * FROM raw_sales_csv;
```

### 2. パーティションを活用

WHERE句でパーティションキーを絞ることでスキャン対象ファイルが減少する。

```sql
-- パーティション条件を必ず指定する
SELECT *
FROM access_logs
WHERE year = '2023' AND month = '07' AND day = '12';
```

### 3. SELECT * を避ける

列指向フォーマットでは必要なカラムだけを指定することでスキャン量を削減できる。

```sql
-- NG: 全カラムスキャン
SELECT * FROM sales;

-- OK: 必要なカラムのみ
SELECT order_id, amount, order_date FROM sales;
```

### 4. クエリ結果の再利用

Athenaは実行結果をS3に保存するため、同一クエリは再実行を避ける。アプリ側でキャッシュするか、CTASで集計テーブルを作成しておく。

### 5. Workgroup でコスト上限設定

```
Workgroup → Settings → Data usage controls
→ Per-query data usage control: 1 GB
```

クエリが閾値を超えるとキャンセルされ過剰な課金を防げる。

---

## よく使うクエリパターン

### S3アクセスログ分析

```sql
SELECT
  requester,
  COUNT(*)              AS request_count,
  SUM(bytes_sent)       AS total_bytes,
  AVG(total_time)       AS avg_latency_ms
FROM s3_access_logs
WHERE
  bucket = 'my-bucket'
  AND year = '2023'
  AND month = '07'
GROUP BY requester
ORDER BY request_count DESC
LIMIT 20;
```

### CloudFrontログ分析

```sql
SELECT
  DATE_TRUNC('hour', FROM_ISO8601_TIMESTAMP(date || 'T' || time || 'Z')) AS hour,
  uri_stem,
  COUNT(*) AS hits,
  SUM(CAST(sc_bytes AS BIGINT)) AS bytes_sent
FROM cloudfront_logs
WHERE date = '2023-07-12'
GROUP BY 1, 2
ORDER BY hits DESC;
```

### ALBアクセスログ分析（5xxエラー率）

```sql
SELECT
  DATE_TRUNC('minute', time) AS minute,
  COUNT(*) AS total,
  SUM(CASE WHEN CAST(elb_status_code AS INT) >= 500 THEN 1 ELSE 0 END) AS errors,
  ROUND(
    100.0 * SUM(CASE WHEN CAST(elb_status_code AS INT) >= 500 THEN 1 ELSE 0 END) / COUNT(*),
    2
  ) AS error_rate_pct
FROM alb_logs
WHERE year = '2023' AND month = '07' AND day = '12'
GROUP BY 1
ORDER BY 1;
```
