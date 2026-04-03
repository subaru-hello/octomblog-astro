---
title: "【Linux】 Sed, Echo"
description: "LinuxのコマンドであるSedとEchoを知ってつよつよエンジニアになろう"
date: 2023-06-17T22:43:35+09:00
draft: false
author: subaru
authorEmoji: 🐙
tags:
- linux
categories:
- linux
image: images/feature2/linux.png
---
たまに使うLinuxコマンドをピックアップ。

### sed
ファイル内の文字を任意の文字に置換してくれるコマンド。

### -i

[sedコマンドでファイルを編集して上書き保存する](https://monologu.com/overwrite-file-by-sed/)

```jsx
sed -i ‘’ /s/hoge/foo/g aa.txt
```

‘’でバックアップを取っている。 

hogeに置換前

```jsx
$ cat aa.txt
hoge
hogettt

```

fooに置換後

```jsx
$ sed -i '' 's/hoge/foo/g' aa.txt
SubarunoMacBook-puro-3:quickstart subaru$ cat aa.txt
foo
foottt
```

aa.txtに編集対象のファイル名を入れる

```jsx
//aa.txt

hoge
```

aa.txtと同ディレクトリに移動後、上記のコマンドを打つと、下記のように変換されている


GNU環境だと、-iに’’をくっつけないと、下記の様にエラーが出てしまう

```jsx
$ sed -i '' 's/GENERATE_SOURCEMAP=true/GENERATE_SOURCEMAP=false/g' .env
sed: s/GENERATE_SOURCEMAP=true/GENERATE_SOURCEMAP=false/g を読み込めません: No such file or directory
```

くっつけると、

```jsx
$ sed -i'' 's/GENERATE_SOURCEMAP=true/GENERATE_SOURCEMAP=false/g' .env
```

### -e

```jsx
sed -e "s/REACT_APP_SHOW_DEV_VIEW//g" .env.development >> .env.development
```

sed -e “s/置換前/置換後/g” 入力ファイル >> 出力ファイル

入力ファイルの中で、置換前の変数を置換後に直してから、出力ファイルに出力する

### -i -e

[sedコマンドでファイルを編集して上書き保存する](https://monologu.com/overwrite-file-by-sed/)

### echo
CI/CDの時、環境に応じてshellスクリプトからenvを更新したい時がある。
その時にechoを使うが、細かい挙動の違いがあるから、まとめておく。

```jsx
echo "REACT_APP_SENTRY_RELEASE_VERSION=$VERSION" >> .env
```

`>>`　

echoの引数に入れた文字列を末尾に追加する。あらかじめ改行をしておかないと、既存ファイルの末尾に文字列があった場合、繋がって保存されてしまう

`>`

echoの引数に入れた文字列のみ .envに入力される。既存の内容が全部上書きされる