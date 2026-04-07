---
title: ストリーム処理
description: 終わりのないイベントストリームをリアルタイムで処理する方法。Kafkaのログ設計、ウィンドウ集計、ストリーム-バッチ統合の考え方を理解する
category: "概念"
tags: ["データ設計", "ストリーム処理", "Kafka", "イベント駆動", "リアルタイム", "DDIA"]
emoji: "🌊"
date: "2026-04-07"
order: 810
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017) Chapter 11"
---

## 定義

**ストリーム処理**：終わりのない（unbounded）イベントシーケンスに対して継続的に処理を行うシステム。バッチ処理が「有限データの一括処理」であるのに対し、ストリーム処理は「無限データのリアルタイム処理」。

## イベントストリームとメッセージシステム

### メッセージキューとの違い

```
従来のメッセージキュー（RabbitMQなど）:
  Producerがメッセージを送る
  → Consumerが受け取る
  → メッセージは削除される（消費されたら消える）

ログベースのメッセージブローカー（Kafka）:
  Producerがイベントをログに追記
  → Consumerはオフセットを管理して任意のタイミングで読む
  → イベントは削除されない（保持期間内）
```

### Apache Kafka の設計

```
Topic（論理的なカテゴリ）
  └── Partition 1: [event0][event1][event2]...[eventN] → Consumer offset=N
  └── Partition 2: [event0][event1]...[eventM]          → Consumer offset=M
  └── Partition 3: ...
```

**設計思想**：
- イベントは不変のログとして追記のみ
- ConsumerはOffsetを持ち、自分のペースで消費
- 複数のConsumer Groupが同じTopicを独立して読める
- ディスクに永続化（メモリDB扱いではない）

これによりKafkaは**データベース**的な役割も担える：過去のイベントを全部遡って再処理できる。

## ストリームのジョイン

### ストリーム-ストリームジョイン

```
クリックイベントストリーム: {userId, url, timestamp}
検索イベントストリーム:     {userId, query, timestamp}

「検索してからX分以内にクリックした」を集計したい
→ 両ストリームを時間ウィンドウで結合
→ 片方が遅れて到達することがある（遅延データ問題）
```

**ウィンドウ**：有限の時間範囲でストリームを区切って処理する。

### ストリーム-テーブルジョイン

```
活動ログストリーム: {userId, action, timestamp}
ユーザープロファイルDB: {userId, name, country, plan}

「活動ログにユーザー情報を付加したい」
→ ストリームの各イベントでDBをルックアップ
→ DBのスナップショット（テーブルをストリーム化）でローカルキャッシュを持つ
```

### テーブル-テーブルジョイン（マテリアライズドビュー）

```
2つのテーブルの変更ストリームをジョイン
→ 結果の変更ストリームを生成
→ これがマテリアライズドビューをインクリメンタルに更新する仕組み
```

## 時刻の扱い

ストリーム処理で最も難しい問題の一つ。

### イベント時刻 vs 処理時刻

```
イベント時刻（Event Time）:  イベントが実際に発生した時刻（クライアントのタイムスタンプ）
処理時刻（Processing Time）: イベントがシステムに到達・処理された時刻

モバイルアプリ:
  ユーザーがオフラインで操作 → オンラインになってからイベントが到達
  → イベント時刻は1時間前なのに処理時刻は今
```

**遅延データの問題**：

```
10:00-10:05のウィンドウで集計したい

10:06に処理: 10:04のイベントが遅れて到達
  → ウィンドウは既に閉じている
  → どうするか？
  
  1. 遅延を無視する（簡単だが不正確）
  2. ウィンドウを一定時間開けておく
  3. 遅延データを別途処理（遅延集計）
```

**ウォーターマーク（Watermark）**：「このタイムスタンプより古いイベントはもう来ない」という信号。Google Cloud Datanflowが普及させた概念。

## ウィンドウの種類

```
タンブリングウィンドウ（Tumbling Window）:
  [0:00-0:05][0:05-0:10][0:10-0:15]
  重複なく固定サイズで区切る

スライディングウィンドウ（Sliding Window）:
  [0:00-0:05][0:01-0:06][0:02-0:07]
  一定間隔でスライドする（重複あり）

セッションウィンドウ（Session Window）:
  ユーザーの非活動期間でウィンドウを区切る
  アクティビティ分析に有用
```

## フォールトトレランス

バッチ処理と違い、ストリームは「失敗したら最初からやり直す」ができない。

**チェックポイント**：処理中の状態を定期的にDVhに永続化。失敗時はチェックポイントから再開。

### 配信保証のレベル

| 保証 | 動作 | リスク |
|---|---|---|
| At-most-once | 失敗しても再送しない | データロス |
| At-least-once | 失敗したら再送 | 重複処理 |
| Exactly-once | ちょうど1回だけ処理 | 実装コスト高 |

**Exactly-onceの実現**：冪等な処理（同じイベントを2回処理しても同じ結果）と、2PCまたはKafkaのトランザクションAPIの組み合わせ。

## ストリーム処理エンジン比較

| エンジン | 特徴 | 適した用途 |
|---|---|---|
| Apache Kafka Streams | Kafkaに組み込み、軽量 | Kafkaユーザーのシンプルな処理 |
| Apache Flink | 真のストリーム処理、低遅延 | 複雑なイベント処理、CEP |
| Apache Spark Streaming | Micro-batch（疑似ストリーム） | バッチ処理との統合 |
| Google Dataflow | マネージド、Beam APIで抽象化 | GCPユーザー |

## イベントソーシングとの関係

```
イベントソーシング:
  状態の変更をイベントのストリームとして記録
  → 現在の状態はイベントを再生して計算

ストリーム処理:
  イベントストリームをリアルタイムで集計・変換

共通の思想:
  「イベントは過去の事実の記録であり、不変」
  「現在の状態は派生物（projection）」
```

## 関連概念

- → [バッチ処理](./concepts_ddia_batch_processing.md)（対になる処理方式、Lambda/Kappa Architecture）
- → [イベントソーシング](./concepts_backend_event_sourcing.md)（ストリームを状態管理に使う）
- → [レプリケーション](./concepts_ddia_replication.md)（Kafkaのレプリケーション）
- → [分散システムの問題](./concepts_ddia_distributed_problems.md)（時刻の不確かさの根本原因）

## 出典・参考文献

- Martin Kleppmann, *Designing Data-Intensive Applications* (2017) Chapter 11
- Tyler Akidau et al., "The Dataflow Model" (2015) — Google
- Jay Kreps, "The Log: What every software engineer should know about real-time data's unifying abstraction" (2013) — LinkedIn Engineering
