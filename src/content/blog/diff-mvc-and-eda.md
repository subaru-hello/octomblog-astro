---
title: "イベントベースアーキテクチャとMVC"
date: 2024-01-20T11:04:15+09:00
author: subaru
authorEmoji: 🐙
tags:
- 疎結合
- javascript
- テスタブルjavascript
categories:
- javascript

image: images/feature2/super-joy.jpeg
---

テスタブルjavascriptを読んでイベントベースアーキテクチャとMVCについて書かれたいた部分があったから、自分なりの例を使ってまとめたいと思う。


## イベントベースアーキテクチャとMVCの違い
- MVC
モデル: 状態と振る舞いを持つ
コントローラー: クライアントから渡されたデータをモデルやビューに渡す橋渡し役。

- イベントベースアーキテクチャ
データ(モデル): 単なるオブジェクト。状態や振る舞いは持たない。
イベントハブ: イベントとハンドラを繋ぐ橋渡し役。SQSやAzure EventHubを思い浮かべると分かりやすい。

### モデルの持つ役割が違う
MVCは、モデルのクラスをDBの行毎にインスタンス化され(※1)、クラス毎にメソッドが定義されている(※2)。MVCではモデルがドメイン知識に関する状態(state)と振る舞い(behavior)を持っているという点が特徴的。

一方でイベントベースアーキテクチャにおけるモデルは、単にデータだけを持つオブジェクトにすぎないので、イベントリスナーは受け付けたデータ（あるいはモデル）をそのまま解釈するだけになる。

MVCにおけるモデルではデータとメソッドが「共存」しているのに対し、イベントベースアーキテクチャではデータとメソッドが「独立」している。
イベントベースアーキテクチャはその疎結合性が故に、テストの容易さやメモリ使用量の削減、モジュール化がしやすいという利点を持っている。


### 本を出版するケースを考える
- MVCの場合
図からわかるように、モデルにドメインロジックを持っている。

![](https://storage.googleapis.com/zenn-user-upload/5202b4951d19-20240120.png)
(A Description of the Model–View–Controller User Interface Paradigm in the Smalltalk-80 System より)

```
author = Author.findById(id: params.user_id) <-- ※1インサート対象のモデル毎に一つインスタンスを作成している

author.books.publish(
  title: "params.title", summary: "params.summary",　contents_file_path: "20230120/asdfgh-zxcvb/mvc.zip"
) // <-- ※2 Authorモデルがpublishというメソッドを持っている

```


- イベントベースアーキテクチャの場合
イベントリスナーで受け付けたeventデータは、単なるオブジェクトになっている。メソッドは持たない。
```
exports.handler = async function (event, context) {
  const params = event.body;
  const { title, summary, contents_file_path, author_id } = params;
  const author = await Author.findById({author_id});
  try {
    await author.books.createOne({
      title, summary, contents_file_path
    })
  }
  catch(e){
    console.log("====error====", e)
  }
  console.log("EVENT: \n" + JSON.stringify(event, null, 2));
  
  return context.logStreamName;
};
```

## 所感
イベントベースアーキテクチャは、データ(event listnerで受け付けたデータ)に状態や振る舞いを持たせないことで、疎結合を実現している。
nodejsはserver sideでjavascriptを使えるようにした言語。clientから来る何百万ものリクエストに対して、リクエスト内容が同じ場合に毎回同じ結果を返す必要があるから、データをstatelessにしているんだろうなと思った。
