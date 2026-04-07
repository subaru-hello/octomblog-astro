---
category: "概念"
order: 1
title: このサイトのアーキテクチャ
description: Astro + Cloudflare Pages で構築したナレッジベースの設計方針。Functional Core, Imperative Shell を Astro コンポーネント設計に適用した実例
tags: ["アーキテクチャ", "関数型", "設計原則"]
emoji: "🏗️"
date: "2026-04-01"
---

## 概要

本サイトは Astro + Cloudflare Pages で構築したナレッジベース。
設計の中心にあるのは **Functional Core, Imperative Shell** パターンをフロントエンドのコンポーネント構成に適用するという考え方。

## インフラ構成

```
ブラウザ
  │
  ├─ 静的ページ（HTML/JS/CSS）── Cloudflare Pages CDN
  │   └─ ビルド時に全記事を静的生成（prerender: true）
  │
  └─ 閲覧数API（POST /api/views/...）── Cloudflare Worker（SSR）
      └─ Cloudflare KV に read/write
```

| 要素 | 役割 |
|---|---|
| Astro | フレームワーク。ビルド時 Markdown → HTML 変換 |
| Cloudflare Pages | CDN + ホスティング |
| Cloudflare Worker | 動的APIエンドポイント（閲覧数）|
| Cloudflare KV | 閲覧数の永続化ストア |

## ソースコードの構成

```
src/
├── lib/                   ← Functional Core（純粋関数のみ・副作用ゼロ）
│   ├── articles.ts        # toArticleData / toNavItem / sortByDateDesc
│   ├── categories.ts      # getCategoryKey / getCategoryLabel / sortedCategoryKeys
│   └── format.ts          # formatDate / slugToTitle
│
├── pages/                 ← Imperative Shell（I/O のみ）
│   ├── index.astro        # getCollection → lib → 表示
│   ├── [...slug].astro    # getCollection + render → lib → 表示
│   └── api/views/[...slug].ts  # KV の read/write のみ
│
└── components/            ← 純粋な表示層（props → HTML）
    ├── Sidebar.astro      # NavItem[] を受け取ってナビゲーションを描画
    └── TableOfContents.astro  # Heading[] を受け取ってTOCを描画
```

## なぜこの構造か

### Functional Core, Imperative Shell の適用

Astro コンポーネントは「データ取得（I/O）」「変換ロジック」「表示」の3つが混在しやすい。

```
// NG: 変換ロジックが page に直書き
const title = a.data.title ?? a.id.split('/').pop()?.replace(/_/g, ' ') ?? 'Untitled';

// OK: 純粋関数に抽出して page は I/O に専念
import { slugToTitle } from '../lib/format';
const title = a.data.title ?? slugToTitle(a.id);
```

`lib/` の関数はすべて：
- 同じ入力 → 同じ出力（参照透過）
- 外部状態を変更しない（副作用ゼロ）
- 単体テストが `lib/*.test.ts` だけで完結できる構造

### ページは I/O の調停役

`pages/*.astro` のフロントマターは以下のみを行う：

1. `getCollection()` でデータ取得
2. `lib/*` の純粋関数で変換
3. コンポーネントに props として渡す

変換ロジックを page に持たせない理由は、**page は Cloudflare の実行環境に依存している**ため、そこにロジックが入るとテストが困難になるから。

### コンテンツはmdファイルのまま管理

```
reference/concepts/*.md  ← 概念・理論
reference/patterns/*.md  ← 解決策のテンプレート
rules/*.md               ← チームの行動規範
skills/*.md              ← 実行手順
```

frontmatter でメタデータを管理し、Astro の Content Layer（glob loader）でビルド時に読み込む。
CMSを使わず git で管理するため、記事追加は `md` ファイルを追加して `npm run deploy` するだけ。

## デプロイフロー

```bash
npm run build   # Astro → dist/（静的HTML + Cloudflare Worker用JS）
wrangler pages deploy dist  # Cloudflare Pages へアップロード
```

## 関連概念

- → [Functional Core, Imperative Shell](functional_core_imperative_shell.md)
- → [純粋関数](pure_function.md)
- → [型駆動設計](type_driven_design.md)
