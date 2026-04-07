---
category: "概念"
order: 109
title: arai60 - Dynamic Programming（動的計画法）
description: 部分問題の最適解をメモ化して再計算を省く。1D/2D DP・メモ化再帰の3パターン
tags: ["arai60", "アルゴリズム", "LeetCode", "DP", "DynamicProgramming"]
emoji: "🧩"
date: "2026-04-04"
source: "https://1kohei1.com/leetcode/"
series:
  - arai60
---

## 概念

**「重複する部分問題を一度だけ解き、結果を再利用する」** アルゴリズム設計手法。
以下の2条件が揃う問題に適用できる：

1. **最適部分構造** — 全体の最適解が部分問題の最適解から構成できる
2. **重複する部分問題** — 同じ部分問題が繰り返し現れる

## 3つのアプローチ

### 1. ボトムアップ DP（テーブル法）

```python
dp = [0] * (n + 1)
dp[0] = base_case
for i in range(1, n + 1):
    dp[i] = f(dp[i-1], dp[i-2], ...)
```

### 2. トップダウン DP（メモ化再帰）

```python
from functools import lru_cache

@lru_cache(maxsize=None)
def dp(i):
    if i == 0:
        return base_case
    return f(dp(i - 1), dp(i - 2))
```

### 3. 空間最適化（前のステップだけ保持）

```python
prev2, prev1 = 0, 1
for i in range(2, n + 1):
    curr = prev1 + prev2
    prev2, prev1 = prev1, curr
```

## Pythonコード例

### Climbing Stairs（階段の登り方）

```python
def climbStairs(n: int) -> int:
    if n <= 2:
        return n
    prev2, prev1 = 1, 2
    for _ in range(3, n + 1):
        prev2, prev1 = prev1, prev1 + prev2
    return prev1
```

### House Robber（隣接しない家を強盗）

```python
def rob(nums: list[int]) -> int:
    if not nums:
        return 0
    prev2, prev1 = 0, 0
    for n in nums:
        prev2, prev1 = prev1, max(prev1, prev2 + n)
    return prev1
```

### House Robber II（環状配置）

```python
def rob2(nums: list[int]) -> int:
    def rob_range(arr):
        prev2, prev1 = 0, 0
        for n in arr:
            prev2, prev1 = prev1, max(prev1, prev2 + n)
        return prev1
    
    if len(nums) == 1:
        return nums[0]
    # 最初の家を含む or 最後の家を含む、どちらか大きい方
    return max(rob_range(nums[:-1]), rob_range(nums[1:]))
```

### Coin Change（最小コイン枚数）

```python
def coinChange(coins: list[int], amount: int) -> int:
    dp = [float('inf')] * (amount + 1)
    dp[0] = 0
    for a in range(1, amount + 1):
        for coin in coins:
            if coin <= a:
                dp[a] = min(dp[a], dp[a - coin] + 1)
    return dp[amount] if dp[amount] != float('inf') else -1
```

### Longest Increasing Subsequence（最長増加部分列）

```python
def lengthOfLIS(nums: list[int]) -> int:
    dp = [1] * len(nums)  # dp[i] = nums[i] で終わるLISの長さ
    for i in range(1, len(nums)):
        for j in range(i):
            if nums[j] < nums[i]:
                dp[i] = max(dp[i], dp[j] + 1)
    return max(dp)
    # O(n log n) 解法は bisect を使った別アプローチが存在
```

### Partition Equal Subset Sum（等分割可能かどうか）

```python
def canPartition(nums: list[int]) -> bool:
    total = sum(nums)
    if total % 2 != 0:
        return False
    target = total // 2
    
    # dp[j] = 合計 j を作れるかどうか
    dp = {0}
    for n in nums:
        dp = {j + n for j in dp} | dp
        if target in dp:
            return True
    return False
```

### Word Break（単語分割可能かどうか）

```python
def wordBreak(s: str, wordDict: list[str]) -> bool:
    words = set(wordDict)
    dp = [False] * (len(s) + 1)
    dp[0] = True
    
    for i in range(1, len(s) + 1):
        for j in range(i):
            if dp[j] and s[j:i] in words:
                dp[i] = True
                break
    return dp[len(s)]
```

## Tips

- **dp 配列の初期化** — `dp[0]` はベースケース。`float('inf')` か `0` かは「最小化」「最大化」のどちらかで決める
- **`@lru_cache` は最強** — メモ化再帰は `@lru_cache(maxsize=None)` を付けるだけで自動メモ化
- **2次元 DP の遷移方向** — 「i と i-1 の関係」を明確にしてから遷移式を書く
- **House Robber II は分割して解く** — 環状問題は「最初の要素を使う / 使わない」の2ケースで直線問題に帰着させる
- **`dp = set()` でサブセット和** — 「特定の和を作れるか」という0-1ナップサック型は set の内包表記で書くと簡潔

## arai60 関連問題

| 問題 | 難易度 | ポイント |
|---|---|---|
| 70. Climbing Stairs | Easy | Fibonacci の変形 |
| 198. House Robber | Medium | prev1/prev2 の空間最適化 |
| 213. House Robber II | Medium | 環状を2回の直線に分割 |
| 91. Decode Ways | Medium | dp[i] = dp[i-1] + dp[i-2] の条件分岐 |
| 322. Coin Change | Medium | unbounded ナップサック |
| 152. Maximum Product Subarray | Medium | max/min を両方追跡 |
| 139. Word Break | Medium | dp[j] + s[j:i] の組み合わせ |
| 300. Longest Increasing Subsequence | Medium | O(n²) or O(n log n) bisect |
| 416. Partition Equal Subset Sum | Medium | 0-1ナップサック + set |

## 関連概念

- → [Recursion](./concepts_arai60_recursion.md)（メモ化再帰はDPと等価）
- → [Binary Search](./concepts_arai60_binary_search.md)（LIS の O(n log n) 解法）
- → [arai60 概要](./concepts_arai60_overview.md)
