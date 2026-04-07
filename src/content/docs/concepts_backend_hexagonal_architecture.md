---
title: ヘキサゴナルアーキテクチャ（ポート＆アダプター）
description: ビジネスロジックを中心に置き、外部システムとの接続をポート（抽象）とアダプター（実装）で分離するアーキテクチャ。DBもHTTPも「外部の詳細」として扱う
category: "概念"
tags: ["バックエンド", "アーキテクチャ", "設計原則", "ヘキサゴナル"]
emoji: "⬡"
date: "2026-04-06"
order: 111
series:
  - TypeScriptバックエンド設計原則
source: "Alistair Cockburn, 'Hexagonal Architecture' (2005) / Clean Architecture（Robert C. Martin）"
---

## 定義

アプリケーションのコア（ビジネスロジック）を六角形の中心に置き、外部との接続を **ポート**（インタフェース）と **アダプター**（実装）で管理する構造。

```
                  ┌─────────────────────┐
  HTTP Request →  │  Driving Adapter    │
  (Controller)    │  (Primary Adapter)  │
                  └──────────┬──────────┘
                             │ Port (interface)
                  ┌──────────▼──────────┐
                  │                     │
                  │  Application Core   │ ← ビジネスロジックのみ
                  │  (Domain + UseCase) │   インフラを知らない
                  │                     │
                  └──────────┬──────────┘
                             │ Port (interface)
                  ┌──────────▼──────────┐
  Database     ←  │  Driven Adapter     │
  (Repository)    │  (Secondary Adapter)│
                  └─────────────────────┘
```

**Driving Adapters（プライマリ）**：アプリを呼び出す側（HTTP, CLI, テスト）  
**Driven Adapters（セカンダリ）**：アプリが呼び出す側（DB, メール, 外部API）

## なぜ重要か

**問題**：レイヤードアーキテクチャでは「Domain層がInfra層を知らない」が崩れやすい。DBが変わるたびにビジネスロジックを変更しなければならない。

**解決**：すべての外部依存をポート（interface）で抽象化。アプリコアは「どんなDBか」「HTTPかCLIか」を一切知らない。テスト時はアダプターをモック実装に差し替えるだけ。

## TypeScript 実装例

```typescript
// ポート（Port）: コア側が定義するインタフェース
// インフラの存在を知らず、必要な操作だけ宣言する
interface UserRepository {
  findById(id: UserId): Promise<User | null>;
  save(user: User): Promise<void>;
}

interface EmailService {
  sendWelcome(email: Email): Promise<void>;
}

// アプリケーションコア（Core）: ポートに依存、アダプターを知らない
class RegisterUserUseCase {
  constructor(
    private readonly users: UserRepository,   // ← インタフェース
    private readonly email: EmailService,     // ← インタフェース
  ) {}

  async execute(command: RegisterUserCommand): Promise<void> {
    const existing = await this.users.findById(command.id);
    if (existing) throw new DomainError('既に登録済みです');

    const user = User.register(command.id, command.email);
    await this.users.save(user);
    await this.email.sendWelcome(command.email);
  }
}

// Driven Adapter（Secondary）: ポートの実装。DBの詳細はここに閉じる
class PostgresUserRepository implements UserRepository {
  async findById(id: UserId): Promise<User | null> {
    const row = await this.db.query(/* ... */);
    return row ? UserMapper.toDomain(row) : null;
  }
  async save(user: User): Promise<void> { /* ... */ }
}

// Driving Adapter（Primary）: HTTPの詳細はここ。コアを呼ぶだけ
class RegisterUserController {
  async handle(req: Request): Promise<Response> {
    await this.useCase.execute({ id: req.body.id, email: req.body.email });
    return new Response(null, { status: 201 });
  }
}

// テスト時: 本物のDBなしでコアをテストできる
class InMemoryUserRepository implements UserRepository {
  private store = new Map<string, User>();
  async findById(id: UserId) { return this.store.get(id.value) ?? null; }
  async save(user: User) { this.store.set(user.id.value, user); }
}
```

## NestJS での実現

NestJSのDIコンテナで、本番はPostgresAdapter、テストはInMemoryAdapterを注入。

```typescript
// Module でアダプターを切り替え
@Module({
  providers: [
    RegisterUserUseCase,
    { provide: UserRepository, useClass: PostgresUserRepository },
    { provide: EmailService, useClass: SendgridEmailService },
  ],
})
export class UserModule {}
```

## 適用場面

- 長期運用を前提とするシステム（DBやフレームワーク変更の可能性がある）
- テストカバレッジを高めたいとき（インフラなしでビジネスロジックをテスト）
- 複数チャンネルから同じビジネスロジックを呼ぶ（HTTP API + CLI + イベント）

## トレードオフ・注意点

| メリット | デメリット |
|---|---|
| インフラ変更がコアに影響しない | ポート定義とアダプター実装でファイル数が増える |
| テストがDBなしで書ける | 小規模CRUDには過剰設計になりやすい |
| 複数の入出力チャンネルに対応しやすい | 初期の学習コストが高い |

**判断基準**：「このシステムは3年後も使われるか？」「DBを変更する可能性があるか？」YESなら導入価値あり。短期プロトタイプには不要。

## 関連概念

- → [レイヤードアーキテクチャ](./concepts_backend_layered_architecture.md)（ヘキサゴナルの前段となる設計）
- → [依存性注入（DI）](./concepts_backend_dependency_injection.md)（アダプターを差し替える仕組み）
- → [Functional Core, Imperative Shell](./concepts_functional_core_imperative_shell.md)（コアを純粋に保つ思想）
- → [境界づけられたコンテキスト](./concepts_bounded_context.md)（コアの境界を決める）

## 出典・参考文献

- Alistair Cockburn, "Hexagonal Architecture" (2005) — alistair.cockburn.us
- Robert C. Martin, *Clean Architecture* (2017) Chapter 22
- Tom Hombergs, *Get Your Hands Dirty on Clean Architecture* (2019)
