---
title: "DDIAを読んで49本のドキュメントを書いた"
description: "Designing Data-Intensive Applicationsを読みながら、データベース・分散システム・データパイプラインの49概念を8テーマに整理した。学習の記録と全記事へのリンク。"
date: 2026-04-09
author: subaru
authorEmoji: 🐙
tags: [DDIA, データ設計, データベース, 分散システム, アーキテクチャ]
categories: [engineering]
image: images/blog-covers/ddia-learning-map.jpeg
draft: false
series: []
---

DDIAを読んでいた。

読み進めるほど「頭に入れようとすると忘れる、書かないと残らない」という感じがしてきて、気づいたら49本のドキュメントを書いていた。最初は3本くらいのつもりだったが、「ここも整理したい」「この概念と繋がっている」という連鎖が止まらなかった。

8つのテーマに分かれている。

---

## テーマ一覧

| # | テーマ | 記事数 | 主な概念 |
|---|---|---|---|
| 1 | DDIAの骨格 | 13 | レプリケーション・トランザクション・分散合意・Kafka |
| 2 | ストレージ・並行制御 | 4 | MVCC・列指向・ベクタークロック・CRDT |
| 3 | クエリ・パフォーマンス | 4 | EXPLAIN・キャッシュ・全文検索・N+1 |
| 4 | 分散DBの実装 | 4 | NewSQL・WAL・分散ID・コンシステントハッシング |
| 5 | 運用・信頼性 | 6 | コネクションプール・マイグレーション・Outbox・PITR |
| 6 | PostgreSQL専門機能 | 9 | RLS・ウィンドウ関数・正規化・PostGIS・セキュリティ |
| 7 | 専門型DB | 3 | 時系列・グラフ・ベクトル |
| 8 | モダンデータ基盤 | 6 | dbt・クラウドDB・Lakehouse・データコントラクト |

---

## テーマ1: DDIAの骨格（13記事）

DDIAの全12章に対応するコア部分。信頼性・スケーラビリティ・保守性という3軸で始まり、データモデルの違い、ストレージエンジンの仕組み、レプリケーション、シャーディング、トランザクション、分散システムが難しい本当の理由、RaftやZooKeeperによる合意、MapReduce→Spark、Kafkaまで一通り。

ここを飛ばすと後のテーマがぼんやりするので、最初に読む。

**こんなエンジニアに**: バックエンドを書いているが、DBやインフラの設計判断を人任せにしてきた人。「NoSQLとRDBどちらを使うか」「レプリケーションってどういう仕組みか」を自分の言葉で説明できるようになりたい人。

**こんな場面で役立つ**: 技術選定の議論、設計レビュー、障害の原因を読むとき。「なぜKafkaを使うのか」「なぜトランザクションが重いのか」の根拠が持てる。

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

「VACUUMって何してるの」「列指向はなぜ速いの」が気になって掘った。PostgreSQLがどう同時書き込みを捌くか（MVCC）、OLAPでParquetが使われる理由（列指向）、分散システムでイベントの順序をどう決めるか（ベクタークロック）、競合なしに値を合算するCRDT。

**こんなエンジニアに**: DBの挙動が腑に落ちないことが多いバックエンドエンジニア。データ基盤やDWHを触り始めたアプリ開発者。分散システムの論文を読もうとしている人。

**こんな場面で役立つ**: 「なぜ `SELECT FOR UPDATE` が必要なのか」「BigQueryはなぜ集計が速いのか」「オフライン編集の競合をどう解決するか」に答えるとき。

- [MVCC — PostgreSQLの並行制御の仕組み](/docs/concepts_ddia_mvcc)
- [列指向ストレージ — ParquetとOLAPの設計](/docs/concepts_ddia_columnar_storage)
- [ベクタークロック — 分散システムの因果順序](/docs/concepts_ddia_vector_clock)
- [CRDT — 競合なしで合算するデータ構造](/docs/concepts_ddia_crdt)

---

## テーマ3: クエリ・パフォーマンス（4記事）

「インデックス貼ったのに遅い」「ORMが何本クエリ投げているか分からない」という経験から整理したテーマ。EXPLAINの読み方、Redisのキャッシュ戦略の使い分け、ElasticsearchのBM25スコアリング、N+1とDataLoader。

**こんなエンジニアに**: アプリは動いているがレスポンスが遅いと言われている人。Railsや Prisma を使っているが内部で何が起きているか分からない人。検索機能を実装しようとしている人。

**こんな場面で役立つ**: パフォーマンス改善の場面で、勘に頼らず原因を特定できる。「Redisを入れれば速くなる」ではなく「どのキャッシュ戦略が合うか」を説明できる。

- [クエリオプティマイザーとEXPLAIN](/docs/concepts_ddia_query_optimizer)
- [キャッシュ戦略 — Redis・Cache-Aside・Write-Through](/docs/concepts_ddia_cache_strategy)
- [全文検索と転置インデックス — ElasticsearchとBM25](/docs/concepts_ddia_full_text_search)
- [N+1問題とDataLoader](/docs/concepts_ddia_n_plus_one)

---

## テーマ4: 分散DBの実装（4記事）

普通のPostgreSQLを超えた領域。SpannerとCockroachDBが実現するグローバル分散トランザクション、WALを使ったCDCとDebezium、分散環境でのID設計（UUID v7・ULID）、コンシステントハッシング。

**こんなエンジニアに**: マイクロサービスを設計・運用しているエンジニア。グローバル展開や大規模トラフィックを扱うシステムを触る機会がある人。DBをまたぐデータ同期に悩んでいる人。

**こんな場面で役立つ**: 「DBを複数リージョンに置きたい」「サービス間のデータ整合をどう保つか」「IDの衝突をどう防ぐか」を検討するとき。Debeziumは特に、DBの変更をイベントとして流したいときに出てくる。

- [NewSQL — Spanner・CockroachDB・TiDB](/docs/concepts_ddia_newsql)
- [WALと論理レプリケーション — DebeziumとCDC](/docs/concepts_ddia_wal_replication)
- [分散ID — UUID v7・ULID・Snowflake ID](/docs/concepts_ddia_distributed_id)
- [コンシステントハッシング — リングと仮想ノード](/docs/concepts_ddia_consistent_hashing)

---

## テーマ5: 運用・信頼性（6記事）

壊さずに直すための技術。PgBouncer、無停止でスキーマを変えるExpand-Contract、マイクロサービス間の結果整合性を保つOutboxパターン、pgBackRestによるPITR、Circuit Breaker、GDPRへの技術的対応。

**こんなエンジニアに**: 本番環境のマイグレーションが怖い人。「障害時にどこまで戻せるか」を説明できない人。サービス間連携で「片方が落ちたときどうなるか」が不安な人。

**こんな場面で役立つ**: リリース計画・インフラ設計・障害対応。特にマイグレーションの設計と障害時のリカバリ手順を立てるときに使える知識が詰まっている。

- [コネクションプーリング — PgBouncerの設計](/docs/concepts_ddia_connection_pooling)
- [ゼロダウンタイムマイグレーション — Expand-Contractパターン](/docs/concepts_ddia_zero_downtime_migration)
- [Outbox/Inboxパターン — At-least-once配信の保証](/docs/concepts_ddia_outbox_pattern)
- [バックアップとPITR — pgBackRestとWALアーカイブ](/docs/concepts_ddia_backup_pitr)
- [バックプレッシャーとCircuit Breaker](/docs/concepts_ddia_backpressure)
- [データプライバシーとCrypto-Shredding — GDPRの技術対応](/docs/concepts_ddia_data_privacy)

---

## テーマ6: PostgreSQL専門機能（9記事）

PostgreSQLをちゃんと使い倒したくて書いたテーマ。Row Level Security、ウィンドウ関数、正規化理論（1NF〜BCNF）、PostGIS、DBアンチパターン（EAV）、pg_stat_statementsによる診断など。

**こんなエンジニアに**: PostgreSQLをメインDBとして使っているバックエンドエンジニア。SaaSを作っていてマルチテナント設計に悩んでいる人。テーブル設計を「なんとなく」やってきた人。

**こんな場面で役立つ**: テーブル設計レビュー、マルチテナントのアクセス制御設計、集計クエリの実装、位置情報機能の追加。「EAVで設計した過去の負債を整理したい」というときにも。

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

RDBやNoSQLとは別の文脈で設計された専用エンジン。TimescaleDB（時系列）、Neo4j（グラフ）、pgvectorとHNSW（ベクトル）。最後のはRAGを自前で作るときに必要になる。

**こんなエンジニアに**: IoT・センサーデータ・監視メトリクスを扱う人（時系列）。SNSや推薦システム、ナレッジグラフを作っている人（グラフ）。LLMを使ったアプリでセマンティック検索を実装したい人（ベクトル）。

**こんな場面で役立つ**: 「PostgreSQLで時系列データを入れたら重くなった」「ユーザー間のつながりをSQLで辿ると遅い」「ChatGPTに自社ドキュメントを読ませたい」という場面でどのエンジンを選ぶかの判断に使える。

- [時系列DBとTimescaleDB — 継続的な集計と圧縮](/docs/concepts_ddia_timeseries_db)
- [グラフDB — Neo4j・CypherとPageRank](/docs/concepts_ddia_graph_db)
- [ベクトルDBとpgvector — HNSWとRAGの設計](/docs/concepts_ddia_vector_db)

---

## テーマ8: モダンデータ基盤（6記事）

2020年代のデータスタック。dbtによるELT、Aurora/Neon/PlanetScaleのクラウドDB比較、Apache IcebergのLakehouse、データコントラクト、OpenTelemetryでのDBクエリトレース。

**こんなエンジニアに**: データエンジニアリングに関わり始めたバックエンドエンジニア。クラウドDBを選定する立場にある人。「スロークエリがどのAPIリクエストで起きているか分からない」という人。

**こんな場面で役立つ**: DBサービスの選定、データパイプラインの設計、可観測性の改善。特にOpenTelemetryはアプリのトレースとDBのクエリを紐付けるので、「N+1がどこで起きているか」をトレースビューで特定できるようになる。

- [dbtとデータ変換パイプライン — ELTのモデル定義](/docs/concepts_ddia_dbt_pipeline)
- [ジョブキューの設計 — BullMQとSKIP LOCKED](/docs/concepts_ddia_job_queue)
- [クラウドDBの設計思想と選択基準 — Aurora・Neon・PlanetScale](/docs/concepts_ddia_cloud_db)
- [Lakehouse — Apache IcebergとDelta Lakeの設計](/docs/concepts_ddia_lakehouse)
- [データコントラクト — Producer/Consumer間のスキーマ契約](/docs/concepts_ddia_data_contract)
- [OpenTelemetryとDBトレーシング — クエリをトレースIDで追う](/docs/concepts_ddia_opentelemetry_db)

---

## 全49記事

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
