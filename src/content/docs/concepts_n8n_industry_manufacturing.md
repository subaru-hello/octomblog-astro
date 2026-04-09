---
category: "概念"
order: 306
title: n8n 製造・工場業界の活用ガイド
description: 製造業における受発注管理・在庫監視・品質管理・サプライヤー連携をn8nで自動化するユースケースガイド。IoTデータ処理とERP連携の実装パターンを解説。
tags: ["n8n", "製造業", "工場", "ERP", "IoT", "在庫管理", "サプライチェーン", "業種別"]
emoji: "🏭"
date: "2026-04-09"
source: "https://www.oneclickitsolution.com/centerofexcellence/aiml/n8n-manufacturing-logistics-automation"
series:
  - n8n業種別ユースケース
---

## 製造・工場の自動化ポイント

製造業では**受注→生産計画→調達→品質管理→出荷**の各工程で情報の連携が手動になりがち。n8nで連携を自動化できる。

## 主要ユースケース一覧

### 受注から生産指示の自動フロー

顧客から受注が入った瞬間に在庫確認・生産スケジュール更新・仕入れ発注を自動で実行。

```
[Webhook/メール: 受注データ受信]
    ↓
[ERP API: 在庫確認]
    ↓
[IF: 在庫あり]
  ├── あり → [生産スケジュールに追加] → [出荷チームに通知]
  └── なし → [仕入れ先に発注メール] → [顧客に納期連絡]
```

**実績**: 製造業での導入事例で受注処理時間を78%削減（n8n案例）

---

### 在庫しきい値アラート＆自動発注

原材料・部品の在庫が設定量を下回ると、自動で仕入れ先に発注メールを送り、在庫管理システムを更新する。

**使用ノード**: Schedule Trigger（毎時確認）→ HTTP Request（ERP在庫API）→ Filter（しきい値以下）→ Gmail（仕入れ先へ発注）→ Google Sheets（発注記録）

---

### IoTセンサーデータの収集・アラート

工場設備のセンサーデータを受信し、異常値を検知した際に担当者へ即座に通知する。

```
[Webhook: IoTセンサーデータ受信]
    ↓
[Code: 閾値判定・異常検知]
    ↓
[IF: 異常値]
  ├── 軽度 → [Slack: 担当者に警告]
  └── 重大 → [Slack: @here 緊急通知] + [メール: 管理職へ]
    ↓
[Airtable/DB: センサーログ記録]
```

---

### サプライヤーからの納期情報自動収集

複数の仕入れ先からの納期回答メールをAIで解析し、納期管理Excelを自動更新する。

**使用ノード**: Gmail Trigger（仕入れ先メール受信）→ OpenAI（メールから納期日・品番を抽出）→ Google Sheets（納期表を更新）→ Slack（遅延リスクのある品番を通知）

---

### 品質検査レポートの自動生成

検査結果をフォームで入力すると、合否判定・不合格理由・是正処置をレポート化して関係者に自動送付する。

| ステップ | ノード |
|---|---|
| 検査結果フォーム入力 | Jotform / Google Forms |
| 合否判定ロジック | Code（IF/スコアリング） |
| レポートPDF生成 | Code（pdfkit） |
| 関係者への配布 | Gmail / Slack |
| 不合格品のエスカレーション | Slack（管理者メンション） |

---

### 出荷・配送状況の自動追跡・通知

配送業者のトラッキングAPIと連携し、出荷から配達完了まで顧客・営業担当に自動で状況通知を送る。

**使用ノード**: Schedule Trigger → HTTP Request（ヤマト/佐川APIなど）→ IF（ステータス変化）→ Gmail（顧客通知）→ Slack（営業担当に通知）

---

## おすすめ連携サービス

| サービス | 用途 |
|---|---|
| SAP / SCSK / 弥生 | ERP連携 |
| MQTT / HTTP Webhook | IoTデバイスデータ受信 |
| Google Sheets / Airtable | 生産・在庫管理台帳 |
| Twilio | 緊急SMS通知 |
| DocuSign | 取引先との書類自動化 |

## 参照ドキュメント

- [HTTP Request・API連携](./concepts_n8n_http_api.md)
- [エラーハンドリング](./concepts_n8n_error_handling.md)
- [Codeノード](./concepts_n8n_code_node.md)
