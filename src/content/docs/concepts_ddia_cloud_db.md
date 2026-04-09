---
title: クラウドDBサービスの設計思想と選択基準
description: Aurora Serverless・Neon・PlanetScale・AlloyDB・Turso等のマネージドDBの設計思想の違いと選択基準。「コンピュートとストレージの分離」というトレンドを理解する
category: "概念"
tags: ["データ設計", "クラウドDB", "Aurora", "Neon", "PlanetScale", "DDIA"]
emoji: "☁️"
date: "2026-04-08"
order: 844
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017) / 各サービス公式ドキュメント"
---

## 定義

クラウドマネージドDBとは、インフラの管理（パッチ適用・バックアップ・フェイルオーバー）をクラウドベンダーに委託するDBサービス。自己ホストのPostgreSQLと比べてオペレーションコストが低いが、アーキテクチャの理解が選択を左右する。

## 最大のトレンド：コンピュートとストレージの分離

```
従来のDB（PostgreSQL自己ホスト）:
  1台のサーバーにコンピュート（CPU・メモリ）と
  ストレージ（ディスク）が同居
  
  → スケールアップが必要（CPUとストレージを一緒に増やすしかない）
  → フェイルオーバーにはデータのコピーが必要（時間がかかる）

モダンクラウドDB:
  コンピュート（CPU・メモリ） ←→ ストレージ（分散・高可用）
  
  → コンピュートだけ瞬時にスケール（ストレージはそのまま）
  → ゼロへのスケールダウンが可能（使わないときは無料）
  → フェイルオーバーが高速（データの移動なし）
```

## AWS Aurora

PostgreSQL/MySQL互換。Amazonが独自設計したストレージエンジンを持つ。

```
設計の特徴:
  6つのストレージノードに分散書き込み（3AZ × 2コピー）
  4/6のクォーラムで書き込み確認
  
  WALの書き込みだけネットワーク経由 → 通常のPostgreSQLより高速
  読み取りレプリカは最大15台（Aurora Replicaはラグがほぼゼロ）

Aurora Serverless v2:
  0.5〜128 ACU（Aurora Capacity Unit）の間で自動スケール
  秒単位での課金
  コールドスタートがほぼなし（接続プールを維持）
  
向いている用途:
  可用性が最優先のエンタープライズ
  読み取りスケールが必要（レプリカを多数）
  既存のMySQL/PostgreSQLアプリの移行
```

## Neon

PostgreSQL互換のサーバーレスDB。コンピュートとストレージの分離を最も徹底。

```
設計の特徴:
  コンピュートノード（Compute）とページサーバー（Pageserver）を完全分離
  
  ページサーバー: Rustで書かれた分散ストレージ
    → S3に変更差分を書き込む
    → PostgreSQLのWALをそのまま受け取る
  
  コンピュートノード:
    → ページサーバーからページをオンデマンドで取得
    → 使用しないと5秒でスリープ（ゼロへスケール）
    → スリープから復帰は〜500ms
  
ブランチ機能（最大の特徴）:
  DBをGitのようにブランチできる
  main ブランチのコピーをミリ秒で作成
  → プルリクエストごとにDBブランチを作れる
  → ステージング環境のDBを瞬時に複製
  
向いている用途:
  開発・テスト環境（ブランチが便利）
  トラフィックが不規則なサービス
  サーバーレス（Vercel Edge Functions等）
```

## PlanetScale

MySQL互換。VitessをベースにしたサーバーレスDB。

```
Vitessとは:
  YouTubeがMySQLのシャーディングのために開発したプロキシ
  MySQLの前に置いてシャーディングを透過的に行う

PlanetScaleの特徴:
  スキーマ変更をブランチで管理（DBのGitワークフロー）
    main ← feature/add-column のようなマージリクエスト
    バックグラウンドで無停止マイグレーション
  
  外部キー制約をサポートしない
    → アプリ層で整合性を保証する必要がある
    → その代わり超高速シャーディングが可能
  
向いている用途:
  大規模書き込みが必要なMySQL互換サービス
  スキーマ変更が頻繁なチーム
  （外部キー不要の設計ができるチーム）
```

## Google AlloyDB

PostgreSQL互換。Spannerの技術を転用。

```
設計の特徴:
  PostgreSQLのクエリエンジン + Googleの分散ストレージ
  
  ログ処理サービス（Log Processing Service）:
    WALをPostgreSQLから受け取り、
    列指向のフォーマットに変換してキャッシュ
    → OLTPとOLAPを同一DBで処理（HTAP）
  
  機械学習によるバキューム最適化
  自動チューニング（human-in-the-loop）
  
向いている用途:
  GCPユーザーで高パフォーマンスが必要
  OLTPとOLAPを統合したい
```

## Supabase

PostgreSQLをベースにしたBaaS（Backend as a Service）。

```
提供機能:
  PostgreSQL（本体）
  PostgREST（自動REST API生成）
  Realtime（変更ストリームのWebSocket配信）
  Storage（ファイルストレージ）
  Auth（認証）
  Edge Functions（Deno）
  
特徴:
  Row Level Securityを前面に出した設計
  クライアントからDBに直接アクセスできる（APIサーバー不要）
  
向いている用途:
  スタートアップ・個人開発（フルスタックを速く作りたい）
  PostgreSQLの機能をフルに使いたい
```

## Turso（libSQL / SQLite）

SQLiteをエッジに分散させたDB。

```
libSQLとは:
  SQLiteのフォーク。レプリケーションを追加。
  
Tursoの特徴:
  プライマリ1台 + エッジレプリカ（世界中のCloudflare PoP）
  書き込みはプライマリへ、読み取りはエッジから（低レイテンシ）
  マルチテナント向け（テナントごとに独立したDB）
  
向いている用途:
  エッジコンピューティング（Cloudflare Workers）
  マルチテナントSaaSで数万テナント規模
  読み取り多い・地理分散が必要
```

## 選択マトリクス

| 要件 | 推奨サービス |
|---|---|
| PostgreSQL互換・高可用性 | Aurora / AlloyDB |
| サーバーレス・ゼロスケール | Neon / Aurora Serverless v2 |
| 開発体験・ブランチ機能 | Neon / PlanetScale |
| 大規模書き込みスケール | PlanetScale（MySQL） / CockroachDB |
| フルスタック・高速開発 | Supabase |
| エッジ・地理分散 | Turso |
| HTAP（OLTP+OLAP） | TiDB / AlloyDB |
| 自己ホストで完全コントロール | PostgreSQL + pgBackRest |

## コスト構造の違い

```
プロビジョンドモデル（Aurora Provisioned, RDS）:
  常時起動 → 使っていなくても課金
  スペックを事前に決める → 過不足が生じる

サーバーレスモデル（Neon, Aurora Serverless, PlanetScale）:
  使った分だけ課金
  ゼロスケールで待機コストなし
  バースト時に自動スケール
  
注意:
  トラフィックが安定・高負荷なら
  プロビジョンドの方が安くなることも多い
```

## 関連概念

- → [レプリケーション](./concepts_ddia_replication.md)（Aurora/Neonのストレージ設計の基盤）
- → [WALと論理レプリケーション](./concepts_ddia_wal_replication.md)（NeonがWALをどう活用するか）
- → [コネクションプーリング](./concepts_ddia_connection_pooling.md)（サーバーレスDBでの接続管理）
- → [NewSQL](./concepts_ddia_newsql.md)（PlanetScaleのVitessとの関係）

## 出典・参考文献

- Amazon Aurora Documentation — docs.aws.amazon.com/aurora
- Neon Documentation — neon.tech/docs
- PlanetScale Documentation — planetscale.com/docs
- Google AlloyDB Documentation — cloud.google.com/alloydb/docs
