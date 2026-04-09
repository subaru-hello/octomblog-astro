---
category: "概念"
order: 200
title: AIでメール内容を自動分類・ルーティングする
description: Gmail受信メールをLLMで自動分類（サポート/営業/スパム/請求）し、カテゴリに応じてラベル付与・転送・Notionチケット作成・無視を自動で行うワークフロー。
tags: ["n8n", "ユースケース", "メール分類", "LLM", "Gmail", "自動化", "ルーティング"]
emoji: "📬"
date: "2026-04-09"
source: "https://docs.n8n.io/advanced-ai/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

info@yourcompany.comへの受信メールをLLMで5カテゴリに自動分類し、それぞれ適切なアクション（ラベル付与・担当者転送・チケット作成）を自動実行する。

**解決する課題**: 複数部門に混在するメールを手動で振り分ける作業をなくし、全メールが適切な担当者に自動でルーティングされる

**使用するn8nノード:**
- Gmail Trigger（受信メール検知）
- OpenAI Chat Model（分類）
- Switch（カテゴリ別分岐）
- Gmail（ラベル付与・転送）
- Notion（チケット作成）

## ワークフロー構成

```
[Gmail Trigger: info@ の新着メール]
    ↓
[OpenAI: メールを5カテゴリに分類]
    ↓
[Switch: category]
  ├── "support"  → [Notion: サポートチケット作成]
  │                   [Gmail: "サポート"ラベル付与]
  ├── "sales"    → [Gmail: sales@に転送]
  │                   [HubSpot: リード登録]
  ├── "billing"  → [Gmail: billing@に転送]
  ├── "spam"     → [Gmail: スパムラベル付与 + アーカイブ]
  └── "other"    → [Gmail: "要確認"ラベル付与]
```

## 実装手順

### Step 1: Gmail Triggerの設定

```
Polling: Every 5 Minutes
```

### Step 2: AI分類（OpenAI）

```
Model: gpt-4o-mini（コスト効率重視）
System Prompt:
以下のメールを分類し、JSONのみで回答してください。他の文字は不要です。
{
  "category": "support|sales|billing|spam|other",
  "confidence": 0-100の整数,
  "summary": "20文字以内の要約",
  "urgency": "high|medium|low"
}

分類基準:
- support: 製品の使い方、バグ報告、技術的な質問
- sales: 導入検討、価格問い合わせ、デモ依頼
- billing: 請求書、支払い、プラン変更
- spam: 広告、フィッシング、不審なメール
- other: 上記に当てはまらないもの

User Message:
件名: {{ $json.subject }}
本文: {{ $json.snippet }}
送信者: {{ $json.from }}
```

### Step 3: JSONレスポンスのパース（Codeノード）

```javascript
// AIの回答がJSONであることを前提にパース
const aiResponse = $json.message.content;
let parsed;
try {
  parsed = JSON.parse(aiResponse);
} catch (e) {
  // パース失敗時はotherカテゴリに
  parsed = { category: 'other', confidence: 0, summary: 'パースエラー', urgency: 'low' };
}

return [{
  json: {
    ...$json,
    category: parsed.category,
    confidence: parsed.confidence,
    summary: parsed.summary,
    urgency: parsed.urgency
  }
}];
```

### Step 4: Switchノードで分岐

```
Mode: Rules Based
Rule 1: {{ $json.category }} equals "support"
Rule 2: {{ $json.category }} equals "sales"
Rule 3: {{ $json.category }} equals "billing"
Rule 4: {{ $json.category }} equals "spam"
Fallback: other
```

### Step 5: サポートカテゴリの処理例

```
Gmail: Add Label
Label: サポート対応中

Notion: Database Item → Create
タイトル: {{ $json.summary }}
カテゴリ: サポート
緊急度: {{ $json.urgency }}
送信者: {{ $('Gmail Trigger').first().json.from }}
メールID: {{ $('Gmail Trigger').first().json.id }}
```

## ポイント・注意事項

- 分類精度を上げるにはFew-shot（具体例）をプロンプトに含める。「こういうメールはsales」の例を5〜10件追加する
- 信頼度（confidence）が60%未満の場合は `other` として人間が確認するフォールバックを入れる
- gpt-4o-miniは安価（gpt-4oの約1/15のコスト）で分類タスクには十分な精度がある

## 関連機能

- [AI・LLMエージェント](./concepts_n8n_ai_agents.md)
- [主要インテグレーション](./concepts_n8n_integrations.md)
- [ロジック制御](./concepts_n8n_logic_flow.md)
