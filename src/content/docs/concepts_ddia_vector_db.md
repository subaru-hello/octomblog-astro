---
title: ベクトルDBとpgvector
description: LLM時代の埋め込みベクトル検索の仕組み。コサイン類似度・近似最近傍探索（ANN）・HNSWインデックスの設計、pgvectorとQdrant/Pineconeの使い分けを理解する
category: "概念"
tags: ["データ設計", "ベクトルDB", "pgvector", "LLM", "近似最近傍探索", "DDIA"]
emoji: "🧲"
date: "2026-04-08"
order: 840
series:
  - データ志向アプリケーション設計（DDIA）
source: "pgvector Documentation / Qdrant Documentation"
---

## 定義

**ベクトルDB**：高次元のベクトル（埋め込み）を格納し、クエリベクトルに最も近いベクトルを効率的に検索するデータベース。LLMが生成する埋め込みをセマンティック検索・レコメンデーション・RAGに活用するための基盤。

## なぜ通常のインデックスでは不十分か

```
通常のBツリーインデックス:
  完全一致・範囲検索に最適
  「id = 123」「price BETWEEN 100 AND 200」

ベクトル検索の問い:
  「このテキスト（1536次元のベクトル）に最も意味が近いドキュメントを返せ」
  → Bツリーは次元が増えると指数的に遅くなる（次元の呪い）
  → 全ベクトルとの距離を計算すると O(N×D) → 大規模DBでは現実的でない
```

## 埋め込みベクトル（Embedding）の仕組み

```
テキスト → LLM（text-embedding-3-small等）→ 数値ベクトル

"猫は動物です" → [0.02, -0.15, 0.87, ..., 0.31]  // 1536次元
"犬は哺乳類です" → [0.03, -0.12, 0.84, ..., 0.28]  // 意味が近いので近いベクトル
"株価が上昇した" → [-0.91, 0.43, -0.21, ..., 0.67]  // 意味が違うので遠いベクトル

類似度:
  コサイン類似度: ベクトルの向きの近さ（-1〜1）
  L2距離（ユークリッド距離）: ベクトルの距離
  内積（Dot Product）: 正規化済みベクトルならコサイン類似度と等価
```

## 近似最近傍探索（ANN）

正確な最近傍を全件スキャンすると遅い。ANNは「近似的に近い」ベクトルを高速に返す。

### HNSW（Hierarchical Navigable Small World）

pgvectorとQdrantが採用する最も広く使われるANNアルゴリズム。

```
アイデア: グラフ構造で「近い点への近道」を事前に構築

多層グラフ:
  Layer 2（粗い）: 少数のノード、長距離のエッジ → 大まかな方向へ高速移動
  Layer 1（中間）: より多くのノード
  Layer 0（細かい）: 全ノード、短距離のエッジ → 精密な最近傍を探す

検索:
  Layer 2から始めてクエリに近いノードに移動
  Layer 0まで降りてきたら局所的な最近傍を返す
  
特性:
  構築: O(N log N)
  検索: O(log N)
  精度とスピードのトレードオフをef_search（探索幅）で調整
```

## pgvectorの使い方

PostgreSQLの拡張機能として動作。既存のPostgreSQLスタックにベクトル検索を追加できる。

```sql
-- インストール
CREATE EXTENSION vector;

-- ベクトルカラムを持つテーブル
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  content TEXT,
  embedding vector(1536),   -- OpenAI text-embedding-3-small の次元数
  metadata JSONB
);

-- HNSWインデックスの作成
CREATE INDEX ON documents
  USING hnsw (embedding vector_cosine_ops)  -- コサイン類似度
  WITH (m = 16, ef_construction = 64);
-- m: 各ノードのエッジ数（多いほど精度↑、メモリ↑）
-- ef_construction: 構築時の探索幅（多いほど精度↑、構築時間↑）

-- または IVFFlat（メモリ効率が良いが精度がやや低い）
CREATE INDEX ON documents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);  -- クラスター数（sqrt(N)が目安）
```

### 類似度検索

```sql
-- クエリベクトルに最も近いドキュメントを10件取得
SELECT
  id,
  content,
  1 - (embedding <=> '[0.1, 0.2, ...]'::vector) AS similarity
FROM documents
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector  -- <=> はコサイン距離
LIMIT 10;

-- 演算子:
-- <=>  コサイン距離（1 - コサイン類似度）
-- <->  L2距離（ユークリッド距離）
-- <#>  負の内積
```

### アプリケーションコードとの統合

```typescript
import OpenAI from 'openai';
import { Pool } from 'pg';

const openai = new OpenAI();
const pool = new Pool();

// テキストを埋め込みに変換してDBに保存
async function indexDocument(content: string, metadata: object) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: content,
  });
  const embedding = response.data[0].embedding;

  await pool.query(
    'INSERT INTO documents (content, embedding, metadata) VALUES ($1, $2, $3)',
    [content, JSON.stringify(embedding), metadata]
  );
}

// セマンティック検索
async function semanticSearch(query: string, limit = 10) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });
  const queryEmbedding = response.data[0].embedding;

  const result = await pool.query(
    `SELECT id, content, metadata,
            1 - (embedding <=> $1) AS similarity
     FROM documents
     ORDER BY embedding <=> $1
     LIMIT $2`,
    [JSON.stringify(queryEmbedding), limit]
  );
  return result.rows;
}
```

## RAG（Retrieval-Augmented Generation）への応用

```
RAGのフロー:
  1. ユーザーの質問をEmbeddingに変換
  2. ベクトルDBで類似ドキュメントを検索
  3. 検索結果をコンテキストとしてLLMに渡す
  4. LLMが回答を生成

メリット:
  LLMが学習していない最新情報・社内情報を参照できる
  ハルシネーションを減らせる（根拠となる文書を提供）
  
実装例:
  質問: "弊社のQ3売上はどうでしたか？"
  → Embedding → ベクトル検索 → 「Q3決算報告書」を取得
  → "以下の資料に基づいて回答してください: [決算報告書]..."
  → LLMが根拠に基づいた回答を生成
```

## ハイブリッド検索

全文検索（キーワード）とベクトル検索（意味）を組み合わせる。

```sql
-- pgvector + PostgreSQLの全文検索を組み合わせる
SELECT
  id,
  content,
  -- 全文検索スコア
  ts_rank(to_tsvector('japanese', content), plainto_tsquery('japanese', $1)) AS fts_score,
  -- ベクトル類似度
  1 - (embedding <=> $2::vector) AS vector_score
FROM documents
WHERE
  to_tsvector('japanese', content) @@ plainto_tsquery('japanese', $1)  -- キーワードフィルタ
ORDER BY
  -- 重み付けで組み合わせ（RRF: Reciprocal Rank Fusion が一般的）
  0.5 * ts_rank(...) + 0.5 * (1 - (embedding <=> $2::vector)) DESC
LIMIT 10;
```

## pgvector vs 専用ベクトルDB

| 観点 | pgvector | Qdrant / Pinecone / Weaviate |
|---|---|---|
| 既存スタック | PostgreSQLのまま | 別システムが必要 |
| スケール | PostgreSQLの上限（〜1億件が目安） | 数十億件以上 |
| 機能 | シンプル | フィルタリング・スパースベクトル・マルチベクトル |
| 管理コスト | 低い | 別途運用が必要 |
| 一貫性 | PostgreSQLのACID | 最終的一貫性 |
| 適した用途 | 中規模RAG・プロトタイプ | 大規模プロダクション |

## インデックスのチューニング

```sql
-- 検索精度を上げる（遅くなる）
SET hnsw.ef_search = 200;  -- デフォルト40

-- インデックスのサイズ確認
SELECT pg_size_pretty(pg_relation_size('documents_embedding_idx'));

-- 精度の確認（ANNの近似誤差）
-- 正確な最近傍(Exact KNN)とANNの結果を比較
SELECT COUNT(*) FROM (
  SELECT id FROM documents ORDER BY embedding <=> $1 LIMIT 10
) ann
WHERE id IN (
  -- インデックスを使わない正確な検索
  SELECT id FROM documents ORDER BY embedding <-> $1 LIMIT 10
);
-- → 10に近いほど精度が高い
```

## 関連概念

- → [全文検索と転置インデックス](./concepts_ddia_full_text_search.md)（ハイブリッド検索の組み合わせ）
- → [ストレージとインデックス](./concepts_ddia_storage_indexing.md)（HNSWインデックスの物理的な格納）
- → [キャッシュ戦略](./concepts_ddia_cache_strategy.md)（Embedding計算結果のキャッシング）

## 出典・参考文献

- pgvector Documentation — github.com/pgvector/pgvector
- Yu A. Malkov & D. A. Yashunin, "Efficient and Robust Approximate Nearest Neighbor Search Using HNSW" (2016)
- Qdrant Documentation — qdrant.tech/documentation
