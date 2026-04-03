---
title: "[技術選定の審美眼] コンパイラ ~ インタプリタ言語"
description: "[技術選定の審美眼] コンパイラ ~ インタプリタ言語"
date: 2023-06-16T08:19:22+09:00
draft: false
author: subaru
authorEmoji: 🐙
tags:
- CS
categories:
- CS
image: images/feature2/eye.png
---

技術選定ができるようになりたい。

**[技術選定の審美眼](https://speakerdeck.com/twada/understanding-the-spiral-of-technologies)** を養う前に、そもそもどんな言語が存在しているのかを知りたいんだ。

だから、言語にはどんな種類があるのかを調べてまとめた。

### コンパイラ言語

事前に一括でコンパイルしてからプログラム語に翻訳する言語のことをコンパイラ言語という。

ソースプログラムをコンパイラに通し、オブジェクトプログラムを作成。その後、オブジェクトプログラムを実行する。

２回手順を踏むので少々手間だが、下記のような点で堅牢なプログラム作りに貢献している。

- コンパイラに通した時に静的解析を行なってくれる
- 実行速度が速くなる
[コンパイラ言語とは？インタプリタ・スクリプトとの違いやJITについても解説 | Modis株式会社](https://www.modis.co.jp/candidate/insight/column_76)

例えば、コンパイラ言語の代表格であるc言語の場合のコンパイルまでの流れは下記のようになる。

1. まずcファイルを作成する

pointa.c

```c
#include <stdio.h>
#include "./pointa.h"
int main(void)
{
    int a  = 15;     
    int b = 20;    

    pointa(&a, &b);

       /* 交換後の値を表示 */
    printf("ポインタ: a = %d, b = %d\n", a, b);
    
    return 0;
}

void pointa(int *pa, int *pb)
{
    int temporally_num;
    
    /* 値を交換する */
    temporally_num = *pa;
    *pa  = *pb;
    *pb  = temporally_num;
}

```

1. コンパイルしてファイルを作成する

```c
% gcc -o pointa pointa.c
```

もし文法にミスがあると下記のようなエラーが出て、実行ファイルが生成されない。

```c
% gcc -o pointa pointa.c
  
pointa.c:16:5: error: implicit declaration of function 'pointa' is invalid in C99 [-Werror,-Wimplicit-function-declaration]
    pointa(&a, &b);
    ^
   
pointa.c:35:6: error: conflicting types for 'pointa'
void pointa(int *pa, int *pb)
     ^
pointa.c:16:5: note: previous implicit declaration is here
    pointa(&a, &b);
    ^
2 errors generated.
```

1. poinaというオブジェクトファイルが生成されるので、実行する

```c
% pointa
ポインタ: a = 20, b = 15

```


### インタプリタ言語

一行一行マシン後に翻訳してから実行する言語。コンパイラ言語と違い、実行速度が遅くなっている反面、コンパイルする手順をコーダーが考えなくていいため、比較的容易に書くことができる。

下記のようなメリットがある。

・プログラムをすぐに実行できる

・1行1行読み込むので、実行がうまくいかなかった時点で、すぐにデバックに取りかかれる

代表的な言語として、Javascript, Ruby, Python, PHPなどがある。

### スクリプト言語

人間が読みやすいように書かれている言語。`インタプリタ言語 includes スクリプト言語`のような関係性になっているため、スクリプト言語に対して厳密な定義は存在していない。

[スクリプト言語とは？コンパイラ言語との違いや種類一覧も紹介！ | Modis株式会社](https://www.modis.co.jp/candidate/insight/column_77)

### JITコンパイラ

JITコンパイラは、事前コンパイルで中間言語に変換し、仮想マシンを通して機械言語に変換することで処理を高速化するもので、コンパイラ言語とインタプリタ言語の中間に位置するような言語になっている。

インタプリタ言語の「一行一行翻訳する」ことによる実行速度の遅延を解消するソリューションの一つとして活躍している。

Ruby2.6以降JITコンパイラが搭載されて、Ruby 2.6.0の時点で、[Optcarrot](https://github.com/mame/optcarrot)というCPU負荷中心のベンチマークにおいてRuby 2.5の[約1.7倍の性能向上](https://gist.github.com/k0kubun/d7f54d96f8e501bbbc78b927640f4208)を達成していた。

[Ruby 2.6.0 Released](https://www.ruby-lang.org/ja/news/2018/12/25/ruby-2-6-0-released/)

また、Ruby3.1から同袍されたYJITは下記のような実績を達成している。しかし、x86-64上のUnix系プラットフォームのみで動いている。（2021年12月時点）

| Ruby標準のインタプリタと比べてrailsbenchで20％、liquidテンプレートレンダリングで39％、Active Recordで37％の性能向上を達成していると

[プロと読み解く Ruby 3.1 NEWS - クックパッド開発者ブログ](https://techlife.cookpad.com/entry/2021/12/25/220002)

[「Ruby 3.1.0」がリリース ～プロセス内JITコンパイラー「YJIT」をマージ【2022年1月5日追記】／言語機能の強化やデバッグ機能の改善なども](https://forest.watch.impress.co.jp/docs/news/1377364.html)

### プログラムが実行されるまで

ソースコードをコンパイルする時に、一行ずつか、一気に全てかで言語の呼び名が変わってくることは理解できた。

実際にプログラムが実行されるまでにどんな処理が発生しているのかを理解しておきたい。

プログラミング言語が「文字列を入力してからプログラム語に翻訳されていくまでの流れ」は以下の通り。

1. 字句解析器
2. 構文解析器（パーサ）
3. 意味解析器（アナライザー）
4. インタプリタ

rubyの構文は[Lisp](http://d.hatena.ne.jp/keyword/Lisp)や[Smalltalk](http://d.hatena.ne.jp/keyword/Smalltalk)といった高度な言語のア[イデア](http://d.hatena.ne.jp/keyword/%A5%A4%A5%C7%A5%A2)を採用しているため、下記のような流れになっている。

1. 字句解析
2. 構文解析
3. コンパイル
4. YARV

詳しく述べるとかなり時間がかかりそうなので、今回はここまでにしたいと思う。

### 参考記事
[コンパイラ言語とは？インタプリタ・スクリプトとの違いやJITについても解説 | Modis株式会社](https://www.modis.co.jp/candidate/insight/column_76)

[スクリプト言語とは？コンパイラ言語との違いや種類一覧も紹介！ | Modis株式会社](https://www.modis.co.jp/candidate/insight/column_77)

[プロと読み解く Ruby 3.1 NEWS - クックパッド開発者ブログ](https://techlife.cookpad.com/entry/2021/12/25/220002)

[「Ruby 3.1.0」がリリース ～プロセス内JITコンパイラー「YJIT」をマージ【2022年1月5日追記】／言語機能の強化やデバッグ機能の改善なども](https://forest.watch.impress.co.jp/docs/news/1377364.html)

[「Rubyのしくみ」 第1章 字句解析と構文解析を読んで - Hit the books!!](https://ud-ike.hatenablog.com/entry/2022/05/13/142902)