---
title: TypeScript OSS に学ぶ設計パターン
description: NestJS・Hono・Fastify・tRPC・Drizzle・Zod の設計思想から、TypeScriptバックエンド実装に直接活かせるパターンを抽出する
category: "Tips"
tags: ["バックエンド", "TypeScript", "NestJS", "Hono", "tRPC", "Drizzle", "Zod", "設計パターン"]
emoji: "📦"
date: "2026-04-06"
order: 19
series:
  - TypeScriptバックエンド設計原則
---

## 目的

代表的TypeScript OSSの設計思想を自分のコードに意識的に適用できるようにする。「なんとなく使う」から「設計判断として選択する」状態に移行する。

---

## Step 1: NestJS から学ぶ「構造化されたDI」

**NestJSの本質**：Angularの思想をサーバーサイドに移植。デコレータ + DIコンテナで依存グラフを宣言的に定義する。

**自分のコードへの適用**：

```typescript
// NestJS が教えてくれること:
// 1. クラスの依存はコンストラクタで宣言する
// 2. Moduleで「何を提供し、何を外部に公開するか」を明示する
// 3. Provider の token（抽象）と useClass（実装）を分離する

// NestJS を使わない場合でも同じ思想を適用できる
class UserModule {
  static create(config: ModuleConfig) {
    const db = new PostgresDatabase(config.db);
    const userRepo = new PostgresUserRepository(db);
    const emailService = new SendgridEmailService(config.email);

    // Composition Root: ここだけで具体実装を知っている
    return {
      registerUser: new RegisterUserUseCase(userRepo, emailService),
      getUser: new GetUserUseCase(userRepo),
    };
  }
}
```

**学ぶべき設計判断**：
- Provider を interface で定義し、環境（本番/テスト）でuseClassを切り替える
- モジュール境界を `exports` で明示し、他モジュールへの漏れを防ぐ
- `@Global()` を乱用しない（隠れた依存を生む）

---

## Step 2: Hono から学ぶ「Web Standards First」

**Honoの本質**：Node.js、Deno、Cloudflare Workers、Bun など11+ランタイムで動く。`Request` / `Response` / `Headers` など Web Standards APIのみを使用。

**自分のコードへの適用**：

```typescript
// Hono のミドルウェアパターンを学ぶ
// → 処理を「入力変換 → コア処理 → 出力変換」に分離できる

// ミドルウェア: 認証（入力検証）
const authMiddleware = createMiddleware(async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return c.json({ error: 'Unauthorized' }, 401);

  const user = await verifyToken(token);
  c.set('currentUser', user);  // コンテキストに安全に型付きで渡す
  await next();
});

// ミドルウェア: バリデーション
app.post('/orders',
  authMiddleware,
  zValidator('json', CreateOrderSchema),  // Zodスキーマで自動バリデーション
  async (c) => {
    const user = c.get('currentUser');
    const body = c.req.valid('json');
    // ここに来た時点で認証済み・バリデーション済みが保証される
    return c.json(await orderService.create(user.id, body), 201);
  }
);
```

**学ぶべき設計判断**：
- ランタイム依存を排除すると移植性が上がる（Cloudflare Workers への移行が容易）
- ミドルウェアチェーンで横断的関心事（認証・ログ・バリデーション）を分離
- `c.set()` / `c.get()` で型安全なコンテキスト伝播

---

## Step 3: Fastify から学ぶ「スキーマ駆動型設計」

**Fastifyの本質**：JSONスキーマを先に定義し、バリデーションとシリアライゼーションをコンパイル時に最適化。「スキーマが仕様書になる」設計。

**自分のコードへの適用**：

```typescript
// Fastify が教えてくれること:
// スキーマ定義が「ドキュメント」「バリデーション」「型」の3つを兼ねる

// Zodでも同じアプローチを実現できる
const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(['admin', 'user']).default('user'),
});

// z.infer でスキーマから型を自動生成（DRYの徹底）
type CreateUserDto = z.infer<typeof CreateUserSchema>;

// Fastifyのプラグインスコープ思想:
// 子プラグインは親の設定を継承するが、兄弟プラグインは共有しない
// → NestJSのモジュールスコープと同じ思想
```

**学ぶべき設計判断**：
- スキーマを single source of truth にする（型定義と実行時バリデーションを分離しない）
- プラグインで機能を隔離し、スコープ汚染を防ぐ

---

## Step 4: tRPC から学ぶ「コントラクトファースト」

**tRPCの本質**：サーバーの型定義がそのままクライアントの型になる。コード生成ゼロ・APIドリフトゼロ。「型がドキュメントであり、コントラクト」。

**自分のコードへの適用**：

```typescript
// tRPC が教えてくれること:
// 1. Procedure を単一責任の小さな単位に分割する
// 2. Input/Output の型を明示することで「契約」を作る
// 3. Context で認証状態などを横断的に注入する

// tRPC の思想をRESTに転用: 関数型APIコントラクト
type GetUserInput = { id: string };
type GetUserOutput = { id: string; name: string; email: string } | null;

// 戻り値の型を明示することで「契約」を文書化
async function getUser(input: GetUserInput): Promise<GetUserOutput> {
  return userRepo.findById(input.id);
}

// tRPC の middleware 思想: Procedureの前後に処理を挟む
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({ ctx: { user: ctx.user } }); // 型が絞り込まれる
});
```

**学ぶべき設計判断**：
- Input/Output を明示的な型として定義する習慣（暗黙のany型を排除）
- MiddlewareチェーンでContextを段階的に絞り込む

---

## Step 5: Drizzle / Prisma から学ぶ「スキーマと型の統合」

**対比**：

| | Prisma | Drizzle |
|---|---|---|
| **思想** | Schema-first（.prismaファイルが真実） | Code-first（TypeScriptが真実） |
| **型生成** | `prisma generate`（事前生成） | リアルタイム型推論（生成不要） |
| **SQL制御** | 抽象化（SQLを書かない） | 薄い抽象（SQLに近い） |

```typescript
// Drizzle の思想: TypeScriptコードがスキーマになる
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
});

// クエリの型が自動推論される
const user = await db.select().from(users).where(eq(users.id, id));
// user: { id: string; email: string; createdAt: Date }[]
```

**学ぶべき設計判断**：
- ORMは「DBをオブジェクトに変換するアダプター」として捉え、Repositoryパターンの内側に閉じ込める
- スキーマとTypeScript型を一元管理する（二重管理しない）

---

## Step 6: Zod から学ぶ「スキーマを信頼の境界に置く」

**Zodの本質**：ランタイムバリデーションと型推論を統一。外部からのデータ（HTTPリクエスト、環境変数、JSONファイル）はZodを通ることで型安全領域に入る。

```typescript
// 信頼の境界: 外部からのデータは全てZodで検証する
const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().min(1000).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']),
});

// process.env はここで一度だけ検証し、以降は型安全な値を使う
const env = EnvSchema.parse(process.env);
// env.PORT は number 型が保証される

// ドメインオブジェクトの構築もZodで保護できる
const EmailSchema = z.string().email().brand('Email');
type Email = z.infer<typeof EmailSchema>;

function createEmail(raw: string): Email {
  return EmailSchema.parse(raw); // 不正なメールアドレスはここで弾く
}
```

**学ぶべき設計判断**：
- システム境界（HTTP入力、環境変数、外部API応答）でZodを使い、内部では型を信頼する
- `z.infer<>` で型定義とバリデーションを一元管理する

---

## チェックリスト

- [ ] DIをコンストラクタ経由で行い、`new ConcreteClass()` をビジネスロジックから排除（NestJS思想）
- [ ] ミドルウェアで認証・バリデーション・ログを分離（Hono/Fastify思想）
- [ ] スキーマから型を自動生成している（Drizzle/Zod思想）
- [ ] 外部入力はZodで検証してから内部に渡している（信頼境界）
- [ ] Input/Output の型を明示した関数設計になっている（tRPC思想）

## 関連概念

- → [依存性注入（DI）と依存性逆転（DIP）](./concepts_backend_dependency_injection.md)（NestJSの設計原則）
- → [ヘキサゴナルアーキテクチャ](./concepts_backend_hexagonal_architecture.md)（アダプターとしてのOSS活用）
- → [API設計比較](./concepts_backend_api_design_comparison.md)（REST/tRPC/gRPCの選択）
- → [SOLID原則 TypeScript実装ガイドライン](./rules_backend_typescript_solid.md)

## 出典

- NestJS Documentation — docs.nestjs.com
- Hono Documentation — hono.dev
- tRPC Documentation — trpc.io
- Drizzle ORM Documentation — orm.drizzle.team
- Zod Documentation — zod.dev
