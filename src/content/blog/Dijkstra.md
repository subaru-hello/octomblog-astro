---
title: "【Algorithms】ダイクストラ法で君と僕との距離を測る"
description: "ダイクストラ法を使って最短距離を求めよう"
date: 2023-06-14T21:04:30+09:00
draft: false
author: subaru
authorEmoji: 🐙
tags:
- algorithms
- typescript
categories:
- algorithms
series:
  - アルゴリズム
image: images/feature2/typescript.png
---

FXに手を出してみたものの、ボラティリティの高さに怯えて1銭上がった瞬間に利確してしまいました、どうもビビリ界のhood starです。

さて、今回は、最短距離問題を解くことに適したアルゴリズムである、ダイクストラ法についての学びをまとめたいと思います。

## ダイクストラ法とは
> ダイクストラのアルゴリズムは、有向グラフにおける最短経路問題を解くためのアルゴリズムです。ここでのグラフは、頂点（ノード）とそれらを結ぶ辺（エッジ）からなる構造で、各辺にはある頂点から別の頂点への「コスト」または「距離」が付与されています。ダイクストラのアルゴリズムは、特定の出発点から他のすべての頂点への最短経路を見つけることができます

図解を見ながらだと説明を理解できるけど、文字だけだと理解できないですね。
ひとまず。ダイクストラ法は以下の手順で目的地までの最短ルートを見つけてくれるみたいです。

### ダイクストラ法の流れ
1. 全ての頂点に対して、「仮の最短距離」を無限大に設定する。ただし、出発点の頂点だけは「仮の最短距離」を0に設定。

2. 未訪問の頂点の中から「仮の最短距離」が最小の頂点を選び、その頂点を「確定頂点」と置く。

3. 「確定頂点」から辺で接続された未訪問の頂点に対して、現在の「仮の最短距離」と、「確定頂点」からの距離を足した値を比較する。もし後者の方が小さければ、「仮の最短距離」を更新する。

4. すべての頂点が「確定頂点」になるまで2と3の手順を繰り返す。


ただ、辺にかかるコストがマイナス（負）だった場合は、ダイクストラ法ではなく、ベルマン-フォードのアルゴリズム等を使わないといけないようですね。

### 有向グラフとは
頂点と向きのついた辺からなる「図形」 のことを指すようです。
一方で無向グラフは、向きのついていない辺からなる「図形」ということになっています。
有向グラフ: 頂点→頂点→頂点
無向グラフ: 頂点⇆頂点⇆頂点
(参考: https://for-spring.com/geometry/graph_theory-4/)

### typescriptのコードで見てみる
ひとまず、コードで流れを追ってみましょう。
横浜駅から渋谷駅までの最短距離を求めてみます。
データ構造と、アルゴリズムに分解してコードを作成します。

- データ構造
向き先をtoで表し、コストをweightで表しています。

```js
type Station = string;

interface Edge {
  to: Station;
  weight: number;
}

type Graph = {
  [key in Station]?: Edge[];
}

const graph: Graph = {
  "横浜": [{to: "川崎", weight: 10}, {to: "品川", weight: 25}],
  "川崎": [{to: "横浜", weight: 10}, {to: "品川", weight: 12}],
  "品川": [{to: "川崎", weight: 12}, {to: "横浜", weight: 25}, {to: "新橋", weight: 5}],
  "新橋": [{to: "品川", weight: 5}, {to: "渋谷", weight: 15}],
  "渋谷": [{to: "新橋", weight: 15}, {to: "自由が丘", weight: 8}],
  "自由が丘": [{to: "渋谷", weight: 8}]
};

```


- アルゴリズム
始点を0に、その他のノード（頂点）を無限大にして、隣接するノード（頂点）までにかかったコストで、頂点を更新していきます。
最終的に、目的地までのコストが低いルートを選択する処理です。

```js
type Distance = {
  [key in Station]?: number;
}

type Previous = {
  [key in Station]?: Station;
}

const findShortestPath = (graph: Graph, start: Station, end: Station): number | undefined => {
  let distances: Distance = {};
  let previous: Previous = {};

  for (let node in graph) {
    distances[node] = Infinity;
  }

  distances[start] = 0;

  let nodes: Station[] = Object.keys(graph);

  while (nodes.length) {
    let shortestDistanceNode = nodes.reduce((prev, curr) => {
      return (distances[prev] !== undefined && distances[prev]! < distances[curr]!) ? prev : curr;
    });

    if (distances[shortestDistanceNode] === Infinity) {
      break;
    }

    nodes = nodes.filter(node => node !== shortestDistanceNode);

    for (let neighbor of graph[shortestDistanceNode]!) {
      let alt = distances[shortestDistanceNode]! + neighbor.weight;
      if (alt < (distances[neighbor.to] || Infinity)) {
        distances[neighbor.to] = alt;
        previous[neighbor.to] = shortestDistanceNode;
      }
    }
  }

  return distances[end];
};

console.log(findShortestPath(graph, "横浜", "渋谷"));  // 42


```


### 実用されている例
データパケットが目的地に最も効率的に到達するパスを見つける時や、GPSとルーティング、Facebookの「友達の友達」の提案などでも使用されているみたいですね。辺をコスト、頂点を経由地あるいは目的地として表すことができる概念ならなんでも当てはめることができそうです。


### まとめ
- ダイクストラのアルゴリズムは、有向グラフにおける最短経路問題を解くためのアルゴリズム 
- コストが負の場合は使用できない
- GPSとルーティング、Facebookのfollow suggestionにも使われている