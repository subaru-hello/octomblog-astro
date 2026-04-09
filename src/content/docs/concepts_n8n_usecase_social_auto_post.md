---
category: "概念"
order: 244
title: ブログ記事→SNS自動投稿パイプラインを構築する
description: WordPressやNotionにブログ記事を公開した際に、AIが各SNS向け（X/LinkedIn/Facebook）の投稿文を自動生成して予約投稿するコンテンツ配信自動化ワークフロー。
tags: ["n8n", "ユースケース", "SNS自動化", "コンテンツ配信", "X（Twitter）", "LinkedIn", "マーケティング"]
emoji: "📱"
date: "2026-04-09"
source: "https://docs.n8n.io/integrations/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

ブログ記事を公開するたびに各SNS向けの投稿文を個別に書く作業を自動化する。AIが媒体ごとのトーン・文字数・ハッシュタグに合わせた投稿文を生成して自動投稿する。

**解決する課題**: 1記事あたり15〜30分かかっていたSNS展開作業をゼロにし、コンテンツ作成に集中できる環境を作る

**使用するn8nノード:**
- RSS Feed Trigger または Webhook（記事公開検知）
- HTTP Request（記事本文取得）
- OpenAI Chat Model（SNS投稿文生成）
- X（Twitter）/ LinkedIn API（投稿）
- Buffer API（複数SNSへの予約投稿）

## ワークフロー構成

```
[RSS Feed Trigger: ブログのRSSフィード監視]
    ↓
[HTTP Request: 記事本文を取得（スクレイピング）]
    ↓
[OpenAI: 各SNS向けに投稿文を並列生成]
  ├── X（Twitter）向け（140文字 + ハッシュタグ）
  ├── LinkedIn向け（ビジネス調 + 詳細説明）
  └── Facebook向け（親しみやすいトーン）
    ↓
[IF: 平日か？]
  ├── 平日 → [X API / LinkedIn API: 即時投稿]
  └── 休日 → [Buffer API: 翌営業日09:00に予約]
```

## 実装手順

### Step 1: RSS Feed Triggerの設定

```
Feed URL: https://yourblog.com/feed（WordPressのRSSフィード）
Polling Interval: Every 10 minutes
```

新しいエントリーが検出されるとワークフローが起動する。

### Step 2: 記事本文の取得（HTTP Request）

```
Method: GET
URL: {{ $json.link }}
Response Format: HTML (Text)
```

HTMLから本文テキストを抽出するため、Codeノードで不要なタグを除去する:

```javascript
// 簡易的なHTMLタグ除去
const html = $json.data;
const text = html
  .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .substring(0, 3000); // トークン節約

return [{ json: { ...$json, bodyText: text } }];
```

### Step 3: 各SNS向け投稿文を並列生成

**X（Twitter）向け:**
```
System: あなたはSNSマーケターです。ブログ記事を元に、X(Twitter)向けの投稿文を作成してください。
条件:
- 120文字以内（URLを含めると140文字になる）
- 3〜5つの関連ハッシュタグを末尾に追加
- 読み手の興味を引く書き出しで始める
- 絵文字を1〜2個使用

記事タイトル: {{ $json.title }}
本文概要: {{ $json.bodyText }}
```

**LinkedIn向け:**
```
System: ビジネス向けの専門的なトーンで、LinkedInの投稿文を作成してください。
条件:
- 300文字程度
- 記事の主要な学びや洞察を3点で箇条書き
- プロフェッショナルな結びの言葉を追加
- ハッシュタグは3つ以内
```

### Step 4: X（Twitter）への投稿

```
Resource: Tweet
Operation: Create
Text: {{ $json.xPost }}
Media: （アイキャッチ画像がある場合は添付）
```

### Step 5: LinkedInへの投稿

```
Method: POST
URL: https://api.linkedin.com/v2/ugcPosts
Headers:
  Authorization: Bearer {{ $credentials.linkedinToken }}
Body:
{
  "author": "urn:li:person:YOUR_PERSON_ID",
  "lifecycleState": "PUBLISHED",
  "specificContent": {
    "com.linkedin.ugc.ShareContent": {
      "shareCommentary": { "text": "{{ $json.linkedinPost }}" },
      "shareMediaCategory": "ARTICLE",
      "media": [{ "status": "READY", "originalUrl": "{{ $json.link }}" }]
    }
  },
  "visibility": { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" }
}
```

### Step 6: Buffer経由での予約投稿（複数SNS対応）

Buffer APIを使うと複数SNSを一元管理できる。

```
Method: POST
URL: https://api.bufferapp.com/1/updates/create.json
Body:
  text: {{ $json.xPost }}
  profile_ids[]: TwitterアカウントID
  profile_ids[]: FacebookページID
  scheduled_at: {{ 翌営業日09:00のUNIXタイムスタンプ }}
```

## ポイント・注意事項

- X API（Twitter API v2）は無料プランでは月1,500件のPOSTに制限あり
- LinkedIn APIは個人ページへの投稿にはOAuthでログインしたユーザー権限が必要。企業ページはPage APIを使用
- 投稿前にプレビューをSlackで確認する「承認フロー」を挟むと、意図しない内容の公開を防げる

## 関連機能

- [マーケター向けガイド](./concepts_n8n_role_marketing.md)
- [HTTP Request・API連携](./concepts_n8n_http_api.md)
- [AI・LLMエージェント](./concepts_n8n_ai_agents.md)
