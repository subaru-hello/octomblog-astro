---
category: "概念"
order: 214
title: イベントソーシング（Event Sourcing）
description: 集約の状態をイベントの列として保存し、現在の状態はイベントを再生して導出する
tags: ["DDD", "イベントソーシング", "イベント駆動", "永続化"]
emoji: "📜"
date: "2026-04-04"
series:
  - 実践ドメイン駆動設計
source: "実践ドメイン駆動設計（Vaughn Vernon）"
---

## 解決する課題

通常のデータ永続化は「現在の状態」だけを保存する。これにより：

- **なぜその状態になったか**の履歴が消える
- 過去の任意の時点の状態に戻せない
- デバッグ・監査が困難

## 概念

**イベントソーシング**は、集約の状態変化を**ドメインイベントの列**として保存するパターン。現在の状態は、最初から全イベントを再生（リプレイ）することで導出する。

```
通常の永続化:
  orders テーブル: { id: "1", status: "PLACED", total: 5000 }

イベントソーシング:
  event_store:
    1. OrderCreated  { order_id: "1", at: "10:00" }
    2. ItemAdded     { order_id: "1", product: "A", qty: 2, at: "10:01" }
    3. ItemAdded     { order_id: "1", product: "B", qty: 1, at: "10:02" }
    4. OrderPlaced   { order_id: "1", at: "10:05" }
  → これらを再生すると現在の状態が得られる
```

## 実装パターン

```python
class Order:
    def __init__(self):
        self._uncommitted_events = []
        self._status = OrderStatus.DRAFT
        self._items = []

    @classmethod
    def reconstruct(cls, events: list) -> 'Order':
        """イベントリストから集約を復元"""
        order = cls()
        for event in events:
            order._apply(event)
        return order

    def place(self) -> None:
        if not self._items:
            raise DomainException("商品がない")
        event = OrderPlaced(order_id=str(self._id))
        self._apply(event)               # 状態を変更
        self._uncommitted_events.append(event)  # 保存用に記録

    def _apply(self, event) -> None:
        """イベントから状態を変更（副作用のみ）"""
        if isinstance(event, OrderPlaced):
            self._status = OrderStatus.PLACED
        elif isinstance(event, ItemAdded):
            self._items.append(OrderItem(event.product_id, event.quantity))
```

## イベントストア

```python
class EventStore:
    def save(self, aggregate_id: str, events: list, expected_version: int) -> None:
        """楽観的ロックで同時書き込みを防ぐ"""
        current_version = self._get_version(aggregate_id)
        if current_version != expected_version:
            raise ConcurrencyException("別のトランザクションが先に変更しました")
        for event in events:
            self._store.append({
                "aggregate_id": aggregate_id,
                "event_type": type(event).__name__,
                "payload": serialize(event),
                "version": current_version + 1,
            })

    def load(self, aggregate_id: str) -> list:
        return [deserialize(e) for e in self._store
                if e["aggregate_id"] == aggregate_id]
```

## スナップショット

イベントが大量になると再生コストが高くなる。**定期的にスナップショット**（現時点の状態のスナップ）を保存し、スナップショット以降のイベントのみ再生する。

## CQRS との組み合わせ

イベントソーシングと CQRS は相性が良い：

```
書き込み側: イベントをイベントストアに保存
     ↓ イベント
読み取り側: イベントをサブスクライブしてリードモデルを更新（プロジェクション）
```

## メリット・デメリット

| メリット | デメリット |
|---|---|
| 完全な変更履歴が残る | 実装複雑度が高い |
| 任意時点への状態復元 | イベントスキーマの変更が困難 |
| デバッグ・監査が容易 | クエリが複雑（プロジェクション必要） |
| ドメインイベントが自然に生まれる | チームへの学習コスト |

複雑さを正当化できる**コアドメイン**にのみ適用する。

## 関連概念

- → [CQRS](./concepts_iddd_cqrs.md)（組み合わせて使う）
- → [ドメインイベント](./concepts_iddd_domain_event.md)（イベントストアの内容）
- → [集約](./concepts_iddd_aggregate.md)
