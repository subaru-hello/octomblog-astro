---
title: "[Typescript] コードで学ぶアルゴリズム ノームソート"
description: "アルゴリズムの王道であるノームソートを学んで奥深さを知ろう"
date: 2023-06-13T07:07:20+09:00
draft: false
author: subaru
authorEmoji: 🐙
tags:
- algorithms
- typescript
categories:
- algorithms
image: images/feature2/typescript.png
---

今日は米消費者物価指数発表や英雇用統計発表があって為替市場はお祭り騒ぎでしたね。
明日はFOMCも開催されるみたいで、ポジション取りずらい。
とまあ、難しい単語を使ってみたいお年頃らしいです。見守ってあげてつかわさい。

今回は、ノームソートについて学んでいきたいと思います。

### ノームソート
> 間違った順序になっている要素を見つけると、その要素を正しい場所に移動するまでバックトラック（後方へ戻る）されるアルゴリズム。

このアルゴリズムの名前は、庭の手入れをしている庭園のノーム（小人）が歩きながら後ろを見て花の配置が正しいか確認し、不適切な場合には修正するという行動を模倣して作られたみたいです。
なんか想像できますね笑

では、実際にコードを見ていきます。
```js
const gnomeSort = (arr: number[]): number[] => {
  if (arr.length <= 1) {
    return arr;
  }

  let i: number = 1;

  while (i < arr.length) {
    if (arr[i - 1] <= arr[i]) {
      i++; 
    } else {
      [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]]; 
      i = Math.max(1, i - 1);
    }
  }
  return arr;
};
```

データフローを把握するために、consoleを挟んでどんな感じで値がスワップされているのかを見てみます。
```js
    } else {
      [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]]; 
        console.log("====swapped=====",`${arr[i-1]} ⇆ ${arr[i]}`)
```
下記のようになりました。先頭の値AとインデックスがA+1にある値を比較してA > A+1だった場合に位置が交換されていますね。
A < A+1になったら次のループに入っているので、Aが先頭に向かって前進しているように見えます。かわいいですね。

```js
> gnomeSort([133,3,444,535,666,141,22])
====swapped===== 3 ⇆ 133
====swapped===== 141 ⇆ 666
====swapped===== 141 ⇆ 535
====swapped===== 141 ⇆ 444
====swapped===== 22 ⇆ 666
====swapped===== 22 ⇆ 535
====swapped===== 22 ⇆ 444
====swapped===== 22 ⇆ 141
====swapped===== 22 ⇆ 133
(7) [3, 22, 133, 141, 444, 535, 666]
```

### 使用場面
Gnome Sortの計算時間複雑度は最悪の場合でも最良の場合でもO(n^2)なので、使用される場面はあまりなさそうです。

### 参考文献
ChatGPT model=gpt-4
https://github.com/TheAlgorithms/TypeScript/blob/master/sorts/gnome_sort.ts