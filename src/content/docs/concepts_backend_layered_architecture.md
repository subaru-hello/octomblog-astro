---
title: レイヤードアーキテクチャ
description: プレゼンテーション・アプリケーション・ドメイン・インフラの4層でシステムを構造化する設計パターン。依存の方向を一方向に保つことでテスト性と変更容易性を高める
category: "概念"
tags: ["バックエンド", "アーキテクチャ", "設計原則", "クリーンアーキテクチャ"]
emoji: "🥞"
date: "2026-04-06"
order: 110
series:
  - TypeScriptバックエンド設計原則
source: "Clean Architecture（Robert C. Martin）/ Patterns of Enterprise Application Architecture（Martin Fowler）"
---

## 定義

システムを責任の異なる「層（レイヤー）」に分割し、各層が下位層にのみ依存する構造。典型的な4層構成：

```
Presentation Layer  ─ HTTPリクエスト受付・レスポンス整形
       ↓
Application Layer  ─ ユースケースの調整・トランザクション制御
       ↓
Domain Layer       ─ ビジネスロジック・ドメインオブジェクト
       ↓
Infrastructure Layer ─ DB・外部API・メッセージキュー
```

## なぜ重要か

**問題**：全ての処理を1つのクラス・関数に詰め込むと、DBの変更がビジネスロジックに波及し、UIの変更がDB処理を壊す。

**解決**：層を分けることで「変更の理由」を1つの層に閉じ込める。DBをPostgresからDynamoDBに変えても、Domain層のコードは無変更で済む。

## TypeScript 実装例

```typescript
// Infrastructure Layer: DBアクセスの実装詳細はここに閉じる
class UserRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.db.query('SELECT * FROM users WHERE id = $1', [id]);
    return row ? UserMapper.toDomain(row) : null;
  }
}

// Domain Layer: ビジネスルールはここ。DBを知らない
class User {
  private constructor(
    public readonly id: UserId,
    private email: Email,
    private status: UserStatus,
  ) {}

  deactivate(): void {
    if (this.status === UserStatus.INACTIVE) {
      throw new DomainError('既に無効化されています');
    }
    this.status = UserStatus.INACTIVE;
  }
}

// Application Layer: ユースケースの調整のみ。ビジネスルールは書かない
class DeactivateUserUseCase {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(userId: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    user.deactivate(); // ルールはDomain層に任せる
    await this.userRepo.save(user);
  }
}

// Presentation Layer: HTTPの詳細だけ。ビジネスロジックなし
class UserController {
  async deactivate(req: Request, res: Response): Promise<void> {
    await this.deactivateUser.execute(req.params.id);
    res.status(204).send();
  }
}
```

## 適用場面

- CRUD中心のAPIサーバー（スタート地点として適切）
- チームがアーキテクチャに不慣れな場合（理解しやすい）
- Hexagonal/Clean Architecture への段階的移行の出発点

## トレードオフ・注意点

| メリット | デメリット |
|---|---|
| 理解しやすい、学習コスト低 | 層をまたぐデータ変換（DTO↔Entity）が増える |
| 段階的に導入可能 | Domain層がInfraに依存しがち（Repository抽象化を怠ると崩壊） |
| ほぼ全フレームワークが対応 | 大規模になるとApplication層が「神クラス」化しやすい |

**崩壊パターン**：Application層がDBクエリを直接発行し始めると、レイヤードアーキテクチャの恩恵が失われる。抽象（Repository interface）を必ず経由すること。

## 関連概念

- → [ヘキサゴナルアーキテクチャ](./concepts_backend_hexagonal_architecture.md)（より厳密な依存逆転の実現）
- → [依存性注入（DI）](./concepts_backend_dependency_injection.md)（層間の依存を管理する手段）
- → [ドメインオブジェクト設計](./concepts_domain_object_design.md)（Domain層の内部設計）

## 出典・参考文献

- Robert C. Martin, *Clean Architecture: A Craftsman's Guide to Software Structure and Design* (2017)
- Martin Fowler, *Patterns of Enterprise Application Architecture* (2002)
- Martin Fowler, "PresentationDomainDataLayering" — martinfowler.com
