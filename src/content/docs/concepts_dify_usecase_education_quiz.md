---
category: "概念"
order: 113
title: 教育：クイズ・学習教材自動生成（Dify実践）
description: 教科書・講義ノートをナレッジベースに登録してクイズ・フラッシュカード・模擬試験を自動生成するDify実践例。教育現場・資格学習向け。
tags: ["Dify", "教育", "クイズ生成", "eラーニング", "資格学習", "ユースケース"]
emoji: "🎓"
date: "2026-04-09"
source: "Dify公式ドキュメント / dify.ai/education"
series:
  - Difyユースケース
---

## シナリオ概要

**課題1（教員向け）**: 授業の単元ごとに確認テストを作るのが大変。良問を作るには時間がかかるし、解説も書かなければならない。

**課題2（学習者向け）**: 資格試験の勉強をしているが、既製の問題集を全部解き終わった後の練習問題がない。自分の弱点に合わせた問題を無限に解きたい。

**解決策**: 教材テキストを Dify のナレッジベースに入れると、問題・解答・解説を自動生成するシステムを構築。

```
教員の操作:
  1. 単元の教科書PDFをアップロード
  2. 「確認テスト10問（4択）を生成」
  3. 問題・解答・解説がセットで出力される

学習者の操作（チャット形式）:
  「AWS SAAのEC2について難しめの問題を出して」
    ↓
  「Q. EC2のAutoScalingで…（問題文）
  
  A) m5.large を使う
  B) スケーリングポリシーを…
  C) ...
  D) ...」
  
  「Bです」
  
  「正解です！解説: Auto Scaling のスケーリングポリシーは…」
```

---

## 使用する Dify 機能

| 機能 | 役割 |
|---|---|
| [ナレッジベース・RAG](concepts_dify_knowledge_rag.md) | 教材のインデックス化 |
| [概要・アプリ種別](concepts_dify_overview.md) | Chatflow（対話型）+ Workflow（一括生成） |
| [変数システム](concepts_dify_variables.md) | 会話変数で学習進捗を管理 |
| [ノード一覧](concepts_dify_nodes.md) | Iteration（一括生成）・LLM ノード |

---

## ユースケース1: 一括クイズ生成（Workflow）

### ワークフロー設計

```
Workflow 構成:

[Start]
  │ {{document}}: 教材ファイル（File型）
  │ {{question_count}}: 問題数（Number型）
  │ {{question_type}}: Select（4択/〇×/記述/穴埋め）
  │ {{difficulty}}: Select（基礎/標準/応用）
  ▼
[Doc Extractor]
  │ 教材テキストを抽出
  ▼
[LLM: 重要概念の抽出]
  │ "この教材の重要概念・用語・事実を列挙してください"
  │ → {{key_concepts}}: 概念リスト
  ▼
[LLM: 問題生成]
  │ → {{questions_json}}: 問題・選択肢・解答・解説のJSON
  ▼
[Code: 整形・フォーマット]
  │ → Markdown形式・CSV形式・HTML形式等
  ▼
[End]
  出力: 完成したクイズセット
```

### 問題生成プロンプト

```
System:
あなたは教育専門家です。
提供された教材から {{difficulty}} レベルの問題を{{question_count}}問生成してください。

問題形式: {{question_type}}

品質基準:
- 教材の内容に基づいた問題のみ（教材にない内容から出題しない）
- 4択の場合、誤答は「それっぽいが明確に間違っている」ものにする
- 単純な暗記でなく「理解しているか確認できる」問題を優先
- 解説は「なぜその答えか」を丁寧に説明する

出力形式（JSON）:
{
  "questions": [
    {
      "id": 1,
      "question": "問題文",
      "choices": {"A": "...", "B": "...", "C": "...", "D": "..."},
      "correct_answer": "B",
      "explanation": "Bが正解の理由...",
      "related_concept": "関連する概念・用語",
      "difficulty": "基礎/標準/応用"
    }
  ]
}

User:
重要概念: {{key_concepts}}
教材テキスト: {{doc_text}}
```

---

## ユースケース2: 対話型学習ボット（Chatflow）

一問一答形式で学習者と対話しながら問題を出す。

### 会話変数の設計

```yaml
会話変数:
  subject: "AWS-SAA"           # 学習中の科目・資格
  difficulty: "standard"       # 現在の難易度
  correct_count: 0             # 正解数
  wrong_topics: []             # 間違えた概念（苦手分野の追跡）
  current_question: {}         # 現在の問題（回答待ち）
  total_questions: 0           # 出題数
```

### 対話フロー

```
Chatflow:

[Start] {{sys.query}}
  ▼
[Question Classifier]
  ├── 「問題を出して」「次の問題」 → [問題生成フロー]
  ├── 回答（A/B/C/D または文字列） → [回答確認フロー]
  ├── 「解説して」「わからない」   → [解説フロー]
  └── 「弱点を教えて」「まとめ」   → [学習サマリーフロー]

[問題生成フロー]
  ├── [Knowledge Retrieval]
  │     クエリ: {{conversation.subject}} + {{conversation.wrong_topics}}
  │     （苦手分野を重点的に出題）
  │
  ├── [LLM: 問題生成]
  │     難易度: {{conversation.difficulty}}
  │     苦手分野を優先: {{conversation.wrong_topics}}
  │
  ├── [Variable Assigner]
  │     conversation.current_question = 生成した問題
  │
  └── [Answer] 問題文を表示

[回答確認フロー]
  ├── [Code: 正誤判定]
  │     ユーザー回答 vs conversation.current_question.correct
  │
  ├── IF 正解:
  │   ├── [Variable Assigner] correct_count += 1
  │   └── [Answer] 「正解！解説:...」
  │
  └── IF 不正解:
      ├── [Variable Assigner] wrong_topics に概念を追加
      └── [Answer] 「惜しい！正解はXです。解説:...」
```

### 苦手分野への自動アダプテーション

```
wrong_topics が蓄積されると:

問題生成の Knowledge Retrieval クエリ:
  通常:   "AWS EC2 基礎知識"
  弱点追跡後: "AWS EC2 基礎知識 Auto Scaling スケーリングポリシー"
              ↑ 間違えた概念を優先検索

→ 苦手分野の問題が多く出るようになる
→ 個人適応型学習（Adaptive Learning）の実現
```

---

## 具体的な活用シーン

### 資格試験対策（AWS / 情報処理技術者 / TOEIC等）

```
ナレッジベースに登録するもの:
  - 公式学習ガイド PDF
  - 過去問・解説テキスト
  - 重要用語集

特有のプロンプト工夫:
  「AWS の試験形式（1つ正解 / 複数正解）に合わせた問題を生成」
  「TOEIC Part 5 の空所補充問題形式で生成」
```

### 学校の確認テスト（教員向け）

```
Workflow 出力オプション:
  - Google Forms 形式でエクスポート（自動採点可能）
  - 印刷用 PDF（問題用紙 + 解答・解説用紙）
  - LMS（Moodle / Canvas）へのインポート形式

Iteration で単元ごとに一括生成:
  単元リスト × 10問 = 授業1学期分のテストをまとめて生成
```

### 社内研修・コンプライアンス教育

```
コンプライアンス研修テスト自動生成:
  - 規程文書 → テスト問題化
  - 毎年内容が変わっても自動更新
  - 受講履歴 + 正答率を記録

IT セキュリティ教育:
  - フィッシングメール判別問題
  - 情報漏洩防止クイズ
```

---

## 参考：他のユースケース

- [RAGチャットボット構築](concepts_dify_usecase_rag_chatbot.md) — ナレッジベースを Q&A に使う基本形
- [コンテンツ一括生成](concepts_dify_usecase_batch_content.md) — Iteration による大量生成パターン
