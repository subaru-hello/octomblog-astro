# octomblog

Astro + Cloudflare Pages で動くブログ・ナレッジベース。

## ローカル開発

```bash
pnpm install
pnpm dev          # http://localhost:4321
```

---

## 記事作成 → デプロイの流れ

### 1. ブログ記事を書く

`src/content/blog/` に Markdown ファイルを作成する。

```bash
touch src/content/blog/my-new-post.md
```

**フロントマター（必須・任意）**

```yaml
---
title: "記事タイトル"
description: "記事の要約（OGP・検索にも使われる）"
date: 2026-04-03
tags: ["AWS", "Go"]           # 任意
categories: ["TECH"]          # TECH | IDEA
image: images/blog-covers/my-new-post.png   # 任意（public/ 以下のパス）
draft: false                  # true にするとビルドから除外
---
```

**カバー画像を追加する場合**

```bash
cp ~/Downloads/cover.png public/images/blog-covers/my-new-post.png
```

---

### 2. Docsを書く

`src/content/docs/` に Markdown ファイルを作成する。

```bash
touch src/content/docs/concepts_my_topic.md
```

**フロントマター**

```yaml
---
title: "概念名"
description: "一行説明"
category: "概念"        # 概念 | フレームワーク | Tips
tags: ["設計原則"]
date: 2026-04-03
emoji: "✨"             # サイドバー・カードに表示
order: 10              # 同カテゴリ内の表示順（小さいほど上）
source: "書籍名 第3章" # 任意
lang: "ja"             # ja | en（省略時 ja）
---
```

---

### 3. ローカルで確認

```bash
pnpm dev
# http://localhost:4321 でブラウザ確認
```

---

### 4. ビルド

```bash
pnpm build
# dist/ が生成され、Pagefind の検索インデックスも自動生成される
```

---

### 5. Cloudflare Pages にデプロイ

```bash
npx wrangler pages deploy dist --project-name octomblog --branch main --commit-dirty=true
```

デプロイ完了後に表示される URL（例: `https://xxxx.octomblog.pages.dev`）で確認できる。
本番 `octomblog.com` はカスタムドメインとして設定済みなので自動的に反映される。

---

## ディレクトリ構成

```
src/
├── content/
│   ├── blog/          # ブログ記事 (*.md)
│   └── docs/          # ナレッジベース (*.md)
├── components/
│   ├── blog/          # ViewCounter, SpeechButton, TOC, TagBadge
│   ├── docs/          # DocsSidebar
│   ├── home/          # ProfileHeader, ArticleCard
│   └── common/        # NavBar, ThemeToggle
├── layouts/
│   ├── BaseLayout.astro
│   ├── BlogPostLayout.astro
│   └── DocsLayout.astro
├── pages/
│   ├── index.astro
│   ├── blog/
│   ├── docs/
│   └── search.astro
└── styles/
    └── global.css

public/
├── images/
│   ├── blog-covers/   # 記事カバー画像
│   └── whoami/        # プロフィール画像
└── favicon/

functions/
└── api/views/[slug].ts  # Cloudflare Pages Function（閲覧数API）
```

---

## Cloudflare 設定

### KV Namespace（閲覧数）

```bash
# 新規作成（初回のみ）
npx wrangler kv namespace create VIEWS

# wrangler.toml の id を発行されたIDに書き換える
```

### カスタムドメイン

Cloudflare Dashboard → Pages → `octomblog` → Custom domains → `octomblog.com`

---

## コマンド一覧

| コマンド | 内容 |
|---------|------|
| `pnpm dev` | ローカル開発サーバー起動 |
| `pnpm build` | 本番ビルド + Pagefind インデックス生成 |
| `pnpm preview` | ビルド結果をローカルでプレビュー |
| `npx wrangler pages deploy dist ...` | Cloudflare Pages にデプロイ |
