---
title: Outboxパターン（トランザクショナルアウトボックス）
description: DBへの書き込みとイベント発行を原子的に行う方法。「DBに保存成功してKafkaへの送信に失敗」というデータ不整合を防ぐOutbox/Inboxパターンの設計を理解する
category: "概念"
tags: ["データ設計", "Outbox", "マイクロサービス", "イベント駆動", "Kafka", "DDIA"]
emoji: "📤"
date: "2026-04-08"
order: 829
series:
  - データ志向アプリケーション設計（DDIA）
source: "Chris Richardson, 'Microservices Patterns' (2018) Chapter 3"
---

## 定義

**Outboxパターン（Transactional Outbox）**：DBへの書き込みとメッセージブローカー（Kafka等）へのイベント発行を、同一トランザクションで原子的に行うパターン。「DBには保存できたがイベント送信に失敗」という半端な状態を防ぐ。

## 問題：2つのシステムへの書き込みは原子的にできない

```
注文確定時の処理（マイクロサービス）:
  1. OrdersテーブルにINSERT（PostgreSQL）
  2. OrderCreatedイベントをKafkaにPublish

問題1: ステップ1成功 → ステップ2でKafkaが落ちていた
  → DBに注文が保存されたが、在庫サービスに通知されない
  → 在庫が引き落とされず、過剰販売が起きる

問題2: ステップ2成功 → ステップ1でDBがロールバック
  → 存在しない注文のイベントが飛んでいる
  → 下流サービスが架空の注文を処理しようとする
```

DBとKafkaは別々のシステムのため、2PCで原子性を保証できない（KafkaはXAトランザクションを実質サポートしない）。

## Outboxパターンの解決策

```
アイデア: イベントをKafkaに直接送らず、まずDBに書く

OrdersテーブルとOutboxテーブルを同じトランザクションで更新
→ DBの原子性だけで整合性を保証
→ OutboxテーブルからKafkaへの転送は別プロセスが担当
```

### スキーマ設計

```sql
-- 通常のビジネステーブル
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Outboxテーブル（未送信イベントのバッファ）
CREATE TABLE outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type VARCHAR(100) NOT NULL,  -- "Order"
  aggregate_id UUID NOT NULL,            -- orders.id
  event_type VARCHAR(100) NOT NULL,      -- "OrderCreated"
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ              -- NULLなら未送信
);

CREATE INDEX ON outbox (processed_at, created_at)
  WHERE processed_at IS NULL;            -- 未送信のみを効率よく検索
```

### アプリケーションコード

```typescript
async function createOrder(customerId: string, items: OrderItem[]) {
  await db.transaction(async (tx) => {
    // 1. 注文を保存
    const order = await tx.query(
      'INSERT INTO orders (id, customer_id, total_amount, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [ulid(), customerId, calculateTotal(items), 'pending']
    );

    // 2. イベントをOutboxに保存（同じトランザクション内）
    await tx.query(
      'INSERT INTO outbox (aggregate_type, aggregate_id, event_type, payload) VALUES ($1, $2, $3, $4)',
      ['Order', order.id, 'OrderCreated', JSON.stringify({ order, items })]
    );

    // Kafkaには送らない！
    // トランザクションがコミットされればイベントは確実にOutboxにある
  });
}
```

## Outboxからの配信方法

### ポーリング方式（シンプル）

```typescript
// バックグラウンドワーカー
async function outboxWorker() {
  while (true) {
    const events = await db.query(
      `SELECT * FROM outbox
       WHERE processed_at IS NULL
       ORDER BY created_at
       LIMIT 100
       FOR UPDATE SKIP LOCKED`  // 並列ワーカーの衝突を防ぐ
    );

    for (const event of events) {
      await kafka.send({
        topic: `${event.aggregate_type}.${event.event_type}`,
        messages: [{ key: event.aggregate_id, value: event.payload }],
      });

      await db.query(
        'UPDATE outbox SET processed_at = NOW() WHERE id = $1',
        [event.id]
      );
    }

    await sleep(100); // 100ms間隔でポーリング
  }
}
```

**FOR UPDATE SKIP LOCKED**：複数のワーカーが同じイベントを処理しないよう、ロック取得できない行をスキップする。

**問題**：ポーリング間隔分の遅延（最大100ms）が発生する。

### CDC方式（Debeziumを使う）

```
PostgreSQLのWALを監視してOutboxテーブルの変更を検出

INSERT into outbox → WALに記録
→ Debeziumが検出 → Kafkaに転送

メリット: ポーリング遅延なし。DBへの追加クエリ不要
デメリット: Debeziumのセットアップが必要

Debeziumのルーティング設定:
  aggregate_typeとevent_typeに基づいてKafkaトピックを決定
  OrderCreated → orders.OrderCreated トピック
```

## Inboxパターン（冪等な受信）

Outboxで「少なくとも1回（at-least-once）」の配信が保証されるが、重複がありうる。受信側でInboxパターンを使って冪等性を確保する。

```sql
-- 受信側のInboxテーブル
CREATE TABLE inbox (
  event_id UUID PRIMARY KEY,  -- イベントの一意ID
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

```typescript
// 在庫サービスのConsumer
async function handleOrderCreated(event: OrderCreatedEvent) {
  await db.transaction(async (tx) => {
    // 重複チェック（冪等性の保証）
    const exists = await tx.query(
      'SELECT 1 FROM inbox WHERE event_id = $1',
      [event.id]
    );
    if (exists.rows.length > 0) return; // 重複 → スキップ

    // 在庫を減らす
    await tx.query(
      'UPDATE inventory SET quantity = quantity - $1 WHERE product_id = $2',
      [event.payload.quantity, event.payload.productId]
    );

    // 処理済みとしてInboxに記録
    await tx.query(
      'INSERT INTO inbox (event_id) VALUES ($1)',
      [event.id]
    );
  });
}
```

## Outboxのメンテナンス

```sql
-- 処理済みのOutboxレコードを定期的に削除
DELETE FROM outbox
WHERE processed_at IS NOT NULL
  AND processed_at < NOW() - INTERVAL '7 days';

-- または論理削除せず、パーティションで管理する
-- TimescaleDBのhypertableと組み合わせると自動削除も可能
```

## Outbox vs Saga の関係

```
Saga: 複数サービスにまたがるトランザクションの調整フロー
Outbox: Sagaの各ステップでイベントを確実に発行するための仕組み

組み合わせ:
  Sagaオーケストレーター → コマンドをOutboxに書く
  → Workerが各サービスにコマンドを送る
  → 各サービスは結果イベントをOutboxに書く
  → Sagaオーケストレーターがイベントを受信
```

## 関連概念

- → [Sagaパターン](./concepts_ddia_sagas.md)（Outboxが支えるSagaの実装）
- → [WALと論理レプリケーション](./concepts_ddia_wal_replication.md)（CDC方式の基盤）
- → [ストリーム処理](./concepts_ddia_stream_processing.md)（at-least-once配信と冪等性）
- → [トランザクション](./concepts_ddia_transactions.md)（FOR UPDATE SKIP LOCKEDの仕組み）

## 出典・参考文献

- Chris Richardson, *Microservices Patterns* (2018) Chapter 3
- Debezium Documentation, "Outbox Event Router" — debezium.io/documentation/reference
- eventuate.io — Transactional Messaging
