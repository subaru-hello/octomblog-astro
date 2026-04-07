---
category: "概念"
order: 110
title: arai60 - Binary Search（二分探索）
description: ソート済みデータをO(log n)で探索。境界値の扱いと不変条件の維持が重要
tags: ["arai60", "アルゴリズム", "LeetCode", "Binary Search"]
emoji: "🔍"
date: "2026-04-04"
source: "https://1kohei1.com/leetcode/"
series:
  - arai60
---

## 概念

**ソート済みデータ**を対象に、**探索範囲を半分ずつ狭めて** O(log n) で探索するアルゴリズム。

```
[1, 3, 5, 7, 9, 11, 13]
          ^
         mid
 left half   right half
```

## 不変条件（Invariant）

二分探索の実装ミスはほぼ **境界値の扱い** に起因する。以下の2つのスタイルを使い分ける：

| スタイル | 区間 | ループ条件 | mid の使い方 |
|---|---|---|---|
| 閉区間 | `[left, right]` | `left <= right` | `left = mid + 1` or `right = mid - 1` |
| 半開区間 | `[left, right)` | `left < right` | `left = mid + 1` or `right = mid` |

## Pythonコード例

### 基本テンプレート（閉区間）

```python
def binary_search(arr: list[int], target: int) -> int:
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = left + (right - left) // 2  # オーバーフロー防止
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1
```

### Find Minimum in Rotated Sorted Array（回転ソート配列の最小値）

```python
def findMin(nums: list[int]) -> int:
    left, right = 0, len(nums) - 1
    while left < right:
        mid = (left + right) // 2
        if nums[mid] > nums[right]:
            # midより右側が乱れている → 最小値は右半分
            left = mid + 1
        else:
            # midは最小値の候補（midを除外しない）
            right = mid
    return nums[left]
```

### Search in Rotated Sorted Array（回転ソート配列での検索）

```python
def search(nums: list[int], target: int) -> int:
    left, right = 0, len(nums) - 1
    while left <= right:
        mid = (left + right) // 2
        if nums[mid] == target:
            return mid
        # 左半分がソート済みかどうかで判断
        if nums[left] <= nums[mid]:
            if nums[left] <= target < nums[mid]:
                right = mid - 1
            else:
                left = mid + 1
        else:
            if nums[mid] < target <= nums[right]:
                left = mid + 1
            else:
                right = mid - 1
    return -1
```

### Median of Two Sorted Arrays（2つのソート済み配列の中央値）

```python
def findMedianSortedArrays(nums1: list[int], nums2: list[int]) -> float:
    # 短い方を A にする
    A, B = nums1, nums2
    if len(A) > len(B):
        A, B = B, A
    
    total = len(A) + len(B)
    half = total // 2
    left, right = 0, len(A) - 1
    
    while True:
        i = (left + right) // 2  # A の分割点
        j = half - i - 2         # B の分割点
        
        Aleft = A[i] if i >= 0 else float('-inf')
        Aright = A[i + 1] if i + 1 < len(A) else float('inf')
        Bleft = B[j] if j >= 0 else float('-inf')
        Bright = B[j + 1] if j + 1 < len(B) else float('inf')
        
        if Aleft <= Bright and Bleft <= Aright:
            if total % 2:
                return min(Aright, Bright)
            return (max(Aleft, Bleft) + min(Aright, Bright)) / 2
        elif Aleft > Bright:
            right = i - 1
        else:
            left = i + 1
```

### Python bisect モジュールの活用

```python
from bisect import bisect_left, bisect_right

arr = [1, 3, 5, 7, 9]
# bisect_left: target以上の最小インデックス
# bisect_right: targetより大きい最小インデックス
idx = bisect_left(arr, 5)   # → 2
idx = bisect_right(arr, 5)  # → 3
```

## Tips

- **`mid = left + (right - left) // 2`** — `(left + right) // 2` は Python では整数オーバーフローしないが、他言語移植時に安全な書き方を習慣化
- **回転配列は「どちらの半分がソート済みか」で判断** — `nums[left] <= nums[mid]` なら左半分がソート済み
- **`right = mid` と `right = mid - 1` の違い** — `right = mid` は mid を候補として残す（最小値探索など）
- **`bisect` は強力な武器** — 挿入位置の検索や LIS の O(n log n) 解法などで活躍

## arai60 関連問題

| 問題 | 難易度 | ポイント |
|---|---|---|
| 153. Find Minimum in Rotated Sorted Array | Medium | `nums[mid] > nums[right]` で判定 |
| 33. Search in Rotated Sorted Array | Medium | ソート済み半分の特定 |
| 4. Median of Two Sorted Arrays | Hard | 分割点を二分探索 |

## 関連概念

- → [Two Pointers](./concepts_arai60_two_pointers.md)（ソート済み配列の別手法）
- → [Dynamic Programming](./concepts_arai60_dynamic_programming.md)（LIS の O(n log n) 解法）
- → [arai60 概要](./concepts_arai60_overview.md)
