---
title: "Map or ForEach or for of"
description: "MapとforEachを覚えて配列操作に強いエンジニアになろう"
date: 2023-06-18T08:17:33+09:00
author: subaru
authorEmoji: 🐙
tags:
- 組み込みメソッド
- javascript
categories:
- javascript
image: images/feature2/js.png
---

コードレビューをしていた時にふと気になったことをまとめました。

## MapとforEachの比較

1. **シンプルで短く書ける**: **`map`** メソッドはコンパクトな形式で要素の変換を行える。関数を一行で書くことができる。
2. **イミュータブルな操作**: **`map`** メソッドは元の配列を変更せず、新しい配列を返すから、元の配列を保持することができる。一方、**`forEach`** メソッドと配列の **`push`** メソッドを組み合わせた方法は、元の配列を変更してしまう。
3. **関数型プログラミングのパターン**: **`map`** メソッドは関数型プログラミングの一般的なパターンで、データの変換や処理を行う際に便利。関数の合成やパイプライン処理など、より高度な操作を組み合わせることもできる。
4. **関数型プログラミングのパターン**: 処理の結果配列が不要の場合は、forEachを使った方が良い。(ただAPIを叩いてinsert処理を走らせたい場合など)

### 実装の違い
まずは操作対象の配列を用意しておきます。
```jsx
const numbers = [1, 2, 3, 4, 5];
```

### **`map` メソッドの例:**
mapの場合、関数型プログラミングっぽく書けていますね。
mapは配列に変更を加えた後、続けて何かしらの操作が必要な場合に便利です。
```tsx
const doubledNumbers = numbers.map(num => num * 2);
console.log(doubledNumbers);
// [2, 4, 6, 8, 10]

```

### **`forEach` メソッドの例:**
forEachの場合、用意した空配列の末尾にnumberをpushしています。
```tsx
const doubledNumbers = [];
numbers.forEach(num => {
  doubledNumbers.push(num * 2);
});
console.log(doubledNumbers);
// [2, 4, 6, 8, 10]
```

### **`for (const hoge of hoges)` の例:**
よりシンプルにかけますね。
```tsx
const doubledNumbers = [];
for (const number of numbers) {
    doubledNumbers.push(number * 2)
}

console.log(doubledNumbers);
// [2, 4, 6, 8, 10]
```

この書き方は、その後の処理に配列が不要な場合、例えば配列内の各オブジェクトをDBヘ保存したい場合に便利ですね。
```tsx
const insertNumberToHoge = (numbers: number[]): boolean | undefined => {
    try {
      for (const number of numbers) {
        await Hoge.insert(number).save()
      }
    } catch(err) {
      throw new Error(`ERROR: ${err}`)
    }

    return true
  }
```

### まとめ
- 配列の中身に変更を加えて新しく配列を作成し直したい場合は、mapを使うと便利
- 配列の中身だけを別のComponentにpropsとして渡したい時はmapが便利
- 中身をAPIを叩く際の引数にしたい場合やDBへ保存したい場合はfor ofが便利
- forEachはあまり使わない