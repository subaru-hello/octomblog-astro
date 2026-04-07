---
title: "Astro 構文リファレンス"
description: "Astroコンポーネント・Content Collections・レイアウトなど、このブログで使う構文のまとめ"
category: "Tips"
tags: ["Astro", "構文", "フロントエンド"]
date: 2026-04-03
emoji: "🧩"
order: 2
---

## コンポーネント基本構文

`.astro` ファイルは「フロントマター（`---` で囲まれたサーバー側 JS）」と「HTMLテンプレート」の2部構成。

```astro
---
// フロントマター: ビルド時に実行されるサーバーサイドJS
const greeting = "Hello";
const items = ["a", "b", "c"];
---

<!-- テンプレート: JSXに近い構文 -->
<h1>{greeting}</h1>
<ul>
  {items.map((item) => <li>{item}</li>)}
</ul>
```

## Props

```astro
---
interface Props {
  title: string;
  count?: number;
}
const { title, count = 0 } = Astro.props;
---

<h2>{title} ({count})</h2>
```

呼び出し側:

```astro
<MyComponent title="見出し" count={5} />
```

## スロット（子要素の挿入）

```astro
<!-- Layout.astro -->
<div class="wrapper">
  <slot />  <!-- デフォルトスロット -->
</div>
```

```astro
<!-- 名前付きスロット -->
<slot name="header" />
<slot />  <!-- デフォルト -->
<slot name="footer" />
```

```astro
<!-- 呼び出し側 -->
<Layout>
  <h1 slot="header">タイトル</h1>
  <p>本文</p>
  <p slot="footer">フッター</p>
</Layout>
```

## 条件分岐・繰り返し

```astro
---
const show = true;
const list = [1, 2, 3];
---

{show && <p>表示する</p>}

{show ? <p>あり</p> : <p>なし</p>}

{list.map((n) => (
  <span>{n}</span>
))}
```

## 動的クラス・スタイル

```astro
---
const isActive = true;
const color = "blue";
---

<div class:list={["base", { active: isActive }, "other"]}>
  クラスの動的結合
</div>

<p style={{ color, fontSize: "14px" }}>インラインスタイル</p>
```

## Content Collections（記事取得）

`src/content.config.ts` でコレクションを定義し、ページから取得する。

### 一覧取得

```astro
---
import { getCollection } from 'astro:content';

const posts = await getCollection('blog');
// draft: true の記事を除外する場合
const published = await getCollection('blog', ({ data }) => !data.draft);
// 日付降順ソート
published.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
---

{published.map((post) => (
  <a href={`/blog/${post.id}`}>{post.data.title}</a>
))}
```

### 単一記事取得（動的ルート）

```astro
---
// src/pages/blog/[...slug].astro
import { getCollection, render } from 'astro:content';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map((post) => ({
    params: { slug: post.id },
    props: { post },
  }));
}

const { post } = Astro.props;
const { Content, headings } = await render(post);
---

<Content />
```

## レイアウト継承

```astro
---
// BaseLayout.astro
interface Props {
  title: string;
  noContainer?: boolean;
}
const { title, noContainer = false } = Astro.props;
---

<html>
  <head><title>{title}</title></head>
  <body>
    {noContainer ? <slot /> : <div class="container"><slot /></div>}
  </body>
</html>
```

```astro
---
// 使う側
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout title="ページタイトル" noContainer>
  <p>コンテンツ</p>
</BaseLayout>
```

## 外部コンポーネントのインポート

```astro
---
import NavBar from '../components/common/NavBar.astro';
import ArticleCard from '../components/home/ArticleCard.astro';
---

<NavBar />
<ArticleCard title="タイトル" href="/blog/slug" />
```

## グローバルCSS・スタイルスコープ

```astro
<!-- スコープ付きスタイル（このコンポーネントのみに適用） -->
<style>
  h1 { color: red; }
</style>

<!-- グローバルスタイル -->
<style is:global>
  body { margin: 0; }
</style>
```

## クライアントサイドスクリプト

```astro
<!-- ビルド時にバンドルされてブラウザで実行される -->
<script>
  document.querySelector('button')?.addEventListener('click', () => {
    alert('クリック！');
  });
</script>

<!-- インライン（バンドルされない） -->
<script is:inline>
  console.log('インライン');
</script>
```

## Markdownのfrontmatter定義（content.config.ts）

```typescript
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    categories: z.array(z.string()).default([]),
    image: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
```

## `Astro.url` / `Astro.site`

```astro
---
// 現在のURLを取得
const currentPath = Astro.url.pathname;  // "/blog/my-post"

// サイトのbaseURL（astro.config.mjs の site）
const siteUrl = Astro.site;              // "https://octomblog.com"

// OGP用絶対URL
const canonicalURL = new URL(Astro.url.pathname, Astro.site);
---
```

## 環境変数

```astro
---
// .env に ASTRO_PUBLIC_SITE_URL=https://... と書く
// PUBLIC_ プレフィックスはブラウザからもアクセス可能
const apiUrl = import.meta.env.PUBLIC_API_URL;
const secret = import.meta.env.SECRET_KEY; // サーバーサイドのみ
---
```
