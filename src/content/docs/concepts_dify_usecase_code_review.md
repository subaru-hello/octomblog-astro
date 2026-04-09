---
category: "概念"
order: 105
title: コードレビュー自動化（Dify実践）
description: Pull Request のコードを自動解析し、バグ・セキュリティ問題・改善提案をDify AgentとGitHub APIで自動投稿する実践例。
tags: ["Dify", "コードレビュー", "GitHub", "エージェント", "ツール", "ユースケース"]
emoji: "🔎"
date: "2026-04-09"
source: "Dify公式ドキュメント https://docs.dify.ai"
series:
  - Difyユースケース
---

## シナリオ概要

**課題**: PR が多く、手動コードレビューが追いつかない。初歩的なバグやセキュリティ問題は自動検出したい。

**解決策**: GitHub Webhook → Dify Workflow で PR 差分を取得 → Agent が自律的に分析 → GitHub API でコメントを投稿。

```
[GitHub PR 作成]
    │ Webhook
    ▼
[Dify Workflow]
    │ PR の diff を取得
    ▼
[Agent: コードを分析]
    │ バグ/セキュリティ/パフォーマンス問題を探す
    ▼
[GitHub API: レビューコメントを投稿]
    ↓
PR に自動コメントが付く
```

---

## 使用する Dify 機能

| 機能 | 役割 |
|---|---|
| [エージェント機能](concepts_dify_agents.md) | 自律的なコード分析 |
| [ツール・プラグイン](concepts_dify_tools_plugins.md) | GitHub API ツール化 |
| [ノード一覧](concepts_dify_nodes.md) | HTTP Request / Code ノード |
| [変数システム](concepts_dify_variables.md) | PR 情報の受け渡し |

---

## ワークフロー設計

```
Workflow 構成:

[Start]
  │ {{repo}}: リポジトリ名（"owner/repo"）
  │ {{pr_number}}: PR番号
  │ {{github_token}}: 環境変数
  ▼
[HTTP Request: PR差分取得]
  │ GET https://api.github.com/repos/{{repo}}/pulls/{{pr_number}}/files
  │ Header: Authorization: Bearer {{env.GITHUB_TOKEN}}
  │ {{pr_files}}: 変更ファイル一覧とdiff
  ▼
[Code: diff を整形]
  │ 長すぎるdiffを切り詰め・フォーマット
  │ {{formatted_diff}}: レビュー用テキスト
  ▼
[Agent: コードレビュー]
  │ tools: [web_search, calculator]  ← 必要に応じて調査可能
  │ max_iterations: 5
  │ {{agent_result}}: レビュー結果（JSON）
  ▼
[Code: GitHub コメント形式に変換]
  │ Markdown でコメントを整形
  ▼
[HTTP Request: コメント投稿]
  │ POST https://api.github.com/repos/{{repo}}/issues/{{pr_number}}/comments
  │ body: {"body": "{{formatted_comment}}"}
  ▼
[End]
```

---

## Agent プロンプト設計

```
System:
あなたはシニアソフトウェアエンジニアです。
提供されたコードの差分をレビューし、以下の観点で問題を報告してください。

レビュー観点:
1. バグ・ロジックエラー（重大度: high）
2. セキュリティ脆弱性（SQLインジェクション、XSS等）（重大度: critical）
3. パフォーマンス問題（重大度: medium）
4. コードの可読性・保守性（重大度: low）

出力形式（JSON）:
{
  "summary": "レビュー全体の概要（1〜2文）",
  "issues": [
    {
      "file": "src/auth.ts",
      "line": 42,
      "severity": "critical",
      "category": "security",
      "description": "パスワードが平文でログに出力されている",
      "suggestion": "console.log から password パラメータを除外する"
    }
  ],
  "overall_score": 7,
  "approved": false
}

問題がなければ "issues": [] を返し、"approved": true とすること。

User:
以下のコード差分をレビューしてください:

{{formatted_diff}}
```

---

## GitHub ツールの設定

```yaml
Custom Tool 設定（OpenAPI スキーマ）:

openapi: "3.0.0"
info:
  title: GitHub API
paths:
  /repos/{owner}/{repo}/pulls/{pr_number}/files:
    get:
      operationId: getPRFiles
      summary: PR の変更ファイル一覧を取得
      parameters:
        - name: owner
          in: path
          required: true
        - name: repo
          in: path
          required: true
        - name: pr_number
          in: path
          required: true

# 認証設定
auth:
  type: bearer
  token: {{env.GITHUB_TOKEN}}
```

---

## コメントのフォーマット

```
GitHub PR コメントのMarkdown形式:

## 🤖 AI コードレビュー

**総合スコア**: 7/10 | **承認**: ❌

### 🔴 Critical（要対応）

**`src/auth.ts` L42**
パスワードが平文でログに出力されています。
```typescript
// 問題のコード
console.log('Login attempt:', { username, password });

// 修正案
console.log('Login attempt:', { username });
```

---

### 🟡 Medium（推奨対応）

**`src/api.ts` L105**
N+1クエリが発生する可能性があります。
`Promise.all` を使って並列化することを検討してください。

---

*このレビューは AI によって自動生成されました。最終判断は人間のレビュアーが行ってください。*
```

---

## Webhook トリガーの設定

```bash
# GitHub リポジトリの Webhook 設定:
# Settings → Webhooks → Add webhook

Payload URL: https://api.dify.ai/v1/workflows/run
Content type: application/json
Secret: your-webhook-secret

# トリガーイベント:
# ✅ Pull requests（PRが開かれた時）

# Dify側（Start ノード）:
# GitHub から送られる Payload を入力変数として受け取る
# {{repository.full_name}} → repo
# {{number}} → pr_number
```

---

## セキュリティ考慮事項

```
1. GitHub Token は Environment Variables（Secret型）で管理
   → ログに表示されない

2. Webhook の Secret 検証
   → Start ノードの前に HTTP Request で署名を検証（HMAC-SHA256）

3. 分析対象コードのプライバシー
   → 機密リポジトリには Azure OpenAI / Anthropic のデータレジデンシー保証を使う
   → または Ollama でローカル処理

4. 自動コメントの明示
   → 「AI自動生成」と明示して誤解を防ぐ
   → human-in-the-loop: Agent の判断を人間が確認してから投稿
```

---

## 参考：他のユースケース

- [エージェント機能](concepts_dify_agents.md) — Agent の ReAct ループの詳細
- [ツール・プラグインエコシステム](concepts_dify_tools_plugins.md) — カスタムツール作成の詳細
- [マルチエージェントオーケストレーション](concepts_dify_usecase_multi_agent.md) — より複雑なエージェント連携
