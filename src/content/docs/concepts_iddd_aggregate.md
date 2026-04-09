---
category: "概念"
order: 206
title: 集約（Aggregate）
description: 一貫性境界を持つエンティティ群のクラスター。集約ルートを通じてのみアクセスされる
tags: ["DDD", "集約", "ドメインモデル", "一貫性"]
emoji: "🫧"
date: "2026-04-04"
series:
  - 実践ドメイン駆動設計
source: "実践ドメイン駆動設計（Vaughn Vernon）第10章"
---

## 解決する課題

複数のエンティティが関連し合うとき、**どこかで変更が起きたとき全体の一貫性を誰が保証するのか**が曖昧になる。Order と OrderItem、Cart と CartItem を別々に変更できてしまうと、不整合な状態が生まれる。

## 概念

**集約（Aggregate）** は、一貫性を保つ単位としてまとめたエンティティ・値オブジェクトのクラスター。

- **集約ルート（Aggregate Root）**: 集約全体への唯一のアクセス窓口となるエンティティ
- 外部から集約内部のオブジェクトへの直接参照は禁止
- **1トランザクション = 1集約の変更**が原則

```
┌─────────────────────────────────┐
│  Order（集約ルート）              │
│  ┌───────────┐ ┌──────────────┐ │
│  │ OrderItem │ │ ShippingInfo │ │
│  └───────────┘ └──────────────┘ │
└─────────────────────────────────┘

外部からは Order のメソッドを通じてのみ変更できる
```

## Wild Workoutsでの確認

`Hour` が集約ルート。`Availability` は外から直接変えられない。

```go
type Hour struct {
    hour         time.Time    // 集約ルートのID
    availability Availability // 外から直接変更不可
}

// 必ず集約ルート経由で操作する
func (h *Hour) ScheduleTraining() error {
    if !h.IsAvailable() {
        return ErrHourNotAvailable
    }
    h.availability = TrainingScheduled
    return nil
}
```

```go
// 悪い例：外から直接変更（整合性が崩れる）
hour.availability = TrainingScheduled

// 良い例：集約ルート経由
hour.ScheduleTraining()
```

## 集約ルートの責務

```python
class Order:  # 集約ルート
    def add_item(self, product_id: ProductId, qty: int) -> None:
        # 不変条件のチェック
        if self._status != OrderStatus.DRAFT:
            raise DomainException("確定済みの注文に商品を追加できません")
        if qty <= 0:
            raise DomainException("数量は1以上必要です")
        self._items.append(OrderItem(product_id, qty))

    def place(self) -> None:
        if not self._items:
            raise DomainException("商品なしで注文を確定できません")
        self._status = OrderStatus.PLACED
        self._events.append(OrderPlaced(str(self._id)))
```

## 集約間の参照はIDのみ

```python
# ❌ 別集約への直接参照
class Order:
    def __init__(self, customer: Customer):
        self._customer = customer  # Customer 集約を直接保持

# ✅ IDのみで参照
class Order:
    def __init__(self, customer_id: CustomerId):
        self._customer_id = customer_id  # IDのみ
```

別集約への直接参照を許すと、変更の影響範囲が広がり一貫性境界が崩れる。

## Vernon が挙げる設計原則（詳細は別記事）

1. 真に必要な一貫性境界だけを集約に含める
2. 集約は小さく保つ
3. 結果整合性で解決できる部分は集約をまたいでよい
4. 集約はIDで参照する

→ [集約の設計原則（4つのルール）](./concepts_iddd_aggregate_design.md)

## トランザクション境界

**1トランザクションで複数の集約を変更してはいけない**（結果整合性を使う）。

「注文確定 → 在庫減算」は同一トランザクションで行うのではなく、`OrderPlaced` イベントを受け取った在庫コンテキストが非同期で処理する。

## 関連概念

- → [集約の設計原則](./concepts_iddd_aggregate_design.md)（Vernon の4ルール詳細）
- → [エンティティ](./concepts_iddd_entity.md)
- → [ドメインイベント](./concepts_iddd_domain_event.md)（集約から発行）
- → [リポジトリ](./concepts_iddd_repository.md)（集約の永続化）
