---
title: "Vue @click 引き数渡し + 複数使う方法を✅"
date: 2021-11-15T21:53:53+09:00
authorEmoji: 🐙
tags:
- Vue.js
categories:
- Vue.js
image: images/feature2/vue.png
---

同じタグ内でv-onハンドラを複数使いたい。これまではv-on:clickと@clickに分けていたが、Github Actionsに設定していたvue/no-parsing-errorによって「同一タグ内で同じハンドラは使えません」と拒絶されてしまった。ぴえそぴえそ泣。

![](https://storage.googleapis.com/zenn-user-upload/e489e62096e5-20230715.png)

今回は、その時のエラー解決ログをまとめたブログとなっている。

### v-onを複数使う方法

@click=""もしくはv-on:click=""の後に発火させたいメソッドを記載する。

例えばscriptタグ内でfirstMethod()とsecondMethod()を定義してあり、ボタンを押したら両方発火させたいと考えている場合は以下の通りに記述する。

```js
<template>
<button @click="MethodOne(); MethodTwo()"></button>
</template>

export default{
  // ・・・
  methods: {
    MethodOne(){
      // ・・・
    },
    MethodTwo(){
      // ・・・
    },
  },
};
```

vue的に複数のメソッドを同一タグ内に記述することはベターとされていない。そういう時は、メソッドを下記のようにラップする。

```js
<template>
<div @click="multipleMethod()"></div>
</template>
<script>
methods: {
    multipleMethod() {
      this.MethodOne()
      this.MethodTwo()
    }
   MethodOne() {
      // ・・・
    }
   MethodTwo() {
      // ・・・
    }
  }
}
</script>
```

[【Vue】v-onで複数の関数を呼び出す方法 - Qiita](https://qiita.com/_Keitaro_/items/375c5274bebf367f24e0)

### 今回実装したかったこと
クリックしたらstateの変更(update)及び次の項目に飛ばす

メソッドには下記のように定義してある。

```js
<script>
export default{
// ・・・
methods:{
#クリックしたらstateを更新する。
countAnswer(indexNum, updAnswer) {
      this.updateAnswer({ indexNum, updAnswer });
    },
clickScroll(e) {
#クリックしたら現在の座標を取得し、水平方向に0,垂直方向に現在のスクロール量 + 次の座標コンテナのtop部分の量だけ移動する。
      const targetArea = e.currentTarget.getBoundingClientRect();
      window.scrollTo(0, window.pageYOffset + targetArea.top);
    },
}
</script>
```

この二つのメソッドを同時に発火させるために当初は下記のように書いていた。

```js
<v-radio
    class="mx-auto justify-center"
    fab
    light
    :ripple="{ center: false, class: 'gray--text' }"
    v-on:click="clickScroll"
    @click="countAnswer(question.num, 3)"
    label="3: 全くない"
>
</v-radio>
```

同一タグ内で強引にv-on:clickと@clickを使っている。これはこれで動くのだが、vue-no-parsing-error的にはアウトらしい。

試しに冒頭で書いた内容に変えてみた。

```js
<v-radio
    class="mx-auto justify-center"
    fab
    light
    :ripple="{ center: false, class: 'gray--text' }"
    v-on:click="clickScroll; countAnswer(question.num, 3);"

    label="3: 全くない"
    >
</v-radio>
```

だが、これだと「currentTargetが見つかりません」というエラーを吐き出し、動かなくなってしまった。引数をうまく渡せていないみたい。

どうしよ〜と思い、「v-on click 引数 複数」と調べたら下記記事にヒット。


[複数のv-on:clickを記述するとクリックした要素を取得できない｜teratail](https://teratail.com/questions/134322)

まんま同じ内容で悩んでいらっしゃった。助かる。

どうやら、引数を渡すためには、v-onで書くメソッド名()の中に$eventを書けば良いそうで。

```js
<v-radio
    class="mx-auto justify-center"
    fab
    light
    :ripple="{ center: false, class: 'gray--text' }"
                        v-on:click=""
    @click="clickScroll
    clickScroll($event);
    countAnswer(question.num, 3);
    "
    label="3: 全くない"
>
</v-radio>
```

このように、clickScrollの中に$eventを書いたら正常に動いた。

**before**
```js
<v-radio
    class="mx-auto justify-center"
    fab
    light
    :ripple="{ center: false, class: 'gray--text' }"
    v-on:click="clickScroll"
    @click="countAnswer(question.num, 3)"
    label="3: 全くない"
    >
</v-radio>
```

**after**

```js
<v-radio
    class="mx-auto justify-center"
    fab
    light
    :ripple="{ center: false, class: 'gray--text' }"
    v-on:click=""
    @click="clickScroll
    clickScroll($event);
    countAnswer(question.num, 3);
    "
    label="3: 全くない"
    >
</v-radio>
```

### 所感

Github Actionsって優秀だ。