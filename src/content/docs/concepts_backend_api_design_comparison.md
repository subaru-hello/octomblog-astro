---
title: API設計比較（REST / GraphQL / gRPC / tRPC）
description: バックエンドAPIの4つの主要アプローチを比較。ユースケース・パフォーマンス・型安全性・開発体験の観点から選択基準を整理する
category: "概念"
tags: ["バックエンド", "API設計", "REST", "GraphQL", "gRPC", "tRPC", "TypeScript"]
emoji: "🔌"
date: "2026-04-06"
order: 116
series:
  - TypeScriptバックエンド設計原則
source: "Roy Fielding, 'Architectural Styles and the Design of Network-based Software Architectures' (2000) / Sam Newman, 'Building Microservices' / tRPC公式ドキュメント"
---

## 定義

バックエンドAPIを設計する際の主要な4つのアプローチ：

| アプローチ | 基盤 | 通信形式 | 型安全 |
|---|---|---|---|
| **REST** | HTTP/1.1 | JSON | なし（OpenAPIで補完） |
| **GraphQL** | HTTP | JSON | スキーマ定義 |
| **gRPC** | HTTP/2 | Protocol Buffers | 完全（IDL） |
| **tRPC** | HTTP | JSON | TypeScript型推論 |

## REST（Representational State Transfer）

**思想**：リソースをURIで表現し、HTTPメソッド（GET/POST/PUT/DELETE）でCRUD操作を対応させる。Roy Fieldingが2000年の博士論文で定義した制約セット。

```typescript
// Hono での REST API 実装
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

const app = new Hono();

// リソースベースのルーティング
app.get('/users/:id', async (c) => {
  const user = await userService.findById(c.req.param('id'));
  if (!user) return c.json({ error: 'Not Found' }, 404);
  return c.json(user);
});

app.post('/users',
  zValidator('json', CreateUserSchema),  // Zodでバリデーション
  async (c) => {
    const data = c.req.valid('json');
    const user = await userService.create(data);
    return c.json(user, 201);
  }
);
```

**適切な場面**：
- 公開API（サードパーティに消費される）
- シンプルなCRUDシステム
- キャッシュ活用が重要なとき（CDN、HTTPキャッシュ）

---

## GraphQL

**思想**：クライアントが必要なフィールドだけを指定してデータを取得する。Facebookが2015年にオープンソース化。Over-fetchingとUnder-fetchingを解消する。

```typescript
// TypeGraphQL でのスキーマ定義
@ObjectType()
class User {
  @Field()
  id!: string;

  @Field()
  name!: string;

  @Field(() => [Order])
  orders!: Order[];  // クライアントが不要なら取得されない
}

@Resolver(User)
class UserResolver {
  @Query(() => User, { nullable: true })
  async user(@Arg('id') id: string): Promise<User | null> {
    return this.userService.findById(id);
  }

  // DataLoaderでN+1を防ぐ（GraphQLの典型的な罠）
  @FieldResolver(() => [Order])
  async orders(@Root() user: User, @Ctx() ctx: Context): Promise<Order[]> {
    return ctx.orderLoader.load(user.id);
  }
}
```

**適切な場面**：
- BFF（Backend for Frontend）でクライアントごとに最適化
- 複数のデータソースを統合して1リクエストで取得したい
- モバイル・Web・TV など多様なクライアントが存在する

**注意**：N+1問題はDataLoaderで必ず対処する。キャッシュがRESTより複雑。

---

## gRPC

**思想**：Protocol Buffers（.proto）でIDL（インタフェース定義言語）を先に定義し、型安全なクライアント・サーバーコードを自動生成。HTTP/2でバイナリ転送。

```protobuf
// user.proto
syntax = "proto3";

service UserService {
  rpc GetUser (GetUserRequest) returns (UserResponse);
  rpc CreateUser (CreateUserRequest) returns (UserResponse);
  rpc ListUsers (ListUsersRequest) returns (stream UserResponse); // ストリーミング
}

message GetUserRequest {
  string id = 1;
}

message UserResponse {
  string id = 1;
  string name = 2;
  string email = 3;
}
```

```typescript
// TypeScript（@grpc/grpc-js）でのサーバー実装
import { UserServiceServer } from './generated/user_grpc_pb';

const userServer: UserServiceServer = {
  getUser: async (call, callback) => {
    const user = await userService.findById(call.request.getId());
    const response = new UserResponse();
    response.setId(user.id);
    callback(null, response);
  },
};
```

**適切な場面**：
- マイクロサービス間の内部通信（外部には非公開）
- 高スループット・低レイテンシが必要な場合（gRPCはJSONより3-10倍小さい）
- 双方向ストリーミングが必要な場合

---

## tRPC

**思想**：TypeScriptの型システムを活用し、サーバーの関数型定義をクライアントがそのまま型推論で利用できる。コード生成不要。TypeScriptネイティブなプロジェクト専用。

```typescript
// サーバー側: ルーター定義
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.create();

export const appRouter = t.router({
  getUser: t.procedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return userService.findById(input.id);  // User | null を返す
    }),

  createUser: t.procedure
    .input(z.object({ name: z.string(), email: z.string().email() }))
    .mutation(async ({ input }) => {
      return userService.create(input);
    }),
});

export type AppRouter = typeof appRouter;

// クライアント側: 型推論でそのまま呼べる（コード生成不要）
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../server/router';

const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: '/api/trpc' })],
});

// 戻り値の型が自動推論される
const user = await trpc.getUser.query({ id: '123' }); // User | null
```

**適切な場面**：
- フロントエンド・バックエンドがTypeScriptのモノレポ
- 外部公開しないAPIで最大のDXを求めるとき
- React Query / SWR との統合（`@trpc/react-query`）

---

## 比較と選択基準

| 観点 | REST | GraphQL | gRPC | tRPC |
|---|---|---|---|---|
| **パフォーマンス** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **型安全性** | ⭐（OpenAPI）| ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **DX（開発体験）** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐（.proto学習）| ⭐⭐⭐⭐⭐（TS限定）|
| **外部公開** | ✅ | ✅ | △（要ゲートウェイ）| ❌（TS限定）|
| **ブラウザ対応** | ✅ | ✅ | △（grpc-web）| ✅ |
| **ストリーミング** | SSE | Subscription | ✅（双方向）| ✅（SSE経由）|

### 決断フレームワーク

```
外部サードパーティに公開する？
  YES → REST（標準で理解しやすい）
  NO ↓

サービス間の高速内部通信？
  YES → gRPC（HTTP/2 + Protobuf）
  NO ↓

フロント・バックエンドが同一TypeScriptコードベース？
  YES → tRPC（最高のDX）
  NO ↓

多様なクライアント（モバイル/Web）でデータ取得を柔軟に？
  YES → GraphQL（BFF）
  NO → REST（シンプルで十分）
```

## トレードオフのまとめ

- **REST**：汎用性最高・学習コスト低。型安全性は OpenAPI + zod-openapi で補完可能
- **GraphQL**：柔軟なデータ取得。N+1・キャッシュ・認可の複雑さに注意
- **gRPC**：最高パフォーマンス。ブラウザ直接通信は grpc-web が必要
- **tRPC**：TypeScript専用だが DX は最高峰。フルスタック TypeScript プロジェクトのデファクト

## 関連概念

- → [ヘキサゴナルアーキテクチャ](./concepts_backend_hexagonal_architecture.md)（どのAPIも「Driving Adapter」として扱う）
- → [依存性注入（DI）](./concepts_backend_dependency_injection.md)（APIハンドラへのサービス注入）
- → [CQRS](./concepts_backend_cqrs.md)（CommandはMutation、QueryはQuery に対応）

## 出典・参考文献

- Roy Fielding, "Architectural Styles and the Design of Network-based Software Architectures" (2000) — ics.uci.edu
- Sam Newman, *Building Microservices* (2022) Chapter 5
- tRPC Documentation — trpc.io
- Tanmai Gopal, "GraphQL vs REST" — hasura.io/blog
