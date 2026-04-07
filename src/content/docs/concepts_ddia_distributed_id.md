---
title: 分散ID生成
description: UUID・ULID・Snowflake IDの比較。なぜUUID v4はインデックスに悪いか、ULIDとUUID v7がどう解決するか。モノトニックIDの生成戦略を理解する
category: "概念"
tags: ["データ設計", "分散ID", "UUID", "ULID", "Snowflake ID", "DDIA"]
emoji: "🆔"
date: "2026-04-07"
order: 825
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017) Chapter 9"
---

## 定義

**分散ID生成**：複数のノードが中央コーディネーターなしに、グローバルに一意なIDを生成する手法。マイクロサービスやシャーディングされたDBでは、中央DBの自動採番（SERIAL / AUTO_INCREMENT）が使えないためこの問題が発生する。

## 要件の整理

```
IDに求められる性質:
  ✅ グローバルに一意（衝突しない）
  ✅ 生成が速い（高スループット）
  ✅ ソート可能（時系列順に並べられる）← これが重要
  ✅ DBインデックスに優しい
  ✅ 推測不可能（セキュリティ）

すべてを同時に満たすのが難しい
```

## SERIAL / AUTO_INCREMENT の限界

```sql
-- PostgreSQLのSERIAL（内部的にはSEQUENCE）
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100)
);
```

**問題**：
- 単一DBへの依存 → シャーディング不可
- 順番が推測可能（`/users/1`, `/users/2`... → ユーザー数が漏れる）
- マージ時の衝突（2つのDBを統合すると重複が起きる）

## UUID v4

ランダムな128bitの値。

```
形式: 550e8400-e29b-41d4-a716-446655440000
生成: 122bitの擬似乱数

✅ 衝突確率が無視できるほど低い（2^122通り）
✅ 推測不可能
✅ 分散生成可能（中央不要）
❌ 完全ランダム → ソート不可
❌ BツリーインデックスのPageSplitが頻発
```

### UUID v4がインデックスに悪い理由

```
Bツリーはキーをソートされた状態で保持する

SERIAL（単調増加）:
  新しい行は常に右端のページに追加
  → ほぼすべてのページがキャッシュに乗る
  → 書き込みI/O最小

UUID v4（ランダム）:
  新しい行がランダムな位置に挿入される
  → ランダムなページをキャッシュに読み込んでは捨てる
  → ページ分割（Page Split）が頻発してインデックスが断片化
  → Write Amplificationが大きい
  
負荷テスト結果（目安）:
  UUID v4 vs SERIAL → 書き込みスループットが50〜70%低下
```

## ULID（Universally Unique Lexicographically Sortable Identifier）

```
形式: 01ARZ3NDEKTSV4RRFFQ69G5FAV
構造:
  |--------10文字---------|--------16文字----------|
  タイムスタンプ(48bit)       ランダム(80bit)

✅ ミリ秒精度のタイムスタンプでソート可能
✅ 同一ミリ秒内でもランダム部分で一意
✅ Crockford Base32で人間が読みやすい
✅ UUIDと同じ128bit（DB上のUUID型に格納可能）
❌ 同一ミリ秒に大量生成すると順序が保証されない
```

```typescript
import { ulid } from 'ulid';

const id = ulid();
// → "01ARZ3NDEKTSV4RRFFQ69G5FAV"

// 時系列順にソート可能
const ids = [ulid(), ulid(), ulid()];
ids.sort(); // 生成順と一致
```

## UUID v7（RFC 9562、2024年確定）

```
構造:
  |--48bit--|-4bit-|-12bit--|--2bit--|----62bit random----|
  unix_ms    ver    rand_a   variant      rand_b

✅ ULID同様にタイムスタンプ付きでソート可能
✅ UUID形式を維持（既存ツールと互換）
✅ RFC標準（2024年4月確定）
→ ULIDの後継としてデファクトになりつつある
```

```sql
-- PostgreSQL 17からネイティブサポート予定
-- 現在はuuid-ossp拡張またはアプリ側で生成
SELECT gen_random_uuid();    -- UUID v4（現在のデフォルト）
-- UUID v7はpg_uuidv7拡張で利用可能
```

## Snowflake ID（Twitter発）

```
構造（64bit整数）:
  |--41bit--|--10bit--|--12bit--|
  タイムスタンプ  マシンID  シーケンス

✅ 64bit整数 → BIGINTとして格納できる（128bitより小さい）
✅ タイムスタンプでソート可能
✅ 毎ミリ秒4096個まで生成可能
❌ マシンIDの管理が必要（分散環境で唯一性を保証するコーディネーター）
❌ タイムスタンプのエポック設定が必要
```

Discordは2015年1月1日をエポックにしたSnowflake IDを採用。

```
Discord ID の例: 175928847299117063
  タイムスタンプ: 175928847299117063 >> 22 = 41944705582 ms
                  → 2015-01-01からの経過ミリ秒
```

## CUID2 / NanoID

セキュリティを優先する場面向け。

```
CUID2:
  衝突耐性の高いランダムID
  プレフィックスで識別（user_01H2G3K4M...）
  → 推測不可能、URL安全

NanoID:
  21文字のランダムID（UUID v4と同等の衝突耐性）
  カスタムアルファベット可能
  UUID v4より短い
```

## 採用指針

```
要件に応じた選択:

順序が重要 + 分散生成 + UUID互換:
  → UUID v7（標準化済み、推奨）
  → ULID（UUID v7登場前のデファクト）

順序が重要 + 整数型で格納したい:
  → Snowflake ID（マシンID管理の仕組みが必要）

セキュリティ優先 + 短さが重要:
  → CUID2 / NanoID

単一DBで十分 + 推測されても問題ない:
  → BIGSERIAL（最もシンプル）
```

## DBのID型選択

```sql
-- PostgreSQL でのUUID格納
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
-- → 16バイト固定長、インデックスが効率的

-- UUID を文字列で格納（アンチパターン）
id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text
-- → 36バイト（ハイフン込み）、比較・インデックスが遅い

-- UUID v7 / ULID を格納する場合
-- UUIDのバイナリ互換なのでUUID型をそのまま使える
```

## セキュリティ上の注意

```
IDに含まれる情報:
  SERIAL: ユーザー数・作成順序が推測可能
  Snowflake: タイムスタンプが含まれる（作成時刻がバレる）
  UUID v4 / CUID2: 推測困難

外部公開IDと内部IDの分離:
  内部: BIGSERIAL（高速、シンプル）
  外部API: UUID v7 or CUID2（推測不可）
  
  → 外部IDから内部IDへのマッピングをDBまたはアプリで管理
```

## 関連概念

- → [パーティショニング](./concepts_ddia_partitioning.md)（シャーディングとID設計の関係）
- → [ストレージとインデックス](./concepts_ddia_storage_indexing.md)（BツリーとランダムIDの問題）
- → [分散システムの問題](./concepts_ddia_distributed_problems.md)（時刻の非信頼性とSnowflake）

## 出典・参考文献

- Martin Kleppmann, *Designing Data-Intensive Applications* (2017) Chapter 9
- Twitter Engineering, "Snowflake" (2010)
- RFC 9562, "Universally Unique IDentifiers (UUIDs)" (2024)
- ULID Specification — github.com/ulid/spec
