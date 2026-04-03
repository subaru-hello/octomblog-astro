---
category: "概念"
order: 24
title: プリミティブ執着（Primitive Obsession）
description: ドメイン概念をプリミティブ型で直接表現し続け、業務制約・操作がコード中に散らばるアンチパターン
tags: ["アンチパターン", "コード品質", "リファクタリング"]
emoji: "⚠️"
date: "2026-04-01"
---

# プリミティブ執着（Primitive Obsession）

## 定義

ドメインの概念をString・int・boolなどのプリミティブ型で直接表現し続けるアンチパターン。
業務制約・意味・操作がコード中に散らばる原因となる。

## 症状

- `String email`, `String phoneNumber`, `String zipCode` が同じ型で区別されない
- バリデーション（メール形式チェック等）が複数箇所に重複して書かれている
- `int price` に「0以上でなければならない」などのassertが各所に散らばっている

## 解決策

値オブジェクトを導入する。制約・操作・等価性判定をそのクラスに閉じ込める。

## 関連概念

- [値オブジェクト](../concepts/value_object.md)（解決策）
- [型駆動設計](../concepts/type_driven_design.md)

## 出典

現場で役立つシステム設計の原則（増田亨）第1章 / Refactoring（Fowler）
