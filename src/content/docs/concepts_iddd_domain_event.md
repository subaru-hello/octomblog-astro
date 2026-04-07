---
category: "概念"
order: 205
title: ドメインイベント（Domain Event）
description: ドメインで起きた重要な出来事を過去形で表現するオブジェクト。疎結合な統合の鍵
tags: ["DDD", "ドメインイベント", "イベント駆動", "統合"]
emoji: "📣"
date: "2026-04-04"
series:
  - 実践ドメイン駆動設計
source: "実践ドメイン駆動設計（Vaughn Vernon）第8章"
---

## 解決する課題

ある操作の完了を受けて別のコンテキストや別の集約に処理を連鎖させるとき、**直接呼び出すと強結合**になる。「注文が確定したらメール送信」「支払いが完了したら在庫を引く」をどう実現するか。

## 概念

**ドメインイベント**は、ドメイン内で「起きた重要な出来事」を**過去形で表現**する不変オブジェクト。

- 命名は**過去形**：`OrderPlaced`、`PaymentReceived`、`UserRegistered`
- 不変（イミュータブル）
- 最低限、**いつ起きたか（timestamp）と識別子**を含む

```python
from dataclasses import dataclass
from datetime import datetime

@dataclass(frozen=True)
class OrderPlaced:
    order_id: str
    customer_id: str
    total_amount: Money
    occurred_at: datetime = field(default_factory=datetime.utcnow)
```

## なぜ重要か

ドメインイベントを発行することで：

- **集約間の通信を疎結合**にできる（直接メソッド呼び出しが不要）
- **コンテキスト間の統合**を非同期にできる
- 何が起きたかの**監査ログ・履歴**が自然に残る
- イベントソーシングの基盤になる

## 発行と購読のパターン

```python
# 集約内でイベントを記録
class Order:
    def place(self) -> None:
        if not self._items:
            raise DomainException("商品がない注文は確定できません")
        self._status = OrderStatus.PLACED
        # イベントを記録（発行はアプリケーション層が行う）
        self._events.append(OrderPlaced(
            order_id=str(self._id),
            customer_id=str(self._customer_id),
            total_amount=self.calculate_total(),
        ))

    def pop_events(self) -> list:
        events, self._events = self._events, []
        return events

# アプリケーションサービスで発行
class PlaceOrderService:
    def execute(self, order_id: str) -> None:
        order = self._repo.find_by_id(order_id)
        order.place()
        self._repo.save(order)
        for event in order.pop_events():
            self._publisher.publish(event)
```

## コンテキスト境界をまたぐ場合

同一コンテキスト内ならシンプルな pub/sub で十分。**コンテキスト境界を越える**場合はメッセージブローカー（RabbitMQ, Kafka）を使い、非同期で処理する。

受け取ったコンテキスト側では、**腐敗防止層でローカルモデルに翻訳**する。

## 設計の指針

- イベント名は**ドメインエキスパートが使う言葉**（ユビキタス言語）
- 受信側が必要とする情報をイベントに含める（ただしイベントが太りすぎないよう注意）
- 冪等な受信処理を設計する（at-least-once delivery）

## 関連概念

- → [集約](./concepts_iddd_aggregate.md)（イベントを発行する主体）
- → [イベントソーシング](./concepts_iddd_event_sourcing.md)（イベントを状態の源泉にする）
- → [境界づけられたコンテキストの統合](./concepts_iddd_integration.md)
- → [CQRS](./concepts_iddd_cqrs.md)
