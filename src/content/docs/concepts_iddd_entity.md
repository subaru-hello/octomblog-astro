---
category: "概念"
order: 203
title: エンティティ（Entity）
description: 同一性（ID）によって識別されるドメインオブジェクト。ライフサイクルを通じてIDが変わらない
tags: ["DDD", "エンティティ", "ドメインモデル", "同一性"]
emoji: "🪪"
date: "2026-04-04"
series:
  - 実践ドメイン駆動設計
source: "実践ドメイン駆動設計（Vaughn Vernon）第5章"
---

## 解決する課題

「同じ人」「同じ注文」をシステムが追跡するとき、どの属性が変わっても**「それが同一のものである」と判断する基準**が必要。名前が変わっても同一人物、住所が変わっても同じ注文。

## 概念

**エンティティ**は、**同一性（Identity）** によって識別されるドメインオブジェクト。

- 属性（名前・状態）が変わっても、**IDが同じなら同一のエンティティ**
- 時間とともに状態が変化する（ライフサイクルを持つ）
- 2つのエンティティは ID が等しい場合のみ等しい

```python
# 値オブジェクトとの比較
# エンティティ: IDで等価判定
user_a = User(id="123", name="Alice")
user_b = User(id="123", name="Bob")   # 名前が違っても
assert user_a == user_b               # IDが同じなら同一

# 値オブジェクト: 内容で等価判定
addr_a = Address("東京都", "渋谷区")
addr_b = Address("東京都", "渋谷区")
assert addr_a == addr_b               # 内容が同じなら等しい
```

## IDの設計

Vernon はエンティティのIDの生成方式として4パターンを示す：

| 方式 | 特徴 | 使いどころ |
|---|---|---|
| ユーザー入力 | 人が決める（従業員番号など） | 業務上の識別子がある場合 |
| アプリケーション生成 | UUID等で事前生成 | 永続化前にIDが必要な場合 |
| 永続化機構が生成 | DB のオートインクリメント | シンプルだが、永続化前IDがない |
| 別コンテキストが割り当て | 外部システムのIDを使う | 既存IDとの統合 |

**推奨: UUID をアプリケーション側で生成**。DBに依存せずテストしやすく、分散システムでも一意。

## エンティティの責務

エンティティは**自身の不変条件を守る**責任を持つ。状態変更は必ずメソッドを通じて行い、invariant が壊れないようにする。

```python
class Order:
    def __init__(self, order_id: OrderId, customer_id: CustomerId):
        self._id = order_id
        self._customer_id = customer_id
        self._items: list[OrderItem] = []
        self._status = OrderStatus.PENDING

    def add_item(self, product: Product, quantity: int) -> None:
        if self._status != OrderStatus.PENDING:
            raise DomainException("確定済みの注文には商品を追加できません")
        self._items.append(OrderItem(product, quantity))

    @property
    def id(self) -> OrderId:
        return self._id
```

## 値オブジェクトとの使い分け

| | エンティティ | 値オブジェクト |
|---|---|---|
| 等価の基準 | ID | 値の内容 |
| 変更可能性 | 可変（状態が変わる） | 不変（変更したら新しいオブジェクト） |
| 例 | 注文、ユーザー、商品 | 金額、住所、メールアドレス |

**迷ったら値オブジェクトを選ぶ**。エンティティはライフサイクル管理のコストが高い。

## 関連概念

- → [値オブジェクト](./concepts_value_object.md)（IDではなく値で識別）
- → [集約](./concepts_iddd_aggregate.md)（エンティティのまとまり）
- → [リポジトリ](./concepts_iddd_repository.md)（エンティティの永続化）
