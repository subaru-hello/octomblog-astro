---
title: 依存性注入（DI）と依存性逆転（DIP）
description: 高レベルモジュールが低レベルモジュールに直接依存しないよう、インタフェース経由で依存を「外から注入」する設計原則と実装パターン
category: "概念"
tags: ["バックエンド", "DI", "SOLID", "NestJS", "設計原則"]
emoji: "💉"
date: "2026-04-06"
order: 112
series:
  - TypeScriptバックエンド設計原則
source: "SOLID原則 / NestJS公式ドキュメント / Khalil Stemmler - khalilstemmler.com"
---

## 定義

**依存性逆転原則（DIP: Dependency Inversion Principle）**：高レベルモジュール（ビジネスロジック）は低レベルモジュール（DB、外部API）に依存してはならない。両者は抽象（インタフェース）に依存すべき。

**依存性注入（DI: Dependency Injection）**：DIPを実現する実装パターン。依存するオブジェクトを「内部で生成」せず「外部から受け取る」。

```
❌ 依存性注入なし（ビジネスロジックがDBを直接生成）
UserService → new PostgresUserRepo() → PostgreSQL

✅ 依存性注入あり（インタフェース経由で受け取る）
UserService → UserRepository (interface)
                    ↑
           PostgresUserRepo（本番）
           InMemoryUserRepo（テスト）
```

## なぜ重要か

**問題**：クラス内部で `new` を呼ぶと、そのクラスはコンクリート実装に縛られる。テスト時に本物のDBが必要になり、DB変更のたびにビジネスロジックを変更しなければならない。

**解決**：依存を外から受け取ることで、本番・テスト・開発環境で異なる実装を差し替え可能になる。ビジネスロジックはインタフェースの形だけ知ればよい。

## TypeScript 実装例

### コンストラクタインジェクション（推奨）

```typescript
// 抽象（Port）
interface UserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

// 高レベルモジュール: インタフェースのみに依存
class UserService {
  // コンストラクタで注入 → テスト時に何でも渡せる
  constructor(private readonly userRepo: UserRepository) {}

  async deactivateUser(id: string): Promise<void> {
    const user = await this.userRepo.findById(id);
    if (!user) throw new Error('User not found');
    user.deactivate();
    await this.userRepo.save(user);
  }
}

// 低レベルモジュール（Adapter）
class PostgresUserRepository implements UserRepository {
  async findById(id: string) { /* DB処理 */ }
  async save(user: User) { /* DB処理 */ }
}

// テスト
class InMemoryUserRepository implements UserRepository {
  private store = new Map<string, User>();
  async findById(id: string) { return this.store.get(id) ?? null; }
  async save(user: User) { this.store.set(user.id, user); }
}

// 本番: PostgresRepo を注入
const service = new UserService(new PostgresUserRepository(db));

// テスト: InMemoryRepo を注入。DBなしでテスト可能
const service = new UserService(new InMemoryUserRepository());
```

### NestJS の DI コンテナ

NestJSは `@Injectable()` と `@Module()` で依存グラフを自動管理する。

```typescript
// Provider（注入されるクラス）
@Injectable()
export class UserService {
  // NestJSが自動でUserRepositoryを注入する
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}
}

// Module（依存関係の定義）
@Module({
  providers: [
    UserService,
    // 抽象トークンと実装を紐付け
    {
      provide: 'IUserRepository',
      useClass: process.env.NODE_ENV === 'test'
        ? InMemoryUserRepository
        : PostgresUserRepository,
    },
  ],
})
export class UserModule {}
```

### tsyringe（軽量DIコンテナ）

NestJSを使わない場合の選択肢。

```typescript
import { injectable, inject, container } from 'tsyringe';

@injectable()
class UserService {
  constructor(
    @inject('UserRepository') private userRepo: UserRepository,
  ) {}
}

// 登録
container.register('UserRepository', { useClass: PostgresUserRepository });

// 解決（依存グラフを自動構築）
const service = container.resolve(UserService);
```

## DIコンテナの選択基準

| ライブラリ | 特徴 | 適用場面 |
|---|---|---|
| **NestJS** | フル機能DI、デコレータベース | NestJSアプリ（セット） |
| **tsyringe** | 軽量、reflect-metadata | Express/Hono等のフレームワーク |
| **InversifyJS** | 最も機能豊富なDIコンテナ | 大規模エンタープライズ |
| **手動注入** | DIコンテナなし、Composition Root で組み立て | 小規模、学習目的 |

## 適用場面

- テストでDBや外部APIを差し替えたいとき
- 同じロジックを異なる実装（本番/ステージング）で動かすとき
- ヘキサゴナル・クリーンアーキテクチャを実装するとき

## トレードオフ・注意点

| メリット | デメリット |
|---|---|
| テスト容易性が大幅向上 | デコレータ・reflect-metadata の設定が必要 |
| 実装の差し替えが容易 | DIコンテナのデバッグが難しい場合がある |
| 変更の影響範囲が小さくなる | 小規模アプリには過剰な場合がある |

**よくある誤り**：「DIコンテナを使えばDIPを守れる」は誤り。コンテナは注入の自動化ツールに過ぎない。ポート（インタフェース）の設計がDIPの本質。

## 関連概念

- → [ヘキサゴナルアーキテクチャ](./concepts_backend_hexagonal_architecture.md)（DIが核となるアーキテクチャ）
- → [SOLID原則 TypeScript実装ガイドライン](./rules_backend_typescript_solid.md)（DIPを含む5原則）
- → [ドメインオブジェクト設計](./concepts_domain_object_design.md)（依存の正しい向き）

## 出典・参考文献

- Robert C. Martin, *Clean Architecture* (2017) — Dependency Rule
- Khalil Stemmler, "Dependency Injection & Inversion Explained in Node.js" — khalilstemmler.com
- NestJS Documentation, "Providers" — docs.nestjs.com/providers
- Mark Seemann, *Dependency Injection Principles, Practices, and Patterns* (2019)
