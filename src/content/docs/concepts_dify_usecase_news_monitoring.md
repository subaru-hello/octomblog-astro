---
category: "概念"
order: 116
title: 競合情報・ニュースモニタリング（Dify実践）
description: 競合他社・業界トレンドをWeb検索で毎朝自動収集してSlackにサマリーを配信するDify Workflowの設計例。
tags: ["Dify", "競合分析", "ニュースモニタリング", "マーケティング", "業務自動化", "ユースケース"]
emoji: "📡"
date: "2026-04-09"
source: "Dify公式ドキュメント / Dify Blog"
series:
  - Difyユースケース
---

## シナリオ概要

**課題**: 競合他社の動向・業界ニュースを毎日確認するのが大変。担当者が毎朝1〜2時間をニュースチェックに費やしているが、抜け漏れも多い。

**解決策**: Dify Workflow を毎朝7時に自動実行。Google Search で競合・業界情報を収集・分析し、Slack に要点をまとめて配信する。

```
毎朝 Slack に届くメッセージ:

📊 【2026-04-09 競合情報レポート】

🔴 要注意:
  - Competitor A が新機能「〇〇」をリリース（昨日）
  - Competitor B がシリーズCで50億円を調達

📌 業界トレンド:
  - 生成AI × ERPの統合事例が増加
  - セキュリティ規制強化に関する政府発表

💡 自社への示唆:
  - 機能〇〇への投資加速が必要
  - 競合Bの資金調達により価格競争が激化する可能性

詳細レポート → [Notion リンク]
```

---

## 使用する Dify 機能

| 機能 | 役割 |
|---|---|
| [ツール・プラグイン](concepts_dify_tools_plugins.md) | Google Search / Web Scraper ツール |
| [ノード一覧](concepts_dify_nodes.md) | Iteration / HTTP Request / LLM ノード |
| [変数システム](concepts_dify_variables.md) | 検索結果の蓄積と受け渡し |
| [API・デプロイ](concepts_dify_api_deployment.md) | スケジュール実行 |

---

## ワークフロー設計

```
Workflow 構成（毎朝7時に自動実行）:

[Start]
  │ {{monitoring_targets}}: 監視対象リスト（競合・キーワード）
  │ {{date}}: 実行日（システム変数）
  ▼
[Iteration: 各ターゲットを調査]
  │ items: monitoring_targets
  │ parallel_num: 3
  │
  │  ┌──────────────────────────────────────┐
  │  │ 各ターゲットに対して:                  │
  │  │                                        │
  │  │ [HTTP Request: SerpAPI]                │
  │  │   q: "{{item}} site:news 24時間以内"   │
  │  │   tbm=nws（ニュース検索）              │
  │  │   → 検索結果リスト                     │
  │  │                                        │
  │  │ [LLM: 重要度フィルタリング]            │
  │  │   "関係のないニュースを除外して        │
  │  │    重要なものだけ残す"                 │
  │  │   → {{filtered_news}}                 │
  │  └──────────────────────────────────────┘
  │
  │ {{iteration.all_news}}: 全ターゲットのニュースリスト
  ▼
[LLM: 統合分析・重要度ランキング]
  │ 全ニュースを俯瞰して
  │ 「今日最も重要な情報トップ5」
  │ 「自社への示唆」を生成
  ▼
[Template: Slack 投稿フォーマット]
  ▼
[HTTP Request: Slack Webhook 投稿]
  ▼
[HTTP Request: Notion に詳細ページ保存]
  ▼
[End]
```

---

## 監視ターゲットの設定

```yaml
monitoring_targets の例（JSON配列として入力）:

[
  {
    "name": "Competitor A",
    "keywords": ["CompetitorA", "CompanyA", "CompanyA新機能"],
    "category": "直接競合"
  },
  {
    "name": "業界トレンド",
    "keywords": ["SaaS市場", "生成AI活用", "DX投資"],
    "category": "市場動向"
  },
  {
    "name": "規制・政策",
    "keywords": ["AI規制", "個人情報保護法改正", "経済産業省DX"],
    "category": "規制情報"
  }
]

→ Start ノードの入力変数に貼り付けるだけでOK
→ 追加・変更も設定画面から簡単にできる
```

---

## SerpAPI の設定

```
Google Search ツール設定:

Tool: Google Search（ビルトインツール）
またはカスタムツール（SerpAPI直接呼び出し）

SerpAPI クエリパラメータ:
  api_key: {{env.SERPAPI_KEY}}
  q: "{{target.name}} {{date}}最新情報"
  tbm: nws          ← ニュース検索
  tbs: qdr:d        ← 過去24時間のみ
  num: 10           ← 上位10件
  hl: ja            ← 日本語
  gl: jp            ← 日本の結果

出力で使う変数:
  news_results[].title     : 記事タイトル
  news_results[].link      : URL
  news_results[].snippet   : 抜粋
  news_results[].date      : 掲載日時
```

---

## 重要度フィルタリングプロンプト

```
System:
あなたは競合分析の専門家です。
以下のニュースリストから「{{target.name}}」に関して
自社ビジネスに影響する重要な情報のみを抽出してください。

フィルタリング基準:
  含める:
    - 製品/機能の新リリース・アップデート
    - 資金調達・M&A・IPO情報
    - 人事（経営層の異動）
    - 価格変更
    - 重大な障害・スキャンダル
  
  除外する:
    - 関係のない一般記事
    - 重複情報
    - 古い記事の再掲載

出力形式（JSON）:
{
  "items": [
    {
      "title": "記事タイトル",
      "url": "URL",
      "summary": "50文字以内の要約",
      "importance": "high/medium/low",
      "category": "製品/資金/人事/価格/障害/その他"
    }
  ]
}

User:
ニュースリスト:
{{search_results}}
```

---

## Slack 投稿フォーマット

```jinja2
{# Template ノードで整形 #}

*📊 【{{ date }} 競合情報レポート】*

{% set high_items = all_news | selectattr('importance', 'eq', 'high') | list %}
{% if high_items %}
*🔴 要注意（重要度: 高）*
{% for item in high_items %}
• {{ item.title }}
  {{ item.summary }} → <{{ item.url }}|詳細>
{% endfor %}

{% endif %}

*📌 その他の動向*
{% for item in all_news | selectattr('importance', 'ne', 'high') | list | slice(5) %}
• [{{ item.category }}] {{ item.summary }}
{% endfor %}

*💡 今日の示唆*
{{ insights }}

詳細 → <{{ notion_url }}|Notionレポート>
```

---

## 定期実行の設定

```
Dify のスケジュール実行（Cronトリガー）:

外部スケジューラから Dify Workflow API を呼び出す:
  
  # GitHub Actions の例（毎朝7時 JST）
  on:
    schedule:
      - cron: '0 22 * * *'  # UTC 22時 = JST 7時

  steps:
    - name: Run Dify monitoring workflow
      run: |
        curl -X POST "https://api.dify.ai/v1/workflows/run" \
          -H "Authorization: Bearer ${{ secrets.DIFY_API_KEY }}" \
          -H "Content-Type: application/json" \
          -d '{"inputs": {"date": "'"$(date +%Y-%m-%d)"'"}, "user": "scheduler"}'

または n8n / Zapier のスケジュールトリガーを使う
```

---

## 応用パターン

### 自社ブランドモニタリング

```
監視キーワード:
  - 自社名（誤字含む）
  - 製品名・サービス名
  - 代表者名
  - 自社の批判・クレーム

アラート設定:
  感情分析で「ネガティブ」かつ「重要度高」の場合
  → 即座に広報・マーケチームへ通知
```

### 株式・財務情報モニタリング

```
上場企業の監視:
  - 決算発表・業績修正
  - アナリストレポート
  - インサイダー取引情報

ツール追加:
  - Yahoo Finance API
  - Bloomberg RSS フィード
```

---

## 参考：他のユースケース

- [ディープリサーチワークフロー](concepts_dify_usecase_deep_research.md) — より深い調査が必要な場合
- [マルチエージェントオーケストレーション](concepts_dify_usecase_multi_agent.md) — 複数エージェントによる並列調査
