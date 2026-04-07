---
title: SOLID原則 TypeScript実装ガイドライン
description: 5つのSOLID原則をTypeScriptで実装する際の具体的なルールと判断基準。NestJS・Hono・tRPC等のTS OSSが採用する設計思想の共通基盤
category: "概念"
tags: ["バックエンド", "SOLID", "TypeScript", "設計原則", "OOP"]
emoji: "🧱"
date: "2026-04-06"
order: 117
series:
  - TypeScriptバックエンド設計原則
source: "Robert C. Martin, 'Agile Software Development' (2002) / LogRocket Blog, 'Applying SOLID principles to TypeScript'"
---

## なぜ SOLID が今も重要か

SOLID原則（2002年, Robert C. Martin）はクラス設計の指針だが、TypeScriptの型システムがあることで「原則違反をコンパイラが検知できる」ようになった。NestJSのモジュール設計、tRPCの型推論、Zodのスキーマ構成は全てこれらの原則を体現している。

---

## S — 単一責任原則（SRP）

**ルール**：クラス・関数が変更される理由は1つだけにする。

```typescript
// ❌ 違反: UserServiceが「ビジネスロジック」「DB操作」「メール送信」を全て担当
class UserService {
  async register(data: RegisterDto) {
    const user = new User(data);                      // ドメインロジック
    await this.db.query('INSERT INTO users...');      // DB操作
    await sendgrid.send({ to: data.email, ... });     // メール送信
  }
}

// ✅ 遵守: 各クラスが1つの責任に集中
class User {
  static register(data: RegisterDto): User { /* ドメインロジック */ }
}
class UserRepository {
  async save(user: User): Promise<void> { /* DB操作のみ */ }
}
class EmailService {
  async sendWelcome(email: string): Promise<void> { /* メールのみ */ }
}
class RegisterUserUseCase {
  async execute(data: RegisterDto): Promise<void> {
    const user = User.register(data);
    await this.userRepo.save(user);
    await this.email.sendWelcome(data.email);
  }
}
```

**判断基準**：「このクラスが変わる理由は何か？」を問う。複数の答えが出たら分割のサイン。

---

## O — 開放閉鎖原則（OCP）

**ルール**：既存コードを変更せずに機能を拡張できるように設計する。

```typescript
// ❌ 違反: 支払い方法を追加するたびにProcessorを変更しなければならない
class PaymentProcessor {
  process(method: string, amount: number) {
    if (method === 'credit') { /* ... */ }
    else if (method === 'paypal') { /* ... */ }
    // 新しい方法を追加するたびにこのクラスを変更
  }
}

// ✅ 遵守: インタフェースで拡張点を定義
interface PaymentMethod {
  process(amount: number): Promise<PaymentResult>;
}
class CreditCardPayment implements PaymentMethod { /* ... */ }
class PayPalPayment implements PaymentMethod { /* ... */ }
class CryptoPayment implements PaymentMethod { /* ... */ } // 追加時に既存コード変更不要

class PaymentProcessor {
  process(method: PaymentMethod, amount: number): Promise<PaymentResult> {
    return method.process(amount); // このクラスは変更しない
  }
}
```

**TypeScriptの恩恵**：`implements` でコンパイル時に契約を保証。新しい実装を追加するときに既存テストが壊れない。

---

## L — リスコフの置換原則（LSP）

**ルール**：サブクラス（実装クラス）は親クラス（インタフェース）の代わりに使用できなければならない。

```typescript
// ❌ 違反: ReadOnlyRepositoryがwriteメソッドを持つインタフェースを実装している
interface UserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}
class ReadOnlyUserRepository implements UserRepository {
  async findById(id: string) { return this.db.find(id); }
  async save() {
    throw new Error('読み取り専用です'); // ← LSP違反: 呼び出し元が例外を想定していない
  }
}

// ✅ 遵守: インタフェースを責任で分割する（ISPも同時に満たす）
interface ReadableUserRepository {
  findById(id: string): Promise<User | null>;
}
interface WritableUserRepository {
  save(user: User): Promise<void>;
}
class ReadOnlyUserRepository implements ReadableUserRepository {
  async findById(id: string) { return this.db.find(id); }
  // saveを持たないので違反しない
}
```

**TypeScriptの恩恵**：型システムがLSP違反を多くのケースで静的に防ぐ。

---

## I — インタフェース分離原則（ISP）

**ルール**：使わないメソッドへの依存を強制しない。大きなインタフェースより小さな特化したインタフェースを複数持つ。

```typescript
// ❌ 違反: 1つの巨大なインタフェース
interface UserRepository {
  findById(id: string): Promise<User | null>;
  findAll(): Promise<User[]>;
  save(user: User): Promise<void>;
  delete(id: string): Promise<void>;
  findByEmailBatch(emails: string[]): Promise<User[]>;
  // 全クラスがこの全メソッドを実装しなければならない
}

// ✅ 遵守: 用途別に分割
interface UserReader {
  findById(id: string): Promise<User | null>;
}
interface UserWriter {
  save(user: User): Promise<void>;
}
interface UserDeleter {
  delete(id: string): Promise<void>;
}

// 必要なインタフェースだけを依存として宣言
class DeactivateUserUseCase {
  constructor(
    private readonly reader: UserReader,   // findByIdしか使わない
    private readonly writer: UserWriter,   // saveしか使わない
  ) {}
}
```

**実践的ヒント**：`Pick<T, K>` や小さなインタフェースを活用。NestJSのProvider設計でも自然と適用される。

---

## D — 依存性逆転原則（DIP）

**ルール**：高レベルモジュール（ビジネスロジック）は低レベルモジュール（DB、API）に直接依存しない。両者はインタフェースに依存する。

```typescript
// ❌ 違反: ビジネスロジックが具体実装に直接依存
class OrderService {
  private repo = new PostgresOrderRepository(); // ← new で直接生成
  private email = new SendgridEmailService();    // ← 具体クラスに依存

  async placeOrder(data: PlaceOrderDto): Promise<void> { /* ... */ }
}

// ✅ 遵守: インタフェース経由で受け取る（DI）
class OrderService {
  constructor(
    private readonly repo: OrderRepository,   // ← インタフェース
    private readonly email: EmailService,     // ← インタフェース
  ) {}

  async placeOrder(data: PlaceOrderDto): Promise<void> { /* ... */ }
}
// テスト: InMemoryRepo を注入してDBなしでテスト
// 本番: PostgresRepo を注入
```

詳細は → [依存性注入（DI）と依存性逆転（DIP）](./concepts_backend_dependency_injection.md)

---

## 原則違反を発見するサイン

| サイン | 違反している原則 |
|---|---|
| クラスのコンストラクタ引数が5つ以上 | SRP（責任が多すぎる） |
| 条件分岐で型や種別を切り替えている | OCP（StrategyパターンやPolymorphismで解決） |
| テストで例外を想定したモックが必要 | LSP（インタフェース設計の問題） |
| テスト用モックで未使用のメソッドが多い | ISP（インタフェースが大きすぎる） |
| `new ConcreteClass()` がビジネスロジック内にある | DIP（DIコンテナまたはコンストラクタ注入で解決） |

## TypeScript OSSが体現するSOLID

- **NestJS**：DIコンテナ（DIP）+ モジュール分割（SRP）+ Provider Interface（OCP/ISP）
- **tRPC**：Procedure の分離（SRP）+ RouterをCompose（OCP）+ 型推論でLSP保証
- **Zod**：`.extend()`・`.pick()`・`.omit()` でスキーマをISP原則に沿って分割
- **Hono**：Middlewareチェーン（OCP：既存コードを変えずに機能追加）

## 関連概念

- → [依存性注入（DI）と依存性逆転（DIP）](./concepts_backend_dependency_injection.md)（DIPの実装）
- → [ヘキサゴナルアーキテクチャ](./concepts_backend_hexagonal_architecture.md)（SOLIDをアーキテクチャレベルに昇華）
- → [ドメインオブジェクト設計](./concepts_domain_object_design.md)（SRPのドメイン層への適用）

## 出典・参考文献

- Robert C. Martin, *Agile Software Development, Principles, Patterns, and Practices* (2002)
- Robert C. Martin, *Clean Architecture* (2017) Part III
- Khalil Stemmler, "SOLID Principles: The Software Developer's Framework to Robust & Maintainable Code" — khalilstemmler.com
- LogRocket, "Applying SOLID principles to TypeScript" — blog.logrocket.com
