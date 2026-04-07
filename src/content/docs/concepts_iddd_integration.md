---
category: "概念"
order: 212
title: 境界づけられたコンテキストの統合
description: 複数のBounded Contextを接続するパターン群。RESTful・メッセージング・ACLによる疎結合な統合
tags: ["DDD", "統合", "コンテキスト間通信", "腐敗防止層"]
emoji: "🔌"
date: "2026-04-04"
series:
  - 実践ドメイン駆動設計
source: "実践ドメイン駆動設計（Vaughn Vernon）第13章"
---

## 解決する課題

Bounded Context を分けた後、それらが連携する必要がある。直接の呼び出しや DB 共有をすると、コンテキスト分割の意味がなくなる。どうやって**独立性を保ちながら連携するか**。

## 統合の3パターン

### 1. RESTful HTTPによる統合（公開ホストサービス）

上流コンテキストが安定した REST API を公開し、下流が消費する。

```python
# 下流コンテキストのアダプター（ACL）
class InventoryAdapter:
    """在庫コンテキストの REST API を自コンテキストのモデルに翻訳"""
    def __init__(self, base_url: str):
        self._base_url = base_url

    def check_availability(self, product_id: str, qty: int) -> bool:
        resp = requests.get(f"{self._base_url}/inventory/{product_id}")
        data = resp.json()
        # 外部モデルを自コンテキストの概念に変換
        return data["available_quantity"] >= qty
```

### 2. メッセージングによる非同期統合

ドメインイベントをメッセージブローカー経由で送受信する。最も疎結合。

```python
# 上流コンテキストがイベントを発行
publisher.publish("order.placed", {
    "order_id": order.id,
    "items": [...],
    "occurred_at": "2026-04-04T00:00:00Z",
})

# 下流コンテキストがサブスクライブして処理
@subscriber("order.placed")
def handle_order_placed(message: dict) -> None:
    # ACL で自コンテキストのモデルに翻訳
    order_id = OrderId(message["order_id"])
    inventory_service.reserve(order_id, message["items"])
```

### 3. 共有カーネル

2コンテキストで共有するモデルを明示的に定義し、両チームが管理する。変更には両者の合意が必要。

## 腐敗防止層（ACL）の実装

外部コンテキストのモデルが自コンテキストに侵食しないよう、翻訳レイヤーを設ける。

```python
# 外部の "Customer" を自コンテキストの "Buyer" に翻訳
class CustomerContextACL:
    def to_buyer(self, external_customer: dict) -> Buyer:
        return Buyer(
            buyer_id=BuyerId(external_customer["customerId"]),
            name=BuyerName(external_customer["fullName"]),
        )
```

## 統合パターンの選択指針

| 要件 | 推奨パターン |
|---|---|
| 即時応答が必要（在庫確認・価格計算） | REST（同期） |
| 処理が非同期でよい（通知・集計） | メッセージング（非同期） |
| 2チームが密に協力できる | 共有カーネル or パートナーシップ |
| 外部/レガシー | ACL + REST or バッチ |

## 冪等性の設計

非同期メッセージは **at-least-once（最低1回）** 配信が基本。同じイベントが複数回届いても問題ないよう**冪等な処理**を設計する。

```python
def handle_order_placed(event_id: str, ...) -> None:
    if self._processed_events.contains(event_id):
        return  # 重複処理をスキップ
    ...
    self._processed_events.add(event_id)
```

## 関連概念

- → [コンテキストマップ](./concepts_iddd_context_map.md)（統合パターンの設計図）
- → [ドメインイベント](./concepts_iddd_domain_event.md)（メッセージングの内容）
- → [CQRS](./concepts_iddd_cqrs.md)
