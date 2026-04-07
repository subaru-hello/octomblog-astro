// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { visit } from 'unist-util-visit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Docs内の相対 .md リンクを /docs/{id} に書き換える rehype プラグイン
// 元ファイルの相対パス構造（../concepts/X.md など）からカテゴリを推定してIDに変換する
function rehypeFixDocsLinks() {
  const docsDir = path.join(__dirname, 'src/content/docs');
  const docIds = new Set(
    fs.readdirSync(docsDir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace('.md', ''))
  );

  function getCategoryFromFileName(fileName) {
    if (fileName.startsWith('anti-patterns_')) return 'anti-patterns';
    const idx = fileName.indexOf('_');
    return idx > 0 ? fileName.substring(0, idx) : '';
  }

  function resolveDocLink(href, currentCategory) {
    const segments = href.split('/');
    const basename = segments[segments.length - 1].replace('.md', '');

    // パスに含まれるディレクトリ名からカテゴリを決定
    const knownCategories = ['concepts', 'patterns', 'rules', 'skills', 'anti-patterns'];
    let category = currentCategory;
    for (let i = segments.length - 2; i >= 0; i--) {
      if (knownCategories.includes(segments[i])) {
        category = segments[i];
        break;
      }
    }

    const withPrefix = `${category}_${basename}`;
    if (docIds.has(withPrefix)) return `/docs/${withPrefix}`;
    if (docIds.has(basename)) return `/docs/${basename}`;
    return null;
  }

  return (tree, file) => {
    const filePath = file.history?.[0];
    if (!filePath?.includes('/content/docs/')) return;

    const fileName = path.basename(filePath, '.md');
    const currentCategory = getCategoryFromFileName(fileName);

    visit(tree, 'element', (node) => {
      if (node.tagName !== 'a') return;
      const href = node.properties?.href;
      if (typeof href !== 'string' || !href.endsWith('.md')) return;

      const resolved = resolveDocLink(href, currentCategory);
      if (resolved) node.properties.href = resolved;
    });
  };
}

export default defineConfig({
  site: 'https://octomblog.com',
  integrations: [mdx(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
    },
    rehypePlugins: [rehypeFixDocsLinks],
  },
});
