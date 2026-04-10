---
category: "Tips"
order: 17
title: 貧血ドメインモデルを診断・修正するスキル
description: コードを見て「業務ロジックがドメインに収まっているか」を判断し、漏れているロジックをドメインオブジェクトに戻す手順
tags: ["スキル", "DDD", "貧血ドメインモデル", "リファクタリング"]
emoji: "🩺"
date: "2026-04-11"
series:
  - 実践ドメイン駆動設計
source: "実践ドメイン駆動設計（Vaughn Vernon）第1章"
---

## 目的

コードを見て「業務ロジックがドメインに収まっているか」を素早く診断し、漏れているものをドメインオブジェクトに戻す。

## 診断手順

### 1. サービス層のif文を探す

```go
// 🚨 サービス層にif文がある → 業務ロジックが漏れているサイン
func (s *OrderService) PlaceOrder(...) error {
    if len(order.Items()) == 0 {      // ← ドメインルール
        return errors.New("商品がない")
    }
    if order.Status() != "DRAFT" {    // ← ドメインルール
        return errors.New("確定済み")
    }
}
```

### 2. ドメインオブジェクトのgetterだけが呼ばれていないかを確認する

```go
// 🚨 getterで値を取り出して外で判断している
if order.GetStatus() == "DRAFT" && order.GetTotalAmount() > 0 {
    order.SetStatus("PLACED")  // setterで状態を直接書き換えている
}
```

getter/setterだけのオブジェクトは「データ置き場」。業務ロジックが外に漏れている。

### 3. 同じ判断が複数のサービスに重複していないかを確認する

```go
// 🚨 PlaceOrderServiceにも
if order.Status() != "DRAFT" { return err }

// 🚨 UpdateOrderServiceにも
if order.Status() != "DRAFT" { return err }
```

重複は「ドメインルールがドメインに収まっていない」証拠。

## 修正手順

### Step 1: 漏れているルールを特定する

サービス層のif文を読んで「これは業務のルールか？」を問う。

```
「商品がない注文は確定できない」→ YES、業務のルール → Orderへ
「cmd.OrderID == ""」          → NO、入力検証 → コマンドオブジェクトへ
「HasPermission(ctx, ...)」    → NO、認証 → ミドルウェアへ
```

### Step 2: ドメインオブジェクトにメソッドを追加する

```go
// Before: サービス層にロジックがある
func (s *OrderService) PlaceOrder(...) error {
    if len(order.Items()) == 0 {
        return errors.New("商品がない")
    }
    if order.status != "DRAFT" {
        return errors.New("確定済み")
    }
    order.status = "PLACED"
}

// After: ロジックをOrderに移す
func (o *Order) Place() error {
    if len(o.items) == 0 {
        return ErrNoItems
    }
    if o.status != Draft {
        return ErrAlreadyPlaced
    }
    o.status = Placed
    return nil
}
```

### Step 3: サービス層を薄くする

```go
// After: サービス層はオーケストレーションだけ
func (s *OrderService) PlaceOrder(...) error {
    order, _ := s.repo.FindByID(cmd.OrderID)
    if err := order.Place(); err != nil {
        return err
    }
    return s.repo.Save(order)
}
```

## 診断チェックリスト

**コードレビュー時に使う**

- [ ] サービス層に `if entity.GetXxx() == "..."` が書かれていないか
- [ ] ドメインオブジェクトに getter/setter しかなく、メソッドがないか
- [ ] 同じ業務判断が複数のサービスに重複していないか
- [ ] `entity.SetStatus("PLACED")` のように状態を外から直接書き換えていないか
- [ ] ドメインオブジェクトのメソッドを呼んだだけでルールが保証されるか

## 関連概念

- → [貧血ドメインモデル（アンチパターン）](./anti-patterns_anemic_domain_model.md)
- → [アプリケーションサービスを薄く保つ](./patterns_thin_application_service.md)
- → [段階的リファクタリング戦略](./skills_incremental_refactoring.md)
