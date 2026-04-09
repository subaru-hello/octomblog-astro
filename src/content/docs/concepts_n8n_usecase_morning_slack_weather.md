---
category: "概念"
order: 215
title: 毎朝SlackにAIで天気・ニュースを通知する
description: スケジュールトリガー＋HTTP Request＋LLMで、毎朝指定Slackチャンネルに天気・ニュースサマリーを自動投稿するワークフロー。
tags: ["n8n", "ユースケース", "Slack", "スケジュール", "天気", "LLM", "OpenAI"]
emoji: "🌤️"
date: "2026-04-09"
source: "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

毎朝9:00に自動起動し、天気APIとニュースAPIからデータを取得。LLMで日本語サマリーを生成してSlackに投稿する。

**解決する課題**: 毎朝手動でチェックしていた天気・ニュースを自動化し、チーム全体に共有

**使用するn8nノード:**
- Schedule Trigger（起動）
- HTTP Request × 2（天気API・ニュースAPI）
- OpenAI Chat Model（LLMサマリー生成）
- Slack（メッセージ投稿）

## ワークフロー構成

```
[Schedule Trigger: 毎日09:00]
    ↓
[HTTP Request: 天気API（OpenWeatherMap）]
    ↓
[HTTP Request: ニュースAPI（NewsAPI）]
    ↓
[Merge: 天気+ニュースデータを統合]
    ↓
[OpenAI Chat Model: 日本語サマリー生成]
    ↓
[Slack: #general に投稿]
```

## 実装手順

### Step 1: Schedule Triggerの設定

```
Trigger Times → Add Time
Rule: Every Day
Hour: 9
Minute: 0
```

### Step 2: 天気APIの呼び出し

```
Method: GET
URL: https://api.openweathermap.org/data/2.5/weather
Query Parameters:
  q: Tokyo
  appid: {{ $credentials.openWeatherApiKey }}
  units: metric
  lang: ja
```

### Step 3: ニュースAPIの呼び出し

```
Method: GET
URL: https://newsapi.org/v2/top-headlines
Query Parameters:
  country: jp
  pageSize: 5
  apiKey: {{ $credentials.newsApiKey }}
```

### Step 4: LLMサマリー生成（OpenAI）

```
System Prompt: あなたは朝のアシスタントです。天気とニュースを簡潔にまとめてください。

User Message:
天気: {{ $('Weather').first().json.weather[0].description }}、{{ $('Weather').first().json.main.temp }}℃

ニュース:
{{ $('News').first().json.articles.map(a => a.title).join('\n') }}
```

### Step 5: Slackへの投稿

```
Channel: #general
Message: {{ $json.message.content }}
```

## ポイント・注意事項

- OpenWeatherMap・NewsAPIは無料プランあり。APIキーをn8nのCredentialに登録する
- LLMへのプロンプトにトークン制限があるため、ニュースは5件程度に絞る
- Slackの投稿フォーマットはMarkdownに対応。ボールドや改行を活用する

## 関連機能

- [ワークフローの基本](./concepts_n8n_workflow_basics.md)
- [トリガーの種類](./concepts_n8n_triggers.md)
- [AI・LLMエージェント](./concepts_n8n_ai_agents.md)
