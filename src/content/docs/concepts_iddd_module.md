---
category: "概念"
order: 210
title: モジュール（Module）
description: ドメインモデルをユビキタス言語に基づいて整理するパッケージ設計の単位
tags: ["DDD", "モジュール", "パッケージ設計", "ユビキタス言語"]
emoji: "📦"
date: "2026-04-04"
series:
  - 実践ドメイン駆動設計
source: "実践ドメイン駆動設計（Vaughn Vernon）第9章"
---

## 解決する課題

コードが増えるにつれ「どこに何があるか」がわからなくなる。技術的な分類（`models/`, `services/`, `repositories/`）でパッケージを切ると、ドメインの概念が技術レイヤーに埋没してしまう。

## 概念

**モジュール**は、関連する概念をグループ化するパッケージの単位。DDD では技術的な分類ではなく、**ユビキタス言語に基づいた業務概念**でモジュールを切る。

## 技術的分類 vs ドメイン的分類

```
❌ 技術的分類（レイヤーで切る）
  com.example.app/
    models/
      Order.py
      Customer.py
      Product.py
    repositories/
      OrderRepository.py
      CustomerRepository.py
    services/
      OrderService.py

✅ ドメイン的分類（業務概念で切る）
  com.example.app/
    ordering/         ← 注文コンテキスト
      Order.py
      OrderItem.py
      OrderRepository.py
    catalog/          ← 商品カタログ
      Product.py
      Category.py
    identity/         ← 顧客・認証
      Customer.py
```

## 設計の原則

- モジュール名は**ユビキタス言語の語彙**から取る
- モジュールの凝集度を高める（関連する概念が一緒にある）
- モジュール間の結合度を下げる（モジュール間の参照を最小化）
- Bounded Context の境界と概ね一致させる

## Vernon の指摘

Vernon は「モジュールは設計の決定を伝えるもの」と述べている。命名が重要で、`util/`, `common/`, `misc/` のような名前はドメインの概念を伝えない。

モジュール名が「なぜこのコードがここにあるのか」を説明できるべき。

## 関連概念

- → [ユビキタス言語](./concepts_ubiquitous_language.md)（モジュール名の語彙源）
- → [境界づけられたコンテキスト](./concepts_bounded_context.md)（モジュールの上位境界）
- → [六角形アーキテクチャ](./concepts_iddd_hexagonal_architecture.md)（レイヤーとモジュールの組み合わせ）
