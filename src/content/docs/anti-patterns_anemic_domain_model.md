---
category: "概念"
order: 302
title: 貧血ドメインモデル（Anemic Domain Model）
description: ドメインオブジェクトがデータ置き場に成り下がり、業務ロジックがサービス層に流出するアンチパターン
tags: ["DDD", "アンチパターン", "貧血ドメインモデル", "ドメインオブジェクト"]
emoji: "🩸"
date: "2026-04-08"
series:
  - 実践ドメイン駆動設計
source: "実践ドメイン駆動設計（Vaughn Vernon）第1章"
---

## 「設計がコードであり、コードが設計である」とはどういうことか

Vernonはこう言う。

> DDDでは、設計がコードであり、コードが設計です。

従来の開発では「設計書（UML・ER図）を作ってからコードを書く」。設計とコードが別物として存在する。

DDDでは逆に、**ドメインモデルをそのままコードで表現する**。業務の概念・ルール・言葉がコードに直接現れる。設計書は不要で、コードを読めばドメインが分かる状態が理想。

言い換えると：コードが汚ければ設計が汚い。コードに業務ルールが見えなければ、設計がコードに反映できていない。

---

## saveCustomer() の問題

Vernonが第1章で示すアンチパターン。Goで書き直すと以下のようなコードになる。

### 問題のあるコード

```go
// サービス層
func (s *CustomerService) SaveCustomer(
    customerID string,
    firstName string,
    lastName string,
    streetAddress string,
    city string,
    postalCode string,
    homePhone string,
    mobilePhone string,
    primaryEmail string,
    secondaryEmail string,
) error {
    customer, err := s.repo.FindByID(customerID)
    if err != nil {
        return err
    }
    if customer == nil {
        customer = &Customer{ID: customerID}
    }

    // 全部ここで判断・操作している
    if firstName != "" {
        customer.FirstName = firstName
    }
    if lastName != "" {
        customer.LastName = lastName
    }
    if streetAddress != "" {
        customer.StreetAddress = streetAddress
        customer.City = city
        customer.PostalCode = postalCode
    }
    if homePhone != "" {
        customer.HomePhone = homePhone
    }
    if primaryEmail != "" {
        customer.PrimaryEmail = primaryEmail
    }
    // ...延々続く

    return s.repo.Save(customer)
}

// Customer は「データ置き場」
type Customer struct {
    ID             string
    FirstName      string
    LastName       string
    StreetAddress  string
    City           string
    PostalCode     string
    HomePhone      string
    MobilePhone    string
    PrimaryEmail   string
    SecondaryEmail string
}
```

### 何が問題か

**1. Customer がオブジェクトではなくデータ置き場**

`Customer` にメソッドがない。フィールドに値を入れておくだけの構造体。
業務の振る舞い（「住所を変更する」「電話番号を登録する」）が Customer 自身に存在しない。

**2. SaveCustomer() が複雑性を引き受けすぎている**

引数が10個以上。すべての変更パターンを1つのメソッドが担う。
「名前を変える操作」と「住所を変える操作」が混在していて、業務上の意図が読み取れない。

**3. 業務ルールがどこにあるか分からない**

例えば「メインのメールアドレスが空になってはいけない」というルールはどこにある？
サービス層の `if` に埋もれているか、そもそも書かれていないか。

---

## DDDらしいコード

```go
// Customer がドメインの振る舞いを持つ
type Customer struct {
    id             CustomerID
    name           PersonName
    postalAddress  PostalAddress
    primaryContact ContactInfo
}

// 「名前を変更する」という業務操作
func (c *Customer) ChangeName(name PersonName) {
    c.name = name
}

// 「連絡先を変更する」という業務操作
func (c *Customer) ChangeContactInfo(contact ContactInfo) error {
    if contact.IsEmpty() {
        return ErrContactInfoRequired // ルールはここに書く
    }
    c.primaryContact = contact
    return nil
}

// 「住所を変更する」という業務操作
func (c *Customer) RelocateTo(address PostalAddress) {
    c.postalAddress = address
}
```

```go
// サービス層は「誰を呼ぶか」だけ決める
func (s *CustomerService) ChangeContactInfo(customerID CustomerID, contact ContactInfo) error {
    customer, err := s.repo.CustomerOfID(customerID)
    if err != nil {
        return err
    }
    if err := customer.ChangeContactInfo(contact); err != nil {
        return err
    }
    return s.repo.Save(customer)
}
```

### 何が変わったか

| | 貧血モデル | DDDモデル |
|---|---|---|
| 業務ルールの場所 | サービス層の if 文 | Customer のメソッド |
| コードから読み取れるもの | データの入れ替え | 業務操作の名前と制約 |
| テスト対象 | サービス層（依存が多い） | Customer 単体（シンプル） |
| 変更の影響範囲 | SaveCustomer() 全体 | 該当メソッドのみ |

---

## 「設計がコードに現れている」状態とは

```go
// 読むだけで業務が分かる
customer.ChangeName(newName)
customer.RelocateTo(newAddress)
customer.ChangeContactInfo(newContact)
```

上記3行は「顧客が名前を変えた」「引っ越した」「連絡先を変えた」という業務イベントをそのまま表現している。

```go
// 業務が見えないコード
SaveCustomer("123", "Taro", "", "新住所", "東京", "100-0001", "", "", "", "")
```

こちらは「何かの値を上書きする」という技術的操作しか見えない。業務の意図が消えている。

**コードが業務の言葉で書かれているとき、コード＝設計が成立する。**

---

## 関連概念

- → [ドメインオブジェクトに業務ロジックを書く](./rules_domain_logic_in_domain_objects.md)
- → [エンティティ](./concepts_iddd_entity.md)
- → [値オブジェクト](./concepts_value_object.md)
