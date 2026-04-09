---
title: OpenTelemetryとDBトレーシング
description: アプリからDBへのクエリをトレースIDで追跡するObservabilityの実践。メトリクス・トレース・ログの3本柱でN+1やスロークエリをリクエスト単位で特定する方法を理解する
category: "概念"
tags: ["データ設計", "OpenTelemetry", "可観測性", "トレーシング", "PostgreSQL", "DDIA"]
emoji: "🔭"
date: "2026-04-09"
order: 849
series:
  - データ志向アプリケーション設計（DDIA）
source: "OpenTelemetry Documentation / Martin Kleppmann, DDIA Chapter 1"
---

## 定義

**OpenTelemetry（OTel）**：メトリクス・トレース・ログの収集・伝搬・エクスポートを標準化したCNCFプロジェクト。ベンダー中立のSDK/APIを提供し、JaegerやGrafana Tempoなど任意のバックエンドに送信できる。

## pg_stat_statementsとの根本的な違い

```
pg_stat_statements（従来のモニタリング）:
  単位: クエリテンプレート単位の集計値
  "SELECT * FROM orders WHERE user_id = $1" → 平均82ms、1,234回実行
  
  問題: どのHTTPリクエストでそのクエリが重いのか分からない
         同じクエリでも user_id=1 と user_id=99999 で速度が全然違うかも

OpenTelemetry（分散トレーシング）:
  単位: 1リクエストのライフサイクル全体
  GET /api/orders/123 → 320ms
    ├── auth middleware: 12ms
    ├── DB: SELECT orders WHERE user_id = $1: 45ms  ← user_id=123のケース
    ├── DB: SELECT order_items WHERE order_id IN (...): 220ms  ← N+1!
    └── render: 43ms
    
  → 「このリクエストのどこが遅いか」が一目でわかる
  → N+1問題がトレースビューに視覚的に現れる
```

## OpenTelemetryの3本柱

```
Traces（トレース）:
  1リクエストの処理フローをスパン（Span）のツリーとして記録
  各スパン: 開始時刻・終了時刻・属性・イベント・親スパンID
  → 分散システムを横断する処理の可視化

Metrics（メトリクス）:
  数値の時系列データ
  例: db.client.connections.usage（接続プール使用率）
  → ダッシュボード・アラートに使う

Logs（ログ）:
  テキストイベント。トレースIDを含めることでトレースと連携
  → スパン内の詳細な出来事を記録
```

## 自動計装（Auto-Instrumentation）

OpenTelemetryの最大の利点は、コードを変えずにDBクエリを自動でトレースできる点。

```typescript
// Node.js（@opentelemetry/auto-instrumentations-node）
// エントリポイントの最初に読み込む
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: 'http://otel-collector:4317',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // PostgreSQL（pg ライブラリ）を自動計装
      '@opentelemetry/instrumentation-pg': {
        enhancedDatabaseReporting: true,  // SQLクエリをスパン属性に含める
      },
      // HTTP/Express も自動計装
      '@opentelemetry/instrumentation-express': { enabled: true },
      '@opentelemetry/instrumentation-http': { enabled: true },
    }),
  ],
});

sdk.start();
// ← これだけで pg の全クエリが自動でトレースされる
```

```python
# Python（opentelemetry-instrumentation-psycopg2）
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.instrumentation.psycopg2 import Psycopg2Instrumentor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

# 自動計装
Psycopg2Instrumentor().instrument()
FastAPIInstrumentor().instrument_app(app)
```

## スパンに記録されるDB属性

OpenTelemetryの[セマンティック規約](https://opentelemetry.io/docs/specs/semconv/database/)で定義されたDB系の標準属性。

```
db.system: "postgresql"
db.name: "myapp"
db.user: "app_user"
db.statement: "SELECT * FROM orders WHERE user_id = $1"
db.operation: "SELECT"
net.peer.name: "db.example.com"
net.peer.port: 5432

// スパンの例
Span: db.postgresql
  duration: 45ms
  status: OK
  attributes:
    db.system: postgresql
    db.statement: SELECT id, total_amount FROM orders WHERE user_id = $1
    db.rows_affected: 42
    // N+1検出のヒントになる
```

## N+1問題のトレースビュー

```
HTTPリクエスト: GET /api/users/1/timeline (850ms)
│
├── db.query: SELECT * FROM posts WHERE user_id = $1 (12ms) → 20件取得
│
├── db.query: SELECT * FROM users WHERE id = $1 (3ms) ← user_id=2
├── db.query: SELECT * FROM users WHERE id = $1 (4ms) ← user_id=5
├── db.query: SELECT * FROM users WHERE id = $1 (3ms) ← user_id=8
├── db.query: SELECT * FROM users WHERE id = $1 (4ms) ← user_id=12
│   ... (合計20回のクエリ = N+1!)
│
└── render (15ms)

→ Jaeger/Grafana Tempoで見ると20個のDBスパンが並ぶ
→ 「同じクエリが繰り返されている」と一目で分かる
```

## 手動計装（カスタムスパン）

```typescript
import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('order-service');

async function processOrder(orderId: string) {
  // カスタムスパンでビジネスロジックをトレース
  return tracer.startActiveSpan('order.process', async (span) => {
    span.setAttributes({
      'order.id': orderId,
      'order.source': 'web',
    });
    
    try {
      const order = await db.query(
        'SELECT * FROM orders WHERE id = $1',
        [orderId]
      );
      // DBクエリは自動計装で子スパンとして記録される
      
      span.addEvent('inventory.checked', {
        'inventory.available': true,
      });
      
      return order;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}
```

## コレクター構成（OpenTelemetry Collector）

```yaml
# otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 1s
    send_batch_size: 1000
  
  # スロークエリのフィルタリング（100ms以上のみ保存）
  filter:
    traces:
      span:
        - 'duration < 100ms and attributes["db.system"] != nil'

exporters:
  # Grafana Tempo（トレース）
  otlp/tempo:
    endpoint: tempo:4317
    tls:
      insecure: true
  
  # Prometheus（メトリクス）
  prometheus:
    endpoint: 0.0.0.0:8889

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp/tempo]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [prometheus]
```

## Grafanaダッシュボードでの可視化

```
Grafana Tempo + Grafana の組み合わせ:

1. トレース検索:
   service.name = "order-service" AND db.system = "postgresql"
   → スロークエリを含むリクエスト一覧

2. スパン詳細:
   特定のトレースIDをクリック
   → ウォーターフォール図でDBクエリの位置を確認

3. TraceQL（クエリ言語）:
   { span.db.statement =~ ".*orders.*" && duration > 100ms }
   → orderテーブルへの100ms超クエリを含むトレース

4. メトリクスとの連携（Exemplars）:
   Prometheusのメトリクスグラフのスパイク点をクリック
   → その時刻の具体的なトレースに直接ジャンプ
```

## コネクションプールのメトリクス

自動計装はクエリだけでなく接続プールの状態も記録する。

```
db.client.connections.usage（gauge）:
  state=idle:  5（待機中の接続）
  state=used:  15（使用中の接続）

db.client.connections.max: 20（最大接続数）

db.client.connections.wait_time（ヒストグラム）:
  p50: 2ms
  p99: 450ms  ← 接続枯渇の兆候
  
→ p99が高い場合: PgBouncerのpool_sizeを増やす、
  またはコネクションを長時間保持しているトランザクションを特定
```

## サンプリング戦略

全トレースを保存するとストレージコストが膨大になる。

```typescript
import { ParentBasedSampler, TraceIdRatioBased } from '@opentelemetry/sdk-trace-base';

const sdk = new NodeSDK({
  // ヘッドベースサンプリング: リクエスト開始時に判定
  sampler: new ParentBasedSampler({
    root: new TraceIdRatioBased(0.1),  // 10%のリクエストをサンプリング
  }),
  // ...
});
```

```yaml
# テールベースサンプリング（Collectorで設定）
# エラーやスロークエリを含むトレースは必ず保存
processors:
  tail_sampling:
    decision_wait: 10s
    policies:
      - name: errors-policy
        type: status_code
        status_code: { status_codes: [ERROR] }
      - name: slow-traces-policy
        type: latency
        latency: { threshold_ms: 500 }
      - name: probabilistic-policy
        type: probabilistic
        probabilistic: { sampling_percentage: 5 }
```

## 実践的なデバッグフロー

```
1. Grafanaでアラート発火
   「p99レイテンシが500msを超えた」

2. Traceを検索
   service.name = "api" AND duration > 500ms AND status = ERROR

3. スパンを展開
   GET /api/checkout → 750ms
     ├── auth: 15ms
     ├── db: SELECT cart WHERE user_id = $1: 8ms
     ├── db: SELECT product WHERE id = $1: 5ms（×12回 = N+1）
     ├── db: INSERT INTO orders: 35ms
     └── db: UPDATE inventory SET stock = $1: 680ms ← スロークエリ特定

4. EXPLAINで原因調査
   EXPLAIN ANALYZE UPDATE inventory SET stock = $1 WHERE product_id = $2;
   → Seq Scan（インデックス欠落を発見）

5. インデックス追加
   CREATE INDEX idx_inventory_product_id ON inventory(product_id);
```

## 関連概念

- → [DBモニタリング](./concepts_ddia_db_observability.md)（pg_stat_statementsとの組み合わせ）
- → [N+1問題とDataLoader](./concepts_ddia_n_plus_one.md)（トレースでN+1を検出する）
- → [コネクションプーリング](./concepts_ddia_connection_pooling.md)（接続プールメトリクス）
- → [クエリオプティマイザーとEXPLAIN](./concepts_ddia_query_optimizer.md)（スロークエリ特定後の分析）

## 出典・参考文献

- OpenTelemetry Documentation — opentelemetry.io/docs
- OpenTelemetry Semantic Conventions for Database — opentelemetry.io/docs/specs/semconv/database
- Grafana Tempo Documentation — grafana.com/docs/tempo
