---
title: N+1問題とDataLoaderパターン
description: ORMやGraphQLで頻出するN+1問題の根本原因と、バッチローディング・DataLoaderパターンによる解決策。Eager LoadingとLazy Loadingのトレードオフを理解する
category: "概念"
tags: ["データ設計", "N+1問題", "DataLoader", "GraphQL", "ORM", "パフォーマンス"]
emoji: "🔄"
date: "2026-04-07"
order: 826
series:
  - データ志向アプリケーション設計（DDIA）
source: "GraphQL DataLoader / Prisma Documentation"
---

## 定義

**N+1問題**：1件のリストを取得するクエリ（1）と、リストの各要素に対して発行されるクエリ（N）で、合計N+1回のDBアクセスが発生するパフォーマンス問題。

## 問題の発生パターン

### REST + ORMの場合

```typescript
// ブログ投稿一覧を返すAPI
app.get('/posts', async (req, res) => {
  const posts = await Post.findAll();  // クエリ1回: SELECT * FROM posts
  
  const result = await Promise.all(
    posts.map(async (post) => ({
      ...post,
      author: await User.findById(post.authorId),  // N回のクエリ発生！
    }))
  );
  
  res.json(result);
});

// 実際に発行されるSQL:
// SELECT * FROM posts;                    ← 1回
// SELECT * FROM users WHERE id = 1;      ← posts[0]の著者
// SELECT * FROM users WHERE id = 2;      ← posts[1]の著者
// SELECT * FROM users WHERE id = 3;      ← posts[2]の著者
// ... N回続く
// 合計: N + 1 クエリ
```

### GraphQLの場合

```graphql
query {
  posts {          # 1クエリ
    title
    author {       # 各投稿ごとにクエリ → N回
      name
    }
  }
}
```

GraphQLのリゾルバは各フィールドを独立して解決するため、N+1が構造的に発生しやすい。

## 解決策1：Eager Loading（JOIN）

関連データを最初から一緒に取得する。

```typescript
// Prismaの例
const posts = await prisma.post.findMany({
  include: {
    author: true,  // JOINで一緒に取得
  },
});

// 発行されるSQL:
// SELECT posts.*, users.*
// FROM posts
// LEFT JOIN users ON users.id = posts.author_id;
// → 1クエリで解決
```

**メリット**：最もシンプル。1クエリで完結。  
**デメリット**：不要なデータまで取得する（GraphQLで一部フィールドしか要求されていない場合でもJOIN）。ネストが深いと巨大なJOINになる。

## 解決策2：DataLoaderパターン

バッチ処理で複数IDをまとめてDBに問い合わせる。

```
通常のN+1:
  User.findById(1)  → SELECT WHERE id = 1
  User.findById(2)  → SELECT WHERE id = 2
  User.findById(3)  → SELECT WHERE id = 3

DataLoader:
  イベントループの1tick内のリクエストを収集
  → SELECT WHERE id IN (1, 2, 3)  ← 1クエリにまとめる
```

### DataLoaderの実装（Node.js）

```typescript
import DataLoader from 'dataloader';

// バッチ関数: IDsの配列を受け取り、同じ順序で結果を返す
const userLoader = new DataLoader<string, User>(async (userIds) => {
  const users = await db.query(
    'SELECT * FROM users WHERE id = ANY($1)',
    [userIds]
  );
  
  // IDの順序に合わせて結果を並び替える（重要！）
  const userMap = new Map(users.map(u => [u.id, u]));
  return userIds.map(id => userMap.get(id) ?? new Error(`User ${id} not found`));
});

// GraphQL リゾルバ
const resolvers = {
  Post: {
    author: (post) => userLoader.load(post.authorId),
    // 複数のpostが同じtickでauthorを要求 → バッチにまとめられる
  }
};

// 発行されるSQL:
// SELECT * FROM users WHERE id IN (1, 2, 3, 4, 5)  ← 1クエリ
```

### DataLoaderのキャッシュ

```typescript
// DataLoaderはリクエストスコープでキャッシュする
const user1 = await userLoader.load('1');  // DBアクセス
const user1Again = await userLoader.load('1');  // キャッシュヒット

// リクエストをまたいでキャッシュしてはいけない
// → 別ユーザーのデータが混ざるセキュリティリスク
// → リクエストごとに新しいDataLoaderインスタンスを作る

// Expressの例
app.use((req, res, next) => {
  req.loaders = {
    user: new DataLoader(batchLoadUsers),
    post: new DataLoader(batchLoadPosts),
  };
  next();
});
```

## 解決策3：事前計算・非正規化

```typescript
// コメント数を毎回カウントするのではなく
// posts テーブルに comment_count カラムを持つ

// コメント追加時:
await db.transaction(async (tx) => {
  await tx.query('INSERT INTO comments ...', [...]);
  await tx.query(
    'UPDATE posts SET comment_count = comment_count + 1 WHERE id = $1',
    [postId]
  );
});

// 読み取り時: JOINもサブクエリも不要
SELECT title, comment_count FROM posts;
```

**トレードオフ**：書き込みが複雑になり、整合性管理が必要。読み取りが非常に速くなる。

## Lazy Loading の危険性

多くのORMはデフォルトでLazy Loading（アクセス時に自動ロード）を提供する。

```python
# Django ORM（Lazy Loading）
posts = Post.objects.all()  # クエリ1回

for post in posts:
    print(post.author.name)  # アクセスのたびにクエリ！
    
# → N+1が暗黙に発生する
# → コードを見ただけではクエリ数が分からない

# 解決: select_related（JOIN）または prefetch_related（IN句）
posts = Post.objects.select_related('author').all()
```

## クエリログで確認する

```typescript
// Prismaのクエリログ有効化
const prisma = new PrismaClient({
  log: ['query'],
});

// 開発時に同じリクエストで何クエリ発行されているか確認
// N+1が起きていると大量のログが出る
```

## 使い分けのまとめ

| 状況 | 解決策 |
|---|---|
| 常にauthorが必要 | Eager Loading（JOIN） |
| GraphQLで動的にフィールドが変わる | DataLoader |
| 読み取り頻度が高い集計値 | 非正規化（カウンターカラム） |
| 深くネストしたデータ | DataLoader + 部分的なEager Loading |

```
原則:
  1. まず問題を計測（推測で最適化しない）
  2. Eager LoadingでJOINできるなら最もシンプル
  3. GraphQLのように動的な場合はDataLoader
  4. 集計が重ければ非正規化を検討
```

## 関連概念

- → [クエリオプティマイザー](./concepts_ddia_query_optimizer.md)（JOINの実行計画）
- → [キャッシュ戦略](./concepts_ddia_cache_strategy.md)（DataLoaderのキャッシュとの関係）
- → [ストレージとインデックス](./concepts_ddia_storage_indexing.md)（インデックスとJOINパフォーマンス）

## 出典・参考文献

- Facebook, "DataLoader" — github.com/graphql/dataloader
- Prisma Documentation, "Relation queries" — prisma.io/docs
- GraphQL Best Practices — graphql.org/learn/best-practices
