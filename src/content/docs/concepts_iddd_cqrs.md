---
category: "概念"
order: 213
title: CQRS（コマンドクエリ責任分離）
description: 状態を変更するコマンドと、状態を読み取るクエリを完全に分離するアーキテクチャパターン
tags: ["DDD", "CQRS", "アーキテクチャ", "クエリ", "コマンド"]
emoji: "⚡"
date: "2026-04-04"
series:
  - 実践ドメイン駆動設計
source: "実践ドメイン駆動設計（Vaughn Vernon）"
---

## 解決する課題

ドメインモデルは書き込み（状態変更）の複雑さに最適化されている。しかし、**読み取り（表示）は全く異なる要件**を持つことが多い：

- 複数の集約を横断した JOIN が必要
- 集約の境界が表示の単位と一致しない
- パフォーマンス要件が書き込みと異なる

同一モデルで両方を満たそうとすると、読み取り用のメソッドがドメインモデルを汚染する。

## 概念

**CQRS（Command Query Responsibility Segregation）** は、Greg Young が提唱したパターン。

- **コマンド（Command）**: 状態を変更する。戻り値なし（または成功/失敗のみ）
- **クエリ（Query）**: 状態を読み取る。副作用なし

この2つを**モデルレベルで完全に分離**する。

```
コマンド側（Write Model）         クエリ側（Read Model）
  PlaceOrderCommand                 OrderSummaryQuery
       ↓                                  ↓
  Order（集約）                    OrderSummaryView（DTO）
       ↓                                  ↓
  orders テーブル                  order_summary ビュー／キャッシュ
```

## コマンド側

ドメインモデル（集約）が変更の一貫性を保証する。集約から見ると、通常の DDD モデルと変わらない。

```python
@dataclass
class PlaceOrderCommand:
    order_id: str
    customer_id: str

class PlaceOrderCommandHandler:
    def handle(self, cmd: PlaceOrderCommand) -> None:
        order = self._repo.find_by_id(OrderId(cmd.order_id))
        order.place()
        self._repo.save(order)
        for event in order.pop_events():
            self._publisher.publish(event)
```

## クエリ側

SQL や集計処理に特化した、**ドメインモデルを使わない**読み取り専用モデル。

```python
@dataclass
class OrderSummaryView:
    order_id: str
    customer_name: str
    total_amount: int
    status: str
    item_count: int

class OrderQueryService:
    def find_summary(self, order_id: str) -> OrderSummaryView:
        # リポジトリを使わず直接SQLで柔軟にJOIN
        row = self._db.execute("""
            SELECT o.id, c.name, o.total_amount, o.status,
                   COUNT(i.id) as item_count
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            JOIN order_items i ON o.id = i.order_id
            WHERE o.id = ?
            GROUP BY o.id
        """, [order_id]).fetchone()
        return OrderSummaryView(**row)
```

## イベント駆動でのリードモデル更新

コマンド側のイベントをサブスクライブしてリードモデルを更新するパターンも一般的。

```
OrderPlaced イベント
    → order_summary テーブルを INSERT/UPDATE
    → キャッシュを更新
```

## 使いどころ

CQRS は複雑さをもたらすため、**すべてのシステムに適用しない**：

| 状況 | CQRS の適用 |
|---|---|
| 読み取り・書き込みのスケール要件が異なる | 有効 |
| 読み取りモデルが書き込みモデルと構造が大きく異なる | 有効 |
| シンプルな CRUD | 過剰。通常の Repository で十分 |
| コアドメインで複雑な業務ロジックがある | 有効 |

## 関連概念

- → [イベントソーシング](./concepts_iddd_event_sourcing.md)（CQRS と組み合わせることが多い）
- → [ドメインイベント](./concepts_iddd_domain_event.md)
- → [リポジトリ](./concepts_iddd_repository.md)
- → [アプリケーションサービス](./concepts_iddd_application_service.md)
