---
title: "【Promise】async/awaitの不思議"
description: "axiosの仕組みとPromiseを学ぼう。コールバック地獄には注意だよ。"
date: 2023-06-20T07:33:03+09:00
authorEmoji: 🐙
tags:
- javascript
- typescript
- Promise
categories:
- 非同期処理
image: images/feature2/js.png
---

axiosのthenやcatchがわからない。そしてPromiseやasync/awaitとかも出てきてしまうから余計に頭が混同してまう。

今回は、ちょっと一旦その単語調べさせて〜と半べそかきながら参考文献を読み漁って脳内パッチワークをしたログになります。#いい歳して半べそかくな。

## axiosとは

axiosとはブラウザやnode.js上で動くPromiseベースのHTTPクライアントです。非同期にHTTP通信を行いたいときに容易に実装できます。

でた、Promise。HTTPクライアントってことは、サーバーにリクエストをなげる何かってことなのかな。

どうやって使うのか

そうやらgetとpostでサーバーに対してリクエストを投げられるらしい。

### GET通信

GET通信はaxios.getメソッドを使用する。

第一引数にパラメータ付きのURLを指定し、

.then()で通信が成功した際の処理を書いている。

.catch()はエラーにの処理を書く。

.finally()は通信が成功しても失敗しても常に実行される。

```js
axios
  .get('/user?ID=12345')
  .then(function (response) {    // handle success  
    console.log(response);
  })
  .catch(function (error) {    // handle error  
  console.log(error);
})
.finally(function () {    // always executed
});
```

### POST通信

POST通信はaxios.postメソッドを使用する。
```js
axios
  .post('/user', {  firstName: 'subaru',  lastName: 'nakano'})
  .then(function (response) {  console.log(response);})
  .catch(function (error) {  console.log(error);
});
```

第2引数に送信したいデータを指定することでPOST送信できる。

postアクションが行われたときに、/userパスに第二引数が渡されるようになっている。

例えばログインアクションを実装したい時に、postは以下のように使う。

Vuexに入れているからmutationに対して変更をcommitする流れを記述している。

```js
const actions = {
  loginUser({ commit }, user) {# ...1
    axios
      .post('sessions', user) # ...2
      .then((res) => {#...3
        commit('setAuthUser', res.data);#...4
        router.push({ name: 'PreliquoTop' });
        alert('ログインに成功しました');
      })
      .catch((err) => console.log(err));
  }
```
第一引数にcommitを取り、第二引数のデータをmutationにコミットできるようにしている。
sessionsコントローラーのpostアクション(createアクション)に対して、userをpostしている。
Promiseのresolveの省略形。成功したときの処理を書いている。。
postアクションが成功したら、そのセッションデータがsetAuthUserに渡るようになっている

### Promise

処理の順序に「お約束」を取り付けることができるもの、処理を待機することや、その結果に応じて次の処理をすることお約束するもの。

Promiseでは、処理されている状態を表す三つのメソッドがある。

**pending**: 未解決 (処理が終わるのを待っている状態)
**resolved**: 解決済み (処理が終わり、無事成功した状態)
**rejected**: 拒否 (処理が失敗に終わってしまった状態)

Promiseの基本形は下記のように書く。
```js
function 非同期的な関数(成功時コールバック, 失敗時コールバック) {
  if (...) {
    成功時コールバック(成果)
  } else {
    失敗時コールバック(問題)
  }
}

//          ↓executor
new Promise(function (resolve, reject) {
  非同期的な関数(
    (成果) => resolve(成果), // 成功時コールバック関数
    (問題) => reject(問題),  // 失敗時コールバック関数
  )
})
```

ここで使用されているPromiseインスタンスを抜粋すると、下記のような書き方になっている。

```js
const promise = new Promise((resolve, reject) => {});
```

{}の中身がresolveした場合は、.thenの中身が実行され、rejectされた場合は.catchの中身が実行される。

## async/await
### asyncとは

asyncは非同期関数を定義する関数宣言であり、関数の頭につけることで、Promiseオブジェクトを返す関数にすることができます

非同期関数を定義する関数宣言のこと。

以下のように関数の前にasyncを宣言することにより、非同期関数（async function）を定義できる。

```js
async function sample() {}
```

### awaitとは

awaitは、Promiseオブジェクトが値を返すのを待つ演算子です。awaitは必ず、async function内で使います

async function内でPromiseの結果（resolve、reject）が返されるまで待機する（処理を一時停止する）演算子のこと

以下のように、関数の前にawaitを指定すると、その関数のPromiseの結果が返されるまで待機する。

```js
async function sample() {
    const result = await sampleResolve();

    // sampleResolve()のPromiseの結果が返ってくるまで以下は実行されない
    console.log(result);
}
```

まとめると、

1. await → Promiseの値が取り出されるまで待つ。
2. async → awaitキーワードを使っている関数のあたまに付ける必要がある。
3. asyncとawaitを使うと、.thenと.catchを省略できるのでコードがスッキリする。

### async/awaitを使った場合と使わなかった場合の非同期処理を比較

- async/awaitを使わなかった場合。
```js
function getServerStatusCode() {
    return new Promise(function(resolve, reject) {
        axios
            .get("<https://httpbin.org/status/200>")
            .then(response => resolve(response.status))
            .catch(error => reject(error.response.status))
    });
}

getServerStatusCode()
    .then(statusCode => console.log("生きてる", statusCode))
    .catch(statusCode => console.error("死んでる", statusCode))
```

- async/awaitを使った場合。

```js
async function getServerStatusCode() {
  try {
    return (await axios.get("<https://httpbin.org/status/500>")).status
  } catch (error) {
    throw error.response.status
  }
}

getServerStatusCode()
    .then(statusCode => console.log("生きてる", statusCode))
    .catch(statusCode => console.error("死んでる", statusCode))
```

チェーンさせることもできる

.thenを組み合わせることで、「1番目の処理が成功したら、2番目の処理を実行させる」といったことも可能になる。

```js
const promise = new Promise((resolve, reject) => {
  resolve("ヤッホー");
})
  .then((val) => {
    console.log(`then1: ${val}`);
    return val;
  })
  .catch((val) => {
    console.log(`catch: ${val}`);
    return val;
  })
  .then((val) => {
    console.log(`then2: ${val}`);
  });

#出力結果
#then1: ヤッホー
#then2: ヤッホー
``` 

catchの中身はエラー時のみなので、今回はthen1とthen2が表示されている。

連続した非同期処理（async/await構文）

awaitを利用すれば、then()で処理を繋げなくても連続した非同期処理が書ける。

```js
function sampleResolve(value) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(value);
        }, 1000);
    })
}

async function sample() {
    return await sampleResolve(10) * await sampleResolve(10) + await sampleResolve(20);
}

async function sample2() {
    const a = await sampleResolve(10);
    const b = await sampleResolve(10);
    const c = await sampleResolve(20);
    return a * b + c;
}

sample().then((v) => {
    console.log(v); // => 120
});

sample2().then((v) => {
    console.log(v); // => 120
});
```

### まとめ
Promise構文を使うと、javascriptに処理する順序を与えることができる。
.thenを繋げるコードは綺麗じゃない。そんな時はasync/awaitを使う。
asyncが文頭にあるfunctionはPromiseのレスポンスが返るまでawait内の処理を実行しない。

ざっくり、Promiseを使うとconsole.logの順番を制御できるんだな〜と認識できた。axios.postした後の順番を制御するためにpromiseが使われているのかな？アプリ制作が終わる頃にはマスターしてたい！

### 参考
アクション | Vuex

async/await 入門（JavaScript） - Qiita

Promise - JavaScript | MDN

【ES6】 JavaScript初心者でもわかるPromise講座 - Qiita

Promiseの使い方、それに代わるasync/awaitの使い方 - Qiita

async/await 入門（JavaScript） - Qiita

【Ajax】axiosを使って簡単にHTTP通信 | Will Style Inc.｜神戸にあるウェブ制作会社