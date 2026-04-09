---
category: "概念"
order: 106
title: 構造化データ抽出ワークフロー（Dify実践）
description: 非構造化テキスト（メール・記事・レポート）から構造化JSONデータを抽出するDify Workflowの設計パターン。
tags: ["Dify", "データ抽出", "構造化データ", "Parameter Extraction", "ワークフロー", "ユースケース"]
emoji: "🗂️"
date: "2026-04-09"
source: "Dify公式ドキュメント https://docs.dify.ai"
series:
  - Difyユースケース
---

## シナリオ概要

**課題**: 営業チームが受け取る問い合わせメールは非構造化テキストで、CRM に手動で転記するのが手間。自動的に案件情報を抽出してシステムに登録したい。

**解決策**: Dify Workflow でメール本文を受け取り、構造化データを抽出して CRM API に登録する。

```
入力メール:
  「先日ご提案いただいたエンタープライズプランについて検討したいと思います。
   弊社は製造業で従業員は約500名です。ご担当の田中様からご連絡ください。
   メールアドレスは yamada@corp.jp、電話は 03-XXXX-XXXX です。」

出力JSON:
  {
    "company_name": null,
    "industry": "製造業",
    "company_size": 500,
    "contact_name": "山田（推定）",
    "email": "yamada@corp.jp",
    "phone": "03-XXXX-XXXX",
    "interest": "エンタープライズプラン",
    "next_action": "田中担当からの連絡"
  }
```

---

## 使用する Dify 機能

| 機能 | 役割 |
|---|---|
| [ノード一覧](concepts_dify_nodes.md) | Parameter Extraction / Code / LLM ノード |
| [変数システム](concepts_dify_variables.md) | 出力変数の型変換と管理 |
| [ワークフロー vs チャットフロー](concepts_dify_workflow_chatflow.md) | Workflow の単発実行 |

---

## ワークフロー設計

```
Workflow 構成:

[Start]
  │ {{text}}: 抽出元テキスト（メール本文等）
  │ {{schema}}: 抽出したいフィールド定義（オプション）
  ▼
[Parameter Extraction]
  │ テキストから定義済みフィールドを自然言語で抽出
  │ {{params.email}}: "yamada@corp.jp"
  │ {{params.phone}}: "03-XXXX-XXXX"
  │ {{params.industry}}: "製造業"
  │ （定義したが見つからないフィールドは null）
  ▼
[LLM: 補完・推論]
  │ Parameter Extraction で取れなかった深い推論が必要なフィールドを補完
  │ 例: テキストのトーン・優先度・感情の推定
  │ {{llm.enriched}}: JSON文字列
  ▼
[Code: マージ・バリデーション]
  │ params と llm.enriched を統合
  │ メールアドレス形式のバリデーション
  │ {{code.result}}: 最終JSON
  ▼
[Conditional Branch]
  ├── 必須フィールドが揃っている → [HTTP Request: CRM API登録]
  └── 必須フィールドが足りない  → [End: partial_result + missing_fields]
```

---

## Parameter Extraction ノード設定

```yaml
入力: {{start.text}}

抽出フィールド定義:
  - name: email
    type: string
    description: "メールアドレス（example@domain.com 形式）"
    required: false

  - name: phone
    type: string
    description: "電話番号（ハイフン区切りでも可）"
    required: false

  - name: company_size
    type: number
    description: "従業員数または会社規模（数値のみ）"
    required: false

  - name: industry
    type: string
    description: "業種・業界（例: 製造業、IT、金融）"
    required: false

  - name: interest
    type: string
    description: "興味を持っている製品・プランの名前"
    required: false

# Parameter Extraction は LLM を使って抽出するため、
# description の質が抽出精度に直結する
```

---

## LLM: 補完・推論ノード

Parameter Extraction では取れない高度な推論を行う。

```
System:
以下の情報を JSON 形式で推定してください。
根拠がない場合は null を返してください。
他のテキストは含めないでください。

User:
テキスト: {{start.text}}

推定してほしい情報:
{
  "sentiment": "positive / neutral / negative",
  "urgency": "high / medium / low",
  "estimated_deal_size": "large / medium / small / unknown",
  "key_concern": "顧客の主な懸念事項（1文）"
}
```

---

## Code ノード: マージとバリデーション

```python
import json
import re

def main(inputs: dict) -> dict:
    params = inputs.get("params", {})
    llm_raw = inputs.get("llm_enriched", "{}")
    
    # LLM出力をパース
    try:
        llm_data = json.loads(llm_raw)
    except json.JSONDecodeError:
        llm_data = {}
    
    # マージ
    result = {**params, **llm_data}
    
    # バリデーション
    validation_errors = []
    
    # メールアドレス形式チェック
    email = result.get("email", "")
    if email and not re.match(r"^[^@]+@[^@]+\.[^@]+$", email):
        result["email"] = None
        validation_errors.append("invalid_email_format")
    
    # 電話番号の正規化（ハイフン除去）
    phone = result.get("phone", "")
    if phone:
        result["phone_normalized"] = re.sub(r"[-\s()]", "", phone)
    
    # 必須フィールドのチェック
    required_fields = ["email", "interest"]
    missing_fields = [f for f in required_fields if not result.get(f)]
    
    return {
        "result": json.dumps(result, ensure_ascii=False),
        "missing_fields": missing_fields,
        "is_complete": len(missing_fields) == 0,
        "validation_errors": validation_errors
    }
```

---

## バリエーション：レシート・請求書の読み取り

```
[Start]
  │ {{file}}: スキャン画像またはPDF
  ▼
[LLM: Vision モード]
  │ モデル: GPT-4o（画像対応）
  │ プロンプト: "この請求書から情報をJSONで抽出してください"
  │ 抽出対象: 発行日/支払期限/合計金額/税額/発行元/品目リスト
  │ {{llm.invoice_json}}: 抽出結果
  ▼
[Code: 金額計算検証]
  │ 品目の合計 == 請求合計かを検証
  │ 不一致なら flag: "amount_mismatch"
  ▼
[End]
```

---

## バリエーション：SNS・レビュー分析

```
入力: レビューテキストのリスト（100件等）

[Iteration]
  各レビューに対して:
  [Parameter Extraction]
    - rating_mentioned: 言及された評価（例: "最高", "最悪"）
    - product_aspect: 言及された製品要素（品質/価格/配送等）
    - issue_category: 問題カテゴリ（もしあれば）

  [LLM: 感情分析]
    - sentiment_score: -1.0〜1.0

[Code: 集計]
  - カテゴリ別の感情スコア平均
  - 頻出キーワード
  - 改善優先順位

[End]: 分析ダッシュボード用データ
```

---

## 実装のポイント

```
1. Parameter Extraction vs LLM 直接
   Parameter Extraction: 定義したフィールドを確実に抽出（型安全）
   LLM 直接: 自由形式の推論・複雑な判断
   → 組み合わせて使うのが最も効果的

2. 出力の型安全性
   LLM は必ずしも有効な JSON を返さない
   → Code ノードで try/except + フォールバック値

3. Few-shot プロンプトで精度向上
   System Prompt に入出力の例を含める:
   例: "入力: '従業員は約500名です' → company_size: 500"

4. スキーマのバージョン管理
   抽出フィールドが変わったら Environment Variables で管理
   → Workflow を再デプロイせずに更新できる
```

---

## 参考：他のユースケース

- [PDFドキュメント分析パイプライン](concepts_dify_usecase_doc_analysis.md) — PDF特化の抽出
- [コンテンツ一括生成](concepts_dify_usecase_batch_content.md) — 大量データのバッチ処理パターン
