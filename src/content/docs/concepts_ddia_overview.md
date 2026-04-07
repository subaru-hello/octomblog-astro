---
title: データ志向アプリケーション設計：概要
description: 信頼性・スケーラビリティ・保守性を軸に、データ中心システムの設計原則を整理する。Martin KleppmannのDDIAの核心
category: "概念"
tags: ["データ設計", "スケーラビリティ", "分散システム", "信頼性", "DDIA"]
emoji: "🗄️"
date: "2026-04-07"
order: 801
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017)"
---

## 定義

**データ志向アプリケーション（Data-Intensive Application）**：処理能力（CPU）よりも、データの量・複雑さ・変化の速さがボトルネックになるシステム。

現代のほぼすべてのWebバックエンドがこれに該当する。データベース、キャッシュ、メッセージキュー、検索インデックスなど複数のデータシステムを組み合わせて構築される。

## 3つの設計目標

```
データシステムの品質
  ├── 信頼性（Reliability）
  │     故障が起きても正しく動作し続ける
  ├── スケーラビリティ（Scalability）
  │     負荷増加に合わせて対応できる
  └── 保守性（Maintainability）
        時間が経っても開発・運用しやすい
```

### 信頼性

**フォールトトレランス**：個々のコンポーネントが故障しても、システム全体が機能し続ける設計。

- ハードウェア障害（ディスク故障、電源断）
- ソフトウェアバグ（カスケード障害）
- 人的ミス（設定ミス、データ削除）

「故障を防ぐ」より「故障から回復できる」設計が現実的。本番環境で意図的にフォールトを注入するChaos Engineeringはこの考え方の実践。

### スケーラビリティ

**負荷記述子（Load Parameters）**：システムの負荷を定量化する指標。

| 指標 | 例 |
|---|---|
| リクエスト数/秒 | APIサーバー |
| DB読み書き比率 | キャッシュ設計の根拠 |
| アクティブユーザー数 | WebSocketコネクション数 |
| キャッシュヒット率 | メモリ vs ディスクアクセス |

**パーセンタイルで見るパフォーマンス**：平均値ではなくp99（99パーセンタイル）で評価する。外れ値が多いシステムでは、平均が「普通の体験」を表さない。

Twitterの事例：フォロワー数10万人のユーザーがツイートすると、10万件のホームタイムラインキャッシュ更新が必要。**ファンアウト問題**の典型。

### 保守性

- **操作性（Operability）**：運用チームがシステムを監視・管理しやすい
- **単純性（Simplicity）**：偶発的複雑さを取り除き、本質的な複雑さのみ残す
- **進化性（Evolvability）**：要件変更に対してシステムを変更しやすい

## データシステムの構成要素

```
アプリケーション層
    │
    ├── キャッシュ（Redis）        ← 高速読み取り
    ├── 全文検索インデックス（ES） ← 柔軟な検索
    ├── メッセージキュー（Kafka）  ← 非同期処理
    └── データベース（PostgreSQL） ← 永続化・整合性
```

これらを単一の「データシステム」として設計するのが現代のバックエンドエンジニアリング。個々のツールの知識だけでなく、組み合わせ方と整合性の管理が設計の核心になる。

## 本シリーズで扱う概念

| テーマ | 主な問い |
|---|---|
| [データモデル](./concepts_ddia_data_models.md) | どの構造でデータを表現するか |
| [ストレージとインデックス](./concepts_ddia_storage_indexing.md) | DBはどうデータを保存・検索するか |
| [レプリケーション](./concepts_ddia_replication.md) | データの複製をどう管理するか |
| [パーティショニング](./concepts_ddia_partitioning.md) | データをどう分散させるか |
| [トランザクション](./concepts_ddia_transactions.md) | 並行性とACIDをどう扱うか |
| [分散システムの問題](./concepts_ddia_distributed_problems.md) | 分散環境の本質的な困難 |
| [一貫性と合意](./concepts_ddia_consistency_consensus.md) | 分散合意をどう実現するか |
| [バッチ処理](./concepts_ddia_batch_processing.md) | 大量データをどう処理するか |
| [ストリーム処理](./concepts_ddia_stream_processing.md) | リアルタイムデータをどう処理するか |

## 関連概念

- → [CQRS](./concepts_backend_cqrs.md)（読み書き分離はDDIAの実践形）
- → [イベントソーシング](./concepts_backend_event_sourcing.md)（ストリーム処理と深い関係）
- → [SLO/エラーバジェット](./concepts_error_budget.md)（信頼性の定量化）

## 出典・参考文献

- Martin Kleppmann, *Designing Data-Intensive Applications* (2017) Chapter 1
- O'Reilly Media — dataintensive.net
