---
title: MVCC（多版型同時実行制御）
description: PostgreSQLがスナップショット分離をどう実装するか。行の複数バージョンを保持することでロックなしに並行読み書きを実現するMVCCの仕組みを理解する
category: "概念"
tags: ["データ設計", "MVCC", "トランザクション", "PostgreSQL", "並行性制御", "DDIA"]
emoji: "📸"
date: "2026-04-07"
order: 814
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017) Chapter 7"
---

## 定義

**MVCC（Multi-Version Concurrency Control）**：データの複数バージョンを同時に保持することで、読み取りと書き込みが互いをブロックしないようにする並行性制御の手法。

「書き込み中のデータを読もうとするとロックで待たされる」という問題を、「読み取りは常に自分が開始した時点のスナップショットを見る」ことで解決する。

## 問題：ロックベース並行性の限界

```
ロックベース（悲観的）:
  TxA: 行Xを読みたい → TxBが書き込み中 → ロック待ち
  TxB: 行Xを書いている
  
  書き込みが読み取りをブロックする
  高トラフィックのシステムでボトルネックになる
```

MVCCは「古いバージョンを残しておく」ことでこれを回避する。

## PostgreSQLのMVCC実装

### 行バージョンの物理的な表現

PostgreSQLの各行には隠しシステムカラムがある：

```
xmin: この行バージョンを作ったトランザクションID
xmax: この行バージョンを削除（更新）したトランザクションID（0なら生存中）
```

```sql
-- 隠しカラムを直接参照できる
SELECT xmin, xmax, id, name FROM users WHERE id = 1;

-- 結果例
xmin  | xmax | id | name
------+------+----+-------
  100 |    0 |  1 | Alice   ← TxID=100が作成、まだ生存中
```

### UPDATEは「削除 + 挿入」

```
TxID=200がAliceをBobに更新する:

Before:
  行1: xmin=100, xmax=0,   name="Alice"  ← 生存中

After:
  行1: xmin=100, xmax=200, name="Alice"  ← TxID=200が削除済みとマーク
  行2: xmin=200, xmax=0,   name="Bob"   ← TxID=200が作成した新バージョン
```

古い行は物理的にはまだディスクにある。これが**デッドタプル（dead tuple）**。

### スナップショットの仕組み

トランザクション開始時、PostgreSQLは「スナップショット」を取得する：

```
スナップショットの構成:
  xmin:  このIDより小さいTxはすべてコミット済み
  xmax:  このIDより大きいTxはまだ開始されていない
  xip[]: この範囲内でまだ実行中のTxのIDリスト

可視性ルール:
  行が見えるのは:
    行のxmin < スナップショットのxmin（確実にコミット済み）
    かつ
    行のxmax = 0（削除されていない）
    または行のxmax > スナップショットのxmax（自分より後のTxが削除した）
```

```
TxA（xmin_snapshot=150で開始）が読み取る:
  行1: xmin=100 → 150より小さいのでコミット済みと判断 → 可視
  行2: xmin=160 → 150より大きいので未来のTx → 不可視
  行3: xmin=130, xmax=145 → コミット済みのTxが削除済み → 不可視
```

## Read Committed vs Repeatable Read の違い

```
Read Committed:
  クエリごとに新しいスナップショットを取得
  → 同じTx内でも2回目の読み取りは別の結果になりうる

Repeatable Read（Snapshot Isolation）:
  トランザクション開始時に1度だけスナップショットを取得
  → Tx内は常に同じスナップショットから読む
  → ノンリピータブルリードを防ぐ
```

## VACUUM：デッドタプルの回収

MVCCでは古いバージョンが蓄積し続ける。VACUUMがそれを回収する。

```
VACUUM の動作:
  1. どのTxからも見えないデッドタプルを特定
  2. 物理的に削除してスペースを解放
  3. インデックスのデッドエントリも削除

AUTOVACUUM:
  PostgreSQLはデフォルトで自動的にVACUUMを実行
  テーブルの変更率が閾値を超えるとトリガー
```

**問題：トランザクションIDの周回（XID Wraparound）**

PostgreSQLのTxIDは32bit整数（約42億）。使い切ると周回して古いデータが「未来のTx」に見えてしまう。定期的なVACUUMが必須。

## MVCCとWrite Skew

[トランザクション](./concepts_ddia_transactions.md)で説明したWrite Skewが起きる理由もMVCCで説明できる：

```
TxA: SELECT count(*) WHERE on_call = true
  → スナップショット時点: 2人
TxB: SELECT count(*) WHERE on_call = true  
  → スナップショット時点: 2人（同じスナップショット）

TxA: UPDATE SET on_call = false（自分のスナップショットでは2人いる、条件満たす）
TxB: UPDATE SET on_call = false（同様）

両方コミット → 実際は0人
```

MVCCは「読んだ行が変わっていないか」のチェックを各行単位でしか行わない。他の行の変更が前提条件を壊したことを検出できない（これを検出するのがSSI）。

## MVCCを使うDBエンジン

| DB | MVCC実装の特徴 |
|---|---|
| PostgreSQL | ヒープ内に複数バージョン。VACUUM必要 |
| MySQL InnoDB | Undo Logに古いバージョンを保存 |
| Oracle | Undo Tablespaceに保存 |
| CockroachDB | HLCタイムスタンプベースのMVCC |

MySQLのUndo Log方式では現在のレコードは常に最新版。古いバージョンはUndo Logから逆算して構築する（PostgreSQLとは逆のアプローチ）。

## 関連概念

- → [トランザクション](./concepts_ddia_transactions.md)（分離レベルの概念）
- → [ストレージとインデックス](./concepts_ddia_storage_indexing.md)（物理ストレージ構造）
- → [一貫性と合意](./concepts_ddia_consistency_consensus.md)（SSIの位置づけ）

## 出典・参考文献

- Martin Kleppmann, *Designing Data-Intensive Applications* (2017) Chapter 7
- PostgreSQL Documentation, "MVCC" — postgresql.org/docs/current/mvcc.html
- Dan R. K. Ports & Kevin Grittner, "Serializable Snapshot Isolation in PostgreSQL" (2012)
