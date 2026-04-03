---
category: "概念"
order: 14
title: Railway-Oriented Programming（鉄道指向プログラミング）
description: エラー処理を2本レールの鉄道として表現し、型安全なエラーハンドリングを実現するパターン
tags: ["関数型", "エラーハンドリング", "パターン"]
emoji: "🚃"
date: "2026-04-01"
---

# Railway-Oriented Programming（鉄道指向プログラミング）

## 定義

エラー処理を「2本レールの鉄道」として表現するパターン。
処理は成功レールと失敗レールのどちらかを走り、一度失敗レールに入ったら以降の処理はスキップされる。

```
入力
  │
  ▼
[バリデーション] ──失敗──→ Error("メールが無効")
  │成功
  ▼
[在庫確認]      ──失敗──→ Error("在庫なし")
  │成功
  ▼
[決済処理]      ──失敗──→ Error("カード拒否")
  │成功
  ▼
成功結果
```

実装上は `Result<Success, Error>` 型（または `Either`）で表現する。

## なぜ重要か

- 例外（try/catch）に頼らずエラーを型として明示できる
- 各ステップが「成功 → 次へ / 失敗 → 終了」の単純な関数になる
- エラーの握りつぶし・見落としがコンパイル時に検出される

## 適用場面

- バリデーションが複数ステップある処理
- 外部APIコール・DB処理など失敗が前提の I/O

## 関連概念

- → [型駆動設計](type_driven_design.md)
- → [純粋関数](pure_function.md)

## 出典

関数型ドメインモデリング（Scott Wlaschin）第6章 / https://fsharpforfunandprofit.com/rop/
