---
category: "Tips"
order: 100
title: Salesforce App Builder 資格試験 Q&A
description: Salesforce Certified Platform App Builder 試験対策。テーマ別解説と練習問題
tags: ["Salesforce", "App Builder", "資格", "試験対策"]
emoji: "☁️"
date: "2026-04-06"
series:
  - salesforce-app-builder
---

## テーマ1：Business Logic & Process Automation（出題比重28%）

### 自動化ツールの使い分け

| ツール | 用途 | コード不要？ |
|---|---|---|
| **Flow Builder** | 複雑な自動化・画面UI・複数オブジェクト操作 | ✅ |
| **Validation Rule** | 保存前に入力チェック・エラー表示 | ✅ |
| **Formula Field** | 値を自動計算して表示（読み取り専用） | ✅ |
| **Roll-Up Summary** | 子→親への集計（SUM/COUNT/MAX/MIN） | ✅ |
| **Apex Trigger** | 複雑なロジック・コード必須の場合 | ❌ |

### 判断のポイント

- **「コードなしで」** → Flow / Validation Rule / Formula
- **「レコード更新時に別オブジェクトも更新」** → Flow
- **「子レコードの合計を親に反映」** → Roll-Up Summary Field
- **「入力値が条件を満たさなければ保存させない」** → Validation Rule
- **Process BuilderはLegacy**（新試験ではFlowが正解になることが多い）

---

### 練習問題

**Q1.** 営業担当者が商談（Opportunity）を「成立」にしたとき、関連する取引先（Account）の「最終成立日」項目を自動更新したい。コードなしで実現するには？

- A. Apex Trigger
- B. Flow Builder ✅
- C. Roll-Up Summary Field
- D. Validation Rule

**解説：** 別オブジェクトの更新はFlowの得意技。Roll-Up SummaryはMaster-Detail関係の集計専用なので不可。

---

**Q2.** 商談の「割引率」が30%を超える場合、保存できないようにしたい。最適な方法は？

- A. Flow Builder
- B. Formula Field
- C. Validation Rule ✅
- D. Approval Process

**解説：** 「保存させない＋エラー表示」はValidation Ruleの定番。FlowでもできるがValidation Ruleが最適解。

---

## テーマ2：Data Modeling & Management（出題比重22%）

### オブジェクトのリレーション種類

| リレーション | 特徴 | 覚えるポイント |
|---|---|---|
| **Master-Detail** | 親が削除されると子も削除される | Roll-Up Summaryが使える |
| **Lookup** | 親が削除されても子は残る | Roll-Up Summaryは使えない |
| **Many-to-Many** | Junction ObjectでLookupを2つ作る | 中間テーブルが必要 |
| **Hierarchical** | ユーザーオブジェクト専用 | 上司→部下の関係 |

### 項目（Field）の種類

| 型 | 用途 |
|---|---|
| **Formula** | 他の項目から計算。読み取り専用 |
| **Roll-Up Summary** | 子→親の集計。Master-Detail必須 |
| **Lookup Relationship** | 他オブジェクトへの参照 |
| **Picklist** | 選択リスト。値セットで管理可能 |
| **External ID** | 外部システムとの連携キー |

### 判断のポイント

- **Master-Detailは最大2つ**まで1オブジェクトに設定可能
- **Lookupは25個**まで
- **Roll-Up SummaryはMaster-Detail専用**（Lookupでは使えない）
- **削除を防ぎたい → Lookup**、**集計したい → Master-Detail**
- **HierarchicalはUserオブジェクト専用**（カスタムオブジェクトには使えない）

```
集計したい
  → Roll-Up Summary Field を使う
    → Master-Detail が必要
      → 親削除時に子も削除される（許容できるか確認）
```

---

### 練習問題

**Q3.** 請求書（Invoice__c）に明細行（LineItem__c）が複数ある。請求書に明細行の合計金額を自動集計したい。どのリレーションが必要か？

- A. Lookup Relationship
- B. Master-Detail Relationship ✅
- C. Hierarchical Relationship
- D. Many-to-Many Relationship

**解説：** Roll-Up Summary Fieldを使うにはMaster-Detail関係が必須。HierarchicalはUserオブジェクト専用。

---

**Q4.** 取引先（Account）と商品（Product）を多対多で関連付けたい。最も適切な方法は？

- A. AccountにProductへのLookupを追加する
- B. Junction ObjectにそれぞれへのLookupを2つ作成する ✅
- C. Master-Detail Relationshipを使う
- D. Hierarchical Relationshipを使う

**解説：** 多対多はJunction Object（中間テーブル）にLookupを2つ作るのが正しい実装。

---

**Q5.** あるカスタムオブジェクトに既にLookupリレーションがある。これをMaster-Detailに変更したい。変更できない条件はどれか？

- A. 子レコードが1000件以上ある
- B. 親項目が空白の子レコードが存在する ✅
- C. オブジェクトにFormulaフィールドがある
- D. オブジェクトがAppExchangeパッケージに含まれている

**解説：** Master-Detailは「子は必ず親が必要」ルールがあるため、親が空白の子レコードが存在すると変換不可。

---

**Q6.** 取引先（Account）への参照（Lookup）を持つカスタムオブジェクトがある。取引先レコードが削除されたとき、子レコードを残しつつ参照項目だけ空白にしたい。どの設定か？

- A. Cascade Delete
- B. Don't Allow Delete
- C. Clear the field（Lookup項目をクリア） ✅
- D. Master-Detail に変換する

**解説：** LookupのデフォルトはClear。「残す＋空白にする」= Clear the field。

---

## Data Modeling 深掘り②：データインポートツール

### 判断表：「大量・自動・全部 → Loader」

| 条件 | Data Import Wizard | Data Loader |
|---|---|---|
| 件数 | **50,000件以下** | **50,000件超** |
| 操作 | 手動・ブラウザ | 自動化・CLI可能 |
| 対象 | 主要オブジェクトのみ | **全オブジェクト** |
| 難易度 | 簡単（初心者向け） | やや複雑 |

### 判断フロー

```
50,000件超？
  YES → Data Loader
  NO  → 自動化が必要？
          YES → Data Loader
          NO  → Data Import Wizard
```

---

**Q7.** 管理者が毎晩100万件の在庫データを外部システムから自動インポートしたい。最適なツールは？

- A. Data Import Wizard
- B. Data Loader ✅
- C. Flow Builder
- D. Schema Builder

**解説：** 100万件（50,000件超）＋自動化 → Data Loader一択。

---

**Q8.** 人事担当者が年に1回、20,000件の従業員データを手動でCSVからインポートする。最適なツールは？

- A. Data Loader
- B. Apex Data Import
- C. Data Import Wizard ✅
- D. External ID

**解説：** 20,000件（50,000件以下）＋手動＋年1回 → Data Import Wizard。

---

## Data Modeling 深掘り③：Record Type・Schema Builder・FLS

### 可視性を制御する3レイヤー（優先順位）

```
① Field-Level Security（最優先）→ 権限がなければ何をしても見えない・編集不可
② Page Layout          → レイアウト上に配置するか
③ Record Type          → どのレイアウト・Picklistを使うか
```

### 読み取り専用の項目型

| 型 | 特徴 |
|---|---|
| **Formula** | 常に読み取り専用 |
| **Roll-Up Summary** | 常に読み取り専用。Master-Detail必須 |
| **Auto Number** | 自動採番。編集不可 |
| **External ID** | Upsertのキーになる。重複チェックに使用 |

---

**Q9.** 営業チームとサポートチームで、同じ商談オブジェクトに異なる選択リストの値を表示したい。何を使うべきか？

- A. Permission Set
- B. Field-Level Security
- C. Record Type ✅
- D. Page Layout

**解説：** Record TypeでPicklist値とページレイアウトをProfile（チーム）ごとに出し分けられる。

---

**Q10.** Schema Builderでできないことはどれか？

- A. 新しいカスタムオブジェクトを作成する
- B. オブジェクト間のリレーションを視覚的に確認する
- C. レコードのデータを編集する ✅
- D. 新しいカスタム項目を追加する

**解説：** Schema Builderは設計ツール。実際のレコードデータの編集は不可。

---

**Q11.** 管理者がPage Layoutである項目を「編集可能」に設定した。しかし特定のProfileのユーザーはその項目を編集できない。最も考えられる原因は？

- A. Record Typeの設定が間違っている
- B. Field-Level SecurityがRead Onlyになっている ✅
- C. Page Layoutが複数ある
- D. Validation Ruleが設定されている

**解説：** Field-Level SecurityはPage Layoutより優先される。FLSがRead Onlyなら編集不可。

---

**Q12.** 外部の受注システムからSalesforceに商品データをインポートする際、既存レコードの更新と新規作成を同時に行いたい。何を使うべきか？

- A. Record Type
- B. Auto Number項目
- C. External ID項目を使ったUpsert ✅
- D. Formula項目

**解説：** External IDをキーにしてUpsert（Update + Insert）を実行するのが定番パターン。

---

## Data Modeling 深掘り④：カスタム項目の型

| 型 | 用途 | 注意点 |
|---|---|---|
| **Text** | 文字列（最大255文字） | 検索可能 |
| **Text Area（Long）** | 長文（最大131,072文字） | レポートでフィルター不可 |
| **Number** | 数値 | 小数点桁数を指定 |
| **Currency** | 金額 | 通貨設定に連動 |
| **Percent** | パーセント | 自動で%表示 |
| **Date / DateTime** | 日付・日時 | タイムゾーンに注意 |
| **Checkbox** | True/False | デフォルト値必須 |
| **Picklist** | 選択リスト | レポートで集計可能 |
| **Multi-Select Picklist** | 複数選択 | レポートでグループ化・集計不可 |
| **Formula** | 計算値 | 読み取り専用 |

### 判断のポイント

- **Multi-Select Picklistはレポートでグループ化・集計不可**
- **Text Area（Long）はレポートフィルター不可**
- **255文字超 → Text Area（Long）**

---

**Q13.** 顧客満足度を「高・中・低」で記録し、レポートで件数を集計したい。最適な項目型は？

- A. Text
- B. Multi-Select Picklist
- C. Picklist ✅
- D. Text Area

**解説：** Picklistはレポートで集計可能。Multi-Select Picklistは集計不可。

---

**Q14.** 商品の説明文（最大5,000文字）を保存したい。レポートでのフィルターは不要。最適な項目型は？

- A. Text
- B. Text Area（Long） ✅
- C. Formula
- D. Text Area（Rich）

**解説：** 255文字超 → Text Area（Long）。レポートフィルター不要という条件も合致。

---

## Data Modeling 深掘り⑤：オブジェクトの種類

| 種類 | 説明 | サフィックス |
|---|---|---|
| **Standard Object** | Salesforceが提供する標準オブジェクト | なし |
| **Custom Object** | 管理者が作成するオブジェクト | `__c` |
| **External Object** | 外部DBをSalesforce上でリアルタイム参照 | `__x` |
| **Big Object** | 数十億件の大量データ長期保存用 | `__b` |

### 判断のポイント

- **数十億件・長期保存** → Big Object
- **外部DBをSalesforceに保存せず参照** → External Object
- **Big ObjectはSOQL制限あり・通常レポート不可**

---

**Q15.** 過去10年分の取引ログ（数十億件）を長期保存しつつSalesforce上で参照したい。最適なオブジェクト種類は？

- A. Custom Object
- B. Standard Object
- C. External Object
- D. Big Object ✅

**解説：** 数十億件の長期保存 → Big Object一択。

---

**Q16.** 外部の在庫管理システムのデータをSalesforce上でリアルタイムに参照したい（Salesforceには保存しない）。最適なオブジェクト種類は？

- A. Custom Object
- B. Big Object
- C. External Object ✅
- D. Standard Object

**解説：** 外部DBをSalesforceに保存せずリアルタイム参照 → External Object。

---

## Data Modeling 深掘り⑥：重複ルール・マッチングルール

### 作成順序（重要）

```
① Matching Rule（重複の判定条件を定義）
      ↓
② Duplicate Rule（重複検出時の動作を定義）
  - Allow：警告は出すが保存できる
  - Block：保存できない
```

---

**Q17.** 同じメールアドレスのContactが登録されようとしたとき、警告は表示するが保存は許可したい。何を設定するか？

- A. Validation Rule
- B. Matching Rule + Duplicate Rule（Allow） ✅
- C. Matching Rule + Duplicate Rule（Block）
- D. Field-Level Security

**解説：** 警告＋保存許可 → Duplicate Rule（Allow）。

---

**Q18.** 重複ルールを設定する前に必ず行うべきことは？

- A. Duplicate Ruleを作成する
- B. Field-Level Securityを設定する
- C. Matching Ruleを作成する ✅
- D. Record Typeを設定する

**解説：** Matching Ruleで「何が重複か」を定義してからでないとDuplicate Ruleは機能しない。

---

## Data Modeling 深掘り⑦：項目の削除ルール

### 削除できない条件

| 状況 | 削除可否 |
|---|---|
| Formulaで参照されている | ❌ |
| Apex / Flowで参照されている | ❌ |
| ページレイアウトに配置されている | ❌ |
| レポート・リストビューで使用中 | ❌ |

### 削除後のルール

- 削除後**15日間はゴミ箱に残り復元可能**
- 15日後に完全削除

---

**Q19.** 管理者がカスタム項目を削除しようとしたが削除できなかった。最も考えられる原因は？

- A. 項目にデータが入力されている
- B. 項目がFormulaフィールドで参照されている ✅
- C. 項目がCheckbox型である
- D. 項目がStandard Objectにある

---

**Q20.** 削除したカスタム項目を復元できる期間は？

- A. 7日間
- B. 30日間
- C. 15日間 ✅
- D. 復元不可

---

## Data Modeling 深掘り⑧：依存Picklist（Dependent Picklist）

### 仕組み

```
Controlling Field（親）の選択値によって
Dependent Field（子）の選択肢が変わる
```

### 重要ルール

- Controlling FieldになれるのはPicklistまたは**Checkbox**のみ
- Dependent FieldになれるのはPicklistまたは**Multi-Select Picklist**のみ
- **Multi-Select PicklistはControlling Fieldになれない**

---

**Q21.** 「製品カテゴリ」を選ぶと「製品名」の選択肢が絞り込まれる仕組みを作りたい。何を使うべきか？

- A. Record Type
- B. Validation Rule
- C. Dependent Picklist ✅
- D. Formula Field

---

**Q22.** Dependent Picklistの「Controlling Field」に設定できないものはどれか？

- A. カスタムPicklist
- B. Checkbox
- C. 標準Picklist
- D. Multi-Select Picklist ✅

**解説：** Multi-Select PicklistはControlling Fieldになれない。

---

## Data Modeling 深掘り⑨：Field History Tracking

### 重要ルール

- 1オブジェクトにつき**最大20項目**まで追跡可能
- 履歴データは**18ヶ月間**保持
- **FormulaとRoll-Up Summaryは追跡不可**

---

**Q23.** 商談の「金額」項目が誰によっていつ変更されたかを追跡したい。最適な方法は？

- A. Validation Rule
- B. Flow Builder
- C. Field History Tracking ✅
- D. Audit Trail

**解説：** Audit Trailは管理者操作のログ。項目値の変更追跡はField History Tracking。

---

**Q24.** Field History Trackingで追跡できない項目型はどれか？

- A. Currency
- B. Picklist
- C. Text
- D. Roll-Up Summary ✅

**解説：** Roll-Up SummaryとFormulaは計算値のため「変更」という概念がなく追跡不可。

---

## Data Modeling 深掘り⑩：上限・制限

| 項目 | 上限 |
|---|---|
| 1オブジェクトのCustom Field数 | **500項目** |
| Master-Detail Relationship | 1オブジェクトに**最大2つ** |
| Lookup Relationship | 1オブジェクトに**最大25つ** |
| Field History Tracking | 1オブジェクトに**最大20項目** |

---

**Q25.** 1つのカスタムオブジェクトに設定できるMaster-Detail Relationshipの最大数は？

- A. 1つ
- B. 2つ ✅
- C. 5つ
- D. 制限なし

---

**Q26.** 1つのオブジェクトに設定できるカスタム項目の上限は？

- A. 100項目
- B. 250項目
- C. 500項目 ✅
- D. 1000項目

---

## Data Modeling 深掘り⑪：Global Value Set

### 仕組み

```
Global Value Set（一元管理）
  → 複数のPicklist項目で同じ値セットを共有
  → 1箇所変更すると全項目に自動反映
```

### 値削除時の動作（重要）

```
Picklist値を削除しても
  → 既存レコード：値はそのまま残る（データ保護）
  → 新規・編集時：選択肢に出てこない
  → レコード削除：されない
```

---

**Q27.** 「ステータス」という選択リストを10個のカスタムオブジェクトで使いまわしたい。値が変わったとき一括で更新できるようにするには？

- A. 各オブジェクトに同じPicklistを個別作成する
- B. Global Value Setを作成して各項目に適用する ✅
- C. Formula Fieldで値を参照する
- D. Record Typeで管理する

---

**Q28.** Global Value Setの値を1つ削除した場合、その値が設定されている既存レコードはどうなるか？

- A. レコードごと削除される
- B. 項目が空白になる
- C. 削除した値は既存レコードには残るが新規選択はできなくなる ✅
- D. エラーが発生して削除できない

---

## Data Modeling 深掘り⑫：Cross-Object Formula

### Roll-Up SummaryとCross-Object Formulaの違い

| | Roll-Up Summary | Cross-Object Formula |
|---|---|---|
| 方向 | 子→親（集計） | 子→親（参照） |
| リレーション | **Master-Detailのみ** | **Lookup・Master-Detail両方** |
| できること | SUM/COUNT/MAX/MIN | 親の値を表示 |
| 編集 | 不可 | 不可 |

---

**Q29.** 商談（Opportunity）に、関連する取引先（Account）の「年間売上」を表示したい。コードなしで実現するには？

- A. Roll-Up Summary Field
- B. Cross-Object Formula Field ✅
- C. Flow Builder
- D. Validation Rule

**解説：** 親の値を子に表示 → Cross-Object Formula。Roll-Up Summaryは集計専用。

---

**Q30.** Cross-Object FormulaとRoll-Up Summaryの違いとして正しいものはどれか？

- A. Roll-Up SummaryはLookupでも使える
- B. Cross-Object FormulaはMaster-Detailのみ使える
- C. Roll-Up SummaryはMaster-Detailのみ、Cross-Object FormulaはLookupでも使える ✅
- D. どちらも集計機能を持つ

**解説：** 試験の最頻出の引っかけ。Roll-Up=Master-Detailのみ、Cross-Object Formula=Lookup可。
