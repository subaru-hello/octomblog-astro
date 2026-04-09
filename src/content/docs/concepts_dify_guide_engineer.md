---
category: "概念"
order: 160
title: エンジニア向けDifyガイド（API統合・CI/CD・テスト自動化）
description: バックエンド・フロントエンドエンジニア向けのDify活用ガイド。REST API統合・Webhook・DSLバージョン管理・プロンプトのCI/CDテスト・TypeScript/Pythonコード例を解説。
tags: ["Dify", "エンジニア", "API", "CI/CD", "テスト", "TypeScript", "Python", "実践"]
emoji: "👨‍💻"
date: "2026-04-09"
source: "Dify公式ドキュメント / エンジニア向けガイド"
series:
  - Dify実践ガイド
---

## エンジニアから見た Dify の立ち位置

```
Dify は「LLM オーケストレーションのインフラ」として使う。

エンジニアが Dify に任せること:
  ✅ プロンプトの管理・バージョニング
  ✅ LLM プロバイダーの切り替え（コード変更なし）
  ✅ RAG パイプラインの構築・チューニング
  ✅ ノーコードで組めるワークフローのビジュアル管理
  ✅ 非エンジニアでも設定変更できる UI

エンジニアがコードで書くこと:
  ✅ 既存システムへの Dify API の組み込み
  ✅ 複雑なデータ変換（Code ノード内）
  ✅ Dify が対応していない外部 API との統合
  ✅ CI/CD パイプラインへのテスト組み込み
```

---

## REST API の完全リファレンス

### ワークフロー実行（同期）

```typescript
// TypeScript での Workflow 呼び出し

interface DifyWorkflowInput {
  inputs: Record<string, string | number | object>;
  response_mode: "blocking" | "streaming";
  user: string;
}

interface DifyWorkflowOutput {
  workflow_run_id: string;
  task_id: string;
  data: {
    outputs: Record<string, unknown>;
    status: "succeeded" | "failed" | "stopped";
    elapsed_time: number;
    total_tokens: number;
    error?: string;
  };
}

async function runDifyWorkflow(
  input: DifyWorkflowInput
): Promise<DifyWorkflowOutput> {
  const res = await fetch("https://api.dify.ai/v1/workflows/run", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DIFY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Dify API error: ${err.message}`);
  }

  return res.json();
}

// 使用例
const result = await runDifyWorkflow({
  inputs: { customer_email: rawEmail },
  response_mode: "blocking",
  user: "system-job",
});

const category = result.data.outputs.category as string;
```

### Streaming レスポンス（SSE）

```typescript
// Server-Sent Events でリアルタイム表示

async function streamDifyChat(
  query: string,
  conversationId: string | null,
  onChunk: (text: string) => void
): Promise<string> {
  const res = await fetch("https://api.dify.ai/v1/chat-messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DIFY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      conversation_id: conversationId ?? "",
      response_mode: "streaming",
      user: "web-client",
    }),
  });

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let fullAnswer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

    for (const line of lines) {
      const data = JSON.parse(line.slice(6));
      if (data.event === "message") {
        onChunk(data.answer);
        fullAnswer += data.answer;
      }
    }
  }

  return fullAnswer;
}
```

### Python での実装

```python
import os
import httpx
from typing import Generator

DIFY_API_KEY = os.environ["DIFY_API_KEY"]
DIFY_BASE_URL = "https://api.dify.ai"

def run_workflow(inputs: dict, user: str = "system") -> dict:
    """ワークフローを同期実行して結果を返す"""
    with httpx.Client(timeout=120) as client:
        res = client.post(
            f"{DIFY_BASE_URL}/v1/workflows/run",
            headers={"Authorization": f"Bearer {DIFY_API_KEY}"},
            json={
                "inputs": inputs,
                "response_mode": "blocking",
                "user": user,
            },
        )
        res.raise_for_status()
        return res.json()["data"]["outputs"]


def stream_chat(query: str, conversation_id: str = "") -> Generator[str, None, None]:
    """チャットをストリーミングで返すジェネレーター"""
    with httpx.stream(
        "POST",
        f"{DIFY_BASE_URL}/v1/chat-messages",
        headers={"Authorization": f"Bearer {DIFY_API_KEY}"},
        json={
            "query": query,
            "conversation_id": conversation_id,
            "response_mode": "streaming",
            "user": "web-client",
        },
        timeout=300,
    ) as res:
        for line in res.iter_lines():
            if line.startswith("data: "):
                import json
                data = json.loads(line[6:])
                if data.get("event") == "message":
                    yield data["answer"]
```

---

## Webhook 受信の実装

```typescript
// Next.js API Route での Dify Webhook 受信

// app/api/dify-webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  // 署名検証（改ざん防止）
  const signature = req.headers.get("x-dify-signature");
  const body = await req.text();
  const expected = crypto
    .createHmac("sha256", process.env.DIFY_WEBHOOK_SECRET!)
    .update(body)
    .digest("hex");

  if (signature !== `sha256=${expected}`) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(body);

  // ワークフロー完了イベントの処理
  if (payload.event === "workflow_finished") {
    const outputs = payload.data.outputs;
    await saveToDatabase(outputs);
    await notifySlack(outputs.summary);
  }

  return NextResponse.json({ received: true });
}
```

---

## DSL のバージョン管理

```bash
# Dify のワークフローを DSL（YAML）でエクスポート

# エクスポート（Dify 管理画面 → アプリ設定 → エクスポート）
# または API 経由:
curl -H "Authorization: Bearer $DIFY_API_KEY" \
  https://api.dify.ai/v1/apps/{app_id}/export \
  -o workflows/customer-support-v1.2.yml

# Git で管理
git add workflows/
git commit -m "feat: customer-support にエスカレーションフロー追加"

# ディレクトリ構成例
workflows/
  customer-support/
    v1.0.yml    ← 初期版
    v1.1.yml    ← FAQ 追加
    v1.2.yml    ← エスカレーション追加（現在）
  email-analyzer/
    v1.0.yml
  knowledge/
    company-faq.json    ← ナレッジのメタデータ
```

---

## プロンプトの CI/CD テスト

### テストスクリプト（Python）

```python
# tests/test_prompts.py
import pytest
import json
from dify_client import run_workflow  # 上記の関数

# テストケース定義
TEST_CASES = [
    {
        "input": {"email": "注文した商品が届きません。注文番号は12345です。"},
        "expected_category": "配送問題",
        "expected_priority": "high",
    },
    {
        "input": {"email": "返品したいのですが、どうすればいいですか？"},
        "expected_category": "返品・交換",
        "expected_priority": "medium",
    },
    {
        "input": {"email": "領収書の発行をお願いしたいです"},
        "expected_category": "請求・領収書",
        "expected_priority": "low",
    },
]

@pytest.mark.parametrize("case", TEST_CASES)
def test_email_classification(case):
    result = run_workflow(case["input"])

    assert result["category"] == case["expected_category"], (
        f"Expected category '{case['expected_category']}', "
        f"got '{result['category']}'"
    )
    assert result["priority"] == case["expected_priority"]

def test_empty_input_returns_fallback():
    """空入力でもエラーにならないことを確認"""
    result = run_workflow({"email": ""})
    assert result.get("error") is not None or result.get("category") == "不明"
```

### GitHub Actions CI

```yaml
# .github/workflows/dify-prompt-test.yml

name: Dify Prompt Tests

on:
  push:
    paths:
      - "workflows/**"   # DSL が変更されたときに実行
  pull_request:
    paths:
      - "workflows/**"

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install dependencies
        run: pip install pytest httpx

      - name: Run prompt tests
        env:
          DIFY_API_KEY: ${{ secrets.DIFY_API_KEY }}
        run: pytest tests/test_prompts.py -v

      - name: Comment on PR with test results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              body: "✅ Dify プロンプトテスト: 全ケース通過"
            });
```

---

## 既存システムへの組み込みパターン

### バックエンドサービスからの非同期呼び出し

```python
# FastAPI + Celery での非同期処理例

from celery import Celery
from dify_client import run_workflow

celery_app = Celery("tasks", broker="redis://localhost:6379/0")

@celery_app.task
def analyze_document_async(document_id: str, text: str) -> None:
    """バックグラウンドで文書分析を実行"""
    result = run_workflow(
        inputs={"document": text},
        user=f"batch-job-{document_id}"
    )
    # 結果を DB に保存
    save_analysis_result(document_id, result)
    # 完了通知
    notify_user(document_id)

# API エンドポイントからタスクをキューに投げる
@app.post("/analyze")
async def analyze(doc_id: str, text: str):
    task = analyze_document_async.delay(doc_id, text)
    return {"task_id": task.id, "status": "processing"}
```

### フロントエンドへの埋め込み（React）

```tsx
// components/DifyChat.tsx

import { useState, useCallback } from "react";

export function DifyChat() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (query: string) => {
    setIsLoading(true);
    let assistantMessage = "";

    setMessages((prev) => [
      ...prev,
      { role: "user", content: query },
      { role: "assistant", content: "" },
    ]);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, conversationId }),
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      // SSE パース...
      assistantMessage += chunk;
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1].content = assistantMessage;
        return updated;
      });
    }

    setIsLoading(false);
  }, [conversationId]);

  return (/* JSX */);
}
```

---

## 参考：関連ドキュメント

- [Dify API・公開・デプロイ](concepts_dify_api_deployment.md) — API 全エンドポイント一覧
- [Difyセルフホスト本番構成ガイド](concepts_dify_selfhost_production.md) — インフラ設計
- [可観測性・デバッグ・評価](concepts_dify_observability.md) — トレーシング・ログ
- [Dify×n8n連携ガイド](concepts_dify_integration_n8n.md) — 外部サービスとのオーケストレーション
