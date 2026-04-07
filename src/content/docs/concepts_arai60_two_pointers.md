---
category: "概念"
order: 101
title: arai60 - Two Pointers（二ポインタ法）
description: 2つのポインタで配列を走査し、O(n²)をO(n)に改善するテクニック
tags: ["arai60", "アルゴリズム", "LeetCode", "Two Pointers"]
emoji: "👉"
date: "2026-04-04"
source: "https://1kohei1.com/leetcode/"
series:
  - arai60
---

## 概念

配列に対して **2つのインデックス（left, right）** を使って走査する手法。
ネストされたループを1つのループに変換し、**O(n²) → O(n)** に計算量を改善できる。

```
left →                    ← right
[2, 7, 11, 15]   target = 9
 ^               ^
 left            right
```

## いつ使うか（問題パターン）

以下のシグナルがあれば Two Pointers を疑う：

- **ソート済み配列**で対（ペア）や3つ組を探す
- 回文（Palindrome）の判定
- 重複要素の除去（in-place）
- 「合計が X になる組み合わせ」
- 水たまり・コンテナの面積（反対方向から詰める）

## アプローチ

### パターン1: 両端から中心へ（Opposite Direction）

```
left → ... ← right
```

- `arr[left] + arr[right]` が target より小さければ `left++`
- 大きければ `right--`
- 一致すれば解

### パターン2: 同方向（Same Direction）

```
slow → ... fast →
```

- `slow` が確定済み位置、`fast` がスキャン
- 重複除去・部分配列の探索などに使用

## Pythonコード例

### Two Sum II（ソート済み配列での二数の和）

```python
def twoSum(numbers: list[int], target: int) -> list[int]:
    left, right = 0, len(numbers) - 1
    while left < right:
        s = numbers[left] + numbers[right]
        if s == target:
            return [left + 1, right + 1]  # 1-indexed
        elif s < target:
            left += 1
        else:
            right -= 1
    return []
```

### 3Sum（三数の和がゼロになる全組み合わせ）

```python
def threeSum(nums: list[int]) -> list[list[int]]:
    nums.sort()
    result = []
    for i in range(len(nums) - 2):
        # 重複スキップ
        if i > 0 and nums[i] == nums[i - 1]:
            continue
        left, right = i + 1, len(nums) - 1
        while left < right:
            s = nums[i] + nums[left] + nums[right]
            if s == 0:
                result.append([nums[i], nums[left], nums[right]])
                # 重複スキップ
                while left < right and nums[left] == nums[left + 1]:
                    left += 1
                while left < right and nums[right] == nums[right - 1]:
                    right -= 1
                left += 1
                right -= 1
            elif s < 0:
                left += 1
            else:
                right -= 1
    return result
```

### Container With Most Water（最大水量）

```python
def maxArea(height: list[int]) -> int:
    left, right = 0, len(height) - 1
    max_water = 0
    while left < right:
        water = min(height[left], height[right]) * (right - left)
        max_water = max(max_water, water)
        # 低い方を動かす（高い方を動かしても面積は増えない）
        if height[left] < height[right]:
            left += 1
        else:
            right -= 1
    return max_water
```

### Trapping Rain Water（雨水の蓄積量）

```python
def trap(height: list[int]) -> int:
    left, right = 0, len(height) - 1
    left_max = right_max = 0
    water = 0
    while left < right:
        if height[left] < height[right]:
            if height[left] >= left_max:
                left_max = height[left]
            else:
                water += left_max - height[left]
            left += 1
        else:
            if height[right] >= right_max:
                right_max = height[right]
            else:
                water += right_max - height[right]
            right -= 1
    return water
```

## Tips

- **ソートが前提** — Two Pointers はほぼ必ずソート済み配列が前提。問題文に「sorted」がなければ先にソートする
- **重複スキップの忘れ** — 3Sum等では `left/right` を動かした後に重複値を読み飛ばす処理を忘れない
- **left < right の条件** — 同じ要素を2回使わないよう `left < right`（等号なし）にする
- **動かす方向の根拠** — 「合計が小さすぎる → 小さい方を右へ」という論理的根拠を必ず言語化する

## arai60 関連問題

| 問題 | 難易度 | ポイント |
|---|---|---|
| 125. Valid Palindrome | Easy | 英数字のみ比較、lower() |
| 167. Two Sum II | Medium | ソート済み前提、O(1)空間 |
| 15. 3Sum | Medium | sort + Two Pointers、重複スキップ |
| 11. Container With Most Water | Medium | 低い方を動かす理由を理解 |
| 42. Trapping Rain Water | Hard | left_max/right_max の更新タイミング |

## 関連概念

- → [Sliding Window](./concepts_arai60_sliding_window.md)（同方向ポインタの発展）
- → [Binary Search](./concepts_arai60_binary_search.md)（ソート済み配列の別アプローチ）
- → [arai60 概要](./concepts_arai60_overview.md)
