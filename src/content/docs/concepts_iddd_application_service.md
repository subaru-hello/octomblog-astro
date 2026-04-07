---
category: "概念"
order: 211
title: アプリケーションサービス（Application Service）
description: ユースケースを調整するオーケストレーション層。ドメインロジックは含まず、薄く保つ
tags: ["DDD", "アプリケーションサービス", "ユースケース", "アーキテクチャ"]
emoji: "🎛️"
date: "2026-04-04"
series:
  - 実践ドメイン駆動設計
source: "実践ドメイン駆動設計（Vaughn Vernon）第14章"
---

## 解決する課題

UI・API・メッセージキューからのリクエストがドメインモデルに直接触れると、インフラの詳細（HTTP・トランザクション・認証）がドメインに混入する。また、複数のドメインオブジェクトを使うユースケースの調整をどこに書くかが不明確になる。

## 概念

**アプリケーションサービス**は、ユースケース1つを1メソッドで表現する薄い調整レイヤー。

責務は：
1. リポジトリから集約を取得する
2. ドメインサービス・集約のメソッドを呼び出す
3. リポジトリに集約を保存する
4. ドメインイベントを発行する

**ドメインのビジネスルールは持たない**。持つのは「何を、どの順で呼ぶか」という調整だけ。

## 例

```python
class PlaceOrderApplicationService:
    def __init__(
        self,
        order_repo: OrderRepository,
        product_repo: ProductRepository,
        event_publisher: DomainEventPublisher,
    ):
        self._order_repo = order_repo
        self._product_repo = product_repo
        self._publisher = event_publisher

    def place_order(self, command: PlaceOrderCommand) -> OrderId:
        # 1. 集約を取得
        order = self._order_repo.find_by_id(OrderId(command.order_id))
        if not order:
            raise ApplicationException("注文が見つかりません")

        # 2. ドメインメソッドを呼び出す（ルールはここにない）
        order.place()

        # 3. 保存
        self._order_repo.save(order)

        # 4. イベント発行
        for event in order.pop_events():
            self._publisher.publish(event)

        return order.id
```

## 薄いサービス層の原則

```python
# ❌ ビジネスロジックがアプリケーションサービスに漏れている
class OrderApplicationService:
    def place_order(self, order_id: str) -> None:
        order = self._repo.find_by_id(order_id)
        if len(order.items) == 0:          # ドメインルールがここにある！
            raise Exception("商品がない")
        if order.status != "DRAFT":        # ドメインルールがここにある！
            raise Exception("確定済み")
        order.status = "PLACED"            # 直接状態を変えている！
        self._repo.save(order)

# ✅ ドメインロジックは集約に委譲
class OrderApplicationService:
    def place_order(self, order_id: str) -> None:
        order = self._repo.find_by_id(order_id)
        order.place()    # ルールは Order エンティティが知っている
        self._repo.save(order)
```

## コマンドオブジェクト

引数を1つのコマンドオブジェクトにまとめると、シグネチャが安定する。

```python
@dataclass
class PlaceOrderCommand:
    order_id: str
    requested_by: str  # 認証情報
```

## ドメインサービスとの違い

| | アプリケーションサービス | ドメインサービス |
|---|---|---|
| ドメインルールを含むか | 含まない | 含む |
| インフラへの依存 | あり（Repository・Publisher） | 最小限 |
| ユビキタス言語 | 薄く使う | 強く使う |

## 関連概念

- → [ドメインサービス](./concepts_iddd_domain_service.md)
- → [六角形アーキテクチャ](./concepts_iddd_hexagonal_architecture.md)（アプリケーションサービスはポートの実装）
- → [ドメインイベント](./concepts_iddd_domain_event.md)
- → [CQRS](./concepts_iddd_cqrs.md)
