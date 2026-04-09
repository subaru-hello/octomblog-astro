---
category: "概念"
order: 108
title: SNSコンテンツ多チャンネル自動生成（Dify実践）
description: 1つのネタからX・LinkedIn・Instagram・Facebook用の投稿文を同時生成するDify Workflowの設計。マーケター向け。
tags: ["Dify", "SNS", "コンテンツマーケティング", "マーケティング", "ワークフロー", "ユースケース"]
emoji: "📱"
date: "2026-04-09"
source: "Dify公式ドキュメント https://docs.dify.ai"
series:
  - Difyユースケース
---

## シナリオ概要

**課題**: ブログ記事を書いたら、X・LinkedIn・Instagram・Facebook にも投稿したい。でも各プラットフォームで文体・文字数・ハッシュタグの作法が全然違う。手動で4つ書くのは時間がかかる。

**解決策**: Dify Workflow に「元ネタ」を渡すと、4チャンネル分の投稿文を一気に生成する。

```
入力:
  テーマ: "AIが会計業務を変える5つのトレンド"
  トーン: プロフェッショナル
  URL: https://blog.example.com/ai-accounting

出力（同時生成）:
  X（旧Twitter）: "会計×AIの最前線。5つのトレンドをまとめました 🔥\n①… ②… ③…\n詳しくは→ [URL] #AI #会計DX"
  LinkedIn: "会計業務にAIが与えるインパクトについて..."（400字・論考調）
  Instagram: "✨ 会計×AI の未来 ✨\n\nあなたの経理チームはもう変わり始めてる？..."（絵文字多め）
  Facebook: "【ブログ更新】AIが会計を変える5つのトレンドを解説..."（リンク付き投稿）
```

---

## 使用する Dify 機能

| 機能 | 役割 |
|---|---|
| [ワークフロー vs チャットフロー](concepts_dify_workflow_chatflow.md) | Workflow で単発生成 |
| [ノード一覧](concepts_dify_nodes.md) | 並列LLMノード・Template ノード |
| [変数システム](concepts_dify_variables.md) | 入力変数・出力変数の管理 |

---

## ワークフロー設計

```
Workflow 構成:

[Start]
  │ {{theme}}    : 投稿の元ネタ・テーマ
  │ {{tone}}     : Select（プロフェッショナル/カジュアル/ユーモラス）
  │ {{url}}      : リンクURL（任意）
  │ {{keywords}} : 含めたいキーワード（任意）
  ▼
[並列実行]
  ├── [LLM: X（旧Twitter）用]
  │     制約: 140文字以内・ハッシュタグ3個・URLあり
  │     → {{x_post}}
  │
  ├── [LLM: LinkedIn 用]
  │     制約: 300〜500文字・ビジネス文体・改行多め・絵文字控えめ
  │     → {{linkedin_post}}
  │
  ├── [LLM: Instagram 用]
  │     制約: 絵文字多め・ハッシュタグ10〜20個・感情に訴える文体
  │     → {{instagram_post}}
  │
  └── [LLM: Facebook 用]
        制約: 200〜400文字・リンク付き・どんな記事か一言で伝える
        → {{facebook_post}}
  ▼
[Template: 最終出力整形]
  │ 4つをまとめてMarkdown形式で出力
  ▼
[End]
  出力: チャンネル別投稿文セット
```

---

## LLM プロンプト例（X用）

```
System:
あなたはSNSマーケターです。X（旧Twitter）投稿を生成してください。

制約:
- 文字数: 140文字以内（URLの22文字を除く）
- 語尾は断言形（「です」でなく「だ」等のキャッチーな表現でもOK）
- ハッシュタグ: {{tone}}に合わせて2〜3個
- 冒頭に注目を引く表現を入れる
- URLは文末に "→ {{url}}" の形で付ける

トーン設定:
  プロフェッショナル: ビジネス向け、信頼感を重視
  カジュアル: 親しみやすい口語
  ユーモラス: 面白い切り口、絵文字あり

User:
テーマ: {{theme}}
キーワード: {{keywords}}
トーン: {{tone}}
URL: {{url}}
```

---

## チャンネル別の特性と注意点

| チャンネル | 最適文字数 | ハッシュタグ | 文体 | 特徴 |
|---|---|---|---|---|
| X | ~140文字 | 2〜3個 | 端的・インパクト | RTされやすいフック |
| LinkedIn | 300〜600文字 | 3〜5個 | ビジネス・洞察 | 改行で読みやすく |
| Instagram | 〜2200文字 | 10〜20個 | 感情的・ストーリー | キャプション＋絵文字 |
| Facebook | 200〜400文字 | 1〜2個 | 親しみやすい | リンクプレビュー活用 |

---

## 応用：A/Bテスト用バリエーション生成

同じチャンネルでも複数案を生成してA/Bテストする。

```
[LLM: X投稿 案A]（キャッチーなフック重視）
[LLM: X投稿 案B]（数字・データ重視）
[LLM: X投稿 案C]（質問で始まる）

→ 3案を担当者が選んで投稿
→ エンゲージメント率を記録して次回のプロンプトに反映
```

---

## 予約投稿との連携

```
Buffer / Hootsuite の API と連携:
  [HTTP Request: Buffer API]
    POST /v1/updates/create
    {
      "profile_ids": ["twitter-id", "linkedin-id"],
      "text": "{{x_post}}",
      "scheduled_at": "2026-04-10T09:00:00Z"
    }

→ 生成から予約投稿まで自動化
→ 毎朝9時投稿のルーティンをワークフロートリガーで自動実行
```

---

## ビジネス向け導入ポイント

```
コード不要で始められる手順:
  1. Dify Cloud にサインアップ（無料プランあり）
  2. Workflow を新規作成
  3. Start ノードに入力変数（theme, tone, url）を設定
  4. 並列 LLM ノードを4つ追加
  5. 各ノードにプロンプトを貼り付け
  6. Web App として公開 → チームで共有

技術知識: ゼロでOK（コピペで動く）
```

---

## 参考：他のユースケース

- [コンテンツ一括生成](concepts_dify_usecase_batch_content.md) — 大量記事のバッチ生成
- [構造化データ抽出](concepts_dify_usecase_data_extraction.md) — メールから情報を抽出する応用
