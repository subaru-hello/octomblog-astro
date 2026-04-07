---
title: バックエンドアーキテクチャの選択
description: 要件・チーム・規模に応じてLayered/Hexagonal/Clean/CQRS/Event Sourcingを選ぶための意思決定プロセス。過剰設計と過小設計の両方を避ける判断基準
category: "Tips"
tags: ["バックエンド", "アーキテクチャ", "設計原則", "意思決定"]
emoji: "🗺️"
date: "2026-04-06"
order: 18
series:
  - TypeScriptバックエンド設計原則
---

## 目的

プロジェクト開始時や設計見直し時に、適切なアーキテクチャパターンを選択する。「技術的に面白い」ではなく「要件と制約に最も適している」という基準で決断できる状態にする。

---

## Step 1: システムの性質を把握する

以下の問いに答えを用意する。

**複雑性の確認**：
- ドメインロジック（ビジネスルール）はどれくらい複雑か？
  - 単純なCRUD中心 → **Layered Architectureで十分**
  - 複雑な業務ルール（在庫管理、決済、予約） → **Hexagonal/Clean + DDD**

**寿命の確認**：
- このシステムは何年使われるか？
  - 6ヶ月以内のプロトタイプ・PoC → **シンプルなLayered**
  - 3年以上の長期運用 → **Hexagonal（インフラ変更を吸収できる構造）**

**チームの確認**：
- チームはDDD・ヘキサゴナルを理解しているか？
  - 理解なし → **Layeredから始め、段階的に移行**
  - 理解あり → 要件に応じたパターンを選択

---

## Step 2: アーキテクチャを選択する

```
ドメインロジックが複雑か？
│
├─ NO → Layered Architecture（Controller → Service → Repository）
│        シンプルなCRUDは過剰設計を避ける
│
└─ YES → インフラ（DB/外部API）を頻繁に変える可能性があるか？
          │
          ├─ NO → Clean Architecture（Use Case中心）
          │        ビジネスルールを明確に分離
          │
          └─ YES → Hexagonal Architecture（Ports & Adapters）
                    アダプター差し替えを最大化

                    ↓ さらに追加
                    読み書きの負荷が大きく異なるか？
                    │
                    └─ YES → + CQRS（読み取りモデルを分離）

                              完全な変更履歴・監査が必要か？
                              │
                              └─ YES → + Event Sourcing
```

---

## Step 3: API設計を選択する

→ 詳細は [API設計比較（REST / GraphQL / gRPC / tRPC）](./concepts_backend_api_design_comparison.md)

**クイック判断**：
- 外部公開 API → **REST**（標準、理解しやすい）
- TypeScript フルスタックの内部API → **tRPC**（型安全、最高DX）
- マイクロサービス間通信（高スループット）→ **gRPC**
- 多様なクライアントへの柔軟なデータ取得 → **GraphQL**

---

## Step 4: 不変のルールを適用する

選んだアーキテクチャに関わらず、以下は常に守る：

1. **依存の方向を守る**：ビジネスロジック（コア）が外部詳細（DB/HTTP）に依存しない
2. **DIを使う**：`new ConcreteClass()` をビジネスロジック内で呼ばない（→ [依存性注入](./concepts_backend_dependency_injection.md)）
3. **エラーを型で表現する**：Result型で予測可能な失敗を型安全に扱う（→ [Result型](./concepts_backend_result_type.md)）
4. **SOLID原則を守る**：特にSRP（1クラス1責任）とDIP（→ [SOLID原則](./rules_backend_typescript_solid.md)）

---

## Step 5: 移行戦略を立てる（既存コードベースの場合）

既存の「スパゲッティ」コードベースへの漸進的導入：

1. **まず境界を引く**：[境界づけられたコンテキスト](./concepts_bounded_context.md)を特定する
2. **新規機能から適用**：既存コードを無理に書き換えず、新機能をHexagonalで実装
3. **Strangler Figパターン**：古い実装の周囲に新しい実装を構築し、徐々に置き換え
4. **テストを先に書く**：リファクタリング前にテストで現状の振る舞いを記録

---

## チェックリスト

選択したアーキテクチャに対して以下を確認：

- [ ] ビジネスロジックはDBやHTTPを知らない
- [ ] テスト時にDBなしでビジネスロジックをテストできる
- [ ] 新しい機能を追加するとき、既存ファイルの変更が最小限
- [ ] コンストラクタ引数が5つ以下（多ければSRP違反のサイン）
- [ ] エラーケースが型で表現されている（Result型 or ドメイン例外）
- [ ] ReadとWriteの処理が混在していない（CQRS適用の場合）

---

## 関連概念

- → [レイヤードアーキテクチャ](./concepts_backend_layered_architecture.md)
- → [ヘキサゴナルアーキテクチャ](./concepts_backend_hexagonal_architecture.md)
- → [CQRS（コマンドクエリ責任分離）](./concepts_backend_cqrs.md)
- → [イベントソーシング](./concepts_backend_event_sourcing.md)
- → [オブザーバビリティ](./concepts_observability.md)（アーキテクチャ選択後の運用設計）

## 出典

- Martin Fowler, "Who Needs an Architect?" — martinfowler.com
- Sam Newman, *Building Microservices* (2022)
- Vaughn Vernon, *Implementing Domain-Driven Design* (2013) Chapter 2
