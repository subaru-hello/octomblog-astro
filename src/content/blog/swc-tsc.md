---
title: "tsファイルをjsにトランスパイルしてみた – tscとswcの速度比"
date: 2025-01-19T12:17:43+09:00
image: images/feature2/swc.jpeg
---

最近、TypeScriptで書いたコード（tsファイル）をJavaScriptに変換する流れが、思ったよりパフォーマンスのボトルネックになってる気がした。CI/CDの時間が地味に伸びてるんだけど、もしかしてトランスパイル（transpile）周りが原因かも？ そんな直感から、主に使われるツールを洗い出してみることにした。

実際、どれが一番早いのか調査して、ヒントを得られればいいなと思う。

---

### ts→jsの工程で登場するツールたち

![](https://storage.googleapis.com/zenn-user-upload/da5f7d0c8c37-20250119.png)

TypeScriptで書いたコードが最終的にCPU上で動くネイティブコードになるまで、ざっくり以下のステップで処理される。

1. **TypeScript Compiler (`tsc`)**

https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API

- 型チェックして、もし型の不整合があればコンパイルエラーを出す
- TypeScriptの構文をJSへトランスパイルする
- ある程度のダウンレベル変換（ESNext → ES5とか）
- 出力はJavaScriptファイルになるから、そのままNode.jsやブラウザで走る
1. **Babel**

https://babeljs.io/

- ESNextやJSX、TypeScript構文を、古いJavaScriptに変換
- 基本的に型チェックはしない
- プラグインやプリセットが豊富で、ReactのJSXトランスフォームとかも可能
1. **swc**

https://swc.rs/

- Rustで実装された超高速トランスパイラ
- やってることはBabelとだいたい同じ（構文変換）だけど、Rustのおかげでとにかく速い
- 型チェックは基本やらない（実験的にはあるみたいだけど、tscほど厳密じゃない）
1. **実行時エンジン (V8, SpiderMonkey, など)**
    - トランスパイル済みのJavaScriptをJITコンパイルして、最終的にネイティブコードとして動かす
    - Node.jsやブラウザが持ってるエンジンが、このJSを理解して実行してる

上記のツールを組み合わせることで、ts→js→ネイティブコードの流れが完成するイメージ。

---

### swc、tscの実行速度を調査

Babelも含めて比較してもいいが、今回はtscとswcだけピックアップして、それぞれの速度を見てみることにした。

### プロジェクト初期化

```bash
$ yarn init
➤ YN0088: A new stable version of Yarn is available: 4.6.0!
➤ YN0088: Upgrade now by running yarn set version 4.6.0

➤ YN0000: · Yarn 4.0.2
➤ YN0000: ┌ Resolution step
➤ YN0000: └ Completed
➤ YN0000: ┌ Fetch step
➤ YN0000: └ Completed
➤ YN0000: ┌ Link step
➤ YN0000: └ Completed
➤ YN0000: · Done in 0s 45ms
$ ls
README.md	package.json	yarn.lock
$ yarn install
➤ YN0000: · Yarn 4.0.2
➤ YN0000: ┌ Resolution step
➤ YN0000: └ Completed
➤ YN0000: ┌ Fetch step
➤ YN0000: └ Completed
➤ YN0000: ┌ Link step
➤ YN0000: └ Completed
➤ YN0000: · Done in 0s 25ms
$ cat package.json 
{
  "name": "swc-vs-tsc",
  "packageManager": "yarn@4.0.2"
}
$ yarn add -D typescript @swc/cli @swc/core
➤ YN0000: · Yarn 4.0.2
➤ YN0000: ┌ Resolution step
➤ YN0085: │ + @swc/cli@npm:0.6.0, @swc/core@npm:1.10.7, typescript@patch:typescript@npm%3A5.7.3#optional!builtin<compat/typescript>::version=5.7.3&hash=e012d7, and 151 more.
➤ YN0000: └ Completed in 3s 424ms
➤ YN0000: ┌ Fetch step
➤ YN0066: │ typescript@patch:typescript@npm%3A5.7.3#optional!builtin<compat/typescript>::version=5.7.3&hash=e012d7: Cannot apply hunk #1
➤ YN0013: │ 88 packages were added to the project (+ 82.5 MiB).
➤ YN0000: └ Completed in 1s 743ms
➤ YN0000: ┌ Link step
➤ YN0000: │ ESM support for PnP uses the experimental loader API and is therefore experimental
➤ YN0007: │ @swc/core@npm:1.10.7 [dc2f5] must be built because it never has been before or the last one failed
➤ YN0000: └ Completed in 1s 246ms
➤ YN0000: · Done with warnings in 6s 439ms

```

### ベンチマーク用のtsファイル生成

実験用に、同じ処理を3000回繰り返すtsファイルを自動生成するスクリプトを書いた。具体的には、interfaceやジェネリクス関数を大量に宣言して行数を稼いでるだけ。

```jsx
$ cat generate-bench.js 
const fs = require("fs");

const lines = [];
lines.push(`// 自動生成された TypeScript ファイル`);
lines.push(`// 適度な量のインターフェイス・クラス・ジェネリクスを含む`);

for (let i = 0; i < 3000; i++) {
  // 例として、同じようなインターフェイスを多数生成
  lines.push(`
    interface Data${i} {
      id: number;
      name: string;
      tags: string[];
    }
    type Alias${i} = Data${i} & { extra?: boolean };

    // ジェネリクスの例
    function processData${i}<T extends Data${i}>(input: T): T {
      return { ...input, tags: input.tags.map(tag => tag.toUpperCase()) };
    }
  `);
}

lines.push(`
  // テスト用の関数呼び出し例
  const sample: Data0 = { id: 0, name: "test", tags: ["tag0"] };
  console.log(processData0(sample));
`);

fs.writeFileSync("bench.ts", lines.join("\n"));
console.log("Generated bench.ts with", lines.length, "lines");

$ node generate-bench.js 
Generated bench.ts with 3003 lines
```

### 実行速度を time コマンドで測る

`time` コマンドの `real` の値（壁時計時間）が、いわゆる実際の経過時間。

- `user`: CPUがユーザーモードで使われた合計
- `sys`: カーネルモードでの合計
- `real`: 実際の経過時間(ウォールクロック)

### tsc の計測

5回計測した平均を見てみる。

```bash
$ cat tsc.sh 
for i in {1..5}; do
  echo "tsc trial $i"
  time yarn tsc bench.ts --noEmit
done

$ chmod +x tsc.sh
$ ./tsc.sh 
tsc trial 1

real	0m1.336s
user	0m2.882s
sys	0m0.129s
tsc trial 2

real	0m1.245s
user	0m2.789s
sys	0m0.106s
tsc trial 3

real	0m1.252s
user	0m2.815s
sys	0m0.104s
tsc trial 4

real	0m1.239s
user	0m2.793s
sys	0m0.104s
tsc trial 5

real	0m1.239s
user	0m2.802s
sys	0m0.103s

```

結果はだいたい平均で1.25～1.3秒くらい出る。

### swc の計測

```bash
$ cat swc.sh 
for i in {1..5}; do
  echo "swc trial $i"
  time yarn swc bench.ts -o /dev/null
done

$ chmod +x ./swc.sh 
$ ./swc.sh 
swc trial 1
Successfully compiled 1 file with swc.

real	0m0.552s
user	0m0.525s
sys	0m0.069s
swc trial 2
Successfully compiled 1 file with swc.

real	0m0.450s
user	0m0.494s
sys	0m0.051s
swc trial 3
Successfully compiled 1 file with swc.

real	0m0.453s
user	0m0.495s
sys	0m0.050s
swc trial 4
Successfully compiled 1 file with swc.

real	0m0.448s
user	0m0.493s
sys	0m0.050s
swc trial 5
Successfully compiled 1 file with swc.

real	0m0.449s
user	0m0.495s
sys	0m0.050s

```

結果はだいたい0.4～0.5秒の範囲で、tscより倍速近い。

### 所感

- swcはtscの2～2.4倍ほど速い（今回のケースだと）
- キャッシュの影響か2回目以降ちょっとだけ速くなるけど、それでもやっぱりswcがリード
- tscは user time が real の2倍くらいなのが興味深い。マルチコアとか、型チェックの並列処理とかありそう

---

### 処理回数を増やしたらどうなるか

3000回から1万回に増やしてみても、やっぱりswcの方が2倍ほど速い。

tsc: 2秒前後

swc: 1秒前後

構造としては変わらず、swc優勢。

---

### そもそも tsc と swc の違い

### tsc

TypeScript公式のコンパイラ。

型チェックがガッツリ入ってるせいで、コンパイル時間が伸びるケースがある。

`tsc --extendedDiagnostics` なんかを使うと分かるけど、**Check time** が全体のほとんどだったりする。

https://github.com/microsoft/TypeScript/wiki/Performance#extendeddiagnostics

`skipLibCheck` を `true` にすると標準ライブラリの型チェックをスキップできて、10%くらい高速化した。

### swc

Rustで書かれたトランスパイラ。Babelみたいに、JSの構文変換に特化してる。

RustはGCを持ってなくて所有権システムでメモリ管理してるから、ランタイムでガーベジコレクションしなくて済む。

そのぶん高速にコードのパースや変換ができるわけだ。

しかも型チェックをほぼ行わない（実験的にはあるらしい）のも速度の秘密。

---

### まとめ

tscは型チェック込みで厳密な保証をしてくれる一方、速度面ではswcが圧倒的に速い。


CIで型チェックを重視するか、それともトランスパイルを高速化したいかで、どちらを使うかの方針が変わると思う。

実際のところ、tscで型チェックだけ走らせて、JSへの変換はswcに任せる（あるいはBabelやesbuildに任せる）構成もある。

自分としては、プロダクションビルドを短くしたいならswcやesbuildを試すのがアリだと感じた。

さらに、TypeScriptならではのコンパイル設定（skipLibCheckとか incrementalビルド とか）をチューニングすると、tscのパフォーマンスもだいぶマシになるかもしれない。

いずれにしても、CI/CD時間を少しでも削減したいなら、トランスパイルのボトルネックを把握するのは大事だなと思った。

密かにRust製TypeScriptコンパイラには他にも、stcというswcの作者であるkdy1氏が作ったコンパイラがあるらしいので注目している。
### 参考文献

**Writing Easy-to-Compile Code:** https://github.com/microsoft/TypeScript/wiki/Performance#writing-easy-to-compile-code

https://blog.logrocket.com/why-you-should-use-swc/

https://engineering.mercari.com/blog/entry/20230606-b059cd98c3/

https://www.totaltypescript.com/rewriting-typescript-in-rust