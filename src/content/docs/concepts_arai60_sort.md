---
category: "概念"
order: 112
title: arai60 - Sort（ソートアルゴリズム）
description: クイックソート・マージソート・バケットソートの仕組みと使い分け
tags: ["arai60", "アルゴリズム", "LeetCode", "Sort", "QuickSort", "MergeSort"]
emoji: "📊"
date: "2026-04-04"
source: "https://1kohei1.com/leetcode/"
series:
  - arai60
---

## 概念

ソートアルゴリズムの計算量比較：

| アルゴリズム | 平均 | 最悪 | 空間 | 安定性 |
|---|---|---|---|---|
| クイックソート | O(n log n) | O(n²) | O(log n) | 不安定 |
| マージソート | O(n log n) | O(n log n) | O(n) | 安定 |
| ヒープソート | O(n log n) | O(n log n) | O(1) | 不安定 |
| バケットソート | O(n + k) | O(n²) | O(n + k) | 安定 |
| カウントソート | O(n + k) | O(n + k) | O(k) | 安定 |

Pythonの `sorted()` / `.sort()` は **Timsort**（安定、O(n log n)）。

## Pythonコード例

### Quick Sort（クイックソートの実装）

```python
def quickSort(arr: list[int], low: int, high: int) -> None:
    if low < high:
        pivot_idx = partition(arr, low, high)
        quickSort(arr, low, pivot_idx - 1)
        quickSort(arr, pivot_idx + 1, high)

def partition(arr: list[int], low: int, high: int) -> int:
    pivot = arr[high]
    i = low - 1
    for j in range(low, high):
        if arr[j] <= pivot:
            i += 1
            arr[i], arr[j] = arr[j], arr[i]
    arr[i + 1], arr[high] = arr[high], arr[i + 1]
    return i + 1
```

### Merge Sort（マージソートの実装）

```python
def mergeSort(arr: list[int]) -> list[int]:
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    left = mergeSort(arr[:mid])
    right = mergeSort(arr[mid:])
    return merge(left, right)

def merge(left: list[int], right: list[int]) -> list[int]:
    result = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
    result.extend(left[i:])
    result.extend(right[j:])
    return result
```

### Sort Colors（Dutch National Flag Problem）

```python
def sortColors(nums: list[int]) -> None:
    low, mid, high = 0, 0, len(nums) - 1
    while mid <= high:
        if nums[mid] == 0:
            nums[low], nums[mid] = nums[mid], nums[low]
            low += 1
            mid += 1
        elif nums[mid] == 1:
            mid += 1
        else:
            nums[mid], nums[high] = nums[high], nums[mid]
            high -= 1
```

### Merge Intervals（区間のマージ）

```python
def merge(intervals: list[list[int]]) -> list[list[int]]:
    intervals.sort(key=lambda x: x[0])
    result = [intervals[0]]
    for start, end in intervals[1:]:
        if start <= result[-1][1]:
            result[-1][1] = max(result[-1][1], end)
        else:
            result.append([start, end])
    return result
```

## Tips

- **Python のソートは `key=` を活用** — `sorted(intervals, key=lambda x: x[0])` で左端によるソートが簡潔に書ける
- **Dutch National Flag はパーティション問題** — 3値のソートはクイックソートのパーティション応用
- **Merge Intervals は先にソート** — 開始点でソートすることで、隣接する区間だけ比較すれば良くなる
- **Sort an Array で Quick/Merge を実装** — 面接でのアルゴリズム説明を想定して実装できるようにしておく

## arai60 関連問題

| 問題 | 難易度 | ポイント |
|---|---|---|
| 912. Sort an Array | Medium | クイックソートまたはマージソートを実装 |
| 75. Sort Colors | Medium | Dutch National Flag（3-way partition） |
| 56. Merge Intervals | Medium | 開始点でソート後に隣接チェック |

## 関連概念

- → [Heap](./concepts_arai60_heap.md)（ヒープソートとの関係）
- → [Two Pointers](./concepts_arai60_two_pointers.md)（Dutch National Flag は Two Pointers の応用）
- → [arai60 概要](./concepts_arai60_overview.md)
