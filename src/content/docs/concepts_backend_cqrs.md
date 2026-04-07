---
title: CQRS（コマンドクエリ責任分離）
description: 読み取り（Query）と書き込み（Command）のモデルを明示的に分離するアーキテクチャパターン。読み取り最適化と書き込みの整合性を独立して設計できる
category: "概念"
tags: ["バックエンド", "CQRS", "アーキテクチャ", "イベント駆動", "DDD"]
emoji: "↔️"
date: "2026-04-06"
order: 113
series:
  - TypeScriptバックエンド設計原則
source: "Greg Young, 'CQRS Documents' (2010) / Martin Fowler, 'CQRS' (martinfowler.com)"
---

## 定義

**CQRS（Command Query Responsibility Segregation）**：システムの操作を「状態を変更するコマンド（Command）」と「状態を読み取るクエリ（Query）」に明示的に分離するパターン。

Bertrand Meyerの **CQS原則**（メソッドは副作用を持つか、値を返すか、どちらか一方）をアーキテクチャレベルに昇華したもの。

```
       Write Side (Command)          Read Side (Query)
       ─────────────────────         ──────────────────
       CreateOrderCommand     →      OrderListQuery
       ConfirmPaymentCommand  →      OrderDetailQuery
             ↓                             ↓
       Domain Model                  Read Model（最適化）
       （ビジネスルール厳密）          （結合済みビュー）
             ↓
       Write Store (正規化DB)  ──→  Read Store（非正規化）
```

## なぜ重要か

**問題**：同じモデルで読み書きを行うと、読み取り最適化（JOIN、集計）と書き込みの整合性（バリデーション、ドメインルール）が競合する。

**解決**：モデルを分離することで、読み取りは「表示に最適なデータ形式」、書き込みは「ビジネスルールの厳密な適用」をそれぞれ独立して設計できる。

## TypeScript 実装例

### シンプルなCQRS（同一DB、モデルのみ分離）

```typescript
// ─── Command Side ───────────────────────────────

// コマンド: 意図を表す値オブジェクト
interface CreateOrderCommand {
  readonly customerId: string;
  readonly items: OrderItem[];
}

// コマンドハンドラ: ビジネスルールを適用して状態変更
class CreateOrderHandler {
  constructor(private readonly orders: OrderRepository) {}

  async handle(cmd: CreateOrderCommand): Promise<void> {
    const order = Order.create(cmd.customerId, cmd.items);
    // Domainルール: 在庫チェック、価格計算などはOrderドメインに委譲
    await this.orders.save(order);
  }
}

// ─── Query Side ─────────────────────────────────

// クエリ: 読み取り専用の要求
interface GetOrdersQuery {
  readonly customerId: string;
  readonly status?: OrderStatus;
}

// クエリハンドラ: ドメインロジックなし、表示に最適化
class GetOrdersHandler {
  constructor(private readonly db: Database) {}

  async handle(query: GetOrdersQuery): Promise<OrderListView[]> {
    // JOINやサブクエリを自由に使える。Domainモデルを経由しない
    return this.db.query(`
      SELECT o.id, o.status, c.name as customer_name,
             COUNT(i.id) as item_count, SUM(i.price) as total
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      JOIN order_items i ON i.order_id = o.id
      WHERE o.customer_id = $1
      GROUP BY o.id, o.status, c.name
    `, [query.customerId]);
  }
}

// ─── メディエーター（NestJS CQRS モジュール）────
import { CommandBus, QueryBus } from '@nestjs/cqrs';

@Controller('orders')
class OrderController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.commandBus.execute(
      new CreateOrderCommand(dto.customerId, dto.items),
    );
  }

  @Get()
  list(@Query('customerId') customerId: string) {
    return this.queryBus.execute(new GetOrdersQuery(customerId));
  }
}
```

### 高度なCQRS（Read Storeを分離）

```typescript
// Write Store (PostgreSQL: 正規化、整合性優先)
// Read Store (Redis / Elasticsearch: 非正規化、高速読み取り)

// イベントからRead Storeを更新するProjection
class OrderProjection {
  @EventHandler(OrderCreatedEvent)
  async onOrderCreated(event: OrderCreatedEvent): Promise<void> {
    // Read Store（Redis）に集計済みデータをキャッシュ
    await this.cache.set(`order:${event.orderId}`, {
      id: event.orderId,
      customerName: event.customerName,  // 結合済み
      totalAmount: event.totalAmount,    // 計算済み
      status: 'pending',
    });
  }
}
```

## NestJS CQRS モジュール

NestJSは `@nestjs/cqrs` で CQRS パターンを標準サポート。

```typescript
// app.module.ts
import { CqrsModule } from '@nestjs/cqrs';

@Module({
  imports: [CqrsModule],
  providers: [CreateOrderHandler, GetOrdersHandler],
})
export class OrderModule {}
```

## 適用場面

- 読み取りと書き込みの負荷が大きく異なるシステム（読み取り多い場合が典型）
- 複雑なドメインロジックがある書き込み処理
- [イベントソーシング](./concepts_backend_event_sourcing.md)と組み合わせるとき（自然な相性）
- マイクロサービス間のデータ集約が必要なとき

## トレードオフ・注意点

| メリット | デメリット |
|---|---|
| 読み取りモデルを自由に最適化できる | モデルの二重管理でコードが増える |
| Write/Readを独立してスケールできる | 最終的一貫性（結果整合性）の扱いが必要 |
| ドメインロジックがQueryに混入しない | 単純なCRUDには明らかに過剰 |

**警告**：CQRSは「命名」だけの問題ではない。コマンドが値を返さず、クエリが状態を変えない規律を全員が守ることで効果が出る。

## 関連概念

- → [イベントソーシング](./concepts_backend_event_sourcing.md)（CQRSと組み合わせると真価を発揮）
- → [ヘキサゴナルアーキテクチャ](./concepts_backend_hexagonal_architecture.md)（CQRSのコアを守る外壁）
- → [境界づけられたコンテキスト](./concepts_bounded_context.md)（CQRSを適用する境界の定義）
- → [純粋関数](./concepts_pure_function.md)（Queryは副作用なし、という原則の源泉）

## 出典・参考文献

- Greg Young, "CQRS Documents" (2010) — cqrs.files.wordpress.com
- Martin Fowler, "CQRS" (2011) — martinfowler.com/bliki/CQRS.html
- Vaughn Vernon, *Implementing Domain-Driven Design* (2013) Chapter 4
- NestJS Documentation, "CQRS" — docs.nestjs.com/recipes/cqrs
