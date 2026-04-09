---
category: "概念"
order: 117
title: 営業提案書自動生成（Dify実践）
description: 顧客情報・業界・課題を入力するだけで、過去の成功事例を参照したパーソナライズ提案書を生成するDify実践例。営業チーム向け。
tags: ["Dify", "営業", "提案書", "セールス", "業務自動化", "ユースケース"]
emoji: "📋"
date: "2026-04-09"
source: "Dify公式ドキュメント / Dify Blog: Sales Enablement"
series:
  - Difyユースケース
---

## シナリオ概要

**課題**: 営業担当者が提案書を1件作るのに2〜3時間かかる。会社情報の調査・競合比較・事例選定・文章作成のすべてが手作業。その間に他の商談機会を逃している。

**解決策**: 顧客の基本情報（会社名・業界・課題）を入れると、過去の成功事例を参照しながらパーソナライズされた提案書を10分で生成する。

```
営業担当者の入力:
  会社名: 株式会社アルファ工業
  業界: 製造業（自動車部品）
  従業員数: 800名
  課題: 品質管理の工数削減・データ活用
  予算感: 月額50〜100万円
  決裁者: 情報システム部長

↓ 約3分

生成される提案書:
  【エグゼクティブサマリー】
  アルファ工業様の品質管理業務における課題...

  【業界での課題】
  製造業では品質データの分析に月XX時間...

  【提案内容・ROI試算】
  弊社ソリューション導入により...

  【類似事例】
  同規模の製造業B社では導入後3ヶ月で...

  【価格・プラン】
  ...
```

---

## 使用する Dify 機能

| 機能 | 役割 |
|---|---|
| [ナレッジベース・RAG](concepts_dify_knowledge_rag.md) | 過去事例・製品情報の検索 |
| [ノード一覧](concepts_dify_nodes.md) | 並列LLM / HTTP Request / Code ノード |
| [ツール・プラグイン](concepts_dify_tools_plugins.md) | Web検索（顧客情報収集） |
| [変数システム](concepts_dify_variables.md) | 顧客情報変数の受け渡し |

---

## ナレッジベースの設計

提案書の質はナレッジベースの質で決まる。

```
登録すべき文書:

1. 成功事例集（重要度: 最高）
   - 業界別・規模別の事例
   - 具体的な数値効果（ROI・工数削減率等）
   - 導入前後の比較
   - チャンキング: Q&A形式（「製造業向け事例は？」でヒットするよう）

2. 製品・サービス仕様書
   - 機能一覧・比較表
   - 価格体系
   - 競合との差別化ポイント

3. 業界別課題集
   - 業界固有の課題・KPI
   - 規制・法令への対応事例
   - 業界用語集（正確な業界言語で書くため）

4. 競合比較資料
   - 競合A・B・Cとの比較表
   - 競合の弱点・自社の強み
```

---

## ワークフロー設計

```
Workflow 構成:

[Start]
  │ {{company_name}}: 会社名
  │ {{industry}}    : 業界
  │ {{size}}        : 従業員数
  │ {{challenges}}  : 課題（自由記述）
  │ {{budget}}      : 予算感
  │ {{decision_maker}}: 決裁者の役職
  ▼
[並列実行]
  ├── [HTTP Request: 顧客企業をWeb検索]
  │     SerpAPI で企業情報・最新ニュースを取得
  │     → {{company_info}}
  │
  └── [Knowledge Retrieval: 類似事例検索]
        クエリ: "{{industry}} {{size}}名規模 {{challenges}}"
        → {{case_studies}}
  ▼
[LLM: 顧客インサイト分析]
  │ 顧客情報 + 業界知識から
  │ 「この顧客が最も気にするポイント」を分析
  │ → {{key_insights}}
  ▼
[LLM: 提案書本文生成]
  │ 入力: 全変数 + key_insights + case_studies
  │ → {{proposal_text}}（Markdown形式）
  ▼
[Code: ROI試算]
  │ 従業員数・課題規模から概算ROIを計算
  │ → {{roi_estimate}}
  ▼
[Template: 最終提案書組み立て]
  ▼
[End]
  出力: 提案書（Markdown / PDF変換用テキスト）
```

---

## 提案書生成プロンプト

```
System:
あなたはトップセールスコンサルタントです。
以下の情報を基に、{{decision_maker}}職の方を説得する提案書を作成してください。

提案書の構成（Markdown形式）:
## エグゼクティブサマリー（200字：経営者が読む最初の要約）
## 現状の課題分析（業界固有の言語で）
## 提案内容と解決アプローチ
## 類似企業での実績・事例（具体的な数値必須）
## 期待されるROI・効果試算
## 導入スケジュール（概要）
## 価格・プラン
## 次のアクション（CTA）

重要な方針:
- {{decision_maker}}が気にする指標に焦点を当てる
  （CFOなら ROI・コスト削減、CTO なら技術的優位性）
- 数値・事例は必ず類似事例から引用する（「〜と推定されます」でなく「〜社では〜%削減」）
- 競合と比較する場合は客観的に
- 「御社様」「〜していただき」等の過度な敬語は避け、プロフェッショナルなトーンで

User:
【顧客情報】
会社名: {{company_name}}
業界: {{industry}}
規模: {{size}}名
課題: {{challenges}}
予算: {{budget}}

【顧客企業の最新情報】
{{company_info}}

【類似事例】
{{case_studies}}

【顧客インサイト】
{{key_insights}}
```

---

## ROI試算の自動化

```python
# Code ノード: ROI 試算
def main(inputs: dict) -> dict:
    size = int(inputs.get("size", 100))
    challenges = inputs.get("challenges", "")
    
    # 課題タイプから削減工数を概算
    time_savings_per_person_hours_per_month = 0
    
    if "データ入力" in challenges or "手作業" in challenges:
        time_savings_per_person_hours_per_month = 10
    if "レポート" in challenges or "集計" in challenges:
        time_savings_per_person_hours_per_month += 8
    if "品質管理" in challenges:
        time_savings_per_person_hours_per_month += 5
    
    # 影響を受ける社員数の推定（課題に関わる部署）
    affected_employees = max(size * 0.1, 5)  # 最低5人
    
    # コスト試算（一人当たり時間単価を3,000円と仮定）
    hourly_rate = 3000
    monthly_savings = affected_employees * time_savings_per_person_hours_per_month * hourly_rate
    annual_savings = monthly_savings * 12
    
    return {
        "affected_employees": int(affected_employees),
        "monthly_time_savings_hours": int(affected_employees * time_savings_per_person_hours_per_month),
        "monthly_cost_savings": int(monthly_savings),
        "annual_cost_savings": int(annual_savings),
        "roi_summary": f"年間約{int(annual_savings/10000)}万円のコスト削減が見込めます（推計）"
    }
```

---

## 提案書の活用パターン

### バリエーション生成

```
同じ顧客への提案でも意思決定者によって内容を変える:

decision_maker = "情報システム部長"
  → 技術的詳細・セキュリティ・統合容易性を強調

decision_maker = "経営企画部長"
  → ROI・競合優位性・市場トレンドを強調

decision_maker = "CFO"
  → コスト削減・ROI・TCO（総所有コスト）を強調

→ Start ノードの decision_maker を変えるだけで別の提案書が生成される
```

### メール文面の自動生成

```
提案書に加えて、送付メール文面も同時に生成:

[LLM: メール文面生成]
  入力: 提案書のエグゼクティブサマリー + 顧客情報
  出力: 件名 + 本文（3段落以内・CTA付き）

→ 提案書 + メールをセットで出力
→ 担当者はコピペして送信するだけ
```

---

## 参考：他のユースケース

- [RAGチャットボット構築](concepts_dify_usecase_rag_chatbot.md) — 事例・製品情報の Q&A ボット版
- [競合情報・ニュースモニタリング](concepts_dify_usecase_news_monitoring.md) — 顧客企業の最新情報を自動収集
