---
title: 一貫性と分散合意
description: 線形化可能性（最強の一貫性）から因果一貫性まで、分散システムの一貫性モデルを整理。RaftとPaxosが解く問題と、分散トランザクションの2PCを理解する
category: "概念"
tags: ["データ設計", "分散システム", "一貫性", "合意アルゴリズム", "Raft", "DDIA"]
emoji: "🤝"
date: "2026-04-07"
order: 808
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017) Chapter 9"
---

## 定義

分散システムの一貫性は「どのノードからデータを読んでも、同じ結果が得られるか」という問題。一貫性のレベルが高いほど実装コストとパフォーマンスコストが上がる。

## 一貫性モデルの階層

```
強い一貫性
  ├── 線形化可能性（Linearizability）  ← 最強
  ├── シリアライザビリティ（Serializability）
  ├── 因果一貫性（Causal Consistency）
  ├── 単調読み取り一貫性（Monotonic Reads）
  └── 最終的一貫性（Eventual Consistency） ← 最弱
弱い一貫性
```

## 線形化可能性（Linearizability）

「システムに対してデータのコピーが1つしか存在しないかのように見える」という保証。

```
書き込み: x ← 1 (開始〜完了)
         ─────────────────
         
読み取りA:        x → 0 (古い値)
               ───────
               
読み取りB:              x → 1 (新しい値)
                        ───────
読み取りC:                     x → 0 (線形化違反！)
                               ───────

書き込みが完了した後、全ての読み取りは新しい値を返すべき
```

線形化可能性が必要な場面：
- **リーダー選出**：全ノードが同じノードをリーダーと認識する
- **一意制約**：ユーザー名の重複防止
- **在庫管理**：同一商品を2人が同時に最後の1個を購入する問題

### CAP定理との関係

```
C（一貫性）= 線形化可能性
A（可用性）= すべてのノードが応答できる
P（ネットワーク分断）= ネットワーク分断が起きても動作する

分断時に一貫性か可用性かどちらかを諦める必要がある
```

実際にはCAPは「ネットワーク分断時」という稀なケースの話。通常は遅延（Latency）との相関が重要：**線形化可能性には追加の通信コストが常にかかる**。

## 因果一貫性（Causal Consistency）

線形化可能性より弱いが、多くの用途で十分な一貫性。

**因果関係の保持**：「AがBの後に起きた」という順序だけを保証する。

```
Alice: "私のパスワードをリセットしました" (メッセージ1)
Bob: メッセージ1を読む
Bob: "Aliceのパスワードは何ですか？" (メッセージ2)
Alice: "xxxです" (メッセージ3)

因果一貫性: メッセージ2はメッセージ1の後に処理される保証がある
（Bobがメッセージ1を読んだ後にメッセージ2を書いたという因果関係）
```

**因果一貫性は達成可能な最強の一貫性**：ネットワーク分断があっても実現でき、パフォーマンスコストを最小限にできる。

## 分散合意（Consensus）

複数ノードが「ある値に合意する」問題。リーダー選出、原子的ブロードキャストなどの基盤。

### 合意の必要条件

1. **均一合意（Uniform Agreement）**：全ての正しいノードが同じ値に決定する
2. **整合性（Integrity）**：各ノードは1回しか値を決定しない
3. **妥当性（Validity）**：決定される値はいずれかのノードが提案した値
4. **終了性（Termination）**：クラッシュしていないノードは最終的に値を決定する

### Paxosアルゴリズム（概念）

```
Phase 1 (Prepare):
  Proposerがpromisenumber=nで全Acceptorに「n以上のプロポーザルを受け付けないよう約束して」と送る

Phase 2 (Accept):
  過半数のAcceptorから約束を得たら、値を提案
  過半数のAcceptorが受け入れたらCommit
```

理論的に正しいが実装が難しく、理解しにくいことで有名。

### Raftアルゴリズム（理解しやすい合意）

Paxosの「理解しにくい」問題を解決するために設計。etcd、CockroachDB、TiKVなどが採用。

```
役割:
  Leader   : ログエントリを管理・複製
  Follower : Leaderに従う
  Candidate: リーダー選出中の状態

リーダー選出:
  1. Followerが一定時間Leaderからのheatbeatを受け取らない
  2. Candidateになり、投票要求を送信
  3. 過半数の票を得たらLeaderになる
  
ログ複製:
  1. Leaderがログエントリを受け取る
  2. 全Followerにレプリケート
  3. 過半数がACKしたらコミット
  4. クライアントに応答
```

### 2フェーズコミット（2PC）

複数ノードにまたがる分散トランザクションのコミットプロトコル。

```
Coordinator（コーディネーター）
  │
  ├── Phase 1 (Prepare):
  │   全Participantに「コミットできるか？」
  │   → 全員YES → Phase 2へ
  │   → 1人でもNO → Abort
  │
  └── Phase 2 (Commit/Abort):
      全Participantにコミット（またはアボート）指示

      ParticipantはYESを返した後は、コーディネーターの指示を待つしかない
      → コーディネーターがPhase 2前にクラッシュ → Participantは宙ぶらりん
```

**2PCの問題点**：コーディネーターがPhase 1後にクラッシュすると、Participantはコミットもアボートもできない「疑念状態（In-doubt）」に陥る。

これを解決するのが3PC（3フェーズコミット）だが、ネットワーク遅延の仮定に依存するため実用的でない。実際にはZooKeeperやetcdのような合意システムにコーディネーター状態を永続化することで解決する。

## ZooKeeper / etcd の役割

分散システムのコーディネーション専用サービス。

- **リーダー選出**：分散Lock
- **サービス検出**：ノードの登録と通知
- **設定の配布**：全ノードへの設定変更
- **フェンシングトークン**：モノトニックに増加するトランザクションID

Zab（ZooKeeper Atomic Broadcast）はPaxosに類似した合意プロトコル。

## 関連概念

- → [レプリケーション](./concepts_ddia_replication.md)（リーダー選出の具体的な文脈）
- → [分散システムの問題](./concepts_ddia_distributed_problems.md)（合意が難しい根本原因）
- → [トランザクション](./concepts_ddia_transactions.md)（単一DBのACIDとの比較）

## 出典・参考文献

- Martin Kleppmann, *Designing Data-Intensive Applications* (2017) Chapter 9
- Diego Ongaro & John Ousterhout, "In Search of an Understandable Consensus Algorithm (Raft)" (2014)
- Leslie Lamport, "Paxos Made Simple" (2001)
