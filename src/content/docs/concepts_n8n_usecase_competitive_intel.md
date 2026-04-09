---
category: "概念"
order: 248
title: 競合情報を自動収集してWeeklyレポートにまとめる
description: 競合他社のブログ・プレスリリース・採用情報・SNSを毎日自動監視し、AIが重要度判定・要約してSlackとNotionに週次競合インテリジェンスレポートとして配信するワークフロー。
tags: ["n8n", "ユースケース", "競合情報", "市場調査", "自動収集", "RSS", "競合分析"]
emoji: "🔭"
date: "2026-04-09"
source: "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

競合他社5社のブログ・採用ページ・GitHub・SNSを毎日自動監視し、新しい動きをAIが分類・要約して週次で競合インテリジェンスレポートを配信する。

**解決する課題**: 競合情報を手動でチェックする週1〜2時間の調査作業を自動化し、重要な動向の見落としをなくす

**使用するn8nノード:**
- Schedule Trigger（毎日・毎週）
- HTTP Request（RSS・スクレイピング）
- OpenAI Chat Model（記事分類・要約）
- Notion（情報ストック）
- Slack（週次レポート配信）
- IF（重要度による分岐通知）

## ワークフロー構成

### ワークフロー1: 毎日の情報収集（バックグラウンド）

```
[Schedule Trigger: 毎日08:00]
    ↓（並列）
[HTTP Request: 競合A社のRSSフィード]    ─┐
[HTTP Request: 競合B社のブログRSS]     ─┤
[HTTP Request: 競合C社のプレスリリース] ─┤→ [OpenAI: 分類・要約]
[HTTP Request: 競合D社のGitHub Releases]─┤
[HTTP Request: 競合A社の採用ページ]    ─┘
    ↓
[IF: 重要度が高い新情報あり]
  └── [Slack: #competitive に即時通知]
    ↓
[Notion: 競合インテリジェンスDBに記録]
```

### ワークフロー2: 週次レポート生成（月曜配信）

```
[Schedule Trigger: 毎週月曜09:00]
    ↓
[Notion: 先週の競合情報を取得]
    ↓
[OpenAI: 週次サマリー生成（業界トレンド分析）]
    ↓
[Slack: #strategy に週次レポート投稿]
```

## 実装手順

### Step 1: RSSフィードの設定

```
Method: GET
URL: https://competitor-a.com/blog/rss.xml
```

RSSレスポンスをCodeノードでパースする:

```javascript
// RSSのXMLをパース（n8n組み込みのxml2jsを利用）
const { parseString } = require('xml2js');
const xml = $json.data;

return new Promise((resolve) => {
  parseString(xml, (err, result) => {
    const items = result?.rss?.channel?.[0]?.item ?? [];
    const parsed = items.map(i => ({
      json: {
        title: i.title?.[0] ?? '',
        link: i.link?.[0] ?? '',
        pubDate: i.pubDate?.[0] ?? '',
        description: i.description?.[0]?.replace(/<[^>]+>/g, '') ?? '',
        source: 'Competitor A Blog'
      }
    }));
    resolve(parsed);
  });
});
```

### Step 2: 採用情報の変化検知

採用ページのエンジニア採用数は「競合の開発投資方向」を示す重要指標。

```javascript
// 前回取得した採用情報と比較して差分を検知
const currentJobs = $json.jobs; // 現在の求人リスト
const previousJobs = $('Previous').first().json.jobs ?? [];

const newJobs = currentJobs.filter(j => !previousJobs.includes(j.title));
const closedJobs = previousJobs.filter(j => !currentJobs.map(c=>c.title).includes(j));

return [{
  json: {
    newJobs,
    closedJobs,
    totalCount: currentJobs.length,
    hasChanges: newJobs.length > 0 || closedJobs.length > 0
  }
}];
```

### Step 3: AIによる重要度分類と要約（OpenAI）

```
System: あなたは競合インテリジェンスアナリストです。
競合の情報を以下のJSONで分類・要約してください:
{
  "importance": "high|medium|low",
  "category": "製品更新|価格変更|採用強化|資金調達|パートナーシップ|マーケティング|その他",
  "summary": "80文字以内の要約",
  "impact": "自社への影響を50文字以内で"
}

高重要度の条件:
- 新製品・機能リリース
- 価格改定
- 大型資金調達・M&A
- 自社の顧客に直接影響する情報

User:
タイトル: {{ $json.title }}
内容: {{ $json.description }}
```

### Step 4: Notionへの記録

```
Database: 競合インテリジェンスDB
Properties:
  タイトル: {{ $json.title }}
  競合名: {{ $json.source }}
  重要度: {{ $json.importance }}
  カテゴリ: {{ $json.category }}
  サマリー: {{ $json.summary }}
  自社への影響: {{ $json.impact }}
  発見日: {{ $now.toISODate() }}
  URL: {{ $json.link }}
```

### Step 5: 週次レポートのSlack配信

```
Channel: #strategy
Text:
📡 *競合週次インテリジェンスレポート（{{ $now.minus({days:7}).toFormat('M/d') }}〜{{ $now.toFormat('M/d') }}）*

*🔴 要注意事項*
{{ 重要度highの情報をリスト表示 }}

*🟡 注目動向*
{{ 重要度mediumの情報をリスト表示 }}

*AI総評:*
{{ OpenAIによる業界トレンド分析 }}
```

## 監視対象の拡張例

| 情報源 | 取得方法 | 着目ポイント |
|---|---|---|
| GitHub Releases | GitHub API | 製品のリリース速度・技術スタック |
| LinkedIn Followers | スクレイピング | ブランド成長率 |
| App Store レビュー | iTunes API | ユーザー満足度の変化 |
| Google Ads（競合） | SimilarWeb API | 広告投資額・キーワード |
| Indeed 採用数 | Indeed API | 採用強化エリア・職種 |

## ポイント・注意事項

- 競合サイトのスクレイピングはrobots.txtを遵守する。原則RSSフィードやAPIを優先する
- 収集した競合情報は社外秘として扱い、アクセス権限を適切に設定する
- AIの重要度判定は「False Positive（過検知）」がある。週次レポートを人間がレビューする文化を維持する

## 関連機能

- [経営者・管理職向けガイド](./concepts_n8n_role_executive.md)
- [HTTP Request・API連携](./concepts_n8n_http_api.md)
- [AI・LLMエージェント](./concepts_n8n_ai_agents.md)
