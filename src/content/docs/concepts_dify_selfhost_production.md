---
category: "概念"
order: 151
title: Difyセルフホスト本番構成ガイド（Docker・セキュリティ・スケーリング）
description: DifyをDocker Composeで本番運用するための設定・SSL/Nginx構成・PostgreSQLバックアップ・スケーリング設計・セキュリティ強化のポイントを実践的に解説。
tags: ["Dify", "セルフホスト", "Docker", "本番運用", "インフラ", "セキュリティ", "エコシステム"]
emoji: "🖥️"
date: "2026-04-09"
source: "Dify公式ドキュメント / セルフホストデプロイガイド"
series:
  - Dify実践ガイド
---

## セルフホストを選ぶ理由

```
Dify Cloud（SaaS）との比較:

セルフホストが必要なケース:
  ✅ 個人情報・機密情報を外部サーバーに送りたくない
  ✅ 金融・医療・行政など規制業界でのデータ主権が必要
  ✅ 月額コストを変動費ではなくインフラ固定費にしたい
  ✅ カスタム統合（社内 SSO・Active Directory）が必要
  ✅ 大量処理でクラウドプランの制限に引っかかる

Dify Cloud で十分なケース:
  → 個人利用・PoC・非機密データ・スモールスタート
```

---

## 構成オプションの選択

```
デプロイ方式:

Docker Compose（推奨: 小〜中規模）:
  チーム: 〜50名 / DAU: 〜1,000
  セットアップ: 30分
  インフラ知識: 低〜中
  コスト: VPS 1台（月 $20〜$100）

Docker Compose + 外部 DB（中規模）:
  チーム: 〜200名 / DAU: 〜5,000
  PostgreSQL と Redis を外部マネージドサービスに分離
  障害時の影響を DB と App で分離できる

Kubernetes（大規模）:
  チーム: 200名〜 / DAU: 5,000〜
  高可用性・自動スケーリングが必要な場合
  インフラ知識: 高
  このドキュメントでは Docker Compose を中心に解説する
```

---

## Docker Compose 本番構成

### ディレクトリ構成

```
dify-production/
  ├── docker-compose.prod.yml    ← 本番用設定
  ├── .env.production            ← シークレット（Git 管理外）
  ├── nginx/
  │   ├── nginx.conf
  │   └── ssl/
  │       ├── cert.pem
  │       └── key.pem
  └── volumes/
      ├── postgres/
      ├── redis/
      └── storage/               ← アップロードファイル
```

### 本番向け docker-compose.prod.yml

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - web
      - api
    restart: always

  api:
    image: langgenius/dify-api:latest
    env_file: .env.production
    environment:
      MODE: api
    volumes:
      - ./volumes/storage:/app/api/storage
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: always
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G

  worker:
    image: langgenius/dify-api:latest
    env_file: .env.production
    environment:
      MODE: worker
    volumes:
      - ./volumes/storage:/app/api/storage
    depends_on:
      - db
      - redis
    restart: always
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G

  web:
    image: langgenius/dify-web:latest
    env_file: .env.production
    restart: always

  db:
    image: postgres:15-alpine
    env_file: .env.production
    environment:
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - ./volumes/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: always
    deploy:
      resources:
        limits:
          memory: 2G

  redis:
    image: redis:7-alpine
    volumes:
      - ./volumes/redis:/data
    command: redis-server --requirepass ${REDIS_PASSWORD} --save 60 1
    healthcheck:
      test: ["CMD", "redis-cli", "--auth", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
    restart: always

  vector-db:
    image: qdrant/qdrant
    volumes:
      - ./volumes/qdrant:/qdrant/storage
    restart: always
    deploy:
      resources:
        limits:
          memory: 4G
```

### .env.production の設定項目

```bash
# =========================
# 必須設定
# =========================

# Django シークレットキー（32文字以上のランダム文字列）
SECRET_KEY=your-very-long-random-secret-key-here-min-32-chars

# DB 設定
POSTGRES_USER=dify
POSTGRES_PASSWORD=strong-random-password-here
POSTGRES_DB=dify
DB_HOST=db

# Redis 設定
REDIS_PASSWORD=strong-redis-password
REDIS_HOST=redis

# ベクターDB
VECTOR_STORE=qdrant
QDRANT_URL=http://vector-db:6333

# ストレージ（ローカル or S3）
STORAGE_TYPE=local
# AWS S3 を使う場合:
# STORAGE_TYPE=s3
# S3_BUCKET_NAME=dify-files
# S3_ACCESS_KEY=...
# S3_SECRET_KEY=...
# S3_REGION=ap-northeast-1

# =========================
# モデルプロバイダー
# =========================

OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# AZURE_OPENAI_API_KEY=...

# =========================
# メール設定（パスワードリセット等）
# =========================

MAIL_TYPE=smtp
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=app-specific-password
MAIL_DEFAULT_SEND_FROM=noreply@yourdomain.com

# =========================
# セキュリティ設定
# =========================

# セルフサインアップを無効化（招待のみに限定）
ALLOW_REGISTER=false

# CORS（フロントエンドのドメインを指定）
WEB_API_CORS_ALLOW_ORIGINS=https://dify.yourdomain.com
```

---

## Nginx / SSL 設定

```nginx
# nginx/nginx.conf

server {
    listen 80;
    server_name dify.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name dify.yourdomain.com;

    ssl_certificate     /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # アップロードファイルサイズ上限（PDF・画像等）
    client_max_body_size 100M;

    # Web フロントエンド
    location / {
        proxy_pass http://web:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # API
    location /api/ {
        proxy_pass http://api:5001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 300s;    # 長い処理のタイムアウト延長
    }

    # Streaming レスポンス（SSE）
    location /api/v1/chat-messages {
        proxy_pass http://api:5001/v1/chat-messages;
        proxy_buffering off;         # SSE に必須
        proxy_cache off;
        proxy_read_timeout 600s;
    }
}
```

SSL 証明書の取得（Let's Encrypt）:
```bash
# Certbot を使った自動取得
docker run --rm -v ./nginx/ssl:/etc/letsencrypt certbot/certbot \
  certonly --standalone \
  -d dify.yourdomain.com \
  --email admin@yourdomain.com \
  --agree-tos
```

---

## バックアップ設計

```bash
#!/bin/bash
# backup.sh — 日次バックアップスクリプト

BACKUP_DIR="/backup/dify/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# PostgreSQL バックアップ
docker exec dify-db pg_dump \
  -U $POSTGRES_USER $POSTGRES_DB \
  | gzip > $BACKUP_DIR/postgres.sql.gz

# アップロードファイルのバックアップ
tar czf $BACKUP_DIR/storage.tar.gz ./volumes/storage

# 7日以上前のバックアップを削除
find /backup/dify -type d -mtime +7 -exec rm -rf {} +

echo "Backup completed: $BACKUP_DIR"
```

```bash
# crontab に追加（毎日午前2時に実行）
0 2 * * * /opt/dify/backup.sh >> /var/log/dify-backup.log 2>&1
```

---

## スケーリング設計

### 水平スケーリング（負荷が高い場合）

```yaml
# worker を複数起動してバッチ処理を並列化
services:
  worker:
    image: langgenius/dify-api:latest
    deploy:
      replicas: 3    # worker を3台並列起動
      resources:
        limits:
          cpus: '2'
          memory: 4G
```

### ボトルネック別の対処

```
症状: API レスポンスが遅い
  原因候補: LLM プロバイダーのレイテンシ・ネットワーク
  対処: モデルの streaming 応答を有効にする（体感速度改善）

症状: バッチ処理が詰まる
  原因候補: worker の不足
  対処: worker replicas を増やす（上記参照）

症状: DB の CPU が高い
  原因候補: ナレッジベースの大量インデックス処理
  対処: PostgreSQL のスペックアップ、または外部マネージドDB への移行
       （AWS RDS / Google Cloud SQL / Supabase）

症状: ディスク I/O が高い
  原因候補: ベクターDBへの大量クエリ
  対処: Qdrant をより高性能なノードに移行
       または Weaviate Cloud / Pinecone に切り替え
```

---

## セキュリティ強化チェックリスト

```
ネットワーク:
  □ DB・Redis ポートを外部に公開しない（internal network のみ）
  □ Nginx でレート制限を設定する（DDoS 対策）
  □ WAF（Cloudflare 等）を前段に配置する

認証・アクセス制御:
  □ ALLOW_REGISTER=false でセルフサインアップを無効化
  □ 管理者パスワードを強固なものに変更
  □ 不要な API キーを無効化する

シークレット管理:
  □ .env ファイルを Git に含めない（.gitignore に追加）
  □ 本番環境変数は AWS Secrets Manager / Vault で管理
  □ API キーを定期的にローテーションする

監視:
  □ コンテナの死活監視（Uptime Kuma・Datadog）
  □ ディスク使用量の監視（storage が溢れると停止する）
  □ PostgreSQL の接続数監視
```

---

## 参考：関連ドキュメント

- [Dify API・公開・デプロイ](concepts_dify_api_deployment.md) — API エンドポイントの仕様
- [Dify Enterprise機能ガイド](concepts_dify_enterprise.md) — SSO・RBAC の設定
- [本番リリース前チェックリスト](concepts_dify_production_checklist.md) — リリース前の確認事項
- [可観測性・デバッグ・評価](concepts_dify_observability.md) — ログ・監視の設定
