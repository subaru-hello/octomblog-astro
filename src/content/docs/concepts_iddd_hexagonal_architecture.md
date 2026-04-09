---
category: "概念"
order: 202
title: 六角形アーキテクチャ（ポートとアダプター）
description: ドメインを中心に置き、外部の技術詳細をアダプターで差し替え可能にするアーキテクチャスタイル
tags: ["DDD", "アーキテクチャ", "六角形アーキテクチャ", "ポートとアダプター"]
emoji: "⬡"
date: "2026-04-04"
series:
  - 実践ドメイン駆動設計
source: "実践ドメイン駆動設計（Vaughn Vernon）第4章"
---

## 解決する課題

従来の層状アーキテクチャ（UI → ビジネス層 → DB層）では、**ドメインロジックがインフラ（フレームワーク・DB・外部API）に依存**してしまいやすい。ドメインに UI やフレームワークの概念が混入すると、テストが困難になり、技術の差し替えが難しくなる。

## 概念

Alistair Cockburn が提唱したアーキテクチャスタイル。**ドメインを中心（内側）** に置き、外部のすべてのアクター（UI、DB、メッセージキュー、外部API）を**アダプター（外側）** で接続する。

```
        [HTTP]  [CLI]  [テスト]
           ↓       ↓       ↓
      ┌─────────────────────┐
      │   ポート（インターフェース）│
      │  ┌─────────────────┐ │
      │  │   ドメインモデル   │ │
      │  │  （純粋なロジック） │ │
      │  └─────────────────┘ │
      │   ポート（インターフェース）│
      └─────────────────────┘
           ↓       ↓       ↓
        [DB] [メッセージキュー] [外部API]
```

- **ポート**: ドメインが外部に公開するインターフェース（抽象）
- **アダプター**: ポートの具体的な実装（HTTP コントローラ、DB リポジトリ、メッセージプロデューサー）

## なぜ重要か

- ドメインが **フレームワーク・DBに依存しない** → テストが容易
- アダプターを差し替えるだけで別の技術に移行できる（DB を MySQL → PostgreSQL へ）
- ドメインロジックを理解するために UI の知識が不要になる

## IDDD における位置づけ

Vernon は六角形アーキテクチャを DDD の「デフォルトアーキテクチャ」として推薦している。ドメインモデルをインフラから守ることが、長期的なモデルの純粋性を保証する。

他の選択肢（CQRS、イベント駆動）と組み合わせることも多い。

## 依存の方向

重要な原則：**外側が内側に依存する。内側は外側を知らない。**

```
✅ DBアダプター → リポジトリインターフェース（ドメイン）
❌ ドメイン → DB（Hibernate等）の具体クラス
```

依存性逆転の原則（DIP）をアーキテクチャレベルで実現したもの。

## Wild Workoutsでの確認

`internal/trainer/domain/hour/repository.go` の `Repository` がポート。

```go
// ドメイン層が定義するポート（interface）
type Repository interface {
    GetHour(ctx context.Context, hourTime time.Time) (*Hour, error)
    UpdateHour(ctx context.Context, hourTime time.Time, updateFn func(h *Hour) (*Hour, error)) error
}
```

`Hour` はDBを一切知らない。`Repository` というインターフェースだけを知っている。
DBがFirestoreだろうとPostgreSQLだろうと `Hour` のコードは変わらない。

## 適用例

| アクター | ポート（インターフェース） | アダプター（実装） |
|---|---|---|
| HTTPリクエスト | `ApplicationService` | REST コントローラ |
| ユニットテスト | `Repository` | In-Memory リポジトリ |
| 本番DB | `Repository` | JPA / SQLAlchemy |
| メッセージ配信 | `DomainEventPublisher` | RabbitMQ / Kafka |

## 関連概念

- → [アプリケーションサービス](./concepts_iddd_application_service.md)（外部からドメインへの入り口）
- → [リポジトリ](./concepts_iddd_repository.md)（ポートとアダプターの典型例）
- → [CQRS](./concepts_iddd_cqrs.md)（六角形との組み合わせパターン）
