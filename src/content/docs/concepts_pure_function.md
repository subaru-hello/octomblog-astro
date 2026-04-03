---
category: "概念"
order: 10
title: 純粋関数（Pure Function）
description: 同じ入力に対して常に同じ出力を返し、副作用を持たない関数
tags: ["関数型", "設計原則", "テスト容易性"]
emoji: "✨"
date: "2026-04-01"
---

# 純粋関数（Pure Function）

## 定義

同じ入力に対して常に同じ出力を返し、副作用を持たない関数。

```
f(x) → y  // 同じxなら常に同じy、外部状態を変えない
```

## なぜ重要か

副作用がないため：
- テストが入力/出力の検証だけで完結する
- 実行順序に依存しないため並列化・合成が安全
- 動作をコードを読むだけで理解できる（実行しなくても推論できる）

## 適用場面

- ドメインロジックの中核（計算・変換・バリデーション）
- テストしたいが副作用が邪魔な箇所を純粋関数に切り出す

## 関連概念

- → [Functional Core, Imperative Shell](functional_core_imperative_shell.md)（純粋関数をどう配置するか）
- → [副作用の分離](side_effect_isolation.md)

## 出典

関数型ドメインモデリング（Scott Wlaschin）
