---
category: "概念"
order: 806
title: 仮名化と匿名化（Pseudonymisation & Anonymisation）
description: 最小化の技術的手段としての仮名化・匿名化の違い。再識別リスクの評価とGDPR適用外となる条件
tags: ["GDPR", "仮名化", "匿名化", "Pseudonymisation", "Anonymisation", "再識別リスク", "ICO"]
emoji: "🎭"
date: "2026-04-07"
source: "ICO - Anonymisation Code of Practice / GDPR Recital 26 / EDPB"
series:
  - GDPRデータ最小化原則
---

## 仮名化と匿名化の根本的な違い

データ最小化の技術的手段として、仮名化と匿名化はよく混同されるが、
GDPR 上の扱いが**完全に異なる**。

```
匿名化（Anonymisation）:
  → 再識別が不可能な状態
  → GDPR の適用外（個人データではなくなる）
  → 要件が非常に厳しい

仮名化（Pseudonymisation）:
  → 追加情報なしには識別不可能な状態
  → GDPR の適用内（個人データとして扱う）
  → リスク軽減手段として評価される
```

## 匿名化（Anonymisation）

### 定義
Recital 26：「もはや特定の自然人を識別できない、またはできなくなったデータ」

### 高い要件の理由
「匿名化済み」と判断するためには、**現実的に再識別できない**ことを証明しなければならない。

```
ICO の判断基準（4つのリスク）:
  1. Singling out（単一化）: 特定個人を集合から抽出できるか
  2. Linkability（連結性）: 別のデータセットと結合して識別できるか
  3. Inference（推論）: 他の属性から個人を推論できるか
  4. Re-identification（再識別）: 補助情報と組み合わせて識別できるか

これら全てのリスクが「非合理的に困難」でなければ匿名化とは言えない
```

### 典型的な「匿名化したつもり」の失敗

```
✗ 氏名を削除しただけ
  → 「45歳・医師・東京在住」で特定できる場合がある（Quasi-identifier）

✗ k-anonymity だけ適用
  → 同一グループ内で属性が偏っていると Homogeneity Attack で推論できる

✗ ランダムな ID に置換
  → 元のマッピングテーブルが残っていれば仮名化にすぎない
```

## 仮名化（Pseudonymisation）

### 定義
Article 4(5)：「追加情報を用いることなく特定の自然人に帰属できなくなるよう処理されたデータ」
（その追加情報は別途保管・アクセス制限が必要）

```
例:
  本番データ: user_id=8a3f9c2b → email=hidden, name=hidden
  マッピングテーブル: 8a3f9c2b → taro@example.com（別システム・厳重アクセス制御）
```

### GDPR 上の位置づけ

仮名化はデータの最小化・保護を「強化する措置」として評価される：

```
Article 25（Privacy by Design）: 仮名化を技術的措置として明示
Article 32（セキュリティ）: 仮名化はセキュリティ措置の一例
DPIA: 仮名化によりリスクレベルが下がりうる
制裁金: 仮名化済みデータのbreach は軽減要素になる場合も
```

しかし**GDPR の適用は外れない**。仮名化データはあくまで個人データ。

## 再識別リスク（Re-identification Risk）の評価

### リスク評価の2軸

```
1. 可能性（Possibility）
   再識別の技術的手段が存在するか

2. 現実性（Reasonableness）
   「合理的に行動する者」が再識別を試みる可能性があるか
   ＋ 実際にそのリソースを持つ者がいるか
```

ICO は「合理的に識別可能かどうか」を判断基準にしている。
技術的に可能でも現実的でなければ匿名化と認められる場合もある（逆も然り）。

## 主要な技術的手法

```
k-anonymity:
  各レコードが少なくとも k-1 件の類似レコードと区別不可能
  → 小さい k だと Quasi-identifier で特定されやすい

l-diversity:
  k-anonymity に加え、各グループ内の sensitive attribute が多様
  → Homogeneity Attack への対策

t-closeness:
  各グループ内の属性分布が全体分布に近い
  → Inference Attack への対策

Differential Privacy:
  データセット全体の統計的性質を保ちつつ、個別レコードへの寄与を数学的に制限
  → Apple, Google が大規模データ収集に採用

Tokenisation:
  個人識別子を意味のないトークンに置換（クレジットカード番号等に多用）
  → 仮名化の一形態
```

## いつ匿名化・仮名化を選ぶか

```
GDPR 外に出たい（匿名化が目標）:
  → 分析・AI学習・公開データセット等
  → 要件が厳しいが達成できれば制約が外れる

リスク軽減しつつ処理を継続（仮名化で十分）:
  → 内部分析・開発環境・テストデータ
  → GDPR は引き続き適用されるが compliance 姿勢として評価される

目的を達成しながら最小化を実現:
  → Privacy by Design の実装として仮名化を設計に組み込む
```

## 関連トピック

- [データ最小化原則 概観](./concepts_gdpr_data_minimisation_overview.md)
- [プライバシー・バイ・デザイン（Article 25）](./concepts_gdpr_privacy_by_design.md)
- [データ保護影響評価（DPIA）](./concepts_gdpr_dpia.md)
- [3要件テスト（adequate・relevant・necessary）](./concepts_gdpr_data_minimisation_three_part_test.md)
