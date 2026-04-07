---
title: バックエンドエラーハンドリング実装
description: Result型・ドメイン例外・グローバルエラーハンドラーを組み合わせた、TypeScriptバックエンドのエラーハンドリング戦略を実装する手順
category: "Tips"
tags: ["バックエンド", "エラーハンドリング", "TypeScript", "Result型", "NestJS"]
emoji: "🚨"
date: "2026-04-06"
order: 20
series:
  - TypeScriptバックエンド設計原則
---

## 目的

エラーが型で表現され、処理漏れがコンパイルエラーになり、HTTPレスポンスへの変換が一元管理されている状態を実現する。「なんとなくtry-catch」からの脱却。

---

## Step 1: エラーの種類を分類する

全てのエラーを同じように扱わない。3種類に分類して戦略を変える。

| 種類 | 定義 | 処理方法 | 例 |
|---|---|---|---|
| **ドメインエラー** | ビジネスルール違反。予測可能な失敗 | **Result型**で型として表現 | 残高不足、重複メール、在庫なし |
| **インフラエラー** | 外部システムの障害。予測可能だが制御不能 | **Result型** + リトライ戦略 | DB接続失敗、外部API応答なし |
| **プログラムエラー** | バグ。プログラマーの誤り | **throw** で即座に停止 | null参照、型アサーション失敗 |

---

## Step 2: ドメインエラーを型で定義する

```typescript
// エラー定義: ドメインごとにエラー型をまとめる
// src/domain/user/errors.ts

export type UserError =
  | { readonly type: 'DUPLICATE_EMAIL'; email: string }
  | { readonly type: 'INVALID_EMAIL'; reason: string }
  | { readonly type: 'USER_NOT_FOUND'; id: string }
  | { readonly type: 'ACCOUNT_DEACTIVATED'; userId: string };

export type OrderError =
  | { readonly type: 'INSUFFICIENT_STOCK'; productId: string; requested: number; available: number }
  | { readonly type: 'ORDER_NOT_FOUND'; orderId: string }
  | { readonly type: 'PAYMENT_DECLINED'; reason: string };
```

---

## Step 3: ユースケースをResult型で実装する

```typescript
import { ok, err, ResultAsync } from 'neverthrow';
import type { UserError } from './errors';

// src/application/use-cases/register-user.ts
class RegisterUserUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly emailService: EmailService,
  ) {}

  async execute(
    command: RegisterUserCommand,
  ): Promise<Result<UserId, UserError | InfraError>> {
    // バリデーション: 失敗は err() で返す
    const emailResult = Email.create(command.email);
    if (!emailResult.ok) return emailResult; // UserError.INVALID_EMAIL

    // 重複チェック
    const existing = await ResultAsync.fromPromise(
      this.userRepo.findByEmail(emailResult.value),
      (cause): InfraError => ({ type: 'DB_ERROR', cause }),
    );
    if (!existing.ok) return existing;
    if (existing.value) {
      return err({ type: 'DUPLICATE_EMAIL', email: command.email });
    }

    // 保存
    const user = User.register(emailResult.value);
    const saveResult = await ResultAsync.fromPromise(
      this.userRepo.save(user),
      (cause): InfraError => ({ type: 'DB_ERROR', cause }),
    );
    if (!saveResult.ok) return saveResult;

    // 後続処理（メール送信）の失敗はログのみ。ユーザー登録は成功扱い
    this.emailService.sendWelcome(user.email).catch(e => {
      logger.error('Welcome email failed', { userId: user.id, error: e });
    });

    return ok(user.id);
  }
}
```

---

## Step 4: HTTPエラーレスポンスへの変換を一元管理する

ドメインエラーとHTTPステータスの対応を Controller（Presentation Layer）に集中させる。ビジネスロジック内でHTTPステータスを知らない。

```typescript
// src/presentation/user.controller.ts

// エラー → HTTPレスポンスの変換テーブル
function toHttpError(error: UserError | InfraError): { status: number; message: string } {
  switch (error.type) {
    case 'DUPLICATE_EMAIL':
      return { status: 409, message: `${error.email} は既に登録されています` };
    case 'INVALID_EMAIL':
      return { status: 400, message: error.reason };
    case 'USER_NOT_FOUND':
      return { status: 404, message: 'ユーザーが見つかりません' };
    case 'ACCOUNT_DEACTIVATED':
      return { status: 403, message: 'アカウントが無効化されています' };
    case 'DB_ERROR':
      logger.error('Database error', error.cause);
      return { status: 500, message: '内部エラーが発生しました' };
    // TypeScriptの網羅性チェック: 全ケースを処理しないとコンパイルエラー
    default:
      const _exhaustive: never = error;
      return { status: 500, message: '予期せぬエラー' };
  }
}

// Hono の例
app.post('/users', zValidator('json', RegisterUserSchema), async (c) => {
  const result = await registerUser.execute(c.req.valid('json'));

  return result.match(
    userId => c.json({ id: userId }, 201),
    error => {
      const { status, message } = toHttpError(error);
      return c.json({ error: message }, status);
    },
  );
});
```

---

## Step 5: グローバルエラーハンドラーで予期せぬ例外を捕捉する

Result型で処理できなかった予期せぬ例外（プログラムエラー）を最終防衛線でキャッチする。

```typescript
// NestJS の場合: ExceptionFilter
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // NestJSの既知例外（HttpException）
    if (exception instanceof HttpException) {
      return response.status(exception.getStatus()).json({
        statusCode: exception.getStatus(),
        message: exception.message,
      });
    }

    // 予期せぬエラー: 詳細をログに記録し、クライアントには最小限の情報のみ返す
    this.logger.error('Unexpected error', {
      error: exception,
      path: request.url,
      method: request.method,
    });

    return response.status(500).json({
      statusCode: 500,
      message: '内部エラーが発生しました',
    });
  }
}

// main.ts で登録
app.useGlobalFilters(new GlobalExceptionFilter());
```

```typescript
// Hono の場合
app.onError((err, c) => {
  // Result型で処理済みのエラーはここに来ない
  // ここに来るのは本当に予期せぬプログラムエラー
  console.error('Unhandled error:', err);
  return c.json({ error: '内部エラーが発生しました' }, 500);
});
```

---

## Step 6: エラーのログ戦略を決める

```typescript
// エラーのログレベルを使い分ける
switch (error.type) {
  case 'DUPLICATE_EMAIL':
  case 'INVALID_EMAIL':
  case 'USER_NOT_FOUND':
    // ビジネス上の正常な失敗: info または warn
    logger.info('Business rule violation', { type: error.type });
    break;

  case 'PAYMENT_DECLINED':
    // 重要なビジネスイベント: warn
    logger.warn('Payment declined', { reason: error.reason });
    break;

  case 'DB_ERROR':
    // インフラ障害: error（アラート対象）
    logger.error('Infrastructure failure', { cause: error.cause });
    break;
}
```

---

## チェックリスト

- [ ] エラーが3種類（ドメイン / インフラ / プログラムエラー）に分類されている
- [ ] 予測可能な失敗はResult型で型として表現されている
- [ ] 全エラーケースが `switch` の `exhaustive check` でカバーされている
- [ ] HTTPステータスへの変換はController層に集中している（ビジネスロジック内にHTTPコードがない）
- [ ] グローバルエラーハンドラーが予期せぬ例外を捕捉している
- [ ] インフラエラーのみが `error` レベルでログされ、ビジネスルール違反は `info`/`warn` で処理されている

## 関連概念

- → [Result型によるエラーハンドリング](./concepts_backend_result_type.md)（Result型の設計原則）
- → [Railway-Oriented Programming](./concepts_railway_oriented_programming.md)（エラーパイプラインの思想）
- → [オブザーバビリティ](./concepts_observability.md)（エラーのログ・トレース設計）
- → [ヘキサゴナルアーキテクチャ](./concepts_backend_hexagonal_architecture.md)（エラーの変換がどの層で行われるか）

## 出典

- Scott Wlaschin, "Railway Oriented Programming" — fsharpforfunandprofit.com
- neverthrow — github.com/supermacro/neverthrow
- Khalil Stemmler, "Flexible Error Handling" — khalilstemmler.com
- NestJS Documentation, "Exception Filters" — docs.nestjs.com/exception-filters
