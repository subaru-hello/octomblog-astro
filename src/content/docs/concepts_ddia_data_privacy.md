---
title: データプライバシーとCrypto-Shredding
description: GDPRの「忘れられる権利」をイベントソーシングで実現するCrypto-Shreddingパターン。データの匿名化・仮名化・暗号化の使い分けと、削除できない不変ログへの対処法を理解する
category: "概念"
tags: ["データ設計", "プライバシー", "GDPR", "Crypto-Shredding", "イベントソーシング", "DDIA"]
emoji: "🔐"
date: "2026-04-08"
order: 837
series:
  - データ志向アプリケーション設計（DDIA）
source: "Martin Kleppmann, 'Designing Data-Intensive Applications' (2017) Chapter 12"
---

## 定義

**Crypto-Shredding（暗号シュレッディング）**：データを暗号化した状態で保存し、削除が必要になったとき暗号鍵を破棄することでデータを「論理的に削除」するパターン。物理的なデータは残るが、鍵なしでは復元不可能になる。

## なぜプライバシーがデータ設計に関わるか

```
GDPR（EU一般データ保護規則）の要件:
  忘れられる権利（Right to Erasure）:
    ユーザーが削除を要求したとき、そのユーザーのデータを消去する義務
    
  問題:
    イベントソーシング: イベントログは不変（削除できない）
    バックアップ: 古いバックアップのデータも消す必要がある
    レプリケーション: 全レプリカのデータを消す必要がある
    BigQuery等のDWH: 大量データから特定ユーザーを削除するのが困難
    
    「データを消したい」vs「不変ログを維持したい」の矛盾
```

## 匿名化・仮名化・暗号化の違い

```
匿名化（Anonymization）:
  個人を特定できないように不可逆的に変換
  氏名・メールを削除、生年月日を年だけに、郵便番号を上3桁に
  → 再特定が不可能 → GDPRの対象外になる
  → 一度やったら元に戻せない

仮名化（Pseudonymization）:
  実際の識別子を別のIDに置き換え
  user_id=1234 → pseudo_id=X9K2M
  マッピングテーブルを持つので再特定可能（GDPRの対象のまま）
  → 漏洩時のリスク低減
  → セキュリティの多層防御

暗号化（Encryption）:
  鍵があれば復元できる
  保存中（at rest）と転送中（in transit）の両方に適用
  Crypto-Shreddingの基盤
```

## Crypto-Shreddingの仕組み

```
通常のイベントソーシング:
  イベントログに生データを保存
  user_id=1234, email=alice@example.com, action=purchase

Crypto-Shredding:
  ユーザーごとに専用の暗号鍵を生成
  個人情報を暗号化してからイベントログに保存
  
イベントログ:
  user_id=1234,
  email=ENC(alice@example.com, key_1234),  ← 暗号化済み
  action=purchase

鍵管理テーブル（削除可能なDB）:
  user_id=1234 → key_1234

削除要求:
  1. 鍵管理テーブルから key_1234 を削除
  2. イベントログは変更しない
  3. 以降、ENC(...)の復号が不可能 → 事実上削除
```

## 実装パターン

```typescript
// 鍵管理サービス
class UserKeyService {
  async getOrCreateKey(userId: string): Promise<Buffer> {
    const existing = await db.query(
      'SELECT encryption_key FROM user_keys WHERE user_id = $1',
      [userId]
    );
    if (existing.rows[0]) {
      return Buffer.from(existing.rows[0].encryption_key, 'base64');
    }
    // 新しい鍵を生成
    const key = crypto.randomBytes(32);
    await db.query(
      'INSERT INTO user_keys (user_id, encryption_key) VALUES ($1, $2)',
      [userId, key.toString('base64')]
    );
    return key;
  }

  async deleteKey(userId: string): Promise<void> {
    // これだけでそのユーザーの全個人情報が「消える」
    await db.query('DELETE FROM user_keys WHERE user_id = $1', [userId]);
  }
}

// イベントの保存
async function saveEvent(userId: string, eventData: EventData) {
  const key = await userKeyService.getOrCreateKey(userId);

  // 個人情報のみ暗号化
  const encryptedPayload = encrypt(
    JSON.stringify({ email: eventData.email, name: eventData.name }),
    key
  );

  await kafka.send({
    topic: 'user-events',
    messages: [{
      key: userId,
      value: JSON.stringify({
        userId,
        action: eventData.action,        // 非個人情報はそのまま
        encryptedPii: encryptedPayload,  // 個人情報は暗号化
        timestamp: new Date().toISOString(),
      }),
    }],
  });
}
```

## フィールドレベル暗号化

特定のカラムだけ暗号化する方法。

```sql
-- PostgreSQLのpgcryptoを使う
CREATE EXTENSION pgcrypto;

-- 保存時に暗号化
INSERT INTO users (id, name, email_encrypted)
VALUES (
  1,
  'Alice',
  pgp_sym_encrypt('alice@example.com', 'encryption-key-from-env')
);

-- 読み取り時に復号
SELECT
  id,
  name,
  pgp_sym_decrypt(email_encrypted, 'encryption-key-from-env') AS email
FROM users
WHERE id = 1;
```

**注意**：暗号化したカラムにはインデックスが効かない。メールアドレスで検索する場合は、ハッシュ値（HMAC）を別カラムに持つ。

```sql
-- 検索用のHMACカラム（暗号化とは別に保持）
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email_encrypted BYTEA,     -- 復号可能な暗号化（表示用）
  email_hmac BYTEA           -- HMAC（検索用、元値に戻せない）
);

CREATE INDEX ON users (email_hmac);  -- インデックス可能

-- 検索
SELECT * FROM users
WHERE email_hmac = hmac('alice@example.com', 'hmac-secret', 'sha256');
```

## データプライバシーの設計チェックリスト

```
収集フェーズ:
  □ 収集する個人情報は本当に必要か（データ最小化原則）
  □ 取得目的を明示しているか（目的制限原則）
  □ 同意を記録しているか

保存フェーズ:
  □ 保存期間を設定しているか（ストレージ制限原則）
  □ at-rest暗号化を有効にしているか
  □ フィールドレベル暗号化が必要なカラムはあるか

削除フェーズ:
  □ 削除要求のワークフローが存在するか
  □ バックアップからも削除できるか（Crypto-Shreddingの採用）
  □ 連携している下流サービスへの削除通知はあるか

アクセス制御:
  □ Row Level Securityを設定しているか
  □ 個人情報へのアクセスを監査ログに記録しているか
```

## Kafkaでのデータ削除

```
Kafkaのトピックは不変のログが原則

対策1: Compactionトピック + トゥームストーン
  key=user_id, value=null のメッセージを送信
  → Compaction時に過去の同キーのメッセージが削除される
  → 個人情報の論理削除

対策2: Crypto-Shredding（推奨）
  個人情報を暗号化してKafkaに保存
  鍵を削除すれば過去のイベントも事実上削除
```

## 関連概念

- → [イベントソーシング](./concepts_backend_event_sourcing.md)（不変ログとの矛盾を解決）
- → [Row Level Security](./concepts_ddia_row_level_security.md)（アクセス制御の実装）
- → [エンコーディングとスキーマ進化](./concepts_ddia_encoding.md)（暗号化フィールドのスキーマ管理）
- → [バックアップとPITR](./concepts_ddia_backup_pitr.md)（バックアップからの個人情報削除）

## 出典・参考文献

- Martin Kleppmann, *Designing Data-Intensive Applications* (2017) Chapter 12
- GDPR Article 17, "Right to Erasure" — gdpr-info.eu
- Michiel Rook, "Event Sourcing and the GDPR: a Primer" (2017)
- AWS, "Implementing GDPR Compliant Architectures on AWS" — aws.amazon.com
