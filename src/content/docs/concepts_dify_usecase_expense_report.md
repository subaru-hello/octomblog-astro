---
category: "概念"
order: 109
title: 経費精算・領収書OCR処理（Dify実践）
description: 領収書の写真やPDFをアップロードするだけで日付・金額・カテゴリを自動抽出し、承認フローまで自動化するDify実践例。
tags: ["Dify", "経費精算", "OCR", "バックオフィス", "業務自動化", "ユースケース"]
emoji: "🧾"
date: "2026-04-09"
source: "Dify公式ドキュメント https://docs.dify.ai"
series:
  - Difyユースケース
---

## シナリオ概要

**課題**: 出張や接待の領収書を集めて経費申請するのが面倒。手入力でExcelに転記 → 上司に承認依頼 → 経理に提出、という3ステップが全部手動。

**解決策**: 領収書の写真をアップロードするだけで、自動的に情報を読み取り、経費申請書を作成して承認フローを開始する。

```
従業員の操作:
  1. 領収書の写真を撮る
  2. Dify の Web App にアップロード
  3. 終わり

自動で行われること:
  - 日付・店名・金額・消費税・支払方法を読み取る
  - 業務上の用途をカテゴリ分け（交通費/接待費/物品購入等）
  - 5,000円以上 → 上司に承認メールを自動送信
  - 承認後 → 経理システムに自動登録
```

---

## 使用する Dify 機能

| 機能 | 役割 |
|---|---|
| [ノード一覧](concepts_dify_nodes.md) | LLM（Vision）/ Code / HTTP Request ノード |
| [変数システム](concepts_dify_variables.md) | File変数でファイルを受け取る |
| [ワークフロー vs チャットフロー](concepts_dify_workflow_chatflow.md) | Workflow で単発処理 |

---

## ワークフロー設計

```
Workflow 構成:

[Start]
  │ {{receipt}}: File型変数（画像またはPDF）
  │ {{employee_name}}: 申請者名
  │ {{purpose}}: 利用目的（任意）
  ▼
[LLM: 領収書読み取り（Vision モード）]
  │ モデル: GPT-4o または Claude 3.5 Sonnet（画像対応）
  │ プロンプト: "領収書の情報をJSONで抽出してください"
  │ {{llm.receipt_data}}: JSON文字列
  ▼
[Code: データ整形・検証]
  │ JSONパース・日付フォーマット統一・金額の数値化
  │ {{code.amount}}: 金額（数値）
  │ {{code.category}}: カテゴリ
  │ {{code.is_valid}}: 検証OK/NG
  ▼
[Conditional Branch: 承認フロー分岐]
  ├── 5,000円未満    → [自動承認] → [経理システムへ登録]
  ├── 5,000円以上    → [上司承認待ちメール送信]
  └── データ不正     → [申請者へエラー通知]
  ▼
[End]
  出力: 申請結果（承認待ち/自動承認/エラー）
```

---

## LLM プロンプト（領収書読み取り）

```
System:
あなたは経理処理の専門家です。
領収書から以下の情報を抽出してJSON形式で返してください。
読み取れない項目は null を返してください。
JSON以外のテキストは出力しないでください。

出力形式:
{
  "store_name": "店舗名",
  "date": "YYYY-MM-DD",
  "amount_total": 数値（税込合計金額）,
  "amount_tax": 数値（消費税額、不明なら null）,
  "payment_method": "現金/クレジットカード/電子マネー/不明",
  "items": [
    {"name": "品目名", "price": 数値}
  ],
  "receipt_number": "レシート番号（あれば）"
}

User:
[添付された領収書画像]
```

---

## Code ノード: 整形・カテゴリ判定

```python
import json
from datetime import datetime

def main(inputs: dict) -> dict:
    raw = inputs.get("receipt_data", "{}")
    employee_name = inputs.get("employee_name", "")
    purpose = inputs.get("purpose", "")
    
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {"is_valid": False, "error": "JSON解析エラー"}
    
    # 必須フィールドチェック
    if not data.get("amount_total") or not data.get("date"):
        return {"is_valid": False, "error": "金額または日付が読み取れませんでした"}
    
    # カテゴリ自動判定（店舗名・品目から推定）
    store = data.get("store_name", "")
    items_text = str(data.get("items", []))
    
    category = "その他"
    if any(k in store for k in ["タクシー", "電車", "バス", "駐車", "航空"]):
        category = "交通費"
    elif any(k in store for k in ["食", "レストラン", "ランチ", "居酒屋", "カフェ"]):
        category = "接待費" if purpose else "会議費"
    elif any(k in items_text for k in ["文具", "用紙", "インク", "ボールペン"]):
        category = "消耗品費"
    elif any(k in store for k in ["ホテル", "旅館", "宿"]):
        category = "宿泊費"
    
    amount = int(data.get("amount_total", 0))
    
    return {
        "is_valid": True,
        "store_name": store,
        "date": data.get("date"),
        "amount": amount,
        "tax": data.get("amount_tax"),
        "payment_method": data.get("payment_method", "不明"),
        "category": category,
        "employee_name": employee_name,
        "purpose": purpose,
        "needs_approval": amount >= 5000  # 5,000円以上は承認必要
    }
```

---

## 承認フロー：メール自動送信

```
[HTTP Request: メール送信（SendGrid等）]
  POST https://api.sendgrid.com/v3/mail/send
  Authorization: Bearer {{env.SENDGRID_API_KEY}}
  
  本文テンプレート:
  ---
  件名: 【経費承認依頼】{{employee_name}} - {{category}} ¥{{amount}}
  
  {{employee_name}} さんから経費申請が届いています。
  
  ■ 内容
  日付: {{date}}
  店舗: {{store_name}}
  金額: ¥{{amount}}（{{payment_method}}）
  カテゴリ: {{category}}
  目的: {{purpose}}
  
  以下のリンクから承認/却下をお願いします:
  [承認する] https://your-system.com/approve/{{expense_id}}
  [却下する] https://your-system.com/reject/{{expense_id}}
```

---

## 複数領収書のバッチ処理

出張後に複数の領収書をまとめて処理する場合。

```
[Start]
  │ {{receipts}}: File List（複数画像）
  ▼
[Iteration]
  │ 各画像に対して上記のフローを実行
  │ parallel_num: 3
  ▼
[Code: 全経費を集計]
  │ 合計金額・カテゴリ別小計を計算
  │ 経費申請書（PDF）を生成
  ▼
[End]
  出力: 経費申請書PDF + 明細一覧
```

---

## ビジネス向け導入ポイント

```
このユースケースで解決する問題:
  ✓ 手入力ミスの削減
  ✓ 申請から承認までのサイクル短縮
  ✓ 経費カテゴリの統一（人によってバラバラ問題）
  ✓ 月末の経費申請集中を防ぐ（日次処理が容易に）

既存システムとの連携:
  - freee / マネーフォワード: API で自動登録
  - 楽楽精算 / ジョブカン経費: Webhook 経由
  - Slack: 承認通知を DM で受け取る

始め方:
  GPT-4o のビジョン機能が必要なため、
  OpenAI の API キーを取得するだけで開始できる
```

---

## 参考：他のユースケース

- [PDFドキュメント分析パイプライン](concepts_dify_usecase_doc_analysis.md) — 文書処理の応用パターン
- [構造化データ抽出ワークフロー](concepts_dify_usecase_data_extraction.md) — 抽出処理の汎用パターン
