---
title: "ログにはメタデータを記録し、コンテンツを含めない"
description: "ログに記録するのは以下のメタデータのみとする："
category: "Tips"
tags: []
date: "2026-04-01"
emoji: "📐"
order: 3
---

# ログにはメタデータを記録し、コンテンツを含めない

## ルール

ログに記録するのは以下の**メタデータ**のみとする：

1. **識別子**：`trace_id`, `session_id`, `user_id`（匿名化済みのもの）
2. **計測値**：レイテンシ、トークン数、エラーコード、HTTPステータス
3. **分類情報**：使用モデル名、ツール名、処理ステージ
4. **結果状態**：`status`, `failure_domain`, `failure_stage`

以下の**コンテンツ**はログに含めない：

- ユーザーの入力テキスト（チャットメッセージ、検索クエリ等）
- LLM・AIの出力テキスト
- アップロードされたファイルの内容
- ユーザーの個人情報（氏名・住所・メールアドレス等）

## 理由

ユーザーの入力や出力をログに残すと、ログストレージが**個人データの保管場所**になる。

- LLM への入力には、ユーザーが意図せず個人情報を含めることがある
- ログは開発者・運用者・監視SaaSなど多くの場所に転送・保存されるため、**PII漏洩の経路が広い**
- GDPR のデータ最小化原則（Data Minimisation）は「目的に必要な最小限のデータのみ処理する」を要求しており、不要なコンテンツをログに含めることは原則違反になりうる

メタデータだけでも、「いつ・どのリクエストで・どこで・何が起きたか」の診断には十分な情報が得られる。

## 例外

以下の条件が全て揃う場合に限り、コンテンツをログに含めることを許容する：

- **明示的な同意**：ユーザーが利用規約等でコンテンツのログ収集に同意している
- **適切な保護措置**：暗号化、アクセス制御、保持期間の設定が実施されている
- **目的の限定**：品質改善・安全性モニタリングなど具体的な目的が明示されている
- **マスキング済み**：PII部分が正規表現等でマスキングされている（デバッグログ限定）

## 出典

- [ICO Data Minimisation Principle](https://ico.org.uk/for-organisations/guide-to-data-protection/guide-to-the-general-data-protection-regulation-gdpr/principles/data-minimisation/)
- [OpenTelemetry Sensitive Data Guidance](https://opentelemetry.io/docs/specs/otel/overview/#sensitive-data)
