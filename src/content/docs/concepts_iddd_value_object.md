---
category: "概念"
order: 204
title: 値オブジェクト（Value Object）- IDDD
description: 値の内容で等価性を判断する不変オブジェクト。string/intをそのまま使わず型で意図を表現する
tags: ["DDD", "値オブジェクト", "不変", "型安全"]
emoji: "💎"
date: "2026-04-09"
series:
  - 実践ドメイン駆動設計
source: "実践ドメイン駆動設計（Vaughn Vernon）第6章"
---

## 解決する課題

`string` や `int` をそのまま使うと、何でも渡せてしまう。

```go
// 顧客IDと商品IDが同じstring型 → 逆に渡してもコンパイルが通る
func CreateOrder(customerID string, productID string) {}
CreateOrder(productID, customerID) // バグ、でも気づけない
```

また、`"invalid-email"` のような無効な値が型レベルで防げない。

## 概念

**Value Object = 値の内容で等価性を判断する、不変のオブジェクト**

- IDを持たない（内容が同じなら同一）
- 不変（変更したら新しいオブジェクトを作る）
- 自分のバリデーションを自分で持つ

```go
// 内容が同じなら等しい
moneyA := Money{Amount: 50, Currency: "JPY"}
moneyB := Money{Amount: 50, Currency: "JPY"}
// moneyA == moneyB → true
```

## 不変にする

```go
// 悪い例：値を直接変える
price.Amount = 100

// 良い例：新しいオブジェクトを返す
func (m Money) Add(other Money) Money {
    return Money{Amount: m.Amount + other.Amount, Currency: m.Currency}
}
```

## string/int の代わりに struct を使う

```go
type CustomerID struct{ value string }
type ProductID  struct{ value string }

func CreateOrder(customerID CustomerID, productID ProductID) {}
// CreateOrder(productID, customerID) → コンパイルエラー
```

型に意図が現れる。間違った渡し方をコンパイル時に検出できる。

## Wild Workoutsでの確認

`Availability` を `string` ではなく `struct` にしている。

```go
// string だと Availability("invalid") が作れてしまう
type Availability string // 悪い例

// struct にすることで NewAvailabilityFromString() 経由でしか作れない
type Availability struct{ a string } // 良い例
var Available = Availability{"available"}
```

無効な状態を型レベルで排除している。

## Entity との使い分け

「これは追跡が必要か？」で判断する。

| | Entity | Value Object |
|---|---|---|
| 等価の基準 | ID | 値の内容 |
| 状態変化 | する | しない（新しいオブジェクトを作る） |
| 例 | 注文・ユーザー・Hour | 金額・住所・Availability |

住所は Value Object。「配送先住所の変更履歴を追う」ならEntityになる。**ドメインの文脈次第**。

**迷ったら Value Object を選ぶ**。Entityはライフサイクル管理のコストが高い。

## 関連概念

- → [エンティティ](./concepts_iddd_entity.md)
- → [値オブジェクト（増田亨版）](./concepts_value_object.md)
- → [貧血ドメインモデル（アンチパターン）](./anti-patterns_anemic_domain_model.md)
