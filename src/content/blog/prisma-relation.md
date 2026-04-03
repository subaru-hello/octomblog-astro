---
title: "【Prisma】関連付けの書き方"
date: 2023-06-19T21:57:50+09:00
author: subaru
authorEmoji: 🐙
tags:
- prisma
- typescript
categories:
- prisma
image: images/feature2/prisma.png
---

prismaの関連付けをまとめていきたいと思います。

### one to one
一つのテーブルに一つの子テーブルを紐づける場合に使用します。
ここでは、Userにプロフィール情報を持たせたい場合を想定しています。

```js
model User {
  id               String            @id @default(cuid())
  name             String
  email            String            @unique
  emailVerified    DateTime?
  profile          Profile?
}

model Profile {
  id     Int    @id @default(autoincrement())
  weight Int
  userId String @unique
  user   User   @relation(fields: [userId], references: [id])
}
```

親テーブルには子モデルを型としたカラムを追加します。
下記Userテーブルで言うところのprofile Profile?です。
Profileの末尾についている?は、null許容の?ですね。

```js
model User {
  id               String            @id @default(cuid())
  name             String
  email            String            @unique
  emailVerified    DateTime?
  profile          Profile?
}
```

子テーブルには、親テーブルのkeyと親モデルを型としたカラムを用意します。
カラム名は任意ですが、モデル名Idとするのが一般的です。
one to oneの場合、モデル名Idは一意になるのが自然なので、@uniqueをつけています。
また、関連付けを定義するために、@relationをつけています。
fieldsには親Idの対象を、referencesには自分のidを入れます。

```js
model Profile {
  id     Int    @id @default(autoincrement())
  weight Int
  userId String @unique
  user   User   @relation(fields: [userId], references: [id])
}
```

### one to many

1対多のパターンです。
親が子を何人も作り出せる形ですね。
ユーザーが複数投稿できる場合を考えてみます。

```js
model User {
  id               String            @id @default(cuid())
  name             String
  email            String            @unique
  emailVerified    DateTime?
  posts            Post[]
}


model Post {
  id        Int     @id @default(autoincrement())
  title     String
  content   String?
  published Boolean @default(false)
  author    User    @relation(fields: [authorId], references: [id])
  authorId  String
}
```

親テーブルにはArray型の子モデルが入るカラムを用意します。カラム名は任意ですが、わかりやすくするため、camel caseかつ複数形にするのが一般的です。

```js
model User {
  id               String            @id @default(cuid())
  name             String
  email            String            @unique
  emailVerified    DateTime?
  posts            Post[]
}

```

次に子テーブルです。
親は一つなので、単数系の親モデルを型とするカラムと、親keyカラムを用意して終了です。
```js
model Post {
  id        Int     @id @default(autoincrement())
  title     String
  content   String?
  published Boolean @default(false)
  author    User    @relation(fields: [authorId], references: [id])
  authorId  String
}
```

### many to many

多対多の関連付けの場合です。
多対多の関連付けは、一つの中間テーブルを二つのテーブルが共有するイメージです。
ここでは、お酒がカテゴライズされるケースを想定しています。
```js
model Alcohol {
  id                  Int                   @id @default(autoincrement())
  name                String
  description         String
  percentage          Int
  favoritedBy         FavoriteAlcohol[]
  alcoholGlasses      AlcoholPouredGlass[]
  categoriesOnAlcohol CategoriesOnAlcohol[]
}

model CategoriesOnAlcohol {
  id         Int      @id @default(autoincrement())
  alcoholId  Int
  categoryId Int
  alcohol    Alcohol  @relation(fields: [alcoholId], references: [id])
  category   Category @relation(fields: [categoryId], references: [id])
}

model Category {
  id                  Int                   @id @default(autoincrement())
  name                String
  categoriesOnAlcohol CategoriesOnAlcohol[]
}
```

まず関連付けたいテーブルに、中間テーブルを複数持てるカラムを用意します。
混乱しやすい書き方なのですが、これは一つのカラムで複数のデータを管理しているわけではありません。
複数持てるということを明示しているだけです。
Alcoholテーブルでいう、`categoriesOnAlcohol CategoriesOnAlcohol[]`のところです。
```js
model Alcohol {
  id                  Int                   @id @default(autoincrement())
  name                String
  description         String
  percentage          Int
  categoriesOnAlcohol CategoriesOnAlcohol[]
}

model Category {
  id                  Int                   @id @default(autoincrement())
  name                String
  categoriesOnAlcohol CategoriesOnAlcohol[]
}
```

中間テーブルには、リレーション対象のモデルを一つづつ定義します。
one to manyで説明した、many側のテーブルに書いた要素を二つにした感じです。
中間テーブルに持たせる内容は、主に**可変要素**なので納得ですね。
```js
model CategoriesOnAlcohol {
  id         Int      @id @default(autoincrement())
  alcoholId  Int
  categoryId Int
  alcohol    Alcohol  @relation(fields: [alcoholId], references: [id])
  category   Category @relation(fields: [categoryId], references: [id])
}
```

### 後述
schemaドリブンの場合、schemaにテーブル定義を書いてからprisma generateをするので今回のように定義すれば良いですが、普通はmigration ファイルで管理するでしょう。その方がログが残り、migration upとdownしやすくなるので便利だからです。