---
title: "即時実行関数式"
description: "即時実行関数を知ってすぐに実行できる喜びを知ろう。javascriptとrubyで実装するよ"
date: 2023-06-06T22:35:22+09:00
draft: false
author: subaru
authorEmoji: 🐙
tags:
- 関数
categories:
- javascript
image: images/feature2/js.png
---

## 即時実行関数式

すぐに実行できる関数式のことを指している。

ラムダ式のような印象を受けた。

書き方は以下のようになる。

### javascriptの場合

;(() => 2 )()
;(() => console.log('hello'))()


実際にnodeで出力を確認してみる。

```bash
> ;(() => 2 )()
2
> ;(() => console.log('hello'))()
hello
>  ;((a) => a * 2 )(4)
8
```

めっちゃ即時やん（笑）

### rubyの場合

rubyはProcやlambdaといった関数型プログラミング的書き方が存在している。

```ruby
def proc_desu(a,b,c)
    Proc.new{
         a + b + c
      }
end

def lambda_desu(a,b,c)

    lambda { 
        a + b + c
    }
end

def iterator_desu(a,b,c)
    lambda { 
        a + b + c
    }
end

p '----Proc-----'
p proc_desu(1,2,3).call
p proc_desu('a','b','c').call

p '---lambda----'
p lambda_desu(1,2,3).call
p lambda_desu('a','b','c').call

p '----iterator----'
p iterator_desu(1,2,3).call
p iterator_desu('a','b','c').call

```

実行してみた。

```ruby
% ruby proc.rb
"----Proc-----"
6
"abc"
"---lambda----"
6
"abc"
"----iterator----"
6
"abc"
```

他で使う予定が無い簡易的な処理を書く際に使うことが多い無名関数。即時実行関数は覚えておいて損はない。
