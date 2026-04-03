---
title: "[clamscan] Array.fromの使い方"
date: 2023-06-25T21:23:03+09:00
authorEmoji: 🐙
tags:
- javascript
- clamscan
categories:
- 非同期処理
image: images/feature2/clamav.png
---

S3へアップロードされたファイルにウイルスチェックをかける機能をlambdaで書いています。
clamscanというライブラリを使うため、clamscanのコードリーディングをしていました。
コードの中で、Array.fromという知らない関数があったのでまとめます。

### Array.from
元の配列に変更を加えないでシャローコピーした配列を作り出す関数です。
下記のように第一引数に配列、第二引数に関数を取るようです。
thisArgは、初期値として持たせておきたいstateを配置するために用意されています。

```js
Array.from(arrayLike)
Array.from(arrayLike, mapFn)
Array.from(arrayLike, mapFn, thisArg)
```

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from

こんな感じの入出力がされます。
```js
console.log(Array.from([('path/to/aaa.png'),('path/to/aaa.png')]));

const square = (x) => x * x;

console.log(Array.from([3,6,9], x => square(x)));

const argTimesA = function(x) { return x * this.a; };
const thisArg = { a: 4 };

console.log(Array.from([3,6,9], argTimesA , thisArg));
```

![](https://storage.googleapis.com/zenn-user-upload/a64d89a7a424-20230625.png)

### clamscanでの使われ方
NodeScanインスタンスのscanFilesメソッド内で使われています。scanした結果、ウィルスに感染している恐れがあるファイルはbadFilesに、恐れがないファイルはgoogFiles,
ウィルス名をvirusesに入れる処理が書かれています。
new Setでファイルの重複をなくし、配列のシャローコピーを作成しています。

```js
  badFiles = Array.from(new Set(badFiles));
  goodFiles = Array.from(new Set(goodFiles));
  viruses = Array.from(new Set(viruses));
```

https://github.com/kylefarris/clamscan/blob/e04d635a8db1c477047c89a76c24fc581e9ca03f/index.js#L1564C58-L1564C58

### new Set
Setは順序付けられた要素の一意なリストを保持し、重複を防ぐのに役立つ関数です。
下記に例を挙げておきます。

- 重複の排除
配列などから重複する要素を取り除く
```js
const arrayWithDuplicates = [1, 2, 3, 2, 1];
const uniqueArray = [...new Set(arrayWithDuplicates)]; // [1, 2, 3]
```

- 存在確認
内部的にハッシュテーブル（またはハッシュマップ）と呼ばれるデータ構造を使っているため、操作を高速に行えるようです。
キーをハッシュ値に変換するこのプロセスは一定時間（O(1)時間）で行えます。
```js
const mySet = new Set([1, 2, 3, 4, 5]);

// Checking for existence is fast and straightforward
console.log(mySet.has(3)); // true
console.log(mySet.has(6)); // false

```
