---
title: "【Prisma】1:Nのランキング作成に苦戦"
date: 2023-07-15T12:17:52+09:00
author: subaru
authorEmoji: 🐙
tags:
- prisma
- typescript
categories:
- prisma
image: images/feature2/prisma.png
---

prismaで1:Nのソートで苦戦している。
ユーザー一覧ページで、現在の売上が高い順にランキング形式で表示させたいのだが、どうもうまくいかない。
https://github.com/prisma/prisma/issues/5008 と同じ問題に直面している。

### 仕様
仕様を雑に書く。

- 売上管理システム
- 1:NなCustomer:dailyEarning
- dailyEarningは前日の売上が保存する
- dailyEarning.currentEarningは、Customerがシステムに登録した日を起算日として、当日6時までの売上情報が保存する
- dailyEarningは毎日6時に更新される

### スキーマ

```js
model Customer {
  custId    Int    @id @default(autoincrement())
  name      String
  dailyEarnings DailyEarning[]
}

model dailyEarning {
  dailyEarningId       Int  @id @default(autoincrement())
  dailyEarning         Float //昨日1日の売上
  currentEarning       Float //現在までの売上
  owner   Customer @relation(fields: [ownerId], references: [id])
  ownerId Int
}

```

### Prisma Clientでソート
現在までの売上をランキング形式で表示したい。
`dailyEarning.currentEarning`の額でソートして、降順でデータを返却することにする。

**「現在まで売上が多い順にして全てのユーザーを返却」**
下記のような感じで描きたいが、OrderByの中にincludeをネストさせる書き方はprismaに存在しない。

```js
const getCustomers = await prisma.customer.findMany({
  orderBy: 
    include: {
|    dailyEarnings: {
       take: 1,
       orderBy: {
	 currentEarning: 'desc',
       },
       select: {
         currentEarning: true,
       },
     }
  },
});

```

`$queryRaw`は使いたくない。prismaの恩恵が受けられないから。

```js
const queryCustomersOrderBycurrentEarningsDesc = 'SELECT * FROM Customer c LEFT INNER JOIN dailyEarning de ON(c.customerId = de.ownerId ) ORDER BY de.currentEarning DESC'

```

一番近いクエリーはこんな感じだけど、なんか違う。dailyEarningsがソートされて返ってくるだけ。
```js
const getCustomer = await prisma.customer.findMany({
    include: {
|    dailyEarnings: {
       orderBy: {
	 currentEarning: 'desc',
       },
       select: {
         currentEarning: true,
       },
  },
});
```

返却されるjson

```json
[
  {
    "customerId": 5,
    "name": "Genuine Person",
    "dailyEarnings": [
      {
        "currentEarning": 10000000
      },
      {
        "currentEarning": 2392000
      },
       {
        "currentEarning": -120000
      }
    ]
  },
  {
    "customerId": 5,
    "name": "Yo Solo",
    "dailyEarnings": [
      {
        "currentEarning": 50000000000
      },
      {
        "currentEarning": 1942000
      },
       {
        "currentEarning": -100000000
      }
    ]
  }
]
```


### chatGPTに聞いた
結局GPTさんに聞いたらそれっぽい回答が返ってきた。
本当は一つの文で完結させたかったけど、仕方ない。

```js
// 1. dailyEarningsで最大のcurrentEarningを持つcustomerを見つける
const dailyEarningsMax = await prisma.dailyEarnings.findMany({
  select: {
    customerId: true,
    currentEarning: true,
  },
  orderBy: {
    currentEarning: 'desc',
  },
  take: 1,
});

// 2. その結果を使ってcustomerをソートする
const sortedCustomers = await prisma.customer.findMany({
  where: {
    id: {
      in: dailyEarningsMax.map((dailyEarning) => dailyEarning.customerId),
    },
  },
  orderBy: {
    id: 'asc', // Or any other sorting condition
  },
});
```

### まとめ
- 仕様を固めてGPTに渡せば、問題は解決する。