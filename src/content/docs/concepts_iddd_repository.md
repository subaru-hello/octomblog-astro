---
category: "概念"
order: 208
title: リポジトリ（Repository）
description: 集約をコレクションとして扱う抽象。インフラの詳細をドメインから隠蔽する
tags: ["DDD", "リポジトリ", "永続化", "インフラ"]
emoji: "🗄️"
date: "2026-04-04"
series:
  - 実践ドメイン駆動設計
source: "実践ドメイン駆動設計（Vaughn Vernon）第12章"
---

## 解決する課題

集約を永続化・復元する処理がドメインモデルに混入すると、ドメインが DB・ORM・クエリ言語に依存してしまう。ドメインロジックのテストに DB 接続が必要になる。

## 概念

**リポジトリ**は、集約をまるでインメモリのコレクションかのように扱う抽象レイヤー。SQL・NoSQL・外部APIなどの永続化詳細をドメインから隠蔽する。

```python
# ドメイン層（インターフェース）
class OrderRepository(ABC):
    @abstractmethod
    def find_by_id(self, order_id: OrderId) -> Optional[Order]: ...

    @abstractmethod
    def save(self, order: Order) -> None: ...

    @abstractmethod
    def find_by_customer(self, customer_id: CustomerId) -> list[Order]: ...
```

```python
# インフラ層（実装）
class SqlOrderRepository(OrderRepository):
    def find_by_id(self, order_id: OrderId) -> Optional[Order]:
        row = self._db.execute(
            "SELECT * FROM orders WHERE id = ?", [str(order_id)]
        ).fetchone()
        return self._mapper.to_entity(row) if row else None

    def save(self, order: Order) -> None:
        # INSERT or UPDATE
        ...
```

## 設計の原則

- **1集約につき1リポジトリ** — 集約ルートに対してのみリポジトリを作る。`OrderItem` の単独リポジトリは不要
- **クエリは集約ルートから** — 集約の内部オブジェクトを直接検索するクエリは避ける
- **トランザクションはリポジトリの外** — トランザクション制御はアプリケーションサービスが持つ

## CQRS との関係

複雑な検索（一覧表示・検索フィルタ・集計）をドメインリポジトリで満たそうとすると、「1集約1リポジトリ」の原則と衝突する。

**CQRS** では、変更（コマンド）用のリポジトリと読み取り（クエリ）用のリードモデルを分離することでこの問題を解消する。

```
コマンド側: OrderRepository（集約の取得・保存）
クエリ側:   OrderQueryService（ビューモデルの構築、JOINあり）
```

## テストのしやすさ

インターフェースを使うことで、テスト時はインメモリ実装に差し替えられる。

```python
class InMemoryOrderRepository(OrderRepository):
    def __init__(self):
        self._store: dict[str, Order] = {}

    def find_by_id(self, order_id: OrderId) -> Optional[Order]:
        return self._store.get(str(order_id))

    def save(self, order: Order) -> None:
        self._store[str(order.id)] = order
```

## 関連概念

- → [集約](./concepts_iddd_aggregate.md)（リポジトリが管理する対象）
- → [六角形アーキテクチャ](./concepts_iddd_hexagonal_architecture.md)（リポジトリはポートとアダプターの典型例）
- → [CQRS](./concepts_iddd_cqrs.md)
