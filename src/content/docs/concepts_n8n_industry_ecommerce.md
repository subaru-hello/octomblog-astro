---
category: "概念"
order: 305
title: n8n EC・小売業界の活用ガイド
description: ECサイト・小売業界における注文処理・在庫管理・顧客対応・マーケティングをn8nで自動化するユースケースと実装パターン。Shopify・WooCommerceとの連携方法。
tags: ["n8n", "EC", "小売", "Shopify", "WooCommerce", "在庫管理", "注文自動化", "業種別"]
emoji: "🛒"
date: "2026-04-09"
source: "https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.shopify/"
series:
  - n8n業種別ユースケース
---

## EC・小売の自動化ポイント

ECビジネスでは**注文→在庫→発送→顧客対応→レビュー**のサイクルに多くの手作業が発生する。

## 主要ユースケース一覧

### 注文処理の完全自動化

Shopifyで注文が入った瞬間に倉庫通知・在庫更新・顧客への注文確認メールを同時実行。

```
[Shopify Trigger: 新規注文]
    ↓（並列処理）
[倉庫システムAPI: 出荷指示]
[Google Sheets: 在庫数を更新]
[Gmail: 注文確認メールを顧客へ]
[Slack: #operations に注文通知]
    ↓
[IF: 在庫不足]
  └── [Slack: 仕入れ担当にアラート]
```

**効果**: 注文処理が人手を介さず数秒で完了

---

### 在庫切れ自動アラート＋発注

在庫が閾値を下回った際に仕入れ先へ自動で発注メールを送り、Google Sheetsの在庫表を更新する。

**使用ノード**: Schedule Trigger（毎日確認）→ HTTP Request（在庫API）→ Filter（閾値以下の商品）→ Gmail（仕入れ先へ発注）→ Google Sheets（在庫記録）

---

### カート放棄者へのリマインダー

カートに商品を入れたまま購入しなかった顧客に、24時間後・72時間後にリマインダーメールを自動送信。

```
[Shopify Webhook: カート作成イベント]
    ↓
[Airtable: カート情報を記録]
    ↓
[Wait: 24時間]
    ↓
[IF: まだ購入されていないか確認]
  └── 未購入 → [Gmail: カートリマインダーメール]
                    ↓
               [Wait: 48時間後]
                    ↓
               [Gmail: クーポン付き最終リマインダー]
```

---

### レビュー収集の自動化

発送完了から7日後に自動でレビュー依頼メールを送る。Googleレビュー・Trustpilot・ECサイト内レビューに対応。

**使用ノード**: Shopify Trigger（発送完了）→ Wait（7日）→ Gmail（レビュー依頼メール with リンク）

---

### マルチチャネル在庫同期

自社EC・Amazon・楽天・Yahoo!ショッピングの在庫を一元管理して常に同期する。

| 販売チャネル | 接続方法 |
|---|---|
| 自社Shopify | Shopifyノード |
| Amazon | HTTP Request（MWS API） |
| 楽天 | HTTP Request（RMS API） |
| Yahoo! | HTTP Request（Yahoo!商店API） |

---

### 季節・イベントセールの自動スケジューリング

セール価格・バナー変更・SNS投稿を指定日時に一括実行する。

```
[Schedule Trigger: セール開始日時]
    ↓
[Shopify: 商品価格を一括変更]
[SNS: セール告知投稿を公開]
[Gmail: メルマガ配信]
    ↓
[Schedule Trigger: セール終了日時]
    ↓
[Shopify: 価格を元に戻す]
```

---

## おすすめ連携サービス

| サービス | 用途 |
|---|---|
| Shopify / WooCommerce | ECプラットフォーム |
| Stripe / PAY.JP | 決済処理 |
| SendGrid / Brevo | トランザクションメール |
| Klaviyo | ECマーケティングオートメーション |
| Zendesk | カスタマーサポート |
| Google Analytics / GA4 | アクセス解析 |

## 参照ドキュメント

- [Shopify注文自動処理のユースケース](./concepts_n8n_usecase_shopify_order.md)
- [トリガーの種類](./concepts_n8n_triggers.md)
- [エラーハンドリング](./concepts_n8n_error_handling.md)
