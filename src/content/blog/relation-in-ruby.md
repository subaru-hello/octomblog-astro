---
title: "テーブルの関連付け（一対一、一対多、多対多）"
date: 2021-11-21T22:07:40+09:00
authorEmoji: 🐙
tags:
- ruby
- 関連づけ
categories:
- ruby
image: images/feature2/ruby.jpeg
---

ER図作成にあたり、エンティティ同士のリレーションの付け方がわからなくなってしまった。IE記法でER図を作成するにあたり、エンティティ同士のリレーションの付け方がわからなくなってしまった。今回はテーブルの関連付け（一対一、一対多、多対多）を学んでいく。

### 今回使用する共通モデル
```rb
# article.rb
class Article < ApplicationRecord
  belongs_to :user
  has_many :comments, dependent: :destroy
 end
```

```rb
# comment.rb
class Comment < ApplicationRecord
    belongs_to :user
    belongs_to :board
end
```
```rb
# user.rb
class User < ApplicationRecord
  has_many :boards, dependent: :destroy
  has_many :comments, dependent: :destroy
end
```

**ER図**
![](https://storage.googleapis.com/zenn-user-upload/b8c1749ee7cd-20230715.png)

### 関連付けをする目的って？

テーブル同士を関連付けさせることで、データ操作を簡単にするため。

例えば記事を投稿する時、冒頭のような関連付をしないと以下の書き方になる。

```rb
@article = Article.create(published_at: Time.now, user_id: @user.id)
```

記事を削除する場合は以下の通り
```rb
@articles = Article.where(user_id: @user.id)
@articles.each do |article|
  article.destroy
end
@user.destroy
```

冒頭のような書き方にすることで、データ操作を下記のようにシンプルな状態にすることが可能になる。
```rb
@article =　@user.articles.create(published_at: Time.now)
```

ユーザーと投稿をまとめて削除する時は、以下のように記述する。かなりシンプル

`@user.destroy`


## 関連付ってどんな種類がある?

ActiveRecordでは、エンティティ間を関連づけるメソッドが多く存在している。今回ER図作成で使用する3つの関連付けを学習したい。

### 1対多,1対1
belongs_to

```rb
class Comment < ApplicationRecord
    belongs_to :user
    belongs_to :board
end
```

belongs_to関連付けは、別のモデルとの間に1対1の関連付けを作成します。データベースの用語で説明すると、この関連付けが行われているクラスには外部キーがあるということです。外部キーが自分のクラスではなく相手のクラスにあるのであれば、belongs_toではなくhas_oneを使う必要があります。

外部キーを持つクラスが子クラスになるということかな。

あるモデルが他のモデルに従属している(belongs_to)と宣言すると、2つのモデルのそれぞれのインスタンス間で「主キー - 外部キー」情報を保持しておくようにRailsに指示が伝わる。

今回の例だと、commentモデルにuserとboardの外部キーを置き、userとboardにはそれぞれ主キーを置くことになる。

### has_oneとbelongs_toの違い

has_manyとbelongs_toの違いは、関連づける相手が１は多かだったが、今度は両方とも相手が１になった。。さてどうしよう。

**１対１（belongs_to と has_one)**

１対１の関連性がある場合、関連付けたいモデルに、belogs_to または　has_oneを加える。例えばあるシステムでは１人のUserは１つのAccountしか持てない決まりだった場合、ユーザーは１つのアカウントを持っている（has_one)、アカウントは特定のユーザーに属している(belongs_to)という関連付けができる。

### belongs_toとhas_oneのどちらを選ぶか？

2つのモデル（UserとAccount）の間に1対1の関係を作りたいのであれば、いずれか一方のモデルにbelongs_toを追加し、もう一方のモデルにhas_oneを追加する必要がある。どちらの関連付けをどちらのモデルに置けばいいか迷った場合、「ユーザーがアカウントを持っている」とみなす方が、「アカウントがユーザーを持っている」と考えるよりも自然。つまり、この場合の正しい関係は以下のようになる。

- UserモデルとAccountモデル
```rb
class User < ApplicationRecord
  has_one :account
end

class Account 
  belongs_to :user
end
```

もちろん外部キーはaccountに置き、主キーはuserに置いている。

### has_many

has_many関連付けは、他のモデルとの間に「1対多」のつながりがあることを示します。has_many関連付けが使われている場合、「反対側」のモデルでは多くの場合belongs_toが使われます。has_many関連付けが使われている場合、そのモデルのインスタンスは、反対側のモデルの「0個以上の」インスタンスを所有します。たとえば、著者(Author)と書籍(Book)を含むRailsアプリケーションでは、著者のモデルを以下のように宣言できます。
```rb
class Author < ApplicationRecord
  has_many :books
end
```

### N対M（多対多）

互いに複数のidに紐づく関係を指している。

idだけを持つ中間テーブルを間に挟んで紐づく。

例えば通信塾の場合。一人の生徒は複数の先生のオンライン講座を受講するし、一人の先生は複数の受講生から受講される。この場合、オンライン講座を通して管理すると整理がしやすい

```rb
# student.rb

class Patient < ApplicationRecord
  has_many :onlineclasses
  has_many :teachers, through: :onlineclasses
end
```

```rb
# teacher.rb

class Physician < ApplicationRecord
  has_many :onlineclass
  has_many :students, through: :onlineclasses
end
```

```rb
# onlineclass.rb

class Onlineclass < ApplicationRecord
  belongs_to :teacher
  belongs_to :student
end
```

多対多の関連付けは、上記のようなソースコードで記述される。

先述したように、ここで特徴的なのはStudentモデルとTeacherモデルは、直接的な関連付けがなされていないという点。

ここでonlineclassesテーブルは、teachersテーブルとstudentsテーブルの間に入っているため、中間テーブルと呼ばれている。

また、Onlineclassモデルのように、2つのモデルの中立ちを行うモデルを結合モデルと呼びます。

### 中間テーブル

多対多のリレーションを作る際に使用されるテーブルのこと。

Twitterで、ユーザーが誰がの投稿にいいねをつける時に初めてこの概念に出会った。

### まとめ
- 関連付けの目的は、データ操作をより簡単にするため。
- 親テーブルに主キー、子テーブルに外部キー
- 双方が一対一の関係の場合、子 belongs to 親、親 has_one 子

## 参考
https://qiita.com/s_tatsuki/items/9a875a9cf486172b8ead

https://qiita.com/morikuma709/items/9fde633db9171b36a068

https://railsguides.jp/association_basics.html

https://qiita.com/kazukimatsumoto/items/14bdff681ec5ddac26d1