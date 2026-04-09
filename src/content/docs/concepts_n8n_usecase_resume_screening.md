---
category: "概念"
order: 242
title: AIで履歴書を自動スクリーニング・スコアリングする
description: Gmail受信の応募書類PDFをOpenAIが解析し、採用要件との適合度を0〜100でスコアリング。書類通過者は自動で面接調整フロー、不通過者には自動不合格通知を送るワークフロー。
tags: ["n8n", "ユースケース", "採用自動化", "履歴書スクリーニング", "AI", "HR", "OpenAI"]
emoji: "📋"
date: "2026-04-09"
source: "https://n8n.io/workflows/6609-ai-powered-recruitment-system-for-resume-screening-and-automated-outreach-with-gpt-4/"
series:
  - n8nワークフロー自動化
---

## ユースケース概要

採用担当者が毎回手動で確認していた履歴書選考をAIで自動化する。応募メール受信→PDF解析→スコアリング→合否判定→通知まで完全自動化。

**解決する課題**: 月50〜100件の応募書類を1枚ずつ開いて確認する作業（1件10分 = 最大16時間/月）を削減し、採用担当者が面接・候補者体験の改善に集中できるようにする

**使用するn8nノード:**
- Gmail Trigger（応募メール受信）
- Code（PDF添付ファイルのテキスト抽出）
- OpenAI Chat Model（スコアリング）
- IF（合否判定）
- Airtable（応募者管理DB）
- Gmail（自動通知送信）
- Slack（採用担当への通知）

## ワークフロー構成

```
[Gmail Trigger: jobs@yourcompany.com の新着メール]
    ↓
[Code: 添付PDFのテキストを抽出]
    ↓
[OpenAI: 採用要件との適合度をスコアリング（JSON出力）]
    ↓
[Airtable: 応募者情報・スコアを記録]
    ↓
[IF: score >= 70]
  ├── 通過 → [Slack: 採用担当に「書類通過候補者」通知]
  │            [Gmail: 候補者に「書類選考通過」メール]
  └── 不通過 → [Wait: 2日後（すぐ返信しない配慮）]
                    [Gmail: 丁寧な不合格通知メール]
```

## 実装手順

### Step 1: Gmail Triggerの設定

```
Polling: Every 5 Minutes
Filter: to:jobs@yourcompany.com has:attachment
```

### Step 2: PDF添付ファイルのテキスト抽出（Codeノード）

```javascript
// n8nのバイナリデータからPDFテキストを取得
// ※ テキストPDFの場合。画像スキャンPDFはOpenAI Vision APIを使用
const binaryKey = Object.keys($binary)[0];
const binaryData = $binary[binaryKey];

// base64デコードしてバッファに変換
const pdfBuffer = Buffer.from(binaryData.data, 'base64');

// pdfkitではなくpdf-parseを使用（要許可設定）
const pdf = require('pdf-parse');
const pdfData = await pdf(pdfBuffer);

return [{
  json: {
    ...$json,
    resumeText: pdfData.text.substring(0, 4000), // トークン上限に配慮
    pages: pdfData.numpages
  }
}];
```

### Step 3: OpenAIでスコアリング

```
Model: gpt-4o-mini（コスト効率重視）
System Prompt:
あなたは採用AIアシスタントです。
以下の採用要件と履歴書を比較し、JSONのみで回答してください。

採用要件:
- 職種: バックエンドエンジニア
- 必須: TypeScript 3年以上、RDB設計経験
- 歓迎: AWS、Docker、チームリード経験
- NG: 学歴不問だが具体的な実務経験がない

{
  "score": 0-100の整数,
  "strengths": ["強みのリスト（3点まで）"],
  "concerns": ["懸念点のリスト（3点まで）"],
  "recommendation": "pass|hold|reject",
  "reason": "判断理由を50文字以内で"
}

User Message:
履歴書全文:
{{ $json.resumeText }}
```

### Step 4: Airtableへの記録

```
Table: 応募者管理
Fields:
  氏名: {{ $json.applicantName }}（Gmailの差出人名）
  メール: {{ $json.from }}
  スコア: {{ $json.score }}
  強み: {{ $json.strengths.join(', ') }}
  懸念点: {{ $json.concerns.join(', ') }}
  判定: {{ $json.recommendation }}
  応募日: {{ $now.toISO() }}
```

### Step 5: 採用担当へのSlack通知（書類通過時）

```
Channel: #hiring-team
Message:
📄 *新規書類通過候補者*

スコア: {{ $json.score }}/100（{{ $json.recommendation }}）
氏名: {{ $json.from }}
強み: {{ $json.strengths.join(' / ') }}
懸念点: {{ $json.concerns.join(' / ') }}
判断理由: {{ $json.reason }}

Airtable: {{ $('Airtable').first().json.url }}
```

## ポイント・注意事項

- AIのスコアリングはあくまで「参考指標」。最終判断は人間が行う運用が望ましい
- スコア70という閾値は職種・採用フェーズによって調整する。倍率が高い場合は80に上げる
- 不合格通知は即時送信を避け、2日後に送ることで「すぐに弾かれた」という印象を緩和する
- 個人情報（履歴書データ）をOpenAIに送信するため、プライバシーポリシーと応募規約への記載が必要

## 関連機能

- [AI・LLMエージェント](./concepts_n8n_ai_agents.md)
- [人事担当向けガイド](./concepts_n8n_role_hr.md)
- [新入社員オンボーディング](./concepts_n8n_usecase_employee_onboarding.md)
