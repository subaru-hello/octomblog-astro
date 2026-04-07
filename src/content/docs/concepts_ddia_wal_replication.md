---
title: WALと論理レプリケーション
description: PostgreSQLのWAL（Write-Ahead Log）の仕組みと、物理レプリケーション・論理レプリケーションの違い。CDCとの関係、レプリケーションスロットの設計を理解する
category: "概念"
tags: ["データ設計", "WAL", "レプリケーション", "PostgreSQL", "CDC", "DDIA"]
emoji: "📝"
date: "2026-04-07"
order: 822
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017) Chapter 5"
---

## 定義

**WAL（Write-Ahead Log）**：データを実際に書き込む前に、「何をするか」をログに記録するメカニズム。「先にログ」という原則がクラッシュ安全性の基盤。

## WALの役割

### クラッシュリカバリ

```
WALなし（ダングラスDB）の問題:
  1. ページをディスクに書き込み中にクラッシュ
  2. ページが半分だけ書かれた状態で残る（Partial Write）
  3. 再起動後、データが壊れている

WALあり:
  1. まずWALに「このページをこう変更する」を追記（シーケンシャルI/O）
  2. WAL書き込み完了後にコミット応答
  3. 実際のデータページは後で書く（バックグラウンド）
  4. クラッシュ時: WALを再生して正しい状態に復元できる
```

**シーケンシャルI/OはランダムI/Oより速い**：WALはディスクの末尾に追記するだけなので、ページのランダム書き込みより大幅に高速。

### PostgreSQLのWAL実装

```
$PGDATA/pg_wal/以下に格納
ファイル名例: 000000010000000000000001（24桁の16進数）

構造:
  LSN（Log Sequence Number）: WALのバイトオフセット
  各WALレコード: LSN + 変更の内容（前のデータ, 後のデータ）
  
LSNで「どこまで処理したか」を管理する
```

## 物理レプリケーション vs 論理レプリケーション

### 物理レプリケーション（Streaming Replication）

WALのバイト列をそのままスタンバイに送る。

```
プライマリ
  │ WALストリーム（バイナリ）
  ↓
スタンバイ1 → WALを適用してデータを復元
スタンバイ2

特徴:
  - バイナリ形式なのでバージョンが同じ必要
  - テーブル単位ではなくDB全体をレプリケーション
  - スタンバイは読み取り専用（Hot Standby）
  - フェイルオーバー用途に使われる
```

### 論理レプリケーション（Logical Replication）

WALを「行レベルの変更」にデコードして送る。

```
プライマリ
  │ WALのデコード（行の INSERT/UPDATE/DELETE に変換）
  ↓
スタンバイ / 別のDB / Kafka / Debezium

特徴:
  - テーブル単位で選択可能
  - バージョンが違うDBへも送れる（アップグレード移行に使える）
  - 異なるDBエンジンへの送信も可能
  - サブスクライバー側での書き込みも可能（双方向）
```

```sql
-- 論理レプリケーションの設定
-- プライマリ側
ALTER SYSTEM SET wal_level = 'logical';
CREATE PUBLICATION my_pub FOR TABLE users, orders;

-- スタンバイ側
CREATE SUBSCRIPTION my_sub
  CONNECTION 'host=primary dbname=mydb'
  PUBLICATION my_pub;
```

## レプリケーションスロット

スタンバイが遅れても、プライマリがWALを削除しないようにする仕組み。

```
問題:
  スタンバイが長時間落ちている間、プライマリはWALを削除する
  → スタンバイが復帰しても必要なWALがない → 全量コピーが必要

解決:
  レプリケーションスロットを作成
  → スタンバイの最後のLSNまでWALを保持し続ける
```

```sql
-- スロット確認
SELECT * FROM pg_replication_slots;

-- 危険: スタンバイが長期停止中にスロットが残っていると
-- pg_walディレクトリが無限に肥大化してディスク満杯になる
```

**本番運用の注意点**：モニタリングに `pg_replication_slots` の `lag` と `pg_wal` のディスク使用量を含める。

## CDCとWAL

[データシステムの統合設計](./concepts_ddia_future.md)で触れたCDCはWALを使って実現する。

```
Debeziumの動作:
  1. PostgreSQLにレプリケーションスロットを作成
     （論理レプリケーション用のpgoutputプラグイン使用）
  2. WALを論理デコード → 行レベルの変更イベント
  3. KafkaにJSON/Avroで発行

Kafkaトピック例:
  mydb.public.users → {"op":"u","before":{...},"after":{...}}
  op: c=insert, u=update, d=delete, r=read（スナップショット時）
```

```
メリット:
  - アプリコードを変更せずに変更ストリームを取得
  - DBの負荷がほぼゼロ（WAL読み取りのみ）
  - 削除も捕捉できる（アプリレベルのフックでは難しい）

デメリット:
  - スキーマ変更（ALTER TABLE）の扱いが複雑
  - 初期スナップショット取得時の整合性管理
  - レプリケーションスロットのディスク管理
```

## WALの設定パラメータ

```
wal_level:
  minimal    → 最小限（クラッシュリカバリのみ）
  replica    → 物理レプリケーション（デフォルト）
  logical    → 論理レプリケーション・CDC用

synchronous_commit:
  on         → WALがディスクに書かれるまでコミット待ち（デフォルト）
  off        → WALのディスク書き込みを待たない（高速、クラッシュで最大数秒のデータロス）
  remote_apply → スタンバイへの適用まで待つ（強い整合性、低速）

wal_compression:
  on         → WALを圧縮（CPU使用増えるがI/O削減）

checkpoint_completion_target:
  0.9        → チェックポイント間隔内でゆっくりダーティページを書く
               （I/Oスパイクを抑制）
```

## チェックポイント（Checkpoint）

WALが永遠に増え続けないよう、定期的に「ここまでデータページに反映した」という印をつける。

```
チェックポイントの動作:
  1. バッファプール内のダーティページをすべてディスクに書く
  2. WALに CHECKPOINT レコードを記録
  3. このLSNより前のWALは削除可能になる
  
設定:
  checkpoint_timeout = 5min   → 最大5分ごとにチェックポイント
  max_wal_size = 1GB          → WALがこのサイズを超えたらチェックポイント
```

チェックポイント直後はI/Oが集中する。`checkpoint_completion_target=0.9` で次のチェックポイントまでの90%の時間をかけてゆっくり書くことでスパイクを抑制できる。

## 関連概念

- → [レプリケーション](./concepts_ddia_replication.md)（シングルリーダーのフォロワー管理）
- → [ストレージとインデックス](./concepts_ddia_storage_indexing.md)（WALとBツリーの関係）
- → [MVCC](./concepts_ddia_mvcc.md)（WALとMVCCの協調動作）
- → [データシステムの統合設計](./concepts_ddia_future.md)（CDCによるDBアンバンドリング）

## 出典・参考文献

- Martin Kleppmann, *Designing Data-Intensive Applications* (2017) Chapter 5
- PostgreSQL Documentation, "Write Ahead Logging" — postgresql.org/docs/current/wal.html
- Debezium Documentation — debezium.io/documentation
- Hironobu Suzuki, "The Internals of PostgreSQL" — interdb.jp/pg
