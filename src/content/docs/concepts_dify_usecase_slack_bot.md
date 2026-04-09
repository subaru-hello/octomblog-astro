---
category: "概念"
order: 115
title: Slack社内ナレッジボット（Dify実践）
description: 社内のSlackから直接質問できるナレッジボットをDify + Slack Webhook連携で構築する。エンジニア・非エンジニア問わず使える社内AIの実践例。
tags: ["Dify", "Slack", "社内ボット", "ナレッジ管理", "業務自動化", "ユースケース"]
emoji: "💬"
date: "2026-04-09"
source: "Dify公式ドキュメント / community articles"
series:
  - Difyユースケース
---

## シナリオ概要

**課題**: 社内の質問が特定の人（シニアエンジニア・ベテラン社員）に集中する。「DBの接続設定は？」「オンコール対応手順は？」という質問が毎日 Slack に来て、その人の集中力が奪われる。

**解決策**: Dify のナレッジベース（社内 Wiki・ runbook・FAQ）を Slack と接続。@botname で質問すると自動で回答する。

```
Slackでの会話:

@知識ボット デプロイ手順を教えて

ボット（3秒後）:
  デプロイ手順です:
  1. main ブランチへの PR をマージ
  2. GitHub Actions が自動的に staging へデプロイ
  3. staging で動作確認後、手動承認でproductionへ
  
  詳細: https://notion.so/deploy-guide
  （出典: Runbook v2.3）
```

---

## 使用する Dify 機能

| 機能 | 役割 |
|---|---|
| [ナレッジベース・RAG](concepts_dify_knowledge_rag.md) | 社内ドキュメントの検索 |
| [API・デプロイ](concepts_dify_api_deployment.md) | Webhook で Slack と接続 |
| [ツール・プラグイン](concepts_dify_tools_plugins.md) | Slack プラグイン |
| [概要・アプリ種別](concepts_dify_overview.md) | Chatflow で文脈を保持 |

---

## アーキテクチャ

```
[Slack: ユーザーが @ボット に質問]
  │ Slack Event API（app_mention イベント）
  ▼
[中継サーバー（Node.js / Cloud Functions）]
  │ Slack の署名検証（3秒以内にHTTP 200を返す）
  │ 非同期で Dify API を呼び出す
  ▼
[Dify: Chatflow（RAG + LLM）]
  │ ナレッジベース検索 → LLM で回答生成
  ▼
[中継サーバー: Slack API で返信投稿]
  │ chat.postMessage（スレッド返信）
  ▼
[Slack: スレッドに回答が届く]
```

### なぜ中継サーバーが必要か

```
Slack Event API の制約:
  - アプリは3秒以内に HTTP 200 を返さないといけない
  - Dify の LLM 処理は3〜30秒かかる
  → 直接繋げると Slack 側でタイムアウトしてしまう

解決策:
  1. Slack からイベントを受信 → 即座に 200 を返す
  2. バックグラウンドで Dify API を呼び出す
  3. 回答ができたら Slack の chat.postMessage で返信
```

---

## 中継サーバーの実装例（Node.js）

```javascript
const { App } = require('@slack/bolt');
const axios = require('axios');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,  // Socket Mode で簡単に始める
  appToken: process.env.SLACK_APP_TOKEN,
});

// @ボット にメンションされたとき
app.event('app_mention', async ({ event, client }) => {
  const userQuestion = event.text.replace(/<@[^>]+>\s*/g, '');
  const channelId = event.channel;
  const threadTs = event.thread_ts || event.ts;

  // 「考え中...」の反応（UX向上）
  await client.reactions.add({
    channel: channelId,
    timestamp: event.ts,
    name: 'hourglass_flowing_sand'
  });

  try {
    // Dify Chat API を呼び出す
    const response = await axios.post(
      'https://api.dify.ai/v1/chat-messages',
      {
        query: userQuestion,
        inputs: {},
        response_mode: 'blocking',
        conversation_id: '',  // 新規会話（スレッドIDで管理も可能）
        user: event.user
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DIFY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const answer = response.data.answer;

    // スレッドに返信
    await client.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
      text: answer
    });

    // 「考え中...」リアクションを外す
    await client.reactions.remove({
      channel: channelId,
      timestamp: event.ts,
      name: 'hourglass_flowing_sand'
    });

  } catch (error) {
    await client.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
      text: 'エラーが発生しました。しばらくしてもう一度お試しください。'
    });
  }
});

(async () => { await app.start(); })();
```

---

## ナレッジベースの設計

### 登録する文書の種類

```
エンジニアチーム向け:
  - Runbook（インシデント対応手順）
  - アーキテクチャ設計ドキュメント
  - API リファレンス（内部）
  - オンボーディングガイド
  - CI/CD・デプロイメント手順

全社員向け:
  - 社内規定・就業規則
  - 福利厚生・手続きガイド
  - 製品・サービスFAQ
  - 組織情報・連絡先
```

### Notion との連携

```
Notion を社内 Wiki として使っている場合:

Dify のナレッジベース → Notion 統合
  → Notion ページを URL で登録
  → 定期的に自動再インデックス

新しいページを Notion に書いたら
→ 翌日には Slack ボットが答えられるようになる
```

---

## スレッド単位での会話継続

同じスレッド内での続き質問に対応する。

```javascript
// スレッドIDを conversation_id として使う
// → 同スレッド内の会話を記憶できる

const conversationMap = new Map();  // スレッドTS → Dify conversation_id

app.event('app_mention', async ({ event, client }) => {
  const threadTs = event.thread_ts || event.ts;
  
  // 既存の会話IDを取得（なければ新規）
  const conversationId = conversationMap.get(threadTs) || '';
  
  const response = await axios.post('/v1/chat-messages', {
    query: userQuestion,
    conversation_id: conversationId,  // 継続
    user: event.user
  });
  
  // 会話IDを保存（次の返信に使う）
  conversationMap.set(threadTs, response.data.conversation_id);
});
```

---

## 発展：Slack コマンドとの統合

```
/ask コマンドで質問:
  /ask デプロイ手順を教えて

/feedback コマンドで回答品質を報告:
  /feedback 良い   → Dify のアノテーションに記録
  /feedback 悪い   → 改善が必要な回答としてフラグ

→ Dify の Logs に自動記録 → プロンプト改善に活用
```

---

## セキュリティ考慮事項

```
1. チャンネル制限
   → 特定チャンネルからの質問のみ受け付ける
   → 機密チャンネルでの使用は別のナレッジベース

2. ユーザー認証
   → Slack の user ID を Dify の user パラメータに渡す
   → 誰が何を質問したかをログで追跡可能

3. 機密情報の取り扱い
   → 「パスワード・秘密鍵を教えて」系の質問には答えない
   → プロンプトで禁止事項を明示

4. API キーの管理
   → Dify API Key と Slack Token は環境変数で管理
   → ローテーションを定期的に行う
```

---

## 参考：他のユースケース

- [RAGチャットボット構築](concepts_dify_usecase_rag_chatbot.md) — Slack なしのシンプルな RAG ボット
- [マルチエージェントオーケストレーション](concepts_dify_usecase_multi_agent.md) — より高度な社内 AI エージェント
