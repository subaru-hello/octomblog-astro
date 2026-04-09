---
category: "概念"
order: 209
title: ファクトリ（Factory）
description: 複雑な集約・エンティティの生成ロジックをカプセル化し、クライアントに詳細を隠す
tags: ["DDD", "ファクトリ", "オブジェクト生成", "ドメインモデル"]
emoji: "🏭"
date: "2026-04-04"
series:
  - 実践ドメイン駆動設計
source: "実践ドメイン駆動設計（Vaughn Vernon）第11章"
---

## 解決する課題

集約の生成にビジネスルールが絡む場合、コンストラクタがドメインの詳細を過剰に知ってしまう。また呼び出し側が複数の依存オブジェクトを組み立てて渡す必要があり、**生成の複雑さがクライアントに漏れる**。

## 概念

**ファクトリ**は、複雑なオブジェクトの生成ロジックをカプセル化する。クライアントはどのように作るかを知らずに「完全な状態のオブジェクト」を受け取れる。

DDD では3種類のファクトリが使われる：

| 種類 | 使いどころ |
|---|---|
| **ファクトリメソッド（集約ルート内）** | 別の集約が特定の子集約を生成する場合 |
| **スタティックファクトリ** | コンストラクタをシンプルに保ちたい場合 |
| **専用ファクトリクラス** | 生成に複数の依存が必要な場合 |

## 例

### スタティックファクトリメソッド

```python
class Order:
    def __init__(self, order_id: OrderId, customer_id: CustomerId):
        # プライベートな初期化
        self._id = order_id
        self._customer_id = customer_id
        self._items = []
        self._status = OrderStatus.DRAFT

    @classmethod
    def create(cls, customer_id: CustomerId) -> 'Order':
        """新しい注文を生成するファクトリメソッド"""
        return cls(
            order_id=OrderId.generate(),
            customer_id=customer_id,
        )

    @classmethod
    def reconstruct(cls, order_id: OrderId, customer_id: CustomerId,
                    items: list, status: OrderStatus) -> 'Order':
        """永続化されたデータから集約を復元するファクトリメソッド"""
        order = cls(order_id, customer_id)
        order._items = items
        order._status = status
        return order
```

### 別集約のファクトリメソッド

```python
class Forum:
    def start_discussion(self, author_id: UserId, subject: str) -> 'Discussion':
        """Forum がDiscussion の生成責任を持つ"""
        if not self._is_open:
            raise DomainException("クローズされたフォーラムにはスレッドを立てられません")
        return Discussion(
            discussion_id=DiscussionId.generate(),
            forum_id=self._id,
            author_id=author_id,
            subject=subject,
        )
```

## Wild Workoutsでの確認

`Hour` の生成は `Factory` 構造体が担う。新規作成とDB復元で検証ロジックを使い分けている。

```go
type Factory struct{ fc FactoryConfig }

// 新規作成：全ルールを検証
func (f Factory) NewAvailableHour(hour time.Time) (*Hour, error) {
    if err := f.validateTime(hour); err != nil {
        return nil, err
    }
    return &Hour{hour: hour, availability: Available}, nil
}

// DB復元：時間検証のみ（過去の記録を復元するので一部スキップ）
func (f Factory) UnmarshalHourFromDatabase(hour time.Time, availability Availability) (*Hour, error) {
    if err := f.validateTime(hour); err != nil {
        return nil, err
    }
    return &Hour{hour: hour, availability: availability}, nil
}
```

生成の文脈（新規 vs 復元）によってルールが変わる場合にファクトリが有効。

## ファクトリが必要なサイン

- コンストラクタが5つ以上の引数を取る
- 生成時にバリデーション・ビジネスルールがある
- 生成のロジックを複数箇所で再利用する
- 「生成する」行為自体がドメインイベントを発行する

## ファクトリ不要のケース

単純なエンティティは `__init__` で十分。ファクトリは複雑さが正当化する場合のみ導入する。

## 関連概念

- → [集約](./concepts_iddd_aggregate.md)
- → [エンティティ](./concepts_iddd_entity.md)
- → [リポジトリ](./concepts_iddd_repository.md)（復元は `reconstruct` ファクトリで）
