---
category: "概念"
order: 22
title: 型駆動設計（Type-Driven Design）
description: ドメインの制約・状態・ルールを型システムで表現し、不正な状態をコンパイル時に防ぐ設計手法
tags: ["関数型", "ドメインモデリング", "型システム"]
emoji: "🎯"
date: "2026-04-01"
series:
  - 現場で役立つシステム設計の原則
---

## 定義

ドメインの制約・状態・ルールを型システムで表現し、「コンパイルが通れば正しい」状態を目指す設計手法。

```
// 悪い例：文字列で何でも表現できてしまう
type Order = { status: string; email: string }

// 良い例：不正な状態を型で表現不可能にする
type UnvalidatedOrder = { email: string }
type ValidatedOrder   = { email: Email; items: NonEmptyList<Item> }
type PaidOrder        = { validatedOrder: ValidatedOrder; paymentId: PaymentId }
```

## なぜ重要か

- **不正な状態を表現不可能にする（Make Illegal States Unrepresentable）**
- ドキュメントとしての型：関数シグネチャがそのまま仕様になる
- 状態遷移のバグをランタイムではなくコンパイル時に検出

## 適用場面

- 状態遷移があるドメインオブジェクト（注文・承認フロー等）
- 外部からの入力バリデーション（未検証型 → 検証済み型への変換）

## 関連概念

- → [Railway-Oriented Programming](railway_oriented_programming.md)（型で成功/失敗を表現）
- → [Value Object](value_object.md)（ドメイン制約を型で閉じ込める）

## 出典

関数型ドメインモデリング（Scott Wlaschin）第2〜4章
