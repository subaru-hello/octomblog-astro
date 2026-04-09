---
category: "概念"
order: 110
title: 会議議事録・タスク自動抽出（Dify実践）
description: 会議の文字起こしテキストからDify Workflowで議事録・アクションアイテム・決定事項を自動生成してNotionやSlackに連携する例。
tags: ["Dify", "議事録", "会議", "業務自動化", "Notion", "Slack", "ユースケース"]
emoji: "📝"
date: "2026-04-09"
source: "Dify公式ドキュメント https://docs.dify.ai"
series:
  - Difyユースケース
---

## シナリオ概要

**課題**: 会議のたびに誰かが議事録を書く係になる。「後で書こう」が積み重なり、記憶が薄れたころに不正確な議事録ができあがる。

**解決策**: Google Meet / Zoom の録音→文字起こしテキストを Dify に渡すと、議事録・アクションアイテム・決定事項を自動生成して Notion と Slack に転記する。

```
入力: 会議の文字起こし（Whisper等で自動生成）
  ↓
[Dify Workflow]
  ↓
Notion 議事録ページに自動記録:
  ## 会議概要
  日時: 2026-04-09  参加者: 山田・田中・鈴木
  
  ## 決定事項
  1. 新機能Xのリリースは5月末に決定
  2. テスト担当は田中さん
  
  ## アクションアイテム
  | 担当 | タスク | 期限 |
  |------|--------|------|
  | 山田 | 要件定義書を作成 | 4/15 |
  | 田中 | テスト計画書を作成 | 4/20 |
  
Slack 通知:
  "【会議議事録】新機能X企画会議 の議事録が作成されました → [Notionリンク]"
```

---

## 使用する Dify 機能

| 機能 | 役割 |
|---|---|
| [ノード一覧](concepts_dify_nodes.md) | LLM / HTTP Request / Code ノード |
| [変数システム](concepts_dify_variables.md) | テキスト変数・出力変数 |
| [ワークフロー vs チャットフロー](concepts_dify_workflow_chatflow.md) | Workflow で単発処理 |

---

## ワークフロー設計

```
Workflow 構成:

[Start]
  │ {{transcript}} : 文字起こしテキスト（Paragraph型）
  │ {{meeting_title}}: 会議名
  │ {{meeting_date}} : 開催日
  │ {{attendees}}   : 参加者（任意）
  ▼
[並列実行]
  ├── [LLM A: 議事録サマリー生成]
  │     → {{summary}}: 概要・背景・議論の流れ
  │
  ├── [LLM B: 決定事項抽出]
  │     → {{decisions}}: 決定事項リスト
  │
  └── [LLM C: アクションアイテム抽出]
        → {{action_items}}: 担当・タスク・期限のJSON
  ▼
[Code: Notionページ本文を組み立て]
  │ Markdown形式で議事録を構成
  │ → {{notion_content}}
  ▼
[HTTP Request: Notion APIでページ作成]
  │ POST https://api.notion.com/v1/pages
  │ → {{notion_page_url}}
  ▼
[HTTP Request: Slack通知]
  │ POST Slack Webhook
  ▼
[End]
```

---

## LLM プロンプト設計

### LLM A: サマリー生成

```
System:
あなたは会議ファシリテーターです。
以下の会議の文字起こしから議事録のサマリーを生成してください。

含める内容:
- 会議の目的・背景（2〜3文）
- 主な議題と議論のポイント（箇条書き）
- 議論に至った背景や前提条件

出力は Markdown 形式でお願いします。

User:
会議名: {{meeting_title}}
日時: {{meeting_date}}
参加者: {{attendees}}

文字起こし:
{{transcript}}
```

### LLM B: 決定事項抽出

```
System:
会議の文字起こしから「決定事項」のみを抽出してください。
決定事項とは、会議で合意・承認・確定した事柄です。
「検討する」「確認する」等の未確定事項は除く。

JSON形式で返してください:
{
  "decisions": [
    {"content": "決定事項の内容", "decided_by": "誰が決定したか（不明ならnull）"}
  ]
}

User: {{transcript}}
```

### LLM C: アクションアイテム抽出

```
System:
会議の文字起こしから「タスク・アクションアイテム」を抽出してください。
「〜する」「〜をお願い」「〜までに」等のキーワードに注目する。

JSON形式で返してください:
{
  "action_items": [
    {
      "task": "タスクの内容",
      "owner": "担当者名（不明なら'未定'）",
      "deadline": "期限（YYYY-MM-DD形式、不明なら null）",
      "priority": "high/medium/low"
    }
  ]
}

User: {{transcript}}
```

---

## Code ノード: Notion ページ組み立て

```python
import json
from datetime import datetime

def main(inputs: dict) -> dict:
    title = inputs.get("meeting_title", "会議議事録")
    date = inputs.get("meeting_date", datetime.now().strftime("%Y-%m-%d"))
    attendees = inputs.get("attendees", "")
    summary = inputs.get("summary", "")
    decisions_raw = inputs.get("decisions", "{}")
    actions_raw = inputs.get("action_items", "{}")
    
    try:
        decisions = json.loads(decisions_raw).get("decisions", [])
    except:
        decisions = []
    
    try:
        action_items = json.loads(actions_raw).get("action_items", [])
    except:
        action_items = []
    
    # 決定事項のMarkdown
    decisions_md = "\n".join([f"- {d['content']}" for d in decisions]) if decisions else "（なし）"
    
    # アクションアイテムのMarkdown表
    if action_items:
        actions_md = "| 担当 | タスク | 期限 | 優先度 |\n|---|---|---|---|\n"
        for item in action_items:
            deadline = item.get("deadline") or "未設定"
            priority = {"high": "🔴 高", "medium": "🟡 中", "low": "🟢 低"}.get(item.get("priority"), "-")
            actions_md += f"| {item.get('owner','未定')} | {item.get('task','')} | {deadline} | {priority} |\n"
    else:
        actions_md = "（なし）"
    
    notion_content = f"""# {title}

**日時**: {date}  
**参加者**: {attendees}

---

## 会議概要

{summary}

---

## 決定事項

{decisions_md}

---

## アクションアイテム

{actions_md}

---

*この議事録はDifyにより自動生成されました*
"""
    
    return {
        "notion_content": notion_content,
        "action_count": len(action_items),
        "decision_count": len(decisions)
    }
```

---

## 文字起こしの取得方法

```
オプション1: Whisper API（OpenAI）
  - 録音ファイル（mp3/mp4/m4a）→ APIで文字起こし
  - Dify の HTTP Request ノードで直接呼べる
  - 精度が高く多言語対応

オプション2: Google Meet の文字起こし機能
  - Google Workspace Business 以上で自動生成
  - テキストファイルをそのまま Dify に入力

オプション3: otter.ai / tl;dv
  - Zoom/Teams/Google Meet と自動連携
  - 文字起こしテキストを Webhook で Dify に送れる

オプション4: 手動でペースト
  - テキストを Start ノードの Paragraph 型変数に貼り付ける
  - 最もシンプルな始め方
```

---

## 週次定例会議の完全自動化

```
毎週月曜定例の場合:

[スケジュールトリガー] 毎週月曜 11:30（会議終了直後）
  ↓
[HTTP Request: Google Drive から最新音声ファイル取得]
  ↓
[HTTP Request: Whisper API で文字起こし]
  ↓
[上記のワークフロー実行]
  ↓
[Notion ページ作成 + Slack 通知]

→ 会議終了後5分で議事録が全員のSlackに届く
```

---

## ビジネス向け導入ポイント

```
コスト感:
  GPT-4o で1時間の会議（〜8000文字）を処理:
  約 0.04〜0.08 ドル（5〜10円）

削減できる時間:
  週1回の定例（1時間）の議事録作成 = 週30〜60分 → ゼロに

Notion 連携の始め方:
  1. Notion の API キーを取得（5分）
  2. Dify の Environment Variables に登録
  3. HTTP Request ノードにコピペ
```

---

## 参考：他のユースケース

- [構造化データ抽出ワークフロー](concepts_dify_usecase_data_extraction.md) — テキストから情報を抽出する汎用パターン
- [SNSコンテンツ多チャンネル自動生成](concepts_dify_usecase_sns_content.md) — 複数チャンネルへの同時出力
