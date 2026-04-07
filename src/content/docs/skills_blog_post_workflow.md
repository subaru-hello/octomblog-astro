---
title: "記事作成・デプロイフロー"
description: "ブログ記事・Docsの作成からCloudflare Pagesへのデプロイまでの手順"
category: "Tips"
tags: ["ブログ運営", "Astro", "Cloudflare"]
date: 2026-04-03
emoji: "🚀"
order: 1
---

## ブログ記事を書く

`src/content/blog/` に Markdown ファイルを作成する。ファイル名がURLスラッグになる。

```bash
touch src/content/blog/my-new-post.md
```

### フロントマター

```yaml
---
title: "記事タイトル"
description: "記事の要約（OGP・検索に使われる）"
date: 2026-04-03
tags: ["AWS", "Go"]
categories: ["TECH"]     # TECH | IDEA
image: images/blog-covers/my-new-post.png  # public/ 以下のパス
draft: false             # true でビルドから除外
---
```

### カバー画像

```bash
cp ~/Downloads/cover.png public/images/blog-covers/my-new-post.png
```

画像は `public/images/blog-covers/` に置き、frontmatter の `image` に `images/blog-covers/ファイル名` を指定する（`/public` の部分は不要）。

---

## Docsを書く

`src/content/docs/` に Markdown ファイルを作成する。

```bash
touch src/content/docs/concepts_my_topic.md
```

### フロントマター

```yaml
---
title: "概念名"
description: "一行説明"
category: "概念"        # 概念 | フレームワーク | Tips
tags: ["設計原則"]
date: 2026-04-03
emoji: "✨"
order: 10               # 小さいほどサイドバーの上に表示
source: "書籍名 第3章"  # 任意
lang: "ja"              # ja | en
---
```

---

## ローカル確認

```bash
pnpm dev
# http://localhost:4321
```

---

## デプロイ

```bash
# 1. ビルド（Astro静的生成 + Pagefind検索インデックス生成）
pnpm build

# 2. Cloudflare Pages にアップロード
npx wrangler pages deploy dist \
  --project-name octomblog \
  --branch main \
  --commit-dirty=true
```

デプロイ後に発行されるプレビューURL（`https://xxxx.octomblog.pages.dev`）で確認できる。カスタムドメイン `octomblog.com` には自動で反映される。
