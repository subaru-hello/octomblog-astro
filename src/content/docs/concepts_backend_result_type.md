---
title: Result型によるエラーハンドリング
description: 成功値と失敗値を型で表現し、エラーをコンパイル時に強制処理させるパターン。try-catchの暗黙的なエラー伝播を排除し、失敗を通常のデータフローとして扱う
category: "概念"
tags: ["バックエンド", "エラーハンドリング", "関数型", "TypeScript", "neverthrow"]
emoji: "🛤️"
date: "2026-04-06"
order: 115
series:
  - TypeScriptバックエンド設計原則
source: "Scott Wlaschin, 'Railway Oriented Programming' / neverthrow ライブラリ / fp-ts"
---

## 定義

**Result型**：処理の結果が「成功（Ok）」か「失敗（Err）」かを型で表現するデータ構造。Rustの `Result<T, E>`、Haskellの `Either` が起源。

```typescript
type Result<T, E> =
  | { ok: true;  value: T }
  | { ok: false; error: E };
```

**Railway-Oriented Programming**（Scott Wlaschin）：Resultを「2本レールの鉄道」に例えた概念。成功レールと失敗レールを並走させ、失敗後の処理を自動でスキップする。

```
成功レール: ──→ validateInput ──→ saveToDb ──→ sendEmail ──→
失敗レール:                    ↘                           ↗
                        DBエラー →→→→→→→→→→→→→→→→ 失敗で終了
```

## なぜ重要か

**try-catchの問題**：

```typescript
// ❌ try-catch: エラー型が不明、処理の漏れをコンパイラが検知できない
async function createUser(data: unknown) {
  try {
    const user = await db.create(data);
    await email.send(user.email);  // このエラーも同じcatchに落ちる
    return user;
  } catch (e) {
    // e の型が unknown。何のエラーか不明
    // sendEmail のエラーと db エラーを区別できない
    console.error(e);
  }
}
```

**Result型の解決**：

```typescript
// ✅ Result型: 失敗が型で明示される。処理の漏れはコンパイルエラー
async function createUser(data: unknown): Promise<Result<User, CreateUserError>> {
  // 呼び出し元は必ず成功/失敗を処理しなければならない
}
```

## TypeScript 実装例

### neverthrow（推奨ライブラリ）

```typescript
import { ok, err, Result, ResultAsync } from 'neverthrow';

// ─── ドメインエラー定義 ───────────────────────────
type CreateUserError =
  | { type: 'DUPLICATE_EMAIL'; email: string }
  | { type: 'INVALID_EMAIL'; reason: string }
  | { type: 'DB_ERROR'; cause: unknown };

// ─── 各ステップをResult型で定義 ─────────────────────

function validateEmail(raw: string): Result<Email, CreateUserError> {
  if (!raw.includes('@')) {
    return err({ type: 'INVALID_EMAIL', reason: 'メールアドレス形式が不正' });
  }
  return ok(new Email(raw));
}

async function checkDuplicate(email: Email): Promise<Result<Email, CreateUserError>> {
  const existing = await userRepo.findByEmail(email);
  if (existing) {
    return err({ type: 'DUPLICATE_EMAIL', email: email.value });
  }
  return ok(email);
}

async function saveUser(email: Email): Promise<Result<User, CreateUserError>> {
  try {
    const user = await userRepo.create(email);
    return ok(user);
  } catch (cause) {
    return err({ type: 'DB_ERROR', cause });
  }
}

// ─── ResultAsync でチェーン ───────────────────────

async function createUser(rawEmail: string): Promise<Result<User, CreateUserError>> {
  return ResultAsync.fromPromise(
    Promise.resolve(rawEmail),
    () => ({ type: 'DB_ERROR' as const, cause: null }),
  )
    .andThen(raw => validateEmail(raw))          // 失敗なら後続スキップ
    .andThen(email => checkDuplicate(email))     // 失敗なら後続スキップ
    .andThen(email => saveUser(email));          // 失敗なら後続スキップ
}

// ─── 呼び出し元（Controller）────────────────────────

const result = await createUser(req.body.email);

// match() で成功/失敗を必ず処理する（処理漏れがコンパイルエラー）
result.match(
  user => res.status(201).json({ id: user.id }),
  error => {
    switch (error.type) {
      case 'DUPLICATE_EMAIL':
        return res.status(409).json({ message: 'このメールアドレスは使用中です' });
      case 'INVALID_EMAIL':
        return res.status(400).json({ message: error.reason });
      case 'DB_ERROR':
        return res.status(500).json({ message: '内部エラー' });
    }
  },
);
```

### 独自実装（ライブラリなし）

```typescript
// シンプルなResult型の自作
const Result = {
  ok: <T>(value: T) => ({ ok: true as const, value }),
  err: <E>(error: E) => ({ ok: false as const, error }),
};

type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// 呼び出し元
const result = validateEmail(rawInput);
if (!result.ok) {
  return res.status(400).json({ message: result.error.reason });
}
const email = result.value; // ここでは Email 型が保証される
```

## 例外との使い分け

Result型と例外（throw）は排他ではない。使い分けの基準：

| 状況 | 推奨 | 理由 |
|---|---|---|
| 予測可能な失敗（バリデーション、重複エラー） | **Result型** | 呼び出し元が処理すべき通常のケース |
| プログラマーのバグ（null deref、型エラー）| **throw（例外）** | 即座に異常を知らせるべき |
| 外部サービスの一時的障害 | **Result型** | リトライ・フォールバックを型安全に制御 |
| 回復不能な致命的エラー | **throw（例外）** | プロセスを止めるべきケース |

## Railway-Oriented Programming との関係

[Railway-Oriented Programming](./concepts_railway_oriented_programming.md) は Result型を使ったパイプライン処理の考え方。`andThen`（flatMap）で処理を繋げると、失敗が発生した時点で後続処理を自動スキップする。

## 適用場面

- バリデーション・認証・DBアクセスなど失敗が想定される処理
- ドメインイベントのエラーを型安全に表現したいとき
- エラーハンドリングの漏れを防ぎたいとき

## トレードオフ・注意点

| メリット | デメリット |
|---|---|
| エラー型がコンパイル時に検証される | async/await と組み合わせると `ResultAsync` の学習コストがある |
| 処理漏れがコンパイルエラーになる | try-catchに慣れたコードベースへの導入は段階的に行う必要がある |
| チェーンで可読性が高まる | 過度なチェーンはかえって読みにくくなる |

## 関連概念

- → [Railway-Oriented Programming](./concepts_railway_oriented_programming.md)（Result型のパイプライン化）
- → [純粋関数](./concepts_pure_function.md)（Result型の前提となる副作用の分離）
- → [Functional Core, Imperative Shell](./concepts_functional_core_imperative_shell.md)（Result型を純粋コアで使う）

## 出典・参考文献

- Scott Wlaschin, "Railway Oriented Programming" — fsharpforfunandprofit.com
- neverthrow — github.com/supermacro/neverthrow
- fp-ts — gcanti.github.io/fp-ts
- Khalil Stemmler, "Flexible Error Handling with the Result Class" — khalilstemmler.com
