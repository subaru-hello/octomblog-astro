---
title: トランザクションとACID
description: ACIDの意味と各分離レベルが防ぐ競合状態を理解する。「シリアライザブルはいつも必要か？」という問いに答えられるようになる
category: "概念"
tags: ["データ設計", "トランザクション", "ACID", "分離レベル", "並行性制御", "DDIA"]
emoji: "🔒"
date: "2026-04-07"
order: 806
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017) Chapter 7"
---

## 定義

**トランザクション**：複数の読み書き操作を1つの論理的な単位としてグループ化する仕組み。「全て成功するか、全て失敗するか」を保証する。

## ACID の意味

よく誤解される4つの特性。

### Atomicity（原子性）

「中途半端な状態が残らない」。コミットかアボート（ロールバック）のどちらか。

```
送金処理:
  1. AのBalance -= 1000 ✓
  2. BのBalance += 1000 ← ここでクラッシュ

Atomicityなし → AからだけBALANCEが減った状態で残る
Atomicityあり → 全ロールバックで元の状態に戻る
```

### Consistency（一貫性）

**唯一アプリケーション側の責任**。ACIDのCはデータ整合性の invariant（不変条件）をトランザクション前後で保つこと。DBは強制できないルール（「残高は常にゼロ以上」など）をアプリが守る責任。

### Isolation（分離性）

**並行して実行されるトランザクションが互いに干渉しない**。後述の分離レベルで度合いを設定する。

### Durability（永続性）

コミットされたトランザクションはクラッシュ後も失われない。WAL（Write-Ahead Log）やレプリケーションで実現。

## 弱い分離レベルと競合状態

完全な分離（シリアライザブル）は遅い。多くのDBはデフォルトで弱い分離レベルを使用。それぞれの弱点を理解することが重要。

### Read Committed（コミット済み読み取り）

PostgreSQLのデフォルト（の最低限）。

**防ぐ問題**：
- ダーティリード：コミットされていない値を読む
- ダーティライト：コミットされていない値を上書きする

**防げない問題**：ノンリピータブルリード

```
Transaction A: SELECT balance → 500
Transaction B: UPDATE balance = 300 (commit)
Transaction A: SELECT balance → 300 (同じTxなのに違う値！)
```

### Snapshot Isolation（スナップショット分離）

**Multi-Version Concurrency Control（MVCC）**で実装。トランザクション開始時点のスナップショットから読む。

```
TxA開始 (snapshot at t=1)
  TxB: balance を 300 に更新 (t=2, commit)
TxA: balance を読む → 500（自分のスナップショット時点の値）
```

**防ぐ問題**：ノンリピータブルリード（fuzzy read）  
**防げない問題**：ファントムリード、Write Skew

**Write Skew（書き込みスキュー）の例**：

```
病院当直システム: 最低1人は当直が必要

Doctor A: SELECT count(*) WHERE on_call = true → 2人
Doctor B: SELECT count(*) WHERE on_call = true → 2人

Doctor A: UPDATE SET on_call = false (自分を外す) → 残り1人でOK
Doctor B: UPDATE SET on_call = false (自分を外す) → 残り0人！

２つのトランザクションが別の行を更新しているのでDirty Writeではないが、
前提条件（2人いる）が変わってしまった
```

### Serializable（シリアライザブル）

最も強い分離レベル。並行実行の結果が、何らかの順序でトランザクションをシリアルに実行した結果と同じになることを保証。

**実装方法**：
1. **実際にシリアル実行**：1CPUで1つずつ処理（VoltDB等）。非常にシンプル。ストアドプロシージャとメモリDBが前提。
2. **2相ロック（2PL）**：読み書き両方にロック。デッドロックリスクあり。パフォーマンス低下大。
3. **シリアライザブルスナップショット分離（SSI）**：楽観的並行性制御。書き込み時に前提条件の違反を検出してアボート。PostgreSQL 9.1以降で採用。

## デッドロック

```
TxA: Xにロック → Yにロックしようとして待機
TxB: Yにロック → Xにロックしようとして待機

→ 永久に待ち続ける
```

DBは定期的にデッドロックを検出し、片方をアボートする。アプリ側はリトライが必要。

## 分離レベル対応表

| 現象 | Read Uncommitted | Read Committed | Repeatable Read | Serializable |
|---|---|---|---|---|
| ダーティリード | ❌ 起きうる | ✅ 防ぐ | ✅ 防ぐ | ✅ 防ぐ |
| ノンリピータブルリード | ❌ | ❌ | ✅ 防ぐ | ✅ 防ぐ |
| ファントムリード | ❌ | ❌ | ❌（大部分） | ✅ 防ぐ |
| Write Skew | ❌ | ❌ | ❌ | ✅ 防ぐ |

## 楽観的 vs 悲観的並行性制御

| 方式 | 動作 | 適した場面 |
|---|---|---|
| 悲観的（2PL） | 競合を恐れてロックを取得 | 競合が頻繁、修正コストが高い |
| 楽観的（SSI） | 競合を期待せず実行し、コミット時に検証 | 競合が少ない、リトライコストが低い |

## 関連概念

- → [分散システムの問題](./concepts_ddia_distributed_problems.md)（分散トランザクションの困難）
- → [一貫性と合意](./concepts_ddia_consistency_consensus.md)（2フェーズコミット）
- → [ストレージとインデックス](./concepts_ddia_storage_indexing.md)（WALとACIDの関係）

## 出典・参考文献

- Martin Kleppmann, *Designing Data-Intensive Applications* (2017) Chapter 7
- Jim Gray & Andreas Reuter, *Transaction Processing* (1992)
