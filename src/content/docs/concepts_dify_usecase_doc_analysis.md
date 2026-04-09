---
category: "概念"
order: 102
title: PDFドキュメント分析パイプライン（Dify実践）
description: 契約書・報告書・論文などのPDFをDify Workflowで自動解析し、構造化データや要約を生成するパイプライン構築例。
tags: ["Dify", "PDF", "ドキュメント分析", "ワークフロー", "RAG", "ユースケース"]
emoji: "📄"
date: "2026-04-09"
source: "Dify公式ドキュメント https://docs.dify.ai"
series:
  - Difyユースケース
---

## シナリオ概要

**課題**: 毎月大量の PDF（契約書・報告書・論文）が届き、手動でキーポイントを抽出するのに時間がかかる。

**解決策**: Dify Workflow でファイルを受け取り、自動的に要約・構造化データ抽出・リスク識別を行い、結果を JSON で返すパイプライン。

```
入力: 契約書PDF
  ↓
[自動解析]
  ↓
出力:
  {
    "summary": "本契約は...",
    "parties": ["甲社: 株式会社A", "乙社: 株式会社B"],
    "contract_period": "2026-04-01〜2027-03-31",
    "key_clauses": ["第5条: 解約は30日前通知..."],
    "risk_flags": ["自動更新条項あり", "損害賠償上限なし"]
  }
```

---

## 使用する Dify 機能

| 機能 | 役割 |
|---|---|
| [概要・アプリ種別](concepts_dify_overview.md) | Workflow を選択 |
| [ナレッジベース・RAG](concepts_dify_knowledge_rag.md) | 類似契約書との比較（オプション） |
| [ノード一覧](concepts_dify_nodes.md) | Doc Extractor / LLM / Code ノード |
| [変数システム](concepts_dify_variables.md) | ファイル変数・出力変数の管理 |

---

## ワークフロー設計

```
Workflow 構成:

[Start]
  │ {{file}}: アップロードされたPDFファイル（File型変数）
  ▼
[Doc Extractor]
  │ PDFからテキストを抽出
  │ {{doc_extractor.text}}: 生テキスト
  ▼
[並列実行]
  ├── [LLM A: 要約]
  │     プロンプト: "以下の文書を3文で要約してください"
  │     {{llm_summary.text}}: 要約
  │
  ├── [LLM B: 構造化抽出]
  │     プロンプト: "契約当事者・期間・主要条項をJSON形式で抽出"
  │     {{llm_structure.text}}: JSON文字列
  │
  └── [LLM C: リスク識別]
        プロンプト: "法的リスクになりうる条項をリストアップ"
        {{llm_risk.text}}: リスクリスト
  ▼
[Code ノード: JSON整形]
  │ 3つのLLM出力を1つのJSONオブジェクトに統合
  │ {{code.result}}: 最終JSON
  ▼
[End]
  出力: {{code.result}}
```

---

## 各ノードの詳細設定

### Doc Extractor ノード

```yaml
入力: {{start.file}}
出力: 
  text: 抽出テキスト（改行・スペース保持）
  
注意点:
  - スキャンPDF（画像PDF）はテキスト抽出できない
  - スキャンPDFにはOCRが必要（別途処理が必要）
  - 非常に長い文書はLLMのコンテキスト長に注意
```

### LLM B: 構造化抽出プロンプト

```
System:
あなたは契約書分析の専門家です。
以下の契約書から情報を抽出し、必ず以下のJSON形式で返してください。
他のテキストは一切含めないでください。

出力形式:
{
  "parties": ["甲: ...", "乙: ..."],
  "contract_date": "YYYY-MM-DD",
  "contract_period": {"start": "...", "end": "..."},
  "subject": "契約の目的",
  "payment_terms": "支払い条件",
  "key_clauses": ["重要条項1", "重要条項2"]
}

User:
{{doc_extractor.text}}
```

### Code ノード: JSON統合

```python
import json

def main(inputs: dict) -> dict:
    summary = inputs.get("summary", "")
    
    # LLM出力のJSONをパース（LLMはたまり余計なテキストを追加することがある）
    structure_raw = inputs.get("structure", "{}")
    try:
        structure = json.loads(structure_raw)
    except json.JSONDecodeError:
        # JSONが壊れていた場合は空オブジェクトでフォールバック
        structure = {}
    
    risk_raw = inputs.get("risk", "")
    risks = [r.strip() for r in risk_raw.split("\n") if r.strip()]
    
    result = {
        "summary": summary,
        "structure": structure,
        "risk_flags": risks,
        "analyzed_at": inputs.get("timestamp", "")
    }
    
    return {"result": json.dumps(result, ensure_ascii=False, indent=2)}
```

---

## 長文PDFへの対処

PDF が LLM のコンテキスト長を超える場合の戦略。

```
戦略1: チャンキング + Iteration
  [Doc Extractor]
    → [Code: テキストを N 文字ごとにチャンク分割]
    → [Iteration: 各チャンクに LLM を適用]
    → [LLM: チャンク要約を統合して最終要約]

戦略2: ナレッジベースを使う
  PDF をナレッジベースに登録
  → [Knowledge Retrieval: "重要条項" でクエリ]
  → 関連チャンクだけ LLM に渡す

推奨モデル（長文対応）:
  Claude 3.5 Sonnet: 200Kトークン
  Gemini 1.5 Pro: 1Mトークン
```

---

## バッチ処理（複数PDF）

一度に複数のPDFを処理する場合。

```
[Start]
  │ {{files}}: File List 型変数（複数ファイル）
  ▼
[Iteration]
  │ items: {{start.files}}
  │ parallel_num: 3（3ファイルを同時処理）
  │
  │ [各ファイルに対して]
  │   [Doc Extractor] → [LLM: 解析] → [Code: JSON化]
  │
  ▼
[Code: 全結果を配列にまとめる]
  ▼
[End]
  出力: [解析結果配列]
```

---

## 実装のポイント

```
1. LLM への出力形式指定は厳格に
   「必ず JSON 形式で返すこと。他のテキストは含めない」
   → それでも壊れることがある → Code ノードで try/except

2. 機密文書の場合はモデル選択に注意
   → Azure OpenAI / Anthropic (データレジデンシー保証)
   → または Ollama（ローカル）

3. API 経由でパイプラインを呼び出す
   → Workflow API に multipart/form-data でファイルをアップロード
   → バッチシステムとの統合が容易
```

---

## 参考：他のユースケース

- [RAGチャットボット構築](concepts_dify_usecase_rag_chatbot.md) — 文書を Q&A で使いたい場合
- [構造化データ抽出ワークフロー](concepts_dify_usecase_data_extraction.md) — より汎用的なデータ抽出パターン
