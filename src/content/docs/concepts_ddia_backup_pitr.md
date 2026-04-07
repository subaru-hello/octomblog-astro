---
title: DBバックアップとPITR
description: ベースバックアップ・WALアーカイブ・Point-in-Time Recoveryの仕組み。RPO/RTOの設計、pg_basebackupとPGBARMANによる本番バックアップ戦略を理解する
category: "概念"
tags: ["データ設計", "バックアップ", "PITR", "PostgreSQL", "信頼性", "DDIA"]
emoji: "💾"
date: "2026-04-08"
order: 830
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017) Chapter 1 / PostgreSQL Documentation"
---

## 定義

**PITR（Point-in-Time Recovery）**：データベースを過去の任意の時点の状態に復元する技術。「誤ってテーブルを削除した」「大量のデータを誤更新した」という事故からの回復に使う。

## RPOとRTOの設計

バックアップ戦略はまずビジネス要件を数値化することから始まる。

```
RPO（Recovery Point Objective）: どこまで遡れるか（データロス許容量）
  RPO = 1時間 → 直近1時間のデータはロスを許容する
  RPO = 0     → データロスゼロ（非常に高コスト）

RTO（Recovery Time Objective）: どれだけ速く復旧できるか
  RTO = 4時間 → 障害発生から4時間以内に復旧
  RTO = 15分  → 高可用性構成が必要

例:
  ECサイト注文DB → RPO=5分, RTO=30分
  社内レポートDB → RPO=1日, RTO=4時間
```

## PostgreSQLのバックアップ種類

```
論理バックアップ（pg_dump）:
  SQLダンプとして出力。可読性あり
  テーブル・スキーマ単位で復元できる
  大規模DBでは時間がかかる
  PITRはできない（特定時点への復元不可）

物理バックアップ（ベースバックアップ + WALアーカイブ）:
  DBファイルをまるごとコピー
  WALと組み合わせてPITRが可能
  大規模DBでも高速（ファイルコピー）
  本番環境ではこちらが基本
```

## 論理バックアップ（pg_dump）

```bash
# テーブル構造とデータをSQLとして出力
pg_dump -h localhost -U postgres -d mydb -f backup.sql

# 圧縮・並列化（大規模DB向け）
pg_dump -h localhost -U postgres -d mydb \
  --format=directory \
  --jobs=4 \
  --file=/backup/mydb_$(date +%Y%m%d)

# リストア
psql -h localhost -U postgres -d newdb -f backup.sql
pg_restore -h localhost -U postgres -d newdb /backup/mydb_20240115
```

**注意**：pg_dumpの実行中もDBは稼働し続けるが、ダンプ開始時点のスナップショットが取られる（MVCCを活用）。

## 物理バックアップとWALアーカイブ

PITRの実現には2つの要素が必要。

```
ベースバックアップ: ある時点のDBファイルの完全コピー
WALアーカイブ:      ベースバックアップ以降の全変更ログ

復元:
  1. ベースバックアップを展開
  2. WALを順番に適用（Redo）
  3. 目的の時点に達したら停止
```

### WALアーカイブの設定

```
# postgresql.conf
wal_level = replica          # 最低限のレプリケーション情報
archive_mode = on            # WALアーカイブを有効化
archive_command = 'cp %p /mnt/wal-archive/%f'  # WALファイルをコピー
# 本番ではS3やGCSに送る:
# archive_command = 'aws s3 cp %p s3://my-bucket/wal/%f'
```

### ベースバックアップの取得

```bash
# pg_basebackup でベースバックアップ
pg_basebackup \
  -h localhost \
  -U replication_user \
  -D /backup/base \
  --wal-method=stream \  # バックアップ中のWALも同時取得
  --checkpoint=fast \
  --progress \
  --compress=zstd

# S3に直接送る（pg_basebackup 15以降）
pg_basebackup ... | aws s3 cp - s3://my-bucket/base/$(date +%Y%m%d).tar.gz
```

## PITRの実行

```bash
# 1. ベースバックアップを復元先に展開
tar xzf /backup/base.tar.gz -C /var/lib/postgresql/data

# 2. recovery設定ファイルを作成
cat > /var/lib/postgresql/data/postgresql.conf << EOF
restore_command = 'cp /mnt/wal-archive/%f %p'  # WALの取得コマンド
recovery_target_time = '2024-01-15 14:30:00'   # この時点まで復元
recovery_target_action = 'promote'             # 復元後にプライマリとして起動
EOF

# recovery.signal ファイルを作成（PITRモードで起動するサイン）
touch /var/lib/postgresql/data/recovery.signal

# 3. PostgreSQLを起動
systemctl start postgresql
# → WALを順番に適用して指定時刻に達したら通常起動
```

## バックアップ管理ツール

### pgBackRest

```yaml
# pgbackrest.conf
[global]
repo1-path=/backup
repo1-type=s3
repo1-s3-bucket=my-backup-bucket
repo1-s3-region=ap-northeast-1
repo1-retention-full=2    # フルバックアップを2世代保持
repo1-retention-diff=14   # 差分バックアップを14日保持

[mydb]
pg1-path=/var/lib/postgresql/data

# フルバックアップ（週1回）
pgbackrest --stanza=mydb backup --type=full

# 差分バックアップ（日次）
pgbackrest --stanza=mydb backup --type=diff

# 増分バックアップ（時間単位）
pgbackrest --stanza=mydb backup --type=incr

# PITRで特定時点に復元
pgbackrest --stanza=mydb restore \
  --target="2024-01-15 14:30:00" \
  --target-action=promote
```

**pgBackRestの利点**：並列バックアップ・暗号化・圧縮・S3/GCS対応・増分バックアップが統合されている。

## バックアップの検証

**バックアップは定期的に復元テストしなければ意味がない。**

```bash
# 週次で自動復元テスト
#!/bin/bash
# 別ホストにバックアップから復元
pgbackrest restore --stanza=mydb --target-time="$(date -d '1 hour ago')"

# 基本的なデータ確認
psql -c "SELECT COUNT(*) FROM orders;"
psql -c "SELECT MAX(created_at) FROM orders;"

# 問題なければSlackに通知
```

## クラウドマネージドDBのバックアップ

| サービス | バックアップ | PITR |
|---|---|---|
| AWS RDS | 自動スナップショット（最大35日） | ✅（5分精度） |
| Google Cloud SQL | 自動バックアップ | ✅（7日間） |
| Supabase | 毎日自動バックアップ | Pro以上で7日間 |
| Neon | ブランチ機能で任意時点のコピー | ✅（独自機能） |

## バックアップ戦略のまとめ

```
最低限（小規模）:
  pg_dump を日次でS3に保存
  保持期間: 30日
  RTO: 数時間、RPO: 1日

推奨（本番）:
  pgBackRestでフル/差分/増分
  WALアーカイブをリアルタイムでS3に送信
  保持期間: フル2世代 + 差分30日
  RTO: 30分〜1時間、RPO: 5分以内

エンタープライズ:
  上記 + 別リージョンにクロスリージョンレプリケーション
  スタンバイを別AZに
  RTO: <15分、RPO: <1分
```

## 関連概念

- → [WALと論理レプリケーション](./concepts_ddia_wal_replication.md)（WALアーカイブの基盤）
- → [レプリケーション](./concepts_ddia_replication.md)（バックアップとHAの組み合わせ）
- → [分散システムの問題](./concepts_ddia_distributed_problems.md)（RPO/RTOの設計思想）

## 出典・参考文献

- PostgreSQL Documentation, "Backup and Restore" — postgresql.org/docs/current/backup.html
- pgBackRest Documentation — pgbackrest.org
- Martin Kleppmann, *Designing Data-Intensive Applications* (2017) Chapter 1（信頼性）
