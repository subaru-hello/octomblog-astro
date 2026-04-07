---
title: エンコーディングとスキーマ進化
description: JSON/XML の限界とバイナリフォーマット（Protobuf・Avro）の設計思想。後方/前方互換性を保ちながらスキーマを進化させる方法を理解する
category: "概念"
tags: ["データ設計", "エンコーディング", "スキーマ進化", "Protobuf", "Avro", "DDIA"]
emoji: "📋"
date: "2026-04-07"
order: 811
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017) Chapter 4"
---

## 定義

**エンコーディング（シリアライゼーション）**：メモリ上のデータ構造をバイト列に変換すること。ファイル保存・ネットワーク送信・メッセージキューへの投稿すべてに必要。

**スキーマ進化**：時間とともにシステムの要件が変わり、データ形式を変更しなければならないときに、旧バージョンと新バージョンが共存できるようにすること。

## JSONの問題点

多くのシステムで使われるが、見えにくい問題がある。

```json
{
  "id": 12345678901234567,
  "price": 9.99,
  "tags": ["hot", "sale"]
}
```

**問題1：数値型の曖昧さ**  
JavaScriptの`Number`は64bit浮動小数点。整数として`12345678901234567`を表現すると精度が失われる。TwitterのAPIが数値IDと文字列IDを両方返すのはこの理由。

**問題2：スキーマがない**  
どのフィールドが必須か、型は何か、ドキュメントを別途管理しなければならない。`null`と「フィールドなし」の区別も曖昧。

**問題3：エンコードサイズ**  
フィールド名を毎回文字列として含む。大量データでは無視できないオーバーヘッド。

## バイナリフォーマットの比較

### Protocol Buffers（Protobuf）

Googleが開発。gRPCのデフォルト。スキーマを`.proto`ファイルで定義する。

```protobuf
// スキーマ定義
message Person {
  required string user_name    = 1;
  optional int64  favorite_number = 2;
  repeated string interests    = 3;
}
```

```
エンコード結果（バイナリ）:
  0a 07 4d 61 72 74 69 6e ...
  
  JSONの{"user_name":"Martin",...} より大幅に小さい
  フィールド名ではなくタグ番号(1,2,3)で識別
```

**タグ番号の意味**：タグ番号がフィールドの「永続的な識別子」。フィールド名は自由に変更できるが、タグ番号を変えると互換性が壊れる。

### Apache Thrift

Facebookが開発。Protobufに似ているがRPCフレームワークも含む。

```thrift
struct Person {
  1: required string       userName,
  2: optional i64          favoriteNumber,
  3: optional list<string> interests
}
```

### Apache Avro

Hadoopエコシステムで使われる。**Protobufと異なりエンコード時にタグ番号を含まない**。

```json
// Avro スキーマ
{
  "type": "record",
  "name": "Person",
  "fields": [
    {"name": "userName",       "type": "string"},
    {"name": "favoriteNumber", "type": ["null", "long"], "default": null},
    {"name": "interests",      "type": {"type": "array", "items": "string"}}
  ]
}
```

エンコードされたデータはフィールド識別子を一切含まない（スキーマの順序でのみ解釈）。そのためリーダースキーマとライタースキーマの照合が必要。

## スキーマ進化の互換性

システムのローリングアップデート（全ノードを同時に更新できない）では、旧コードと新コードが混在する期間がある。

```
後方互換性（Backward Compatibility）:
  新しいコードが古いデータを読める
  → フィールドを追加する場合、古いデータにはそのフィールドがない
  
前方互換性（Forward Compatibility）:
  古いコードが新しいデータを読める
  → 知らないフィールドが来ても無視できる
```

### Protobuf/Thriftでの互換性ルール

```
✅ 安全な変更:
  - 新しいフィールドを追加（新しいタグ番号を使う）
  - 使わなくなったフィールドを削除（タグ番号は再利用しない）
  - optional → repeated の変更

❌ 危険な変更:
  - タグ番号の変更（既存データが読めなくなる）
  - required フィールドの追加（古いデータがrequiredを満たさない）
  - データ型の変更（int32 → int64 は一部安全、string → int は破壊的）
```

### Avroでの互換性

リーダースキーマとライタースキーマが一致しなくても、Avroはフィールド名で照合してギャップを埋める。

```
ライタースキーマ（古い）: {userName, favoriteNumber}
リーダースキーマ（新しい）: {userName, favoriteNumber, email}

→ emailはリーダースキーマのデフォルト値で補完
→ 旧データでも新しいスキーマで読める（後方互換）
```

**Kafkaのスキーマレジストリ**：Kafkaでは送信者と受信者が異なるチームで、スキーマが一致しないと障害になる。Confluent Schema RegistryがAvro/JSON Schema/Protobufのスキーマを一元管理し、互換性チェックを自動化する。

```
Producer → [スキーマ登録/確認] → Schema Registry
         → [スキーマID + エンコードデータ] → Kafka

Consumer → [メッセージからスキーマID取得] → Schema Registry
         → [スキーマ取得してデコード] → 処理
```

## データフローモード

エンコードされたデータはどう流れるか。

### DBを経由するデータフロー

```
アプリv1がデータをDBに書く（古いスキーマ）
アプリv2がDBからデータを読む（新しいスキーマ）

→ DBはデータを「そのまま保存」するだけ
→ アプリ側で後方互換性を維持する必要がある

注意: アプリv2がレコードを読んで書き戻すとき、
      v2が知らないフィールドを落とさないように注意
```

### サービスを経由するデータフロー（REST / RPC）

```
REST API:
  バージョニング（/v1/users, /v2/users）で互換性を管理
  JSONの場合、前方互換性はクライアントが未知フィールドを無視することで実現

RPC（gRPC）:
  Protobufのスキーマ進化ルールに従う
  クライアントとサーバーを独立してアップデートできる
```

**RPC vs REST**：gRPCはProtobufで型安全かつ高速。REST+JSONは言語非依存で人間が読みやすい。サービス間通信ではgRPCが増えているが、外部公開APIはRESTが多い。

### メッセージパッシング（非同期）

```
KafkaやRabbitMQ経由:
  Producerがメッセージをエンコードして送信
  Consumerが後からデコード

「後から」の間にスキーマが変わっている可能性がある
→ AvroとSchema Registryの組み合わせが実用的な解
```

## フォーマット比較まとめ

| 特性 | JSON | Protobuf | Avro | MessagePack |
|---|---|---|---|---|
| 人間可読 | ✅ | ❌ | ❌ | ❌ |
| スキーマ | 任意（JSON Schema） | 必須（.proto） | 必須 | なし |
| サイズ | 大きい | 小さい | 最小 | 中程度 |
| スキーマ進化 | 手動管理 | タグ番号で管理 | スキーマ照合 | 困難 |
| コード生成 | 不要 | 必要 | 必要 | 不要 |
| 主な使われ方 | REST API | gRPC, 内部通信 | Kafka, Hadoop | Redis, ゲーム |

## 関連概念

- → [ストリーム処理](./concepts_ddia_stream_processing.md)（Kafkaのスキーマ管理）
- → [レプリケーション](./concepts_ddia_replication.md)（ローリングアップデート中の互換性）
- → [データモデル](./concepts_ddia_data_models.md)（スキーマオンライトとスキーマオンリード）

## 出典・参考文献

- Martin Kleppmann, *Designing Data-Intensive Applications* (2017) Chapter 4
- Google, Protocol Buffers Documentation — protobuf.dev
- Apache Avro Specification — avro.apache.org
- Confluent, Schema Registry Documentation
