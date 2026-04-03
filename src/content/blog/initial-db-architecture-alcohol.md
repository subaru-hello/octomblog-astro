---
title: "お酒の強さ診断アプリのDB設計(初期構想)"
description: "お酒の強さ診断アプリのDB設計を見てみよう"
date: 2023-06-17T22:35:43+09:00
draft: false
author: subaru
authorEmoji: 🐙
tags:
- DB設計
- DB
categories:
- DB
image: images/feature2/db.png
---

アルコールに強いかどうかを診断して、次の飲み会で飲むお酒を提案するアプリを作り直しています。
当時まだテーブル設計に関する知識がなかった頃、アルコールとアルコールセットの設計を自己結合関連付けにした時の話です。

### 当初のテーブル設計

下記テーブル設計が当初僕が書いていたテーブルになります。

![](https://storage.googleapis.com/zenn-user-upload/222567d23a23-20230617.png)

この、AccumulatedOrdersテーブルとAlcoholOrdersテーブルのカラムに問題がありました。

それぞれのやりたかった挙動をまとめます。

### 使用するモデル

```ruby
class AccumulatedOrders < ApplicationRecord
  has_many :alcohol_orders
end
```

```ruby
class AlcoholOrders < ApplicationRecord
  belongs_to :accumulated_order
end
```

### エンティティ内のカラム

```ruby
create_table "accumulated_orders", force: :cascade do |t|
    t.integer "is_accumulated_orders", null: false
    t.datetime "created_at", precision: 6, null: false
    t.datetime "updated_at", precision: 6, null: false
    t.index ["analysis_id"], name: "index_accumulated_orders_on_analysis_id"
  end
create_table "alcohol_orders", force: :cascade do |t|
    t.integer "is_order", null: false
		t.integer "alcohol_types", default: 0, null:false
    t.datetime "created_at", precision: 6, null: false
    t.datetime "updated_at", precision: 6, null: false
    t.index ["accumulated_orders_id"], name: "index_alcohol_orders_on_accumulated_orders_id"
  end
```

### カラム説明

- is_accumulated_orders: お酒の順番を格納する
- is_order: お酒の順番を格納する
- alcohol_types: enumでお酒の種類をポリモーフィック関連させる。同じメソッドを持つ酒インスタンスを複数作ることができる。

### やりたかった挙動

AccumulatedOrders

お酒の順番をまとめて管理

AlcoholOrders

お酒の順番と種類を個別に管理

accumulated_order_id: 外部キー、bmn

is_order: 何番目のお酒になるのかを格納

alcohol_types: お酒の種類を格納

```ruby
AccumulatedOrders
id: 1・・・①
is_accumulated_orders: ["1","2","3","4"] #お酒の順番

AlcoholOrders
accumulated_order_id: 1　#AccumulatedOrdersのidと対応する
id: 1
is_order: 1 #is_accumulated_ordersの"1"に対応する
alcohol_types: 1　

accumulated_order_id: 1・・・③
id: 2
is_order: 2
alcohol_types: 2

accumulated_order_id: 1・・・③
id: 3
is_order: 3
alcohol_types: 3

accumulated_order_id: 1・・・③
id: 4
is_order: 4
alcohol_types: 4
```

- 診断結果に基づいて飲み物を飲む順番をユーザーに提供する
- AccumulatedOrdersテーブルのis_accumulated_ordersで順番を保持する。
- AlcoholOrdersテーブルのaccumulated_order_idはAccumulatedOrdersの外部キーで、AccumulatedOrdersテーブルのPK(id)と対応する。

### 問題点①　お酒の順番を格納するカラムが重複している。

AccumulatedOrdersとAlcoholOrdersそれぞれにお酒の順番を格納するカラムがあります。

同じ挙動をするカラムが二つ以上あることはテーブル設計上冗長なので、どちらかにまとめる必要がある。

### 問題点②　カラム名が適切でない

is_order,is_accumulated_ordersというカラム名が使われています。[こちらの記事](https://qiita.com/kumackey/items/7ccbc949458bd0af22bd)を参考にしてテーブルの切り分けを行ったためis_〇〇というカラム名にしました。

どうやらisを接頭につけると、格納される値はtrue, falseになるのがベストのようです。なぜなら、isはクローズドクエスチョンだからです。なので、カラム名をそれぞれis_order⇨orders,is_accumulated_orders⇨削除に変更しました。

[クイズアプリにおけるデータベース設計のアンチパターン - Qiita](https://qiita.com/kumackey/items/7ccbc949458bd0af22bd)

### 問題点①を理解する

これは生徒の例を使うと、なぜアンチパターンなのか理解することができました。

下記のような生徒クラスがあるとします。

![](https://storage.googleapis.com/zenn-user-upload/223f56e65524-20230617.png)

生徒はそれぞれidと出席番号を持っていて、クラスIDの組に所属すると仮定します。

ここに4人の生徒がいます。

```ruby

id:4
出席番号:4
クラスID:1
名前: 安倍

id:1
出席番号:1
クラスID:1
名前: 青木

id:3
出席番号:3
クラスID:1
名前: 麻生

id:2
出席番号:2
クラスID:1
名前: 秋元
```

１組に所属する生徒を取得したい場合、SQLは以下のように書きます。

```ruby
SELECT s.name
FROM Student s
WHERE s.class_id = 1
#=> "安倍","青木","麻生","秋元"
```

さらに、順番を昇順に取得したい場合はORDER句を使用して以下のように書きます

```ruby
SELECT s.name
FROM Student s
WHERE s.class_id = 1
ORDER BY absence_id
#=> "青木","秋元","麻生","安倍"
```

つまり、Studentクラスのみで、生徒の順番や所属する場所を絞り込み検索することができるので、わざわざ順番だけを保持するクラスや、所属する場所だけを保持するクラスを作る必要が内容です。

当初のテーブル設計は正規化が足りていなかったみたいです。

### 最終形態(第3正規化)

順番だけを持つAccumulatedOrdersテーブルが今回のテーブル設計に不必要なものになったので、削除し、設計を見直しました。
![](https://storage.googleapis.com/zenn-user-upload/f94116d1b74a-20230617.png)

### と思いきや、、

しかし、まだ正規化が足りていません。順番とお酒の種類を持つテーブルになってしまっています。一つのテーブルで守らせたい挙動は一つに決まっているので、順番とアルコールの種類を切り分けて二つのテーブルに切り出しました。
![](https://storage.googleapis.com/zenn-user-upload/ebac768cf701-20230617.png)

これで現段階の正規化が完了しました。

これから本格的にポートフォリオを作成していきます。結果的にテーブル数が４つになってしまいましたが、拡張性の高いアプリではあるので、機能追加と主にテーブルを増やしていければと思います。なんとなくデータベースのdの字くらいはわかってきた気がするな？

[マスタとトランザクション - Qiita](https://qiita.com/puripuri_corgi/items/5547813f75038e368be7)

[クイズアプリにおけるデータベース設計のアンチパターン - Qiita](https://qiita.com/kumackey/items/7ccbc949458bd0af22bd)