---
title: キャッシュ戦略とRedis設計
description: Cache-Aside・Write-Through・Write-Behindの使い分けとキャッシュ無効化問題。Redisのデータ構造選択とよくある落とし穴を整理する
category: "概念"
tags: ["データ設計", "キャッシュ", "Redis", "スケーラビリティ", "パフォーマンス", "DDIA"]
emoji: "⚡"
date: "2026-04-07"
order: 819
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017) / Redis Documentation"
---

## 定義

**キャッシュ**：計算コストや取得コストの高いデータを高速な記憶領域に一時保存し、同じリクエストへの応答を速くする仕組み。

「キャッシュは速い」という認識は正しいが、「どこで整合性が崩れるか」を知らないまま使うとデータ不整合のバグを生む。

## キャッシュを使う理由

```
問題: DBへの全クエリが同じコストとは限らない

重いクエリ:
  - 複雑なJOINと集計（数百ms）
  - 外部APIの結果（ネットワーク往復）
  - 機械学習モデルの推論結果

軽いクエリなのに詰まる理由:
  - 同じ行を1秒間に1000回読む（ホットスポット）
  - DBコネクション数の上限
```

## 3つのキャッシュ戦略

### Cache-Aside（Look-Aside）

アプリが自分でキャッシュを管理する最も一般的なパターン。

```
読み取り:
  1. Redisを確認 → ヒットしたらそのまま返す（Cache Hit）
  2. ミスしたらDBから取得（Cache Miss）
  3. 取得したデータをRedisに書いてから返す

書き込み:
  1. DBに書く
  2. Redisの対応キーを削除（または更新）
```

```typescript
async function getUser(userId: string): Promise<User> {
  const cached = await redis.get(`user:${userId}`);
  if (cached) return JSON.parse(cached);

  const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  // TTLを設定して古いデータが残り続けないようにする
  await redis.setex(`user:${userId}`, 3600, JSON.stringify(user));
  return user;
}

async function updateUser(userId: string, data: Partial<User>) {
  await db.query('UPDATE users SET ... WHERE id = $1', [userId]);
  // 更新後はキャッシュを削除（次の読み取りでDBから再取得される）
  await redis.del(`user:${userId}`);
}
```

**メリット**：DBが落ちていてもキャッシュから返せる。読み取り多い場合に最適。  
**注意**：書き込み後のキャッシュ削除を忘れると古いデータを返し続ける。

### Write-Through

書き込み時にキャッシュとDBを同時に更新する。

```
書き込み:
  1. キャッシュに書く
  2. DBに書く（同期的に）
  → 常にキャッシュとDBが一致している

読み取り:
  キャッシュにあれば返す（必ずある）
```

**メリット**：読み取り時に常にキャッシュヒット。データの一貫性が高い。  
**デメリット**：書き込みが2箇所に発生してレイテンシが上がる。めったに読まれないデータもキャッシュに入る（無駄）。

### Write-Behind（Write-Back）

まずキャッシュに書き、DBへの反映を非同期で行う。

```
書き込み:
  1. キャッシュに書く → 即座にクライアントに応答
  2. バックグラウンドでDBに非同期書き込み

読み取り:
  キャッシュから返す
```

**メリット**：書き込みが非常に速い。バーストトラフィックに強い。  
**デメリット**：DBに書く前にキャッシュが落ちたらデータロス。実装が複雑。ゲームのスコアや閲覧数カウントに使われる。

## キャッシュ無効化問題

> "There are only two hard things in Computer Science: cache invalidation and naming things." — Phil Karlton

### ダブルデリートパターン（Cache-Asideの競合対策）

```
問題のあるシナリオ:
  Thread A: DBを読む（古い値）
  Thread B: DBを更新 → キャッシュを削除
  Thread A: 古い値をキャッシュに書く ← 古いデータが残る！

対策（Delay Double Delete）:
  1. キャッシュを削除
  2. DBを更新
  3. 少し待つ（200ms）
  4. もう一度キャッシュを削除
  
  → 厳密には解決しないが、ウィンドウを縮小できる

より確実な対策:
  書き込み時は「更新」ではなく「削除」を使う
  （古い値で上書きするリスクを避ける）
```

### TTL（Time-To-Live）の設計

```
短すぎるTTL: キャッシュミスが多発 → DBの負荷が減らない
長すぎるTTL: 古いデータが長期間残る → 整合性の問題

ガイドライン:
  変わらないデータ（マスタ）: 1時間〜24時間
  変わりうるデータ（ユーザー情報）: 5〜60分
  リアルタイム性が必要なデータ: キャッシュしない or 数秒
```

## Redisのデータ構造の選択

| 型 | コマンド例 | 用途 |
|---|---|---|
| String | GET/SET | JSONシリアライズ、カウンター |
| Hash | HGET/HSET | オブジェクトのフィールド管理 |
| List | LPUSH/RPOP | キュー、最新N件 |
| Set | SADD/SMEMBERS | ユニーク集合、タグ |
| Sorted Set | ZADD/ZRANGE | ランキング、スコア付きデータ |
| Bitmap | SETBIT/BITCOUNT | 日次アクティブユーザー数 |
| HyperLogLog | PFADD/PFCOUNT | 近似カーディナリティ |
| Stream | XADD/XREAD | イベントログ（Kafka的用途） |

```typescript
// Sorted Set でランキング
await redis.zadd('leaderboard', score, userId);
const top10 = await redis.zrevrange('leaderboard', 0, 9, 'WITHSCORES');

// Bitmap で日次アクティブユーザー
const today = new Date().toISOString().split('T')[0];
await redis.setbit(`dau:${today}`, userId, 1);
const dauCount = await redis.bitcount(`dau:${today}`);

// HyperLogLog でユニーク訪問者数（誤差0.81%、メモリ12KB固定）
await redis.pfadd('unique_visitors', visitorId);
const approxCount = await redis.pfcount('unique_visitors');
```

## よくある落とし穴

### キャッシュスタンピード（Thundering Herd）

```
問題:
  人気データのTTLが切れた瞬間、大量リクエストが同時にDBに殺到

対策1: Probabilistic Early Expiration
  TTL切れ前に確率的に再計算を始める

対策2: Mutex（ロック）
  最初の1リクエストだけDBに問い合わせ、他は待たせる

対策3: 非同期リフレッシュ
  TTL切れでも古い値を返しつつ、バックグラウンドで更新
```

### ホットキー問題

```
1つのRedisキーに過剰なリクエストが集中:
  芸能人のプロフィール、セール中の商品情報

対策: キーをシャーディング
  user:12345_shard_0 〜 user:12345_shard_9
  読み取り時にランダムなシャードを選ぶ
  書き込み時は全シャードを更新
```

### キャッシュペネトレーション（存在しないキーへの攻撃）

```
問題:
  存在しないIDを大量にリクエスト → キャッシュミスが続発 → DBに到達

対策1: Null値もキャッシュする（短いTTLで）
対策2: ブルームフィルターで存在確認
  → DBに行く前にブルームフィルターでIDの存在を確認
  → 存在しないなら即404を返す（DBアクセスなし）
```

## RedisとDB間の一貫性レベル

```
強い一貫性が必要:
  → キャッシュを使わない or 書き込み時にRedisとDBをトランザクションで更新

最終的一貫性で十分:
  → Cache-Aside + 適切なTTL

結果整合で許容できる例:
  SNSのフォロワー数（数秒遅れていい）
  商品の閲覧数（正確な数より速さが重要）
  ユーザープロフィール（数分の遅延は許容）
```

## 関連概念

- → [レプリケーション](./concepts_ddia_replication.md)（Redisのレプリケーション構成）
- → [データシステムの統合設計](./concepts_ddia_future.md)（派生データとしてのキャッシュ）
- → [トランザクション](./concepts_ddia_transactions.md)（DBとキャッシュの二重書き込み整合性）
- → [分散システムの問題](./concepts_ddia_distributed_problems.md)（ネットワーク障害時のキャッシュ動作）

## 出典・参考文献

- Redis Documentation — redis.io/docs
- Martin Kleppmann, *Designing Data-Intensive Applications* (2017) Chapter 1, 5
- AWS, "Caching Best Practices" — aws.amazon.com/caching/best-practices
