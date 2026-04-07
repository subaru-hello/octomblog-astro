---
category: "概念"
order: 105
title: arai60 - Heap / PriorityQueue（ヒープ・優先度付きキュー）
description: 最小・最大を O(log n) で取り出すデータ構造。K番目の要素・K個に頻出
tags: ["arai60", "アルゴリズム", "LeetCode", "Heap", "PriorityQueue"]
emoji: "⛰️"
date: "2026-04-04"
source: "https://1kohei1.com/leetcode/"
series:
  - arai60
---

## 概念

**最小値（または最大値）を常に O(log n) で取り出せる** データ構造。
Pythonの `heapq` は **最小ヒープ**。最大ヒープは値を負にして扱う。

```
最小ヒープ:
        1
       / \
      3   2
     / \
    5   4
```

| 操作 | 計算量 |
|---|---|
| push（追加） | O(log n) |
| pop（最小を取り出す） | O(log n) |
| peek（最小を見る） | O(1) |
| heapify（リストをヒープに変換） | O(n) |

## いつ使うか（問題パターン）

- **「K番目に大きい/小さい」要素** — サイズ K のヒープを維持
- **「上位 K 個」の要素** — nlargest / nsmallest
- **複数のソート済みリストのマージ**
- **タスクスケジューリング** — 優先度付きキュー
- **Dijkstra法**（最短経路）

## Pythonコード例

### Kth Largest Element in a Stream（ストリームのK番目に大きい要素）

```python
import heapq

class KthLargest:
    def __init__(self, k: int, nums: list[int]):
        self.k = k
        self.heap = nums
        heapq.heapify(self.heap)
        # サイズを k に保つ
        while len(self.heap) > k:
            heapq.heappop(self.heap)

    def add(self, val: int) -> int:
        heapq.heappush(self.heap, val)
        if len(self.heap) > self.k:
            heapq.heappop(self.heap)
        return self.heap[0]  # K番目に大きい = ヒープの最小値
```

### Last Stone Weight（最後の石の重さ）

```python
import heapq

def lastStoneWeight(stones: list[int]) -> int:
    # 最大ヒープ（値を負にして最小ヒープで実現）
    heap = [-s for s in stones]
    heapq.heapify(heap)
    
    while len(heap) > 1:
        y = -heapq.heappop(heap)  # 最大
        x = -heapq.heappop(heap)  # 2番目に大きい
        if x != y:
            heapq.heappush(heap, -(y - x))
    
    return -heap[0] if heap else 0
```

### K Closest Points to Origin（原点に近いK点）

```python
import heapq

def kClosest(points: list[list[int]], k: int) -> list[list[int]]:
    # (距離の二乗, x, y) のタプルでヒープ管理
    heap = []
    for x, y in points:
        dist = x * x + y * y
        heapq.heappush(heap, (dist, x, y))
    
    result = []
    for _ in range(k):
        _, x, y = heapq.heappop(heap)
        result.append([x, y])
    return result
```

### Kth Largest Element in an Array（配列のK番目に大きい要素）

```python
import heapq

def findKthLargest(nums: list[int], k: int) -> int:
    # サイズ k の最小ヒープを維持
    heap = nums[:k]
    heapq.heapify(heap)
    for n in nums[k:]:
        if n > heap[0]:
            heapq.heapreplace(heap, n)
    return heap[0]
```

### Task Scheduler（タスクスケジューリング）

```python
import heapq
from collections import Counter

def leastInterval(tasks: list[str], n: int) -> int:
    count = Counter(tasks)
    heap = [-c for c in count.values()]
    heapq.heapify(heap)
    
    time = 0
    queue = []  # (残り頻度, 実行可能時刻)
    
    while heap or queue:
        time += 1
        if heap:
            cnt = 1 + heapq.heappop(heap)  # 1回実行（負なのでデクリメント）
            if cnt:
                queue.append((cnt, time + n))
        if queue and queue[0][1] == time:
            heapq.heappush(heap, queue.pop(0)[0])
    
    return time
```

## Tips

- **最大ヒープは値を負にする** — `heapq` は最小ヒープのみ。最大値を取り出したいときは `-val` でプッシュして `-heap[0]` で参照
- **タプルでの比較** — `heapq` はタプルの最初の要素で比較する。`(距離, インデックス, 値)` の形で優先度を制御できる
- **`heapq.nlargest(k, arr)`** — 上位 K 個を O(n log k) で取得。`sorted(arr)[-k:]` より効率的
- **`heapreplace` は push + pop より速い** — 同じ操作だが1回のヒープ操作で済む

## arai60 関連問題

| 問題 | 難易度 | ポイント |
|---|---|---|
| 703. Kth Largest Element in a Stream | Easy | サイズ k のヒープを維持 |
| 1046. Last Stone Weight | Easy | 最大ヒープ（負値トリック） |
| 973. K Closest Points to Origin | Medium | 距離の二乗でソート |
| 215. Kth Largest Element in an Array | Medium | クイックセレクトも選択肢 |
| 621. Task Scheduler | Medium | クールダウン付きスケジューリング |
| 355. Design Twitter | Medium | ヒープで K 件のフィードを結合 |

## 関連概念

- → [Sort](./concepts_arai60_sort.md)（ヒープソートとの関係）
- → [BFS/DFS](./concepts_arai60_bfs_dfs.md)（Dijkstra でのヒープ使用）
- → [arai60 概要](./concepts_arai60_overview.md)
