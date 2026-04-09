---
title: DBセキュリティと権限管理
description: SQL Injection対策・最小権限の原則（GRANT/REVOKE）・接続のTLS設定・監査ログを体系的に理解する。RLSと組み合わせた多層防御の設計を理解する
category: "概念"
tags: ["データ設計", "セキュリティ", "SQL Injection", "PostgreSQL", "権限管理", "DDIA"]
emoji: "🔑"
date: "2026-04-08"
order: 846
series:
  - データ志向アプリケーション設計（DDIA）
source: "OWASP Top 10 / PostgreSQL Documentation"
---

## 定義

DBセキュリティとは、データへの不正アクセス・改ざん・漏洩を防ぐための技術的制御の総体。アプリ層・DB層・ネットワーク層の多層防御（Defense in Depth）が基本原則。

## SQL Injection（最も重大な脆弱性）

OWASPが長年トップに挙げる脆弱性。ユーザー入力がSQLとして解釈される問題。

```typescript
// ❌ 脆弱な実装（文字列連結）
const userId = req.query.id; // 攻撃者が "1 OR 1=1" を入力
const query = `SELECT * FROM users WHERE id = ${userId}`;
// 実行されるSQL: SELECT * FROM users WHERE id = 1 OR 1=1
// → 全ユーザーのデータが返る

// さらに危険な例
const name = req.query.name; // 攻撃者が "'; DROP TABLE users; --" を入力
const query = `SELECT * FROM users WHERE name = '${name}'`;
// → テーブルが削除される
```

```typescript
// ✅ 安全な実装（パラメータ化クエリ / プリペアドステートメント）
// ユーザー入力は常に $1, $2 ... で渡す
const userId = req.query.id;
const result = await db.query(
  'SELECT * FROM users WHERE id = $1',
  [userId]  // ← 値として扱われる。SQLとして解釈されない
);

// ORMを使う場合も同様（Prisma）
const user = await prisma.user.findUnique({
  where: { id: userId },  // 内部でパラメータ化される
});
```

### LIKE句でのインジェクション

```typescript
// ❌ LIKE句でもパラメータ化が必要
const search = req.query.q; // 攻撃者が "%" を入力
const query = `SELECT * FROM products WHERE name LIKE '%${search}%'`;
// → '%' → 全件返る（大量データの引き出し）

// ✅ LIKE特殊文字をエスケープ
function escapeLike(str: string) {
  return str.replace(/[%_\\]/g, '\\$&');
}
const safeSearch = escapeLike(req.query.q);
await db.query(
  "SELECT * FROM products WHERE name LIKE $1 ESCAPE '\\'",
  [`%${safeSearch}%`]
);
```

## 最小権限の原則（Principle of Least Privilege）

アプリが必要とする権限だけを付与する。

```sql
-- ❌ アンチパターン: アプリからスーパーユーザーで接続
-- スーパーユーザーはすべての操作ができてしまう

-- ✅ 専用のアプリユーザーを作成
CREATE USER app_user WITH PASSWORD 'secure_password';

-- 必要なテーブルへの権限のみ付与
GRANT SELECT, INSERT, UPDATE ON orders TO app_user;
GRANT SELECT, INSERT, UPDATE ON order_items TO app_user;
GRANT SELECT ON products TO app_user;  -- 参照のみ
GRANT SELECT ON users TO app_user;

-- SEQUENCEへのアクセス（SERIAL/BIGSERIALで必要）
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- スキーマへのアクセス
GRANT USAGE ON SCHEMA public TO app_user;

-- 今後作成されるテーブルへの自動付与
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
```

### ロールベースの権限管理

```sql
-- ロールを使った権限管理
CREATE ROLE readonly;
CREATE ROLE readwrite;
CREATE ROLE admin;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO readwrite;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin;

-- ユーザーにロールを割り当て
CREATE USER analyst_user WITH PASSWORD 'xxx';
GRANT readonly TO analyst_user;

CREATE USER api_user WITH PASSWORD 'xxx';
GRANT readwrite TO api_user;

-- 用途別のDB接続ユーザー
-- app_user    → アプリのAPI（readwrite）
-- migration_user → マイグレーションツール（DDL権限も必要）
-- readonly_user  → 分析・BI接続（SELECT のみ）
-- backup_user   → バックアップ（REPLICATION権限）
```

## TLS/SSL接続の強制

```sql
-- postgresql.conf
ssl = on
ssl_cert_file = 'server.crt'
ssl_key_file  = 'server.key'
ssl_ca_file   = 'ca.crt'      -- クライアント証明書の検証に使う

-- pg_hba.conf（接続認証設定）
# TYPE  DATABASE  USER       ADDRESS      METHOD
hostssl all       all        0.0.0.0/0    scram-sha-256  # TLSのみ許可
host    all       all        127.0.0.1/32 reject          # ローカルからのTLSなし拒否
```

```typescript
// アプリ側: TLSを要求
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true,  // サーバー証明書を検証
    ca: fs.readFileSync('ca.crt').toString(),  // CA証明書
  },
});
```

## 監査ログ（Audit Logging）

誰が何をいつアクセスしたかを記録する。

```sql
-- pgaudit拡張（PostgreSQL公式の監査拡張）
CREATE EXTENSION pgaudit;

-- postgresql.conf
-- pgaudit.log = 'read,write,ddl'  # 監査対象の操作
-- pgaudit.log_catalog = off        # システムカタログへのアクセスは除外
-- pgaudit.log_relation = on        # テーブル名を記録

-- 監査ログの例（PostgreSQLログに出力）:
-- LOG: AUDIT: SESSION,1,1,READ,SELECT,,,"SELECT * FROM users WHERE id = 1",<none>
```

```sql
-- アプリ定義の監査テーブル（より細かい制御）
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_name VARCHAR(100),
  operation VARCHAR(10),  -- INSERT/UPDATE/DELETE
  old_data JSONB,
  new_data JSONB,
  changed_by VARCHAR(100) DEFAULT current_user,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  app_user_id UUID  -- アプリレベルのユーザーID（SET LOCALで渡す）
);

-- トリガーで自動記録
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (table_name, operation, old_data, new_data, app_user_id)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD)::jsonb ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW)::jsonb ELSE NULL END,
    current_setting('app.user_id', true)::uuid  -- アプリがセットしたユーザーID
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_users
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
```

## シークレット管理

```bash
# ❌ 環境変数への直書き（ソースコードにコミットされるリスク）
DATABASE_URL=postgresql://user:password@host/db

# ✅ シークレット管理サービスを使う
# AWS Secrets Manager
aws secretsmanager get-secret-value --secret-id prod/db/password

# HashiCorp Vault
vault kv get secret/db/production

# Kubernetes Secret（Base64エンコードのみ、暗号化ではない）
kubectl create secret generic db-secret \
  --from-literal=password='secure_password'
```

```typescript
// アプリ起動時にシークレットを動的に取得
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

async function getDatabaseUrl(): Promise<string> {
  const client = new SecretsManagerClient({ region: 'ap-northeast-1' });
  const command = new GetSecretValueCommand({ SecretId: 'prod/db' });
  const response = await client.send(command);
  const secret = JSON.parse(response.SecretString!);
  return `postgresql://${secret.username}:${secret.password}@${secret.host}/${secret.dbname}`;
}
```

## 多層防御のまとめ

```
Layer 1: ネットワーク
  → DBをプライベートサブネットに配置（インターネットから直接アクセス不可）
  → セキュリティグループでアプリサーバーのIPのみ許可
  → TLS接続を強制

Layer 2: 認証
  → 強力なパスワード（scram-sha-256）
  → シークレット管理サービス
  → IAM認証（AWS RDS IAM Auth等）

Layer 3: 認可
  → 最小権限のロール
  → Row Level Security（マルチテナント）
  → スキーマ分離

Layer 4: アプリケーション
  → パラメータ化クエリ（SQL Injection防止）
  → 入力バリデーション

Layer 5: 監視・監査
  → 監査ログ（pgaudit）
  → 異常なクエリの検出
  → 定期的な権限レビュー
```

## 関連概念

- → [Row Level Security](./concepts_ddia_row_level_security.md)（DBレベルのアクセス制御）
- → [データプライバシーとCrypto-Shredding](./concepts_ddia_data_privacy.md)（暗号化との組み合わせ）
- → [コネクションプーリング](./concepts_ddia_connection_pooling.md)（TLS接続とPgBouncer）
- → [DBモニタリング](./concepts_ddia_db_observability.md)（監査ログの監視）

## 出典・参考文献

- OWASP, "SQL Injection" — owasp.org/www-community/attacks/SQL_Injection
- PostgreSQL Documentation, "Client Authentication" — postgresql.org/docs/current/client-authentication.html
- pgaudit Documentation — github.com/pgaudit/pgaudit
