---
title: バックプレッシャーとサーキットブレーカー
description: システムが過負荷になったとき何が起きるか。バックプレッシャーによるフロー制御、Circuit BreakerとBulkheadパターンで障害の連鎖を防ぐ設計を理解する
category: "概念"
tags: ["データ設計", "バックプレッシャー", "サーキットブレーカー", "信頼性", "分散システム", "DDIA"]
emoji: "🔋"
date: "2026-04-08"
order: 833
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017) Chapter 1, 11"
---

## 定義

**バックプレッシャー（Backpressure）**：処理できる速度を超えたリクエストが来たとき、上流に「遅くしてほしい」というシグナルを伝える仕組み。バッファが無限ではないため、何もしなければメモリ枯渇やレイテンシ無限増大が起きる。

**サーキットブレーカー（Circuit Breaker）**：依存するサービスが不健全なとき、早期に失敗を返してシステム全体の崩壊を防ぐパターン。電気回路のブレーカーに例えた名前。

## バックプレッシャーなしの問題

```
Producerが1000件/秒でKafkaにメッセージを送る
Consumerが100件/秒しか処理できない

何も制御しない場合:
  1. Kafkaのキューが積み上がる（ラグが増大）
  2. Consumerがどんどん遅れる
  3. DBへのクエリが積み上がる
  4. DBコネクションプールが枯渇
  5. 全リクエストがタイムアウト → カスケード障害
```

## バックプレッシャーの実装

### プルベースのバックプレッシャー

ConsumerがProducerから「自分が処理できる分だけ」取得する。

```
Kafkaの場合:
  ConsumerはPollでメッセージを引き取る（Pushではない）
  max.poll.records で1回に取得する件数を制御
  処理が遅ければPollingが減る → 自然にバックプレッシャーになる

HTTPの場合:
  Streaming APIで1件ずつ受け取る
  → サーバーはクライアントが受け取るまで次を送らない（TCP流量制御）
```

### キューの深さ制限

```typescript
// 有界キュー（Bounded Queue）でバックプレッシャー
import { Queue } from 'bull';

const queue = new Queue('email', {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  },
  settings: {
    maxStalledCount: 1,
  },
});

// キューが満杯ならエラーを返す（積み込みすぎない）
async function enqueueEmail(data: EmailData) {
  const waiting = await queue.getWaitingCount();
  if (waiting > 10000) {
    throw new Error('Queue is full, please try later');
    // → 503 Service Unavailable をクライアントに返す
  }
  await queue.add(data);
}
```

### レート制限（Rate Limiting）

```typescript
import Bottleneck from 'bottleneck';

// 外部APIへのリクエストを制限
const limiter = new Bottleneck({
  maxConcurrent: 5,     // 同時実行数
  minTime: 100,         // リクエスト間の最小間隔（ms）
  reservoir: 100,       // トークンバケット: 100リクエスト/秒
  reservoirRefreshAmount: 100,
  reservoirRefreshInterval: 1000,
});

const result = await limiter.schedule(() => externalApi.call());
```

## サーキットブレーカーパターン

```
3つの状態:
  Closed（通常）: リクエストを通す。エラー率を監視
  Open（遮断）:  エラー率が閾値超え → 即座に失敗を返す（DBにアクセスしない）
  Half-Open（半開）: 一定時間後に試験的にリクエストを通す

状態遷移:
  Closed → Open:     エラー率が閾値（例: 50%）を超えた
  Open → Half-Open:  タイムアウト（例: 30秒）後
  Half-Open → Closed: 試験リクエストが成功
  Half-Open → Open:  試験リクエストが失敗
```

```typescript
import CircuitBreaker from 'opossum';

const options = {
  timeout: 3000,          // 3秒でタイムアウト
  errorThresholdPercentage: 50,  // エラー率50%でOpen
  resetTimeout: 30000,    // 30秒後にHalf-Openに移行
};

const breaker = new CircuitBreaker(callDatabase, options);

breaker.on('open', () => {
  console.log('Circuit breaker OPEN: DB calls blocked');
  metrics.increment('circuit_breaker.open');
});

breaker.on('halfOpen', () => {
  console.log('Circuit breaker HALF-OPEN: testing...');
});

breaker.on('close', () => {
  console.log('Circuit breaker CLOSED: normal operation');
});

// フォールバックを定義
breaker.fallback(() => getCachedData());  // キャッシュから返す

const result = await breaker.fire(queryId);
```

## Bulkheadパターン

船の隔壁（Bulkhead）から来た名前。一部が浸水しても他の区画が影響を受けない設計。

```
問題:
  APIサーバーが外部サービスA, B, Cを呼ぶ
  サービスAが遅くなる → スレッドが詰まる
  → サービスB, Cへのリクエストも詰まる（共有スレッドプール）
  → サービス全体が応答不能に

Bulkhead:
  サービスA用スレッドプール: 20スレッド
  サービスB用スレッドプール: 20スレッド
  サービスC用スレッドプール: 10スレッド
  
  Aが詰まっても B, C のプールは影響を受けない
```

```typescript
// DBのコネクションプールを用途別に分ける
const oltp_pool = new Pool({ max: 20 }); // トランザクション用
const olap_pool = new Pool({ max: 5  }); // 分析クエリ用（長時間クエリが詰まっても本線に影響しない）
const background_pool = new Pool({ max: 3 }); // バックグラウンドジョブ用
```

## カスケード障害のパターン

```
依存関係:
  API → 注文サービス → 在庫サービス → DB

在庫DBが遅くなる:
  1. 在庫サービスのスレッドが詰まる（タイムアウト待ち）
  2. 注文サービスが在庫サービスを待つスレッドが詰まる
  3. APIが注文サービスを待つリクエストが詰まる
  4. 全体が応答不能に（カスケード障害）

防止策:
  - 各層でタイムアウトを設定（無限に待たない）
  - サーキットブレーカーで障害を隔離
  - Bulkheadでリソースを分離
  - キャッシュでフォールバック
```

## リトライとジッター

```typescript
// ❌ 単純なリトライ（サンダーリングハード問題）
async function retry(fn, times) {
  for (let i = 0; i < times; i++) {
    try { return await fn(); }
    catch { await sleep(1000); }  // 全クライアントが同時にリトライ → 同時スパイク
  }
}

// ✅ 指数バックオフ + ジッター（ランダム分散）
async function retryWithJitter(fn, maxAttempts = 3) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxAttempts - 1) throw err;
      const base = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      const jitter = Math.random() * base; // ランダムに分散
      await sleep(base + jitter);
    }
  }
}
```

## ストリーム処理でのバックプレッシャー

[ストリーム処理](./concepts_ddia_stream_processing.md)でもバックプレッシャーは重要なテーマ。

```
Project Reactor / RxJS のバックプレッシャー:
  Publisher（データ生成）
    ↓ request(N)
  Subscriber（処理できる量だけリクエスト）

Kafka Streams:
  Consumer Lag = Producerがどれだけ先行しているか
  Lagが増大 → ConsumerのCPU・メモリを増やすか、Producer側を制限する
```

## 観測指標

```
監視すべき指標:
  - キューの深さ（増え続けていないか）
  - Consumer Lag（Kafkaのラグ）
  - Circuit BreakerのOpen状態の回数・時間
  - スレッドプールの利用率
  - タイムアウトの発生率
  - p99レイテンシ（平均より外れ値が重要）
```

## 関連概念

- → [分散システムの問題](./concepts_ddia_distributed_problems.md)（タイムアウトの難しさ）
- → [ストリーム処理](./concepts_ddia_stream_processing.md)（Kafkaのバックプレッシャー）
- → [コネクションプーリング](./concepts_ddia_connection_pooling.md)（Bulkheadとプールの設計）
- → [キャッシュ戦略](./concepts_ddia_cache_strategy.md)（サーキットブレーカーのフォールバック）

## 出典・参考文献

- Martin Fowler, "CircuitBreaker" — martinfowler.com/bliki/CircuitBreaker.html
- Michael Nygard, *Release It!* (2018) — Stability Patterns
- Martin Kleppmann, *Designing Data-Intensive Applications* (2017) Chapter 1, 11
- Reactive Streams Specification — reactive-streams.org
