---
title: "データエンジニアリングを体系的に学ぶための地図 — DDIAを軸に49の概念を整理した"
description: "Designing Data-Intensive Applicationsを軸に、データベース・分散システム・データパイプラインの49概念を8つのテーマに整理した学習マップ。どこから学べばいいか迷っている人の入口になれば。"
date: 2026-04-09
author: subaru
authorEmoji: 🐙
tags: [DDIA, データ設計, データベース, 分散システム, アーキテクチャ]
categories: [engineering]
image: images/blog-covers/ddia-learning-map.jpeg
draft: false
series: []
---

Martin KleppmannのDDIA（Designing Data-Intensive Applications）は、データシステムを作る人間が一度は読むべきと言われる一冊だ。

ただ、読み始めると「知識の前提が多い」「章をまたいで概念が出てくる」という壁にぶつかる。手を動かしながら整理しないと自分の中に残らない。そこで、DDIAを軸に自分でまとめ直した49本のドキュメントを書いた。

8つのテーマに分かれている。この記事はその入口だ。

---

## 全体マップ

| # | テーマ | 記事数 | カバーする概念 |
|---|---|---|---|
| 1 | DDIAの骨格 | 13 | レプリケーション・トランザクション・分散合意・バッチ/ストリーム |
| 2 | ストレージ・並行制御 | 4 | MVCC・列指向・ベクタークロック・CRDT |
| 3 | クエリ・パフォーマンス | 4 | EXPLAIN・キャッシュ・全文検索・N+1 |
| 4 | 分散DBの実装 | 4 | NewSQL・WAL・分散ID・コンシステントハッシング |
| 5 | 運用・信頼性 | 6 | コネクションプール・マイグレーション・Outbox・PITR・GDPR |
| 6 | PostgreSQL専門機能 | 9 | RLS・ウィンドウ関数・正規化・PostGIS・セキュリティ |
| 7 | 専門型DB | 3 | 時系列・グラフ・ベクトル |
| 8 | モダンデータ基盤 | 6 | dbt・クラウドDB・Lakehouse・データコントラクト・OTel |

---

## テーマ1: DDIAの骨格（13記事）

DDIAの全12章に対応するコア。「なぜデータシステムは壊れるのか」という問いから始まり、データモデルの比較、ストレージエンジンの設計、レプリケーション・シャーディング・トランザクションの仕組み、分散システムの本質的な困難、Raftや2PCによる合意プロトコル、MapReduce→Sparkのバッチ処理、Kafkaのストリーム処理まで一通り網羅する。

**ここを読めば**：RDBとNoSQLをトレードオフで語れるようになる。「CAP定理ってなんですか」に正確に答えられるようになる。

- [DDIAの概観 — 信頼性・スケーラビリティ・保守性](/docs/concepts_ddia_overview)
- [データモデルの比較 — リレーショナル・ドキュメント・グラフ](/docs/concepts_ddia_data_models)
- [ストレージとインデックス — BツリーとLSMツリー](/docs/concepts_ddia_storage_indexing)
- [レプリケーション — シングルリーダー/マルチリーダー/リーダーレス](/docs/concepts_ddia_replication)
- [パーティショニング — シャーディング戦略](/docs/concepts_ddia_partitioning)
- [トランザクションとACID — 分離レベルの設計](/docs/concepts_ddia_transactions)
- [分散システムの困難 — 時刻・ネットワーク・GC停止](/docs/concepts_ddia_distributed_problems)
- [一貫性と合意 — Raft・2PC・線形化可能性](/docs/concepts_ddia_consistency_consensus)
- [バッチ処理 — MapReduceからSparkへ](/docs/concepts_ddia_batch_processing)
- [ストリーム処理 — Kafkaとウィンドウ集計](/docs/concepts_ddia_stream_processing)
- [エンコーディングとスキーマ進化 — Protobuf・Avro・互換性](/docs/concepts_ddia_encoding)
- [Sagaパターン — 分散トランザクションの設計](/docs/concepts_ddia_sagas)
- [データシステムの統合設計 — CDC・データメッシュ・Kappa](/docs/concepts_ddia_future)

---

## テーマ2: ストレージ・並行制御の深掘り（4記事）

DDIAの「どう書いているか」ではなく「なぜそう書くのか」の部分。PostgreSQLがどうやって同時アクセスを捌いているか（MVCC）、OLAPがなぜParquetを使うのか（列指向）、分散システムで「どのイベントが先か」をどう決めるか（ベクタークロック）、競合なしで値を合算する方法（CRDT）。

**ここを読めば**：VACUUMが何をしているか説明できる。`SELECT FOR UPDATE` との違いが分かる。

- [MVCC — PostgreSQLの並行制御の仕組み](/docs/concepts_ddia_mvcc)
- [列指向ストレージ — ParquetとOLAPの設計](/docs/concepts_ddia_columnar_storage)
- [ベクタークロック — 分散システムの因果順序](/docs/concepts_ddia_vector_clock)
- [CRDT — 競合なしで合算するデータ構造](/docs/concepts_ddia_crdt)

---

## テーマ3: クエリ・パフォーマンス（4記事）

クエリが遅い原因を特定して直す技術。`EXPLAIN ANALYZE` の読み方からコストベースオプティマイザーの仕組み、Redisのキャッシュ戦略の使い分け（Cache-Aside/Write-Through/Write-Behind）、Elasticsearchの転置インデックスとBM25スコアリング、ORMが密かに生み出すN+1問題とDataLoaderによる解決まで。

**ここを読めば**：「インデックス貼ったのに遅い」の原因を体系的に診断できる。

- [クエリオプティマイザーとEXPLAIN](/docs/concepts_ddia_query_optimizer)
- [キャッシュ戦略 — Redis・Cache-Aside・Write-Through](/docs/concepts_ddia_cache_strategy)
- [全文検索と転置インデックス — ElasticsearchとBM25](/docs/concepts_ddia_full_text_search)
- [N+1問題とDataLoader](/docs/concepts_ddia_n_plus_one)

---

## テーマ4: 分散DBの実装（4記事）

「普通のPostgreSQL」を超えたい場面の技術。Google SpannerとCockroachDBが実現するグローバル分散トランザクション（NewSQL）、WALを使ったCDCとDebeziumによるイベントストリーミング、分散システムでソート可能なIDをどう設計するか（UUID v7・ULID）、ノードを増減しても偏りが少ないコンシステントハッシング。

- [NewSQL — Spanner・CockroachDB・TiDB](/docs/concepts_ddia_newsql)
- [WALと論理レプリケーション — DebeziumとCDC](/docs/concepts_ddia_wal_replication)
- [分散ID — UUID v7・ULID・Snowflake ID](/docs/concepts_ddia_distributed_id)
- [コンシステントハッシング — リングと仮想ノード](/docs/concepts_ddia_consistent_hashing)

---

## テーマ5: 運用・信頼性（6記事）

「作る」より「壊さない・直す」ための技術。PgBouncerによる接続管理、無停止でスキーマを変える Expand-Contract パターン、マイクロサービス間の結果整合性を保つ Outbox パターン、障害からのデータ復旧（pgBackRest・PITR）、サービス間の負荷伝搬を止める Circuit Breaker、GDPRへの技術的対応（Crypto-Shredding）。

**ここを読めば**：「マイグレーションで本番を止めずに済む方法」と「障害時にどこまで戻せるか」に答えられる。

- [コネクションプーリング — PgBouncerの設計](/docs/concepts_ddia_connection_pooling)
- [ゼロダウンタイムマイグレーション — Expand-Contractパターン](/docs/concepts_ddia_zero_downtime_migration)
- [Outbox/Inboxパターン — At-least-once配信の保証](/docs/concepts_ddia_outbox_pattern)
- [バックアップとPITR — pgBackRestとWALアーカイブ](/docs/concepts_ddia_backup_pitr)
- [バックプレッシャーとCircuit Breaker](/docs/concepts_ddia_backpressure)
- [データプライバシーとCrypto-Shredding — GDPRの技術対応](/docs/concepts_ddia_data_privacy)

---

## テーマ6: PostgreSQL専門機能（9記事）

PostgreSQLをフルに使い倒すための知識。テナントごとにデータを分離する Row Level Security、クエリで前後の行を参照するウィンドウ関数、データベース設計の基礎である正規化理論（1NF〜BCNF）、位置情報を扱う PostGIS、アンチパターンの代名詞 EAV 設計の何が問題か、遅くなりがちなクエリを診断する pg_stat_statements、など。

- [Row Level Security — マルチテナントの行単位アクセス制御](/docs/concepts_ddia_row_level_security)
- [DBアンチパターン — EAVとポリモーフィック関連](/docs/concepts_ddia_db_antipatterns)
- [マテリアライズドビュー — リフレッシュ戦略の設計](/docs/concepts_ddia_materialized_views)
- [DBモニタリング — pg_stat_statementsとPrometheus](/docs/concepts_ddia_db_observability)
- [垂直パーティショニング — 列の分割とTOAST](/docs/concepts_ddia_vertical_partitioning)
- [ウィンドウ関数 — ROW_NUMBER・LAG・LEAD・移動平均](/docs/concepts_ddia_window_functions)
- [正規化理論 — 1NFからBCNFまで](/docs/concepts_ddia_normalization)
- [地理空間データとPostGIS — 距離検索・GiSTインデックス](/docs/concepts_ddia_postgis)
- [DBセキュリティと権限管理 — SQL Injection・GRANT・pgaudit](/docs/concepts_ddia_db_security)

---

## テーマ7: 専門型DB（3記事）

RDB・NoSQLに収まらない特殊なデータ構造のための専用エンジン。IoTや金融系で必須のTimescaleDB（時系列データ）、人と人のつながりを辿るNeo4j（グラフDB）、類似文書・類似画像を検索するpgvector・HNSW（ベクトルDB）。ChatGPTに代表されるRAGシステムの土台になる。

- [時系列DBとTimescaleDB — 継続的な集計と圧縮](/docs/concepts_ddia_timeseries_db)
- [グラフDB — Neo4j・CypherとPageRank](/docs/concepts_ddia_graph_db)
- [ベクトルDBとpgvector — HNSWとRAGの設計](/docs/concepts_ddia_vector_db)

---

## テーマ8: モダンデータ基盤（6記事）

2020年代のデータエンジニアリングのスタック。dbtによるELT変換パイプライン、Aurora・Neon・PlanetScaleのクラウドDB比較（コンピュートとストレージの分離）、Apache IcebergとDelta Lakeが実現するLakehouse、Producer/Consumer間のスキーマ契約を管理するデータコントラクト、OpenTelemetryでアプリからDBへのクエリをトレースIDで追う方法まで。

- [dbtとデータ変換パイプライン — ELTのモデル定義](/docs/concepts_ddia_dbt_pipeline)
- [ジョブキューの設計 — BullMQとSKIP LOCKED](/docs/concepts_ddia_job_queue)
- [クラウドDBの設計思想と選択基準 — Aurora・Neon・PlanetScale](/docs/concepts_ddia_cloud_db)
- [Lakehouse — Apache IcebergとDelta Lakeの設計](/docs/concepts_ddia_lakehouse)
- [データコントラクト — Producer/Consumer間のスキーマ契約](/docs/concepts_ddia_data_contract)
- [OpenTelemetryとDBトレーシング — クエリをトレースIDで追う](/docs/concepts_ddia_opentelemetry_db)

---

## どこから読むか

DDIAを通読しようとして挫折した経験があるなら、**テーマ1の最初の1本**（[DDIAの概観](/docs/concepts_ddia_overview)）から読んでほしい。信頼性・スケーラビリティ・保守性という3軸で、後続の記事がどこに位置づけられるかが分かる。

実務のRDB設計力を上げたいなら、**テーマ3→テーマ6**の順がおすすめだ。クエリのチューニング → PostgreSQL固有の機能、という実践的な順序になる。

分散システムの設計に興味があるなら、**テーマ1→テーマ2→テーマ4**の順で理論を積んでいく流れが効く。

---

## 全49記事インデックス

| テーマ | 記事 |
|---|---|
| **DDIAの骨格** | [概観](/docs/concepts_ddia_overview) / [データモデル](/docs/concepts_ddia_data_models) / [ストレージ・インデックス](/docs/concepts_ddia_storage_indexing) / [レプリケーション](/docs/concepts_ddia_replication) / [パーティショニング](/docs/concepts_ddia_partitioning) / [トランザクション](/docs/concepts_ddia_transactions) / [分散システムの困難](/docs/concepts_ddia_distributed_problems) / [一貫性と合意](/docs/concepts_ddia_consistency_consensus) / [バッチ処理](/docs/concepts_ddia_batch_processing) / [ストリーム処理](/docs/concepts_ddia_stream_processing) / [エンコーディング](/docs/concepts_ddia_encoding) / [Saga](/docs/concepts_ddia_sagas) / [統合設計](/docs/concepts_ddia_future) |
| **ストレージ・並行制御** | [MVCC](/docs/concepts_ddia_mvcc) / [列指向](/docs/concepts_ddia_columnar_storage) / [ベクタークロック](/docs/concepts_ddia_vector_clock) / [CRDT](/docs/concepts_ddia_crdt) |
| **クエリ・パフォーマンス** | [クエリオプティマイザー](/docs/concepts_ddia_query_optimizer) / [キャッシュ戦略](/docs/concepts_ddia_cache_strategy) / [全文検索](/docs/concepts_ddia_full_text_search) / [N+1問題](/docs/concepts_ddia_n_plus_one) |
| **分散DBの実装** | [NewSQL](/docs/concepts_ddia_newsql) / [WALとCDC](/docs/concepts_ddia_wal_replication) / [分散ID](/docs/concepts_ddia_distributed_id) / [コンシステントハッシング](/docs/concepts_ddia_consistent_hashing) |
| **運用・信頼性** | [コネクションプール](/docs/concepts_ddia_connection_pooling) / [無停止マイグレーション](/docs/concepts_ddia_zero_downtime_migration) / [Outboxパターン](/docs/concepts_ddia_outbox_pattern) / [バックアップ・PITR](/docs/concepts_ddia_backup_pitr) / [Circuit Breaker](/docs/concepts_ddia_backpressure) / [Crypto-Shredding](/docs/concepts_ddia_data_privacy) |
| **PostgreSQL専門機能** | [RLS](/docs/concepts_ddia_row_level_security) / [DBアンチパターン](/docs/concepts_ddia_db_antipatterns) / [マテリアライズドビュー](/docs/concepts_ddia_materialized_views) / [DBモニタリング](/docs/concepts_ddia_db_observability) / [垂直パーティショニング](/docs/concepts_ddia_vertical_partitioning) / [ウィンドウ関数](/docs/concepts_ddia_window_functions) / [正規化理論](/docs/concepts_ddia_normalization) / [PostGIS](/docs/concepts_ddia_postgis) / [DBセキュリティ](/docs/concepts_ddia_db_security) |
| **専門型DB** | [時系列DB](/docs/concepts_ddia_timeseries_db) / [グラフDB](/docs/concepts_ddia_graph_db) / [ベクトルDB](/docs/concepts_ddia_vector_db) |
| **モダンデータ基盤** | [dbt](/docs/concepts_ddia_dbt_pipeline) / [ジョブキュー](/docs/concepts_ddia_job_queue) / [クラウドDB](/docs/concepts_ddia_cloud_db) / [Lakehouse](/docs/concepts_ddia_lakehouse) / [データコントラクト](/docs/concepts_ddia_data_contract) / [OpenTelemetry](/docs/concepts_ddia_opentelemetry_db) |
