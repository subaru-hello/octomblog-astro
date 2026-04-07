---
category: "概念"
order: 204
title: ドメインサービス（Domain Service）
description: エンティティや値オブジェクトに自然に属さないドメインロジックの置き場所
tags: ["DDD", "ドメインサービス", "ドメインモデル"]
emoji: "⚙️"
date: "2026-04-04"
series:
  - 実践ドメイン駆動設計
source: "実践ドメイン駆動設計（Vaughn Vernon）第7章"
---

## 解決する課題

ドメインのロジックが**複数のエンティティ・値オブジェクトにまたがる**とき、どこに書けばよいか？どちらか一方に書くと責務過多になり、どちらでもない「ユーティリティクラス」を作るとドメインロジックがサービス層に漏れる。

## 概念

**ドメインサービス**は、特定のエンティティや値オブジェクトに自然に属さないドメインロジックをカプセル化するオブジェクト。

以下の条件がそろったときにドメインサービスを導入する：

1. 操作が**本質的にドメインの概念**である（インフラや UI の話ではない）
2. **複数のドメインオブジェクト**が関わる
3. どのエンティティ/値オブジェクトにも属させると**不自然**

## 典型的な用途

- 2つのアカウント間の**資金移動**（どちらのアカウントに置くか不自然）
- ユニーク性のチェック（リポジトリを参照する必要があるため、エンティティに持たせられない）
- 複数集約にまたがる計算・集計

## 例

```python
# ❌ どちらのエンティティに責務を持たせるか不自然
class Account:
    def transfer_to(self, target: 'Account', amount: Money) -> None:
        # 自分が操作されながら相手も操作する — 不自然
        ...

# ✅ ドメインサービスで表現
class TransferService:
    def __init__(self, account_repo: AccountRepository):
        self._repo = account_repo

    def transfer(
        self,
        source_id: AccountId,
        target_id: AccountId,
        amount: Money,
    ) -> None:
        source = self._repo.find_by_id(source_id)
        target = self._repo.find_by_id(target_id)
        source.debit(amount)
        target.credit(amount)
        self._repo.save(source)
        self._repo.save(target)
```

## アプリケーションサービスとの違い

| | ドメインサービス | アプリケーションサービス |
|---|---|---|
| 含む知識 | ドメインルール・業務ロジック | ユースケースの調整・オーケストレーション |
| インフラ依存 | 最小限（Repositoryインターフェースは使える） | 使う（トランザクション・メッセージング） |
| ユビキタス言語 | 使う | 使う（ただし薄い） |
| テスト | ドメインモデルのみでテスト可能 | 統合テストになりやすい |

## 注意点

- **ドメインサービスを多用しすぎない** — 多くのロジックはエンティティ・値オブジェクトに属せるはず。ドメインサービスが増えすぎると「貧血ドメインモデル」の兆候
- ステートレスに保つ（状態を持たない）

## 関連概念

- → [エンティティ](./concepts_iddd_entity.md)
- → [アプリケーションサービス](./concepts_iddd_application_service.md)
- → [集約](./concepts_iddd_aggregate.md)
