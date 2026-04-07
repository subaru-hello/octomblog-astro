---
category: "概念"
order: 801
title: データ最小化原則 概観（GDPR Article 5(1)(c)）
description: GDPRの7原則の中でデータ最小化が占める位置づけと、adequate・relevant・necessary の3要件の全体像
tags: ["GDPR", "データ最小化", "プライバシー", "UK GDPR", "ICO", "個人データ保護"]
emoji: "🔒"
date: "2026-04-07"
source: "ICO - UK GDPR Guidance / GDPR Article 5(1)(c)"
series:
  - GDPRデータ最小化原則
---

## データ最小化原則とは

UK GDPR Article 5(1)(c) に定められた原則。個人データは以下でなければならない：

> **「adequate, relevant and limited to what is necessary in relation to the purposes for which they are processed」**
> （処理目的に対して十分・関連性があり・必要な範囲に限定されている）

シンプルに言えば：**「必要以上のデータを持つな」**。

## GDPR 7原則の中の位置づけ

```
Article 5(1) の 6 原則 + 5(2) のアカウンタビリティ

(a) 適法性・公正性・透明性（Lawfulness, Fairness, Transparency）
(b) 目的限定（Purpose Limitation）             ← 最小化の「前提」
(c) データ最小化（Data Minimisation）          ← ここ
(d) 正確性（Accuracy）
(e) 保存期限限定（Storage Limitation）         ← 最小化の「時間的次元」
(f) 完全性・機密性（Integrity and Confidentiality）
(g) アカウンタビリティ（Accountability）       ← すべての遵守を証明する義務
```

(b) 目的限定 → (c) データ最小化 → (e) 保存期限限定、の三原則は一体として機能する。
目的が定まっていないと「何が必要か」を判断できないため、(b) は (c) の論理的前提。

## 3要件の概観

```
Adequate（十分性）
  ├── 目的を達成するに「足りている」か
  ├── 多すぎてもダメ、少なすぎてもダメ
  └── 例: 住所確認に郵便番号だけでは不十分な場合もある

Relevant（関連性）
  ├── 目的と「論理的・客観的に繋がっている」か
  ├── 因果関係や業務上の必要性が説明できるか
  └── 例: 採用選考で血液型を収集することは関連性がない

Limited to what is Necessary（必要性・比例性）
  ├── 同じ目的を達成できる中で「最も侵害度が低い手段」か
  ├── "just in case" 収集の禁止
  └── 例: 配送のために生年月日は必要ない
```

## なぜ最小化が重要か

**リスク低減の観点**
- 持っていないデータは漏洩しない
- データ侵害（breach）時の被害範囲が限定される
- GDPR 違反リスクと制裁金（最大売上高 4%）の回避

**信頼構築の観点**
- データ主体（個人）との信頼関係
- 「必要以上に収集しない」という姿勢がブランド価値に直結

**運用コストの観点**
- 不要データの保存・管理・セキュリティコストの削減
- 消去義務（Article 17）への対応コスト低減

## 原則間の相互依存関係

```
目的限定(b)
  └─→ 目的を特定・文書化する
         └─→ データ最小化(c)
               └─→ 目的を達成するのに必要な範囲を判断
                     └─→ 保存期限限定(e)
                           └─→ 目的が達成されたら削除
                                 └─→ 消去権(Art.17) の発動条件
```

アカウンタビリティ(g) は、この連鎖全体を「証明できる状態」にしておく義務。

## 関連トピック

- [3要件テスト（adequate・relevant・necessary）](./concepts_gdpr_data_minimisation_three_part_test.md)
- [目的限定原則（Purpose Limitation）](./concepts_gdpr_purpose_limitation.md)
- [保存期限限定原則（Storage Limitation）](./concepts_gdpr_storage_limitation.md)
- [プライバシー・バイ・デザイン（Article 25）](./concepts_gdpr_privacy_by_design.md)
- [アカウンタビリティと立証責任](./concepts_gdpr_accountability.md)
