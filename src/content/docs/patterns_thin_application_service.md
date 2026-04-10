---
category: "パターン"
order: 305
title: アプリケーションサービスを薄く保つ
description: ユースケース層に技術的コードや共通関数が入り込む問題を、「何者か」で分類して適切な場所に戻す
tags: ["DDD", "アプリケーションサービス", "ユースケース", "設計"]
emoji: "🪶"
date: "2026-04-10"
series:
  - 実践ドメイン駆動設計
source: "実践ドメイン駆動設計（Vaughn Vernon）第14章"
---

## 問題

理想のアプリケーションサービスは「誰を呼ぶか決めるだけ」の薄い層。
しかし実際には以下が入り込んで肥大化しやすい。

```go
func (s *OrderService) PlaceOrder(ctx context.Context, cmd PlaceOrderCommand) error {
    // 技術的バリデーション（入り込みやすい）
    if cmd.OrderID == "" {
        return errors.New("order_id is required")
    }

    // 認証チェック（入り込みやすい）
    if !s.authService.HasPermission(ctx, "order:create") {
        return ErrForbidden
    }

    order, err := s.repo.FindByID(cmd.OrderID)
    if err != nil {
        return err
    }

    // 業務ルールがここに漏れてくる
    if len(order.Items()) == 0 {
        return errors.New("商品がない")
    }
    if order.Status() != "DRAFT" {
        return errors.New("確定済み")
    }

    // 共通ヘルパーが生えてくる
    if err := s.validateCustomerCredit(order); err != nil {
        return err
    }

    order.Place()
    return s.repo.Save(order)
}
```

---

## 解消の基本方針：「何者か」で分類する

入り込んでくるものを種別で分けると、置き場所が決まる。

| 入り込むもの | 種別 | 正しい置き場所 |
|---|---|---|
| 「〜できない」「〜でなければならない」 | ドメイン検証 | Entity / Value Object |
| 複数集約にまたがる業務ルール | ドメインロジック | ドメインサービス |
| 認証・ログ・トランザクション | 横断関心事 | ミドルウェア / デコレーター |
| `cmd.OrderID == ""` のような構造検証 | インターフェース検証 | コマンドオブジェクト自身 |
| 複数ユースケースで使う関数 | 上記のいずれかに分類される | 種別に応じた場所 |

---

## パターン1：ドメイン検証はEntityへ戻す

```go
// ❌ アプリケーションサービスに業務ルールが漏れている
func (s *OrderService) PlaceOrder(...) error {
    if len(order.Items()) == 0 {
        return errors.New("商品がない")
    }
    if order.Status() != "DRAFT" {
        return errors.New("確定済み")
    }
    order.SetStatus("PLACED")
}

// ✅ 業務ルールはOrderが持つ
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

// アプリケーションサービスは呼ぶだけ
func (s *OrderService) PlaceOrder(...) error {
    order, _ := s.repo.FindByID(cmd.OrderID)
    if err := order.Place(); err != nil {
        return err
    }
    return s.repo.Save(order)
}
```

---

## パターン2：共通ドメインロジックはドメインサービスへ

複数のユースケースで同じドメイン的な判断をしているなら、それはドメインサービスに属する。

```go
// ❌ 複数のユースケースに同じロジックが散らばる
func (s *OrderService) PlaceOrder(...) error {
    if err := s.validateCustomerCredit(order); err != nil { // 共通化されているが...
        return err
    }
}
func (s *OrderService) AddItem(...) error {
    if err := s.validateCustomerCredit(order); err != nil { // ここにも
        return err
    }
}

// ✅ ドメインサービスに切り出す
type CreditCheckService struct{}

func (cs CreditCheckService) Validate(customer *Customer, order *Order) error {
    // 業務ルールとしての与信チェック
    if customer.CreditLimit() < order.TotalAmount() {
        return ErrCreditLimitExceeded
    }
    return nil
}

// アプリケーションサービスはドメインサービスを呼ぶだけ
func (s *OrderService) PlaceOrder(...) error {
    order, _ := s.repo.FindByID(cmd.OrderID)
    customer, _ := s.customerRepo.FindByID(order.CustomerID())
    if err := s.creditCheck.Validate(customer, order); err != nil {
        return err
    }
    if err := order.Place(); err != nil {
        return err
    }
    return s.repo.Save(order)
}
```

---

## パターン3：横断関心事はミドルウェアへ

認証・ログ・トランザクションはドメインの話ではない。ミドルウェアで処理する。

```go
// ❌ アプリケーションサービスが技術的関心事を持つ
func (s *OrderService) PlaceOrder(ctx context.Context, cmd PlaceOrderCommand) error {
    if !s.authService.HasPermission(ctx, "order:create") {
        return ErrForbidden
    }
    s.logger.Info("PlaceOrder called", "orderID", cmd.OrderID)
    // ...
}

// ✅ ミドルウェアで処理し、ユースケースはドメインだけ
func AuthMiddleware(next Handler) Handler {
    return func(ctx context.Context, cmd Command) error {
        if !hasPermission(ctx, cmd.RequiredPermission()) {
            return ErrForbidden
        }
        return next(ctx, cmd)
    }
}

// アプリケーションサービスはドメインのことだけ考える
func (s *OrderService) PlaceOrder(ctx context.Context, cmd PlaceOrderCommand) error {
    order, _ := s.repo.FindByID(cmd.OrderID)
    if err := order.Place(); err != nil {
        return err
    }
    return s.repo.Save(order)
}
```

---

## パターン4：コマンドオブジェクトで構造検証を閉じ込める

```go
// ❌ アプリケーションサービスに入力検証が混入
func (s *OrderService) PlaceOrder(orderID string, userID string) error {
    if orderID == "" {
        return errors.New("orderID is required")
    }
    if userID == "" {
        return errors.New("userID is required")
    }
    // ...
}

// ✅ コマンドオブジェクトが自分で検証する
type PlaceOrderCommand struct {
    OrderID string
    UserID  string
}

func NewPlaceOrderCommand(orderID, userID string) (PlaceOrderCommand, error) {
    if orderID == "" {
        return PlaceOrderCommand{}, errors.New("orderID is required")
    }
    if userID == "" {
        return PlaceOrderCommand{}, errors.New("userID is required")
    }
    return PlaceOrderCommand{OrderID: orderID, UserID: userID}, nil
}

// アプリケーションサービスは有効なコマンドが来ることを前提にできる
func (s *OrderService) PlaceOrder(ctx context.Context, cmd PlaceOrderCommand) error {
    order, _ := s.repo.FindByID(cmd.OrderID)
    if err := order.Place(); err != nil {
        return err
    }
    return s.repo.Save(order)
}
```

---

## 理想の姿

```go
func (s *OrderService) PlaceOrder(ctx context.Context, cmd PlaceOrderCommand) error {
    order, err := s.repo.FindByID(OrderID(cmd.OrderID))
    if err != nil {
        return err
    }
    if err := order.Place(); err != nil { // 業務ルールはOrderが持つ
        return err
    }
    return s.repo.Save(order)
}
```

3行。「誰を取得して、何を呼んで、どこに保存するか」だけ。これがアプリケーションサービスの理想形。

---

## 判断のチェックリスト

肥大化してきたとき、以下を自問する：

1. **「〜できない」「〜でなければならない」が書いてある** → Entityのメソッドへ
2. **複数ユースケースで同じロジックが重複している** → ドメインサービスへ
3. **認証・ログ・トランザクション制御が書いてある** → ミドルウェアへ
4. **引数の `nil` チェックや型チェックが書いてある** → コマンドオブジェクトへ

## 関連概念

- → [アプリケーションサービス](./concepts_iddd_application_service.md)
- → [ドメインサービス](./concepts_iddd_domain_service.md)
- → [貧血ドメインモデル（アンチパターン）](./anti-patterns_anemic_domain_model.md)
