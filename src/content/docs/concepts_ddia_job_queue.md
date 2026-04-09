---
title: ジョブキューの設計
description: バックグラウンドジョブをどのシステムで処理するか。BullMQ・Sidekiq・pg_queueとKafkaの使い分け、リトライ戦略・デッドレターキュー・ジョブの冪等性設計を理解する
category: "概念"
tags: ["データ設計", "ジョブキュー", "BullMQ", "非同期処理", "マイクロサービス", "DDIA"]
emoji: "📬"
date: "2026-04-08"
order: 842
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017) Chapter 11"
---

## 定義

**ジョブキュー**：時間のかかる処理やリトライが必要な処理をバックグラウンドで非同期に実行するシステム。HTTPリクエストのタイムアウト内に完了しない処理を切り離す。

## なぜジョブキューが必要か

```
問題: 重い処理をHTTPレスポンス内でやろうとする
  POST /orders → 在庫確認 + 決済処理 + メール送信 + PDF生成
  → タイムアウト（30秒）
  → ユーザーは失敗と思う
  → 実は途中まで処理されている

解決: 重い処理をジョブキューに委譲
  POST /orders → キューにジョブを積む → 202 Accepted を即座に返す
  バックグラウンドワーカーが処理
```

## ジョブキュー vs Kafka の使い分け

```
ジョブキュー（BullMQ, Sidekiq等）:
  タスク指向: 「このジョブを誰かが処理すること」が目的
  At-most-once or at-least-once
  失敗時のリトライが組み込み
  デッドレターキューで失敗ジョブを管理
  適した用途: メール送信、PDF生成、外部API呼び出し

Kafka:
  イベント指向: 「何が起きたか」を記録することが目的
  複数のConsumerが同じイベントを処理できる
  イベントのリプレイが可能（Kafkaのログ保持期間内）
  適した用途: サービス間の非同期通信、イベントドリブン
```

## BullMQ（Redis ベース、Node.js）

```typescript
import { Queue, Worker, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';

const connection = new Redis({ host: 'redis', port: 6379 });

// キューの作成
const emailQueue = new Queue('email', { connection });

// ジョブの追加
await emailQueue.add(
  'send-welcome-email',
  { userId: '123', email: 'alice@example.com' },
  {
    attempts: 3,                    // 最大3回リトライ
    backoff: {
      type: 'exponential',
      delay: 1000,                  // 1s, 2s, 4s とバックオフ
    },
    removeOnComplete: { count: 100 }, // 成功ジョブは100件保持
    removeOnFail: false,             // 失敗ジョブは残す（調査用）
  }
);

// ワーカーの定義
const worker = new Worker('email', async (job) => {
  const { userId, email } = job.data;
  
  // 進捗の更新
  await job.updateProgress(10);
  
  await sendEmail({ to: email, subject: 'ようこそ' });
  
  await job.updateProgress(100);
  return { sent: true, at: new Date().toISOString() };
}, { connection, concurrency: 5 });  // 同時5ジョブまで

// エラーハンドリング
worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
  // Slackに通知、Sentryに送信など
});
```

### ジョブの優先度

```typescript
// 優先度付きキュー
await emailQueue.add('urgent-notification', data, { priority: 1 });  // 高優先
await emailQueue.add('newsletter', data, { priority: 10 });          // 低優先
// 数字が小さいほど高優先度
```

### スケジュールジョブ（Cron）

```typescript
// 毎日午前8時に実行
await emailQueue.add(
  'daily-digest',
  {},
  {
    repeat: { cron: '0 8 * * *', tz: 'Asia/Tokyo' },
  }
);
```

## PostgreSQLをキューとして使う（pg_queue / SKIP LOCKED）

外部ツールなしにPostgreSQLだけでジョブキューを実装できる。

```sql
-- ジョブテーブル
CREATE TABLE jobs (
  id BIGSERIAL PRIMARY KEY,
  queue VARCHAR(100) NOT NULL DEFAULT 'default',
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  run_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON jobs (queue, status, scheduled_at)
  WHERE status = 'pending';
```

```typescript
// ワーカー: ジョブをデキューして処理
async function processJob() {
  const result = await db.query(`
    UPDATE jobs
    SET status = 'running', run_at = NOW(), attempts = attempts + 1
    WHERE id = (
      SELECT id FROM jobs
      WHERE status = 'pending'
        AND queue = $1
        AND scheduled_at <= NOW()
      ORDER BY scheduled_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED  -- 並列ワーカーの競合を防ぐ
    )
    RETURNING *
  `, ['email']);

  if (!result.rows[0]) return; // ジョブなし

  const job = result.rows[0];
  try {
    await processEmailJob(job.payload);
    await db.query("UPDATE jobs SET status = 'completed' WHERE id = $1", [job.id]);
  } catch (err) {
    if (job.attempts >= job.max_attempts) {
      // デッドレターキューへ
      await db.query(
        "UPDATE jobs SET status = 'failed', error_message = $2 WHERE id = $1",
        [job.id, err.message]
      );
    } else {
      // リトライスケジュール（指数バックオフ）
      const delay = Math.pow(2, job.attempts) * 60; // 秒
      await db.query(
        "UPDATE jobs SET status = 'pending', scheduled_at = NOW() + $2 * INTERVAL '1 second' WHERE id = $1",
        [job.id, delay]
      );
    }
  }
}
```

**pgqueue / Que / GoodJob**：Rubyエコシステムではこのパターンが多く使われる。Outboxパターンとの組み合わせで整合性を保てる利点がある。

## デッドレターキュー（DLQ）

```typescript
// 最大リトライ数を超えたジョブをDLQに移動
const dlq = new Queue('email:dead-letter', { connection });

worker.on('failed', async (job, err) => {
  if (job && job.attemptsMade >= job.opts.attempts!) {
    // DLQに移動（調査・手動リトライのため保持）
    await dlq.add(job.name, {
      originalJob: job.data,
      error: err.message,
      failedAt: new Date().toISOString(),
    });
  }
});

// DLQの監視と手動リトライ
const dlqJobs = await dlq.getJobs(['waiting']);
for (const job of dlqJobs) {
  // 調査後に手動でリトライ
  await emailQueue.add(job.name, job.data.originalJob);
  await job.remove();
}
```

## ジョブの冪等性設計

ジョブが複数回実行されても同じ結果になるよう設計する（at-least-once配信に対応）。

```typescript
async function sendWelcomeEmail(job: Job) {
  const { userId } = job.data;

  // 冪等性チェック: すでに送信済みか確認
  const alreadySent = await db.query(
    'SELECT 1 FROM email_log WHERE user_id = $1 AND type = $2',
    [userId, 'welcome']
  );
  if (alreadySent.rows.length > 0) {
    console.log(`Welcome email already sent to user ${userId}, skipping`);
    return;
  }

  await emailService.send({ to: user.email, subject: 'ようこそ' });

  // 送信記録（冪等性のため）
  await db.query(
    'INSERT INTO email_log (user_id, type, sent_at) VALUES ($1, $2, NOW())',
    [userId, 'welcome']
  );
}
```

## ジョブキューの選択指針

| システム | 適した用途 | 特徴 |
|---|---|---|
| BullMQ（Node.js） | Node.jsサービスの非同期処理 | Redis必要、豊富な機能 |
| Celery（Python） | Pythonサービスの非同期処理 | Redis/RabbitMQ対応 |
| Sidekiq（Ruby） | Railsアプリ | Redis、スレッドベース |
| GoodJob / Que（Ruby） | Railsアプリ | PostgreSQLのみ、シンプル |
| PostgreSQL SKIP LOCKED | 小〜中規模 | 追加インフラ不要 |
| Kafka | サービス間イベント | 高スループット、リプレイ可能 |
| AWS SQS / Cloud Tasks | クラウドマネージド | インフラ管理不要 |

```
判断基準:
  追加インフラを持ちたくない → PostgreSQL SKIP LOCKED
  Node.jsで豊富な機能が必要 → BullMQ
  サービス間の非同期通信 → Kafka
  クラウドネイティブ → SQS / Cloud Tasks
  高スループット(>10万件/秒) → Kafka
```

## 関連概念

- → [Outboxパターン](./concepts_ddia_outbox_pattern.md)（ジョブとイベント発行の整合性）
- → [バックプレッシャー](./concepts_ddia_backpressure.md)（キューが詰まったときの制御）
- → [Sagaパターン](./concepts_ddia_sagas.md)（ジョブキューで実装するSaga）
- → [ストリーム処理](./concepts_ddia_stream_processing.md)（Kafkaとの使い分け）

## 出典・参考文献

- BullMQ Documentation — docs.bullmq.io
- Martin Kleppmann, *Designing Data-Intensive Applications* (2017) Chapter 11
- Brandur Leach, "Reliable Database-Backed Job Queues" — brandur.org
