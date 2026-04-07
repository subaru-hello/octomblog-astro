---
title: セキュリティ設計原則
category: "概念"
emoji: "🏛️"
order: 802
date: "2026-04-07"
series: [セキュリティ]
tags: ["セキュリティ", "設計原則", "Zero Trust", "Defense in Depth", "Least Privilege"]
source: "Zero Trust Networks（Evan Gilman & Doug Barth, 2017）/ The Principles of Information Security（Michael Whitman, 2021）/ NIST SP 800-207（Zero Trust Architecture）/ Saltzer & Schroeder『The Protection of Information in Computer Systems』（1975）"
---

## なぜ設計原則が必要か

個別の脆弱性対策（SQLインジェクション対策、XSS対策）は「既知の穴を塞ぐ」行為に過ぎない。  
設計原則は「**穴が生まれにくい構造そのものを作る**」ための思想であり、未知の脅威にも耐性を持つ。

---

## 原則1: Defense in Depth（多層防御）

**1つの対策が破られることを前提に、複数の防御層を重ねる。**

```
インターネット
    │
  WAF（不正リクエストをフィルタ）
    │
  Firewall（ポート・プロトコル制限）
    │
  認証・認可（IDとアクセス制御）
    │
  アプリケーション（入力バリデーション）
    │
  データベース（暗号化・最小権限）
    │
  監査ログ（検知・証跡）
```

1層が突破されても次の層で止まる。どの層も単独で完璧である必要はない。

---

## 原則2: Least Privilege（最小権限の原則）

**エンティティ（ユーザー・プロセス・サービス）には、タスクを実行するために必要な最小限の権限だけを与える。**

目的は権限昇格攻撃やインサイダー脅威の被害範囲の最小化。

実装例：
- DBアカウントにSELECT権限のみ付与し、DROP/ALTER は与えない
- マイクロサービスが他サービスのAPIを呼ぶ際に専用の最小スコープトークンを使う
- 管理者権限が必要な操作は一時的に付与し、終了後に剥奪する（JIT: Just-In-Time Access）

---

## 原則3: Zero Trust（ゼロトラスト）

**「境界内は安全」という前提を捨て、すべてのアクセスを常に検証する。**

### 従来のペリメータモデルとの違い

```
【従来: ペリメータモデル】
外部 ──[Firewall]── 内部ネットワーク（信頼）
                         └── 内部ユーザー・サービスは無検証でアクセス可

【Zero Trust】
外部 ─┐
内部 ─┼──[Identity & Context 検証]── リソース
VPN  ─┘  （場所・デバイス・ユーザーに関わらず毎回認証）
```

### Zero Trust の7原則（NIST SP 800-207）

1. すべてのデータソースとコンピューティングサービスをリソースとみなす
2. ネットワークの場所に関わらずすべての通信を保護する
3. 個別セッションごとにアクセスを許可する
4. アクセス制御はポリシーで動的に決定する
5. すべての資産の整合性とセキュリティ状態を監視・検証する
6. 認証と認可を動的に実施し、アクセス許可前に厳格に施行する
7. 資産・ネットワーク・通信の状態についてできるだけ多くの情報を収集する

### 実装の3要素

| 要素 | 内容 |
|---|---|
| Identity | ユーザー・デバイス・サービスの厳格な認証（MFA必須） |
| Device | デバイスのヘルスチェック（MDM, EDR） |
| Least Access | マイクロセグメンテーション、必要最小限のアクセスのみ許可 |

---

## 原則4: Fail Secure（安全側への失敗）

**システムが障害を起こしたとき、開放ではなく閉鎖側に倒れるよう設計する。**

| Fail Open（危険） | Fail Secure（安全） |
|---|---|
| 認証サーバーが落ちたらすべてのユーザーを通す | 認証サーバーが落ちたらアクセスを拒否する |
| WAFがエラーになったらすべてのリクエストを通す | WAFがエラーになったらリクエストを遮断する |

---

## 原則5: Separation of Duties（職務分離）

**重要な操作を単一のエンティティだけで完結できないようにする。**

金融システムで「入金処理」と「入金承認」を同一人物が行えないようにするのと同じ概念。  
システムでは「デプロイ権限」と「本番DBアクセス権限」を同一アカウントに持たせない設計がこれに該当する。

---

## 原則6: Open Design（設計の公開性）

**セキュリティはアルゴリズムや設計の秘匿に頼らない。鍵だけが秘密であるべき。**

Kerckhoffs の原則（1883年）に由来する。  
「暗号アルゴリズムは公開されていても、鍵さえ秘密なら安全でなければならない」という考え方。

独自の暗号アルゴリズムを作ることは「Security by Obscurity（隠蔽によるセキュリティ）」であり、設計が漏洩した瞬間に崩壊する。AES や RSA など公開・検証済みの標準を使うべき理由がここにある。

---

## 原則7: Assume Breach（侵害を前提とする）

**「侵入されない」を目標にするのではなく、「侵入されたときの被害を最小化する」設計を優先する。**

Zero Trust と組み合わせることで最も効果を発揮する。

実装につながる問い：
- 攻撃者が内部ネットワークに侵入した場合、ラテラルムーブメントを防ぐセグメンテーションがあるか？
- 管理者アカウントが乗っ取られた場合、検知できるか？
- データが外部に流出した場合、暗号化によって内容を守れるか？

---

## 原則の優先順位と組み合わせ方

原則は独立して機能するのではなく、重なり合って機能する。

```
Assume Breach（前提思想）
    ├── Zero Trust（アクセス制御）
    │       └── Least Privilege（権限設計）
    ├── Defense in Depth（多層防御）
    │       └── Fail Secure（障害設計）
    └── Separation of Duties（責務設計）
            └── Open Design（暗号・設計）
```

---

## 参考文献

- Evan Gilman & Doug Barth『Zero Trust Networks』（O'Reilly, 2017）— Zero Trust の実装を実践的に解説した代表書
- NIST SP 800-207『Zero Trust Architecture』（2020）— NIST による Zero Trust の公式定義と7原則
- Jerome Saltzer & Michael Schroeder『The Protection of Information in Computer Systems』（1975）— Least Privilege, Open Design など現代でも有効な原則の原典
- Michael Whitman & Herbert Mattord『Principles of Information Security』（Cengage, 2021）— Defense in Depth などセキュリティ原則の体系的解説
