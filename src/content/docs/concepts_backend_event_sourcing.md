---
title: イベントソーシング
description: 現在のシステム状態をスナップショットではなく「過去のイベントの積み重ね」として永続化するパターン。状態の変化履歴が全て保存され、任意の時点の状態を再現できる
category: "概念"
tags: ["バックエンド", "イベントソーシング", "アーキテクチャ", "CQRS", "DDD"]
emoji: "📜"
date: "2026-04-06"
order: 114
series:
  - TypeScriptバックエンド設計原則
source: "Greg Young (2010) / Implementing Domain-Driven Design（Vaughn Vernon）/ Martin Fowler, 'Event Sourcing'"
---

## 定義

**イベントソーシング（Event Sourcing）**：アプリケーションの状態を「現在値」として保存する代わりに、「状態を変化させたイベントのシーケンス」として永続化するパターン。

```
従来型（スナップショット）:
orders テーブル
| id | status    | total |
|----|-----------|-------|
| 1  | delivered | 5000  |  ← 現在値のみ保存

イベントソーシング型:
order_events テーブル
| id | order_id | type              | payload           | occurred_at |
|----|----------|-------------------|-------------------|-------------|
| 1  | 1        | OrderCreated      | {total: 5000}     | 10:00       |
| 2  | 1        | PaymentConfirmed  | {method: "card"}  | 10:05       |
| 3  | 1        | OrderShipped      | {tracking: "..."}  | 14:00       |
| 4  | 1        | OrderDelivered    | {}                | 翌日         |

→ イベントを順に適用すると現在状態を再現できる
```

## なぜ重要か

**問題**：現在値だけ保存すると「なぜその状態になったか」がわからない。「3日前の状態に戻したい」「支払いが二重に処理されたが証拠がない」などの問題が発生する。

**解決**：全変化履歴をイベントとして保存。任意時点の状態を再現（タイムトラベル）でき、監査ログが自動的に構成され、バグ調査が容易になる。

## TypeScript 実装例

```typescript
// ─── イベント定義 ────────────────────────────────

// イベントは不変の事実。過去形で命名する
type OrderEvent =
  | { type: 'OrderCreated'; customerId: string; items: OrderItem[]; total: number }
  | { type: 'PaymentConfirmed'; method: string; paidAt: Date }
  | { type: 'OrderShipped'; trackingNumber: string }
  | { type: 'OrderCancelled'; reason: string };

// ─── Aggregate（イベントを適用して状態を構成）────

class Order {
  private id!: string;
  private status!: OrderStatus;
  private total!: number;
  private uncommittedEvents: OrderEvent[] = [];

  // イベントを「適用」して状態を変化させる
  apply(event: OrderEvent): this {
    switch (event.type) {
      case 'OrderCreated':
        this.status = OrderStatus.PENDING;
        this.total = event.total;
        break;
      case 'PaymentConfirmed':
        this.status = OrderStatus.PAID;
        break;
      case 'OrderShipped':
        this.status = OrderStatus.SHIPPED;
        break;
      case 'OrderCancelled':
        this.status = OrderStatus.CANCELLED;
        break;
    }
    return this;
  }

  // コマンドからイベントを生成（ビジネスルールはここで検証）
  static create(customerId: string, items: OrderItem[]): Order {
    if (items.length === 0) throw new DomainError('商品が選択されていません');
    const total = items.reduce((sum, i) => sum + i.price, 0);

    const order = new Order();
    const event: OrderEvent = { type: 'OrderCreated', customerId, items, total };
    order.apply(event);
    order.uncommittedEvents.push(event);
    return order;
  }

  confirmPayment(method: string): void {
    if (this.status !== OrderStatus.PENDING) {
      throw new DomainError('支払い待ちの注文のみ確定できます');
    }
    const event: OrderEvent = { type: 'PaymentConfirmed', method, paidAt: new Date() };
    this.apply(event);
    this.uncommittedEvents.push(event);
  }

  // イベントストアから Aggregate を再構築
  static reconstitute(events: OrderEvent[]): Order {
    return events.reduce(
      (order, event) => order.apply(event),
      new Order(),
    );
  }

  getUncommittedEvents(): OrderEvent[] {
    return [...this.uncommittedEvents];
  }
}

// ─── イベントストア ───────────────────────────────

class EventStore {
  async appendEvents(
    aggregateId: string,
    events: OrderEvent[],
    expectedVersion: number,  // 楽観的ロック
  ): Promise<void> {
    // 楽観的ロック: 同時書き込みを防ぐ
    const currentVersion = await this.getCurrentVersion(aggregateId);
    if (currentVersion !== expectedVersion) {
      throw new ConcurrencyError('同時更新が検出されました');
    }
    await this.db.insert(events.map((e, i) => ({
      aggregateId,
      version: expectedVersion + i + 1,
      type: e.type,
      payload: JSON.stringify(e),
      occurredAt: new Date(),
    })));
  }

  async loadEvents(aggregateId: string): Promise<OrderEvent[]> {
    const rows = await this.db.query(
      'SELECT payload FROM events WHERE aggregate_id = $1 ORDER BY version',
      [aggregateId],
    );
    return rows.map(r => JSON.parse(r.payload));
  }
}

// ─── Repository（イベントソーシング版）────────────

class OrderRepository {
  async findById(id: string): Promise<Order | null> {
    const events = await this.eventStore.loadEvents(id);
    if (events.length === 0) return null;
    return Order.reconstitute(events);
  }

  async save(order: Order, expectedVersion: number): Promise<void> {
    const events = order.getUncommittedEvents();
    await this.eventStore.appendEvents(order.id, events, expectedVersion);
    // CQRSのRead Storeも更新（Projection）
    await this.publisher.publish(events);
  }
}
```

## スナップショット最適化

イベントが数千件になるとリプレイが遅くなる。定期的にスナップショットを保存して高速化する。

```typescript
class SnapshotRepository {
  async findById(id: string): Promise<Order> {
    const snapshot = await this.loadLatestSnapshot(id);
    const events = await this.eventStore.loadEvents(id, snapshot?.version ?? 0);
    return Order.reconstitute(events, snapshot?.state);
  }

  // 100イベントごとにスナップショットを保存
  async saveIfNeeded(order: Order): Promise<void> {
    if (order.version % 100 === 0) {
      await this.saveSnapshot(order);
    }
  }
}
```

## 適用場面

- 監査ログが必要なシステム（金融、医療、EC）
- デバッグのために「いつ、何が起きたか」を正確に追跡したい
- [CQRS](./concepts_backend_cqrs.md)と組み合わせてRead Storeを構築するとき
- 将来の機能追加で過去データを再解析したい（Projection の再構築）

## トレードオフ・注意点

| メリット | デメリット |
|---|---|
| 完全な変更履歴（監査ログ不要） | イベントスキーマの進化管理が複雑 |
| タイムトラベルデバッグ可能 | 読み取りには別途Projectionが必要 |
| 過去データの再解析・再集計が可能 | 習得コストが高い |
| 楽観的ロックで同時更新を制御 | 単純なCRUDには明らかに過剰 |

**イベントスキーマの進化**：一度保存したイベントのフィールドを変えると既存データが壊れる。Upcaster（古い形式を新しい形式に変換するアダプタ）パターンで対応する。

## 関連概念

- → [CQRS（コマンドクエリ責任分離）](./concepts_backend_cqrs.md)（イベントからRead Storeを構築する）
- → [ヘキサゴナルアーキテクチャ](./concepts_backend_hexagonal_architecture.md)（イベントストアをアダプターとして扱う）
- → [境界づけられたコンテキスト](./concepts_bounded_context.md)（どのコンテキストにESを適用するか）

## 出典・参考文献

- Greg Young, "Event Sourcing" (2010) — cqrs.files.wordpress.com
- Martin Fowler, "Event Sourcing" — martinfowler.com/eaaDev/EventSourcing.html
- Vaughn Vernon, *Implementing Domain-Driven Design* (2013) Chapter 8
- Adam Dymitruk, *Event Modeling* — eventmodeling.org
