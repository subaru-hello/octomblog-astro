---
title: 全文検索と転置インデックス
description: Elasticsearchがなぜ速いか。転置インデックスの構造、TF-IDF/BM25によるスコアリング、アナライザーの設計を理解する
category: "概念"
tags: ["データ設計", "全文検索", "Elasticsearch", "転置インデックス", "BM25", "DDIA"]
emoji: "🔎"
date: "2026-04-07"
order: 820
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017) Chapter 3"
---

## 定義

**全文検索（Full-Text Search）**：テキストの部分一致や関連性スコアによる検索。通常のDBインデックスは完全一致・前方一致が得意だが、全文検索は「この文書はクエリにどれだけ関連しているか」を計算して返す。

## なぜ通常のインデックスでは不十分か

```sql
-- LIKE検索の限界
SELECT * FROM articles WHERE body LIKE '%機械学習%';
-- → フルスキャン、遅い、AND/OR条件が難しい、関連度ランキングがない

-- 通常のBツリーインデックス
CREATE INDEX ON articles (body);
-- → 前方一致（LIKE 'keyword%'）にしか使えない
```

全文検索が必要な場面：
- 記事・ドキュメントの横断検索
- ECサイトの商品検索（関連度順）
- ログ分析（フリーテキスト条件）

## 転置インデックス（Inverted Index）

全文検索の核心となるデータ構造。

```
通常のインデックス（正引き）:
  Document → Contents
  doc1 → "機械学習はデータから学ぶ技術"
  doc2 → "深層学習は機械学習の一部"

転置インデックス（逆引き）:
  Term → Posting List（その語が出現するドキュメントリスト）
  "機械学習" → [(doc1, pos=0, freq=1), (doc2, pos=2, freq=1)]
  "データ"   → [(doc1, pos=3, freq=1)]
  "深層学習" → [(doc2, pos=0, freq=1)]
  "学ぶ"     → [(doc1, pos=5, freq=1)]
```

### 検索の流れ

```
クエリ: "機械学習 データ"

1. アナライザーでトークン化: ["機械学習", "データ"]
2. 各トークンのPosting Listを取得:
   "機械学習" → [doc1, doc2]
   "データ"   → [doc1]
3. 積集合（AND）または和集合（OR）:
   AND → [doc1]
4. 各ドキュメントのスコアを計算
5. スコア順に返す
```

## スコアリング：TF-IDFとBM25

### TF-IDF（Term Frequency - Inverse Document Frequency）

```
TF（Term Frequency）: その文書内での出現頻度
  tf(t, d) = (語tの文書dでの出現回数) / (文書dの総語数)
  
IDF（Inverse Document Frequency）: 全体での珍しさ
  idf(t) = log(全文書数 / 語tが出現する文書数)
  
  → 「の」「は」など全文書に出る語のIDFは低い
  → 専門用語や固有名詞のIDFは高い

スコア = TF × IDF
```

### BM25（Best Match 25）

ElasticsearchのデフォルトスコアリングアルゴリズムはTF-IDFの改良版。

```
k1（飽和パラメータ）: 同じ語の繰り返しによるスコア上昇を抑制
  TF-IDFは100回出現すると100倍のスコアになる
  BM25はある程度で飽和する（普通 k1=1.2）

b（長さ正規化）: 長い文書が有利にならないよう調整
  長い文書は単純に語が多く出現しやすい
  b=0.75 が一般的なデフォルト
```

## Elasticsearchのセグメント構造

Elasticsearchは[LSMツリー](./concepts_ddia_storage_indexing.md)に似た設計で転置インデックスを管理する。

```
インデックス
  └── シャード（パーティション）
        └── セグメント（不変のLuceneインデックス）
              ├── セグメント1（古い、大きい）
              ├── セグメント2
              └── セグメント3（新しい、小さい）

書き込みフロー:
  1. 新規ドキュメント → インメモリバッファ
  2. Refreshごと（デフォルト1秒）→ 新しいセグメントとしてフラッシュ
  3. バックグラウンドでセグメントをマージ（コンパクション）
  
削除はセグメントを書き換えず、削除フラグ（.del）を設定
マージ時に物理削除される
```

**Refresh vs Flush vs Merge**：
- Refresh（1秒）: インメモリ → 検索可能なセグメントに（near-real-time）
- Flush: セグメントをディスクに永続化（Translogを空に）
- Merge: 複数セグメントを1つに統合（I/Oコストあり）

## アナライザーの設計

テキストを「どうトークンに分割するか」がスコアリングの前提になる。

```
アナライザーのパイプライン:
  Character Filter → Tokenizer → Token Filter

例: "東京都渋谷区でのPython機械学習勉強会"

Character Filter:
  HTML除去、文字正規化（全角→半角など）

Tokenizer（日本語の場合）:
  → Kuromoji（形態素解析）
  ["東京", "都", "渋谷", "区", "Python", "機械", "学習", "勉強", "会"]

Token Filter:
  → ストップワード除去（"で", "の" など）
  → 同義語展開（"ML" → "機械学習"）
  → 小文字化（"Python" → "python"）
```

```json
// Elasticsearchのアナライザー設定例
{
  "settings": {
    "analysis": {
      "analyzer": {
        "ja_analyzer": {
          "type": "custom",
          "tokenizer": "kuromoji_tokenizer",
          "filter": ["kuromoji_part_of_speech", "lowercase", "ja_stop"]
        }
      }
    }
  }
}
```

## マルチフィールドとブースティング

```json
// タイトルに高いブーストをかける
{
  "query": {
    "multi_match": {
      "query": "機械学習",
      "fields": ["title^3", "body^1", "tags^2"]
    }
  }
}
```

## ElasticsearchとDBの役割分担

```
書き込み: PostgreSQL（整合性の保証）
  ↓ 非同期同期（CDC or アプリレベル）
全文検索: Elasticsearch（スコアリング・集計）

注意:
  - 2つのシステム間の同期は最終的一貫性
  - 書き込み直後はESに反映されていないことがある
  - 削除の同期漏れはESにゴミデータが残る
```

## ベクトル検索（セマンティック検索）

近年のLLM時代に重要になった検索方式。

```
従来の全文検索:
  "犬" で検索 → "犬" という語を含む文書を返す

ベクトル検索（Semantic Search）:
  "犬" を埋め込みベクトルに変換
  → コサイン類似度の高いベクトルを持つ文書を返す
  → "ペット", "柴犬", "動物病院" も関連として出てくる

実装: pgvector（PostgreSQL拡張）、Qdrant、Pinecone、Weaviate
Elasticsearch 8.x以降もKNN検索をサポート
```

## 関連概念

- → [ストレージとインデックス](./concepts_ddia_storage_indexing.md)（LSMツリーとの類似）
- → [データモデル](./concepts_ddia_data_models.md)（検索特化のストレージ選択）
- → [キャッシュ戦略](./concepts_ddia_cache_strategy.md)（検索結果のキャッシング）
- → [パーティショニング](./concepts_ddia_partitioning.md)（Elasticsearchのシャーディング）

## 出典・参考文献

- Martin Kleppmann, *Designing Data-Intensive Applications* (2017) Chapter 3
- Elasticsearch Documentation — elastic.co/docs
- Robertson & Zaragoza, "The Probabilistic Relevance Framework: BM25 and Beyond" (2009)
