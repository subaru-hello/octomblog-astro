---
title: Sagaパターンと分散トランザクション
description: マイクロサービス間にまたがるトランザクションを2PCなしで実現するSagaパターン。コレオグラフィとオーケストレーションの2方式と、補償トランザクションの設計を理解する
category: "概念"
tags: ["データ設計", "分散システム", "Saga", "マイクロサービス", "トランザクション", "DDIA"]
emoji: "🔗"
date: "2026-04-07"
order: 812
series:
  - データ志向アプリケーション設計（DDIA）
source: "Chris Richardson, 'Microservices Patterns' (2018) / Garcia-Molina & Salem, 'Sagas' (1987)"
---

## 定義

**Saga**：複数のサービスにまたがる長期トランザクションを、独立したローカルトランザクションのシーケンスとして実装するパターン。各ステップが失敗した場合は**補償トランザクション（Compensating Transaction）**で前のステップを取り消す。

## なぜ2PCでは不十分か

[2フェーズコミット](./concepts_ddia_consistency_consensus.md)はマイクロサービスでは実用的でない。

```
問題1: サービス間の強い依存
  コーディネーターがダウン → 全サービスが宙ぶらりん状態で停止

問題2: NoSQLは2PCをサポートしていない
  MongoDBやCassandraにまたがるトランザクションは実行不可能

問題3: 長時間ロックによる可用性低下
  注文確定 → 在庫確保 → 決済処理 が数秒かかる間、全リソースがロック

問題4: サービスの自律性の破壊
  各サービスが独立してデプロイ・スケールできるのがマイクロサービスの利点
  2PCはそれを否定する
```

## Sagaの仕組み

```
注文処理 Saga:
  1. 注文サービス: 注文を作成（PENDING状態）
  2. 在庫サービス: 在庫を確保
  3. 決済サービス: 決済を実行
  4. 注文サービス: 注文をCONFIRMED状態に更新

ステップ3で失敗した場合（補償）:
  3C. 決済サービス: （何もしない）
  2C. 在庫サービス: 在庫の確保を解放
  1C. 注文サービス: 注文をREJECTED状態に更新
```

各ローカルトランザクションは自サービスのDBにコミットし、次のステップをトリガーする。

## 2つの実装方式

### コレオグラフィ（Choreography）

各サービスがイベントを発行し、それを聞いたサービスが次のアクションを実行する。中央コントローラーなし。

```
注文サービス ──[OrderCreated]──→ Kafka ──→ 在庫サービス
                                              │
                                    [StockReserved]
                                              │
                                           決済サービス
                                              │
                                    [PaymentCompleted]
                                              │
                                           注文サービス（CONFIRMED更新）
```

**メリット**：サービスが疎結合。新しいサービスの追加が容易。  
**デメリット**：フロー全体を俯瞰しにくい。循環依存のリスク。

### オーケストレーション（Orchestration）

中央の**Sagaオーケストレーター**が各サービスに指示を出す。

```
Sagaオーケストレーター
  │
  ├── 1. 注文サービスへ「注文作成」指示
  │   ← 完了通知
  │
  ├── 2. 在庫サービスへ「在庫確保」指示
  │   ← 完了通知
  │
  └── 3. 決済サービスへ「決済」指示
      ← 完了通知 or 失敗通知（→補償フロー開始）
```

**メリット**：フロー全体が見えやすい。複雑な条件分岐が管理しやすい。  
**デメリット**：オーケストレーターにロジックが集中しすぎるリスク（神クラス化）。

## 補償トランザクションの設計

すべてのステップには「取り消し用の操作」が必要。ただし完全な「なかったこと」にはならない。

```
種類:
  Compensatable Transaction: 補償可能（在庫確保 → 在庫解放）
  Pivot Transaction: これより後は補償もリトライもない（決済実行）
  Retriable Transaction: 失敗してもリトライすれば成功する（通知送信）
```

**セマンティック取り消し**：  
決済が完了した後にキャンセルされた場合、「返金処理」という別の操作になる。「決済をなかったことにする」のではなく「返金した」という新しいイベントが記録される。

## 一時的な不整合との付き合い方

SagaはACIDの「分離性（I）」を犠牲にする。Saga実行中は**中間状態が他から見える**。

```
問題: 注文ステップ1が完了した直後（ステップ2の前）
  他のトランザクションがPENDING注文を読める
  → その注文はいずれRejectedになるかもしれない
```

対策パターン：
- **セマンティックロック**：Sagaが処理中のリソースに「PENDING」フラグをつける
- **可換更新**：操作の順序を変えても結果が同じになるよう設計（在庫増減は可換）
- **楽観的ロック**：読み取り時のバージョンと更新時のバージョンが一致しなければ失敗

## 冪等性の重要性

ネットワーク障害でメッセージが重複することがある。各ステップは**冪等**でなければならない。

```typescript
// 冪等でない実装（危険）
async function reserveStock(orderId: string, quantity: number) {
  await db.execute('UPDATE stock SET reserved = reserved + $1', [quantity]);
}

// 冪等な実装（安全）
async function reserveStock(orderId: string, quantity: number) {
  // orderId で重複チェック
  const exists = await db.query(
    'SELECT 1 FROM stock_reservations WHERE order_id = $1', [orderId]
  );
  if (exists) return; // 冪等: 同じ操作を再実行しても副作用なし
  
  await db.transaction(async (tx) => {
    await tx.execute('INSERT INTO stock_reservations (order_id) VALUES ($1)', [orderId]);
    await tx.execute('UPDATE stock SET reserved = reserved + $1', [quantity]);
  });
}
```

## Sagaの実装ツール

| ツール | 特徴 |
|---|---|
| Temporal | ワークフローをコードで記述。リトライ・タイムアウトを自動管理 |
| AWS Step Functions | マネージドステートマシン。Sagaの状態を永続化 |
| Axon Framework | Java向けCQRS/ES + Saga統合フレームワーク |
| Mastra（TypeScript） | AIエージェント向けワークフローエンジン（Sagaパターンを応用） |

## Saga vs 2PC

| 観点 | Saga | 2PC |
|---|---|---|
| 一貫性 | 最終的一貫性（ACD） | 強い一貫性（ACID） |
| 可用性 | 高い（単一サービス障害が全体を止めない） | 低い（コーディネーター障害で全停止） |
| 適した規模 | マイクロサービス、長期トランザクション | 単一DBクラスタ内 |
| 実装複雑さ | 補償ロジックが必要 | DBが自動的に処理 |
| NoSQL対応 | 可能 | 不可能 |

## 関連概念

- → [一貫性と合意](./concepts_ddia_consistency_consensus.md)（2PCの詳細と限界）
- → [トランザクション](./concepts_ddia_transactions.md)（単一DBのACID保証との対比）
- → [イベントソーシング](./concepts_backend_event_sourcing.md)（Sagaのイベント駆動実装）
- → [CQRS](./concepts_backend_cqrs.md)（Sagaとの組み合わせパターン）

## 出典・参考文献

- Hector Garcia-Molina & Kenneth Salem, "Sagas" (1987) — ACM SIGMOD
- Chris Richardson, *Microservices Patterns* (2018) Chapter 4
- Temporal Documentation — temporal.io/docs
