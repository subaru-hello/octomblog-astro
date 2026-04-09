---
category: "概念"
order: 152
title: Dify Enterprise機能ガイド（SSO・RBAC・監査ログ・マルチワークスペース）
description: 大企業・組織でDifyを安全に展開するためのEnterprise機能。SSO（SAML/OIDC）・ロールベースアクセス制御・監査ログ・マルチワークスペース管理の設計と実装を解説。
tags: ["Dify", "Enterprise", "SSO", "RBAC", "セキュリティ", "組織管理", "エコシステム"]
emoji: "🏢"
date: "2026-04-09"
source: "Dify公式ドキュメント / Enterprise Edition ガイド"
series:
  - Dify実践ガイド
---

## Dify Enterprise とは

```
Dify には3つのエディションがある:

Community Edition（CE）:
  → OSS。GitHub から無料で利用可能
  → 個人・小チーム向け
  → SSO・高度なアクセス制御なし

Dify Cloud Pro/Teams:
  → SaaS 形式。クレジットカード課金
  → チームコラボレーション機能あり
  → データはDify クラウドに保存される

Enterprise Edition（EE）:
  → セルフホスト前提
  → 大企業・規制業界向け
  → SSO・RBAC・監査ログ・マルチワークスペース
  → ライセンス購入が必要
  → 本番データを自社インフラに保持できる
```

---

## SSO（シングルサインオン）

### 対応プロトコル

```
SAML 2.0:
  → Microsoft Entra ID（旧 Azure AD）
  → Okta
  → OneLogin
  → Google Workspace（管理者設定が必要）

OIDC（OpenID Connect）:
  → Okta
  → Auth0
  → Keycloak（OSS・セルフホスト）
  → GitLab
  → GitHub Enterprise

設定の流れ（SAML の場合）:
  1. IdP（Okta 等）で Dify のアプリを登録
  2. IdP の Metadata XML を取得
  3. Dify の管理画面 → Enterprise → SSO 設定に貼り付け
  4. ユーザーが Dify にアクセスするとIDPにリダイレクト
  5. 認証成功後、Dify に戻ってくる（SAML Response）
```

### Okta SAML 設定例

```
Okta 側の設定:
  App type: SAML 2.0
  Single sign on URL: https://dify.yourdomain.com/api/enterprise/sso/saml/acs
  Audience URI (SP Entity ID): https://dify.yourdomain.com

Attribute Mapping（必須）:
  email → user.email
  name  → user.displayName

Dify 側（.env.production）:
  SAML_SP_ENTITY_ID=https://dify.yourdomain.com
  SAML_IDP_METADATA_URL=https://your-okta.okta.com/app/xxxxx/sso/saml/metadata
```

### SSO 導入時のユーザープロビジョニング

```
Just-in-Time（JIT）プロビジョニング:
  SSO で初回ログインしたユーザーを自動でアカウント作成
  → 管理者が事前にユーザーを追加しなくていい
  → Dify Enterprise でデフォルト対応

SCIM（SCIMプロビジョニング）:
  Okta/Azure AD のユーザー変更を Dify に自動同期
  → 社員の入退社時に Dify アカウントも自動で有効化/無効化
  → Enterprise ライセンスが必要
```

---

## RBAC（ロールベースアクセス制御）

### Dify のロール体系

```
ワークスペースレベルのロール:

Owner（オーナー）:
  → ワークスペースの全権限
  → メンバー追加・削除
  → Enterprise 設定の変更
  → 1ワークスペースに1名

Admin（管理者）:
  → アプリ・ナレッジの作成・編集・削除
  → メンバーの招待（Owner 以外）
  → API キーの管理

Editor（編集者）:
  → アプリの作成・編集
  → ナレッジの作成・編集
  → 他者のアプリを編集できない

Viewer（閲覧者）:
  → アプリの利用のみ（ワークフロー実行）
  → ソース（プロンプト・設定）は見えない
  → ナレッジの閲覧のみ

推奨ロール設計:
  AI 開発者・プロンプトエンジニア: Admin / Editor
  現場スタッフ（ツール利用者）: Viewer
  IT 管理者: Owner
  外部パートナー: Viewer（期限付き招待）
```

### アプリレベルのアクセス制御

```
アプリの公開範囲設定:
  Private（非公開）: 作成者のみ
  Workspace（社内）: ワークスペースのメンバー全員
  Public（公開）: URL を知っていれば誰でも

実践的な設計例:
  開発中のアプリ: Private
  テスト中のアプリ: Workspace
  本番公開の社内ツール: Workspace（API キーで認証）
  顧客向けチャットボット: Public（自社サイトに埋め込み）
```

---

## 監査ログ

```
Enterprise Edition で記録されるイベント:

認証イベント:
  - ユーザーのログイン・ログアウト
  - SSO 認証の成功・失敗
  - パスワードリセット

管理イベント:
  - メンバーの追加・削除・ロール変更
  - ワークスペース設定の変更
  - API キーの作成・削除

AI 利用イベント:
  - ワークフロー・チャットの実行記録
  - ナレッジベースの更新
  - モデルプロバイダーの変更

ログの活用:
  → セキュリティインシデントの調査
  → コンプライアンス報告（SOC 2 / ISO 27001）
  → 不正アクセスの検知

外部 SIEM への転送:
  Dify の監査ログを Splunk / Datadog / AWS Security Hub に
  Webhook 経由で転送して集中管理できる
```

---

## マルチワークスペース管理

### ワークスペース分割の設計

```
どのようにワークスペースを分けるか:

部門別:
  workspace-hr         → 人事部
  workspace-finance    → 財務部
  workspace-sales      → 営業部
  → メリット: 部門の独立性・ナレッジの分離
  → デメリット: 共通ツールの重複作成

プロジェクト別:
  workspace-product-a
  workspace-product-b
  → スタートアップ・プロジェクト型組織に向いている

環境別:
  workspace-dev        → 開発・テスト
  workspace-staging    → QA・受け入れテスト
  workspace-prod       → 本番
  → AI アプリの開発ライフサイクルを管理できる

推奨（中規模組織）:
  本番用ワークスペース × 事業部数
  + 開発用ワークスペース × 1（共用テスト環境）
```

### ワークスペース間のナレッジ共有

```
現状の制約:
  ナレッジベースはワークスペースをまたいで共有できない
  → 全社共通のナレッジは「共通ワークスペース」に集約して
    そのワークスペースのアプリ API を他から呼び出す

回避策:
  共通ナレッジワークスペースを1つ作成
    → 就業規則・製品仕様・コンプライアンス規程
  各部門ワークスペースから HTTP Request ノードで呼び出す
  → アプリ API 経由でナレッジを間接参照する
```

---

## 大企業導入時の考慮事項

### ガバナンス設計

```
AI ガバナンスポリシーで決めるべき事項:

利用許可モデルの決定:
  ① 全社員に開放（イノベーション重視）
  ② 申請制・審査後に許可（リスク管理重視）
  ③ 部門ごとに担当者のみ開発可（折衷案）

利用可能なモデルの制限:
  → 外部 API（OpenAI 等）の利用を制限して
    社内デプロイの Ollama・Azure OpenAI のみ許可する
  → データ保護観点での重要な意思決定

プロンプト・ナレッジの審査:
  → 個人情報が含まれていないか定期監査
  → AI 出力の品質レビューフロー

コスト配賦:
  → 部門ごとのトークン消費量を管理
  → 監査ログからコスト配賦レポートを生成
```

### 調達・ライセンス

```
Enterprise Edition の購入:
  → Dify 社に直接問い合わせ（公式サイト）
  → ユーザー数・機能範囲によって価格が変わる
  → サポート（SLA）が含まれる

調達時に確認すべき事項:
  □ データ処理契約（DPA）の締結
  □ SLA（稼働率・サポート応答時間）
  □ セキュリティ監査・ペネトレーションテスト報告書
  □ 輸出規制・利用地域の制限
  □ ライセンスの同時ユーザー数定義

OSS Community Edition を使う場合:
  → ライセンスは Apache 2.0
  → 商用利用可能・改変可能
  → SSO 等の Enterprise 機能は含まれない
  → サポートはコミュニティフォーラムのみ
```

### コンプライアンス対応

```
規制要件別の対応方針:

個人情報保護法（日本）:
  → セルフホスト + 国内リージョンのサーバー
  → ナレッジベースに個人情報を登録しない
  → 個人情報保護審議会への届出

GDPR（EU）:
  → EU リージョンのサーバーを使用
  → データ処理契約（DPA）を Dify 社と締結
  → 忘れられる権利への対応（ユーザーデータの削除機能）

HIPAA（米国医療）:
  → Business Associate Agreement（BAA）の締結
  → PHI（個人健康情報）を LLM プロバイダーに送らない設計
  → アクセスログの最低6年保存

SOC 2 / ISO 27001:
  → 監査ログを外部 SIEM に転送
  → アクセスレビューの定期実施
  → 変更管理プロセスの整備
```

---

## Enterprise 導入ロードマップ

```
Phase 1（1〜2ヶ月）: パイロット
  → 1部門 10〜30名での試験運用
  → PoC アプリを2〜3本作成
  → 課題・ニーズを収集

Phase 2（2〜3ヶ月）: 本番化・拡大
  → セルフホスト本番環境の構築
  → SSO 設定・RBAC 設計
  → 全社ポリシーの策定

Phase 3（3ヶ月〜）: 全社展開
  → 部門ごとのワークスペース分割
  → 社内 AI 開発者の育成
  → ガバナンス・コスト管理の運用開始
```

---

## 参考：関連ドキュメント

- [Difyセルフホスト本番構成ガイド](concepts_dify_selfhost_production.md) — インフラ設計の詳細
- [本番リリース前チェックリスト](concepts_dify_production_checklist.md) — セキュリティ確認事項
- [Difyアンチパターン集](concepts_dify_antipatterns.md) — AP-10: 個人情報の取り扱い
- [Dify API・公開・デプロイ](concepts_dify_api_deployment.md) — API 設計の詳細
