---
title: "#!/bin/bashって何？"
date: 2023-07-03T07:52:47+09:00
authorEmoji: 🐙
tags:
- サーバーレス
- sls
- SAM
- clamscan
categories:
- サーバーレス
image: images/feature2/clamav.png
---

### #!/bin/bashって何？

> **she-bang**‘(**shabang**). This derives from the concatenation of the tokens *sharp* (#) and *bang* (!)
> 

どのshellを使うのかを明示的に指定するシンボリックリンクだそう
。
シェルスクリプトのようなUnix-likeなOperating Systemsでは、she-bangはコマンドとして認識されるそうです。

なので、最初に#がついていても、「これからbin/bashで実行すれば良いんだな」、とシステムが解釈する見たい。

https://medium.com/@codingmaths/bin-bash-what-exactly-is-this-95fc8db817bf