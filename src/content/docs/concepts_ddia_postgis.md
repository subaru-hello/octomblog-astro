---
title: 地理空間データとPostGIS
description: 位置情報の格納・距離計算・範囲検索・経路探索をPostgreSQLで実現するPostGISの設計。空間インデックス（GiST/R-Tree）とGeoJSONの扱いを理解する
category: "概念"
tags: ["データ設計", "PostGIS", "地理空間", "PostgreSQL", "空間インデックス", "DDIA"]
emoji: "🗺️"
date: "2026-04-08"
order: 845
series:
  - データ志向アプリケーション設計（DDIA）
source: "PostGIS Documentation / OGC Simple Features Specification"
---

## 定義

**PostGIS**：PostgreSQLに地理空間機能を追加する拡張機能。点・線・ポリゴンなどの幾何データを格納し、距離計算・包含判定・空間結合などを効率的に実行できる。

## なぜ通常のカラムでは不十分か

```sql
-- ナイーブな実装（アンチパターン）
CREATE TABLE stores (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8)
);

-- 「現在地から1km以内のお店」
SELECT *
FROM stores
WHERE
  -- ピタゴラスの定理（地球が平面と仮定）
  SQRT(POWER(latitude - 35.6895, 2) + POWER(longitude - 139.6917, 2)) < 0.009;
-- 問題1: 地球は球体なのでこの計算は不正確（高緯度で誤差が大きくなる）
-- 問題2: インデックスが使えない（SQRT関数のため）→ フルスキャン
```

## PostGISのセットアップ

```sql
CREATE EXTENSION postgis;
CREATE EXTENSION postgis_topology;  -- トポロジー演算が必要な場合

-- バージョン確認
SELECT PostGIS_Version();
```

## 基本的なデータ型と座標系

```sql
-- POINT型（経度・緯度の点）
-- SRID 4326 = WGS84（GPS・GoogleMapsが使う座標系）
CREATE TABLE stores (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  location GEOMETRY(POINT, 4326)  -- 経度・緯度の点
);

-- データ挿入
INSERT INTO stores (name, location) VALUES
  ('新宿店', ST_SetSRID(ST_MakePoint(139.6917, 35.6895), 4326)),
  ('渋谷店', ST_SetSRID(ST_MakePoint(139.7020, 35.6580), 4326)),
  ('池袋店', ST_SetSRID(ST_MakePoint(139.7109, 35.7295), 4326));

-- GeoJSONからも作成できる
INSERT INTO stores (name, location) VALUES
  ('銀座店', ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Point","coordinates":[139.7651, 35.6717]}'), 4326));
```

## 距離計算

```sql
-- ST_Distance: 度単位（不正確）
SELECT name, ST_Distance(location, ST_MakePoint(139.7020, 35.6580)::geometry)
FROM stores;

-- ST_DistanceSphere: メートル単位（球面近似）
SELECT
  name,
  ROUND(ST_DistanceSphere(
    location,
    ST_SetSRID(ST_MakePoint(139.7020, 35.6580), 4326)  -- 渋谷駅
  )::numeric) AS distance_m
FROM stores
ORDER BY distance_m;

-- Geography型を使う（より正確、日本全土でも精度が高い）
ALTER TABLE stores ADD COLUMN location_geo GEOGRAPHY(POINT, 4326);
UPDATE stores SET location_geo = location::geography;

SELECT name, ST_Distance(location_geo, ST_MakePoint(139.7020, 35.6580)::geography) AS distance_m
FROM stores
ORDER BY distance_m;
```

## 範囲検索（半径N km以内）

```sql
-- 渋谷駅から1km以内のお店（Geographyで正確な距離）
SELECT name, ST_Distance(location_geo, ST_MakePoint(139.7020, 35.6580)::geography) AS distance_m
FROM stores
WHERE ST_DWithin(
  location_geo,
  ST_MakePoint(139.7020, 35.6580)::geography,
  1000  -- 1000メートル = 1km
)
ORDER BY distance_m;
```

## 空間インデックス（GiSTインデックス）

```sql
-- GiSTインデックスの作成（R-Treeベース）
CREATE INDEX idx_stores_location ON stores USING GIST (location);
CREATE INDEX idx_stores_location_geo ON stores USING GIST (location_geo);

-- インデックスが使われる確認
EXPLAIN SELECT * FROM stores
WHERE ST_DWithin(location_geo, ST_MakePoint(139.7020, 35.6580)::geography, 1000);
-- → Index Scan using idx_stores_location_geo が表示されれば OK
```

### R-Treeの仕組み

```
GiSTインデックスはR-Tree（Rectangle Tree）を使用:

各ノードが「バウンディングボックス（MBR）」を持つ
  ノード1: [東京都内の全店舗のMBR]
    ノード2: [新宿・渋谷エリアのMBR]
      → 新宿店（点）
      → 渋谷店（点）
    ノード3: [池袋エリアのMBR]
      → 池袋店（点）

検索: クエリの円とMBRが重なるノードだけ探索
      対象外のノードは全部スキップ
```

## ポリゴン操作

```sql
-- 配達エリア（ポリゴン）
CREATE TABLE delivery_zones (
  id SERIAL PRIMARY KEY,
  store_id INT REFERENCES stores(id),
  zone GEOMETRY(POLYGON, 4326)
);

INSERT INTO delivery_zones (store_id, zone) VALUES (
  1,
  ST_GeomFromText('POLYGON((
    139.68 35.67,
    139.70 35.67,
    139.70 35.70,
    139.68 35.70,
    139.68 35.67
  ))', 4326)
);

-- 現在地がどの配達エリアに含まれるか
SELECT s.name
FROM stores s
JOIN delivery_zones dz ON dz.store_id = s.id
WHERE ST_Contains(
  dz.zone,
  ST_SetSRID(ST_MakePoint(139.6950, 35.6850), 4326)  -- ユーザーの現在地
);

-- 2つのエリアの重なり
SELECT ST_Intersection(zone1, zone2) FROM ...;

-- エリアの面積（平方メートル）
SELECT ST_Area(zone::geography) AS area_sq_m FROM delivery_zones;
```

## GeoJSONとの連携

```sql
-- PostGIS → GeoJSON（フロントエンドへの送信）
SELECT
  name,
  ST_AsGeoJSON(location)::json AS geojson
FROM stores;
-- 結果: {"type":"Point","coordinates":[139.6917,35.6895]}

-- GeoJSON → PostGIS（フロントエンドからの受信）
SELECT ST_GeomFromGeoJSON($1) AS geometry;
```

```typescript
// TypeScriptでのGeoJSON操作
const result = await db.query(`
  SELECT name, ST_AsGeoJSON(location)::json AS geometry
  FROM stores
  WHERE ST_DWithin(location_geo, ST_MakePoint($1, $2)::geography, $3)
  ORDER BY location_geo <-> ST_MakePoint($1, $2)::geography
  LIMIT 10
`, [longitude, latitude, radiusMeters]);

// GeoJSON Feature Collectionとして返す
const features = result.rows.map(row => ({
  type: 'Feature',
  geometry: row.geometry,
  properties: { name: row.name },
}));
```

## KNN（K近傍）検索

```sql
-- <-> 演算子でインデックスを使ったKNN検索
-- 渋谷駅に最も近い5店舗
SELECT
  name,
  ROUND(location_geo <-> ST_MakePoint(139.7020, 35.6580)::geography) AS distance_m
FROM stores
ORDER BY location_geo <-> ST_MakePoint(139.7020, 35.6580)::geography
LIMIT 5;
-- → GiSTインデックスを使って効率的に検索（全件スキャンなし）
```

## クラスタリング（ヒートマップ用）

```sql
-- グリッドベースの集計（ヒートマップ用）
SELECT
  ST_SnapToGrid(location, 0.01) AS grid_point,  -- 約1km格子
  COUNT(*) AS count
FROM stores
GROUP BY grid_point;
```

## 主な用途

| 用途 | 使う関数 |
|---|---|
| 近くのお店を探す | ST_DWithin, <-> |
| 配達エリア判定 | ST_Contains, ST_Within |
| 2点間の距離 | ST_Distance, ST_DistanceSphere |
| エリアの重なり | ST_Intersects, ST_Intersection |
| ジオコーディング | Nominatim + PostGIS |
| ルート検索 | pgRouting（別拡張） |

## 関連概念

- → [ストレージとインデックス](./concepts_ddia_storage_indexing.md)（R-TreeとBツリーの違い）
- → [全文検索と転置インデックス](./concepts_ddia_full_text_search.md)（GiSTインデックスの別の応用）
- → [パーティショニング](./concepts_ddia_partitioning.md)（地理的なパーティション分割）

## 出典・参考文献

- PostGIS Documentation — postgis.net/docs
- OGC Simple Features Specification — ogc.org
- Boundless, "Introduction to PostGIS" — workshops.boundlessgeo.com/postgis-intro
