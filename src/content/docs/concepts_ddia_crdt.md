---
title: CRDT（競合なし複製データ型）
description: 分散システムで複数ノードが同時に書き込んでも自動的にマージできるデータ構造。G-Counter・LWW-Register・OR-Setなど主要な型と、なぜ競合が起きないかの数学的直感を理解する
category: "概念"
tags: ["データ設計", "CRDT", "分散システム", "結果整合性", "競合解決", "DDIA"]
emoji: "🔀"
date: "2026-04-07"
order: 817
series:
  - データ志向アプリケーション設計（DDIA）
source: "Shapiro et al., 'A Comprehensive Study of CRDTs' (2011)"
---

## 定義

**CRDT（Conflict-free Replicated Data Type）**：複数のノードが同時に独立して変更を加えても、最終的に全ノードが同じ状態に収束することが数学的に保証されたデータ構造。

人間が競合を解決したり、コーディネーターを必要としない。

## なぜ競合なしにできるか：数学的直感

CRDTが競合を回避できる理由は、操作（またはステート）が**半束（Semilattice）**の性質を持つことにある。

```
半束の条件:
  1. 可換性: merge(A, B) = merge(B, A)（順序を問わない）
  2. 結合性: merge(A, merge(B, C)) = merge(merge(A, B), C)（どこから始めても同じ）
  3. 冪等性: merge(A, A) = A（同じ操作を何度しても変わらない）

これら3条件を満たす「merge関数」を定義できるデータ型がCRDT
```

## 主要なCRDTの型

### G-Counter（Grow-only Counter）

増加しかしないカウンター。各ノードが自分の担当カウンターを持つ。

```
ノード数: A, B, C

各ノードの状態:
  A: [A:3, B:0, C:2]
  B: [A:0, B:5, C:0]
  C: [A:3, B:0, C:2]  ← Aの更新を受け取っている

マージ（各要素のmax）:
  merge(A, B) = [max(3,0), max(0,5), max(2,0)] = [3, 5, 2]
  
合計値: sum([3, 5, 2]) = 10

可換性: merge(A, B) = merge(B, A) ✅
冪等性: merge(A, A) = A ✅
```

### PN-Counter（Positive-Negative Counter）

増減できるカウンター。G-Counterを2つ組み合わせる。

```
P（増加用のG-Counter）: [A:5, B:3, C:2]  → sum = 10
N（減少用のG-Counter）: [A:2, B:0, C:1]  → sum = 3

実際の値: P合計 - N合計 = 10 - 3 = 7
```

いいね数、在庫数など増減するカウンターに使える。

### LWW-Register（Last-Write-Wins Register）

タイムスタンプが最新の値を「正」とするレジスタ。

```
ノードAが value="Alice" を ts=100 で書き込み
ノードBが value="Bob"   を ts=150 で書き込み

マージ: ts=150のBobが勝つ

問題: タイムスタンプの精度に依存（時刻のずれがあると誤った順序になる）
対策: [ベクタークロック](./concepts_ddia_vector_clock.md)をタイムスタンプ代わりに使う
```

### 2P-Set（Two-Phase Set）

一度削除した要素は追加できない制約つきセット。

```
Add-Set: {Alice, Bob, Charlie}
Remove-Set: {Bob}

実際の値: Add-Set - Remove-Set = {Alice, Charlie}

Bobは一度Removeに追加されたら永遠に復活できない
→ 実用面では制限が大きい（OR-Setで解決）
```

### OR-Set（Observed-Remove Set）

追加・削除を繰り返せる実用的なセット型。

```
仕組み: 追加時に一意のタグをつける

Alice が "りんご" をタグ=uuid1 で追加
  → {(りんご, uuid1)}

Bob  が "バナナ" をタグ=uuid2 で追加
  → {(りんご, uuid1), (バナナ, uuid2)}

Alice が "りんご" を削除
  → {(バナナ, uuid2)}  ← uuid1のりんごだけ消える

同時に別ノードで "りんご" をタグ=uuid3 で再追加:
  → uuid3のりんごはuuid1の削除に影響されない
  → マージ後: {(りんご, uuid3), (バナナ, uuid2)}
  
「追加が削除に勝つ」というセマンティクス
```

### LWW-Map / MV-Register

マップや複数値レジスタ。値ごとにLWWやOR-Setの考え方を適用。

## CRDTの2つのアーキテクチャ

### State-based CRDT（CvRDT）

```
各ノードが完全な状態を持ち、状態全体をマージする

ノードA → ノードB に自分の状態全体を送る
ノードB: merge(自分の状態, Aの状態)

シンプルだがネットワーク帯域が必要（状態が大きい場合）
```

### Operation-based CRDT（CmRDT）

```
操作だけを送信する（状態全体ではなく差分）

ノードA: "increment(user=alice, by=1)" を全ノードにブロードキャスト
各ノードはその操作を自分の状態に適用

帯域節約だが、操作の順序・重複に注意が必要（冪等性が必要）
```

## 実際の採用事例

| サービス/ツール | 用途 | CRDT型 |
|---|---|---|
| Redis（Redis Enterprise） | 分散カウンター | PN-Counter |
| Riak | KVストア | LWW-Register, OR-Set |
| Figma | リアルタイム共同編集 | カスタムCRDT |
| Notion | ブロックエディタ | Operation-based |
| Automerge | JSONドキュメント | 複合CRDT |
| Yjs | テキスト・リッチエディタ | YATA（CRDT派生） |

## Google DocsとCRDTの違い

```
Google Docs（OT：Operational Transformation）:
  中央サーバーがすべての操作を調整する
  サーバーが操作を「変換」して矛盾を解消
  → サーバーレスでは動かない

CRDT（Figma, Linear等）:
  中央サーバー不要で同期可能
  P2P編集、オフライン編集が可能
  → ローカルファーストアプリケーションの基盤
```

## 限界と注意点

```
問題1: 削除が難しい
  「削除した」という情報も永続的に保持しないとiPとの矛盾が起きる
  → Tombstone（墓石）が蓄積してメモリを圧迫

問題2: すべてのデータ型に適用できるわけではない
  「一意制約（ユーザー名の重複禁止）」はCRDTで実現不可
  → 中央コーディネーターか後から整合するアプローチが必要

問題3: 「意図の喪失」
  Alice: "Hello" を "Hello World" に変更
  Bob:   "Hello" を "Hello!" に変更
  
  CRDT（OR-Set的）マージ: "Hello World!"
  → これは両者の意図とは違うかもしれない
```

## 関連概念

- → [ベクタークロック](./concepts_ddia_vector_clock.md)（競合を「検出」する方法）
- → [レプリケーション](./concepts_ddia_replication.md)（競合が起きるマルチリーダー文脈）
- → [一貫性と合意](./concepts_ddia_consistency_consensus.md)（強い一貫性との対比）
- → [ストリーム処理](./concepts_ddia_stream_processing.md)（Operation-basedとイベント駆動の類似）

## 出典・参考文献

- Marc Shapiro et al., "A Comprehensive Study of Convergent and Commutative Replicated Data Types" (2011) — INRIA
- Martin Kleppmann, *Designing Data-Intensive Applications* (2017) Chapter 9
- Martin Kleppmann & Alastair Beresford, "A Conflict-Free Replicated JSON Datatype" (2017)
- Yjs Documentation — yjs.dev
