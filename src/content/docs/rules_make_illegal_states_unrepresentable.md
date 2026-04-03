---
category: "Tips"
order: 4
title: 不正な状態を型で表現不可能にする
description: ドメインオブジェクト設計時、存在してはいけない状態をコードで表現できないようにする設計規範
tags: ["ルール", "型システム", "ドメインモデリング"]
emoji: "🔒"
date: "2026-04-01"
---

# 不正な状態を型で表現不可能にする

## ルール

ドメインオブジェクトの設計時、**「存在してはいけない状態」をコードで表現できないようにする**。
プリミティブ型（string, int, bool）でドメイン概念を直接表現しない。

```typescript
// NG: statusが"pending"/"paid"/"cancelled"以外の文字列を許してしまう
type Order = { status: string }

// OK: 型として列挙し、それ以外は存在できない
type OrderStatus = "pending" | "paid" | "cancelled"
type Order = { status: OrderStatus }

// さらに良い: 状態ごとにデータ構造を変える
type PendingOrder  = { items: Item[] }
type PaidOrder     = { items: Item[]; paidAt: Date; paymentId: string }
type Order = PendingOrder | PaidOrder
```

## 理由

文字列や数値でドメイン状態を表現すると：
- バリデーションが各所に散らばる
- 不正値の混入がランタイムまで気づかれない
- 状態ごとに必要なフィールドが違うのに同一構造に詰め込まれる

## 例外

外部I/O境界（APIレスポンス、DBレコード）はプリミティブで受け取らざるを得ない。
その場合は境界で即座に型変換し、ドメイン層にプリミティブを持ち込まない。

## 出典

関数型ドメインモデリング（Scott Wlaschin）第3章
