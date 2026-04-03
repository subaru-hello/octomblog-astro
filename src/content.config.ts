import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date(),
    author: z.string().optional().default('subaru'),
    authorEmoji: z.string().optional(),
    tags: z.array(z.string()).optional().default([]),
    categories: z.array(z.string()).optional().default([]),
    image: z.string().optional(),
    draft: z.boolean().optional().default(false),
    series: z.array(z.string()).optional().default([]),
  }),
});

const docs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    category: z.enum(['概念', 'フレームワーク', 'Tips']),
    tags: z.array(z.string()).optional().default([]),
    date: z.coerce.date(),
    source: z.string().optional(),
    emoji: z.string().optional().default('📄'),
    order: z.number().optional().default(0),
    lang: z.enum(['ja', 'en']).optional().default('ja'),
  }),
});

export const collections = { blog, docs };
