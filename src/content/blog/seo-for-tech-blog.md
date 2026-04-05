---
title: "技術ブログのSEOを強化するためにやること"
description: "title・description・OGP・JSON-LD・Core Web Vitalsまで、技術ブログのSEOに必要な要素を体系的に整理する。Astroでの実装例も添えて。"
date: 2025-04-14T00:00:00+09:00
author: subaru
authorEmoji: 🐙
tags:
- SEO
- Astro
- フロントエンド
categories:
- engineering
image: images/feature2/seo-mc.jpg
---

## なぜ技術ブログにSEOが必要か

「書いたら誰かが読んでくれる」時代は終わった。

技術記事は書いた瞬間ではなく、検索やSNSで発見された瞬間から読まれ始める。Zennやはてなのような大型プラットフォームはドメインパワーで検索上位に入れるが、自前ブログはそうはいかない。コンテンツの質と同時に、技術的なSEO基盤が必要になる。

SEOは大きく3つのレイヤーに分かれる。

```
1. クロール・インデックス      Googleにページを認識させる
2. メタデータ品質             検索結果・SNSでの表示品質
3. コンテンツ・パフォーマンス   ランキングと直帰率に影響
```

---

## 1. 基礎：title / description / canonical

### title

検索結果のクリック率（CTR）に最も直結する要素。

```html
<title>記事タイトル | サイト名</title>
```

- **30〜60文字**が推奨（それ以上は検索結果で切れる）
- 記事の主題を冒頭に置く
- 全ページで一意であること

### description

検索結果のスニペット（説明文）に使われる。ランキングへの直接影響はないが、CTRに影響する。

```html
<meta name="description" content="120文字程度の要約" />
```

- **70〜120文字**が目安
- 記事を読むメリットが伝わる文にする
- 各ページで一意であること

### canonical

同一コンテンツが複数URLに存在する場合（例：`?page=1` など）、正規URLを明示する。

```html
<link rel="canonical" href="https://example.com/blog/post-slug/" />
```

自前ブログでは必須というわけではないが、設定しておくと安全。

---

## 2. OGP・Twitter Card：SNSシェアの品質

OGP（Open Graph Protocol）はSNSでシェアされたときのサムネイル・タイトル・説明文を制御する。

```html
<!-- 基本OGP -->
<meta property="og:type" content="article" />
<meta property="og:url" content="https://example.com/blog/post-slug/" />
<meta property="og:title" content="記事タイトル | サイト名" />
<meta property="og:description" content="記事の説明" />
<meta property="og:image" content="https://example.com/ogp-image.jpg" />
<meta property="og:locale" content="ja_JP" />

<!-- 記事専用 -->
<meta property="article:published_time" content="2026-04-05T00:00:00+09:00" />
```

**`og:type` は記事ページでは `"article"` にすること。** デフォルトの `"website"` のままだと、FacebookやLINEで記事として正しく認識されない場合がある。

Twitter（現X）は独自のカードメタを持つ：

```html
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="記事タイトル | サイト名" />
<meta name="twitter:description" content="記事の説明" />
<meta name="twitter:image" content="https://example.com/ogp-image.jpg" />
```

`summary_large_image` にすると大きい画像カードで表示される。技術記事はこちらの方が目立つ。

---

## 3. JSON-LD：構造化データでリッチリザルトを狙う

最も効果が高く、最も見落とされがちな要素。

JSON-LDはGoogleに「このページが何であるか」を機械的に伝えるデータ形式だ。正しく実装すると、検索結果に**リッチリザルト**（記事カード、パンくずリスト等）として表示される可能性が生まれる。

技術ブログに最適なのは `BlogPosting` スキーマ：

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "記事タイトル",
  "description": "記事の説明",
  "datePublished": "2026-04-05T00:00:00+09:00",
  "author": {
    "@type": "Person",
    "name": "著者名",
    "url": "https://example.com"
  },
  "image": "https://example.com/ogp-image.jpg",
  "url": "https://example.com/blog/post-slug/",
  "keywords": ["SEO", "Astro", "フロントエンド"]
}
</script>
```

実装後は [Google Rich Results Test](https://search.google.com/test/rich-results) で検出されることを確認する。

### Astroでの実装例

```astro
---
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: title,
  description: description,
  datePublished: date.toISOString(),
  author: { '@type': 'Person', name: author },
  image: ogImage.toString(),
  url: canonicalURL.toString(),
  keywords: tags,
};
---

<script type="application/ld+json" set:html={JSON.stringify(jsonLd)} />
```

`set:html` を使うことでAstroのエスケープを回避し、JSONをそのまま出力できる。

---

## 4. サイトマップと robots.txt

### サイトマップ

Googleに「クロールすべきページ一覧」を渡すファイル。Astroなら `@astrojs/sitemap` で自動生成できる：

```js
// astro.config.mjs
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://example.com',
  integrations: [sitemap()],
});
```

生成された `sitemap-index.xml` を [Google Search Console](https://search.google.com/search-console) に登録すると、インデックスが速くなる。

### robots.txt

クローラーへのアクセス制御ファイル。基本的には全許可でよい：

```
User-agent: *
Allow: /
Sitemap: https://example.com/sitemap-index.xml
```

`public/robots.txt` に置くだけで有効になる。

---

## 5. Core Web Vitals：パフォーマンスもランキング要因

Googleは2021年から Core Web Vitals をランキング要因に組み込んでいる。

| 指標 | 意味 | 目標値 |
|------|------|--------|
| **LCP** (Largest Contentful Paint) | 最大要素の表示完了時間 | 2.5秒以下 |
| **CLS** (Cumulative Layout Shift) | レイアウトのズレ | 0.1以下 |
| **INP** (Interaction to Next Paint) | 操作への応答速度 | 200ms以下 |

技術ブログで効きやすい改善：

- 画像に `width` / `height` を明示する（CLSの防止）
- アイキャッチ画像に `loading="eager"` / `fetchpriority="high"` を付与（LCP改善）
- フォントは `display: swap` を使う
- 不要なJavaScriptを除去する

Astroは静的生成がデフォルトなのでJS量が少なく、初期スコアは高めだ。

---

## 優先順位のまとめ

すべてを一度にやる必要はない。効果と実装コストで優先度をつけると：

| 優先度 | 施策 | 難易度 |
|--------|------|--------|
| 🔴 高 | title / description の最適化 | 低 |
| 🔴 高 | OGP / Twitter Card の完備 | 低 |
| 🔴 高 | JSON-LD 構造化データ | 中 |
| 🟡 中 | サイトマップ登録 (Search Console) | 低 |
| 🟡 中 | Core Web Vitals 改善 | 中〜高 |
| 🟢 低 | robots.txt の整備 | 低 |

最初の3つを実装するだけで、大多数の自前ブログよりSEO的に優位に立てる。

---

## 参考

- [Google Search Central - 構造化データ入門](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)
- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [Web Vitals](https://web.dev/articles/vitals)
- [Open Graph Protocol](https://ogp.me/)
