---
category: "概念"
order: 111
title: arai60 - Recursion（再帰）
description: 問題を自己参照的に分解する。バックトラッキングと組み合わせた全探索が核心
tags: ["arai60", "アルゴリズム", "LeetCode", "Recursion", "Backtracking"]
emoji: "🔄"
date: "2026-04-04"
source: "https://1kohei1.com/leetcode/"
series:
  - arai60
---

## 概念

**関数が自分自身を呼び出す** ことで問題を小さな部分問題に分解するテクニック。
木・グラフ・組み合わせ列挙と相性が良い。

```
f(n) = f(n-1) + f(n-2)   ← 再帰関係
f(0) = 0, f(1) = 1       ← 基底ケース
```

## 再帰の3要素

1. **基底ケース（Base Case）** — これ以上分解できない最小問題を返す
2. **再帰関係（Recursive Case）** — 問題を小さくして自分を呼び出す
3. **収束保証** — 毎回確実に問題が小さくなることを確認する

## バックトラッキングパターン

```python
def backtrack(path, choices):
    if 終了条件:
        result.append(path[:])  # コピーを追加
        return
    for choice in choices:
        path.append(choice)      # 選択
        backtrack(path, ...)     # 再帰
        path.pop()               # 選択を取り消す（backtrack）
```

## Pythonコード例

### Subsets（全部分集合）

```python
def subsets(nums: list[int]) -> list[list[int]]:
    result = []
    
    def backtrack(start, path):
        result.append(path[:])
        for i in range(start, len(nums)):
            path.append(nums[i])
            backtrack(i + 1, path)
            path.pop()
    
    backtrack(0, [])
    return result
```

### Combination Sum（合計が target になる組み合わせ・重複使用可）

```python
def combinationSum(candidates: list[int], target: int) -> list[list[int]]:
    result = []
    
    def backtrack(start, path, remaining):
        if remaining == 0:
            result.append(path[:])
            return
        for i in range(start, len(candidates)):
            if candidates[i] > remaining:
                break
            path.append(candidates[i])
            backtrack(i, path, remaining - candidates[i])  # i からで重複OK
            path.pop()
    
    candidates.sort()
    backtrack(0, [], target)
    return result
```

### Permutations（全順列）

```python
def permute(nums: list[int]) -> list[list[int]]:
    result = []
    
    def backtrack(path, remaining):
        if not remaining:
            result.append(path[:])
            return
        for i in range(len(remaining)):
            path.append(remaining[i])
            backtrack(path, remaining[:i] + remaining[i+1:])
            path.pop()
    
    backtrack([], nums)
    return result
```

### Palindrome Partitioning（全パリンドローム分割）

```python
def partition(s: str) -> list[list[str]]:
    result = []
    
    def is_palindrome(sub):
        return sub == sub[::-1]
    
    def backtrack(start, path):
        if start == len(s):
            result.append(path[:])
            return
        for end in range(start + 1, len(s) + 1):
            sub = s[start:end]
            if is_palindrome(sub):
                path.append(sub)
                backtrack(end, path)
                path.pop()
    
    backtrack(0, [])
    return result
```

## Tips

- **`path[:]` でコピー** — `result.append(path)` だと参照渡しになるため、必ず `path[:]` でコピーする
- **`candidates.sort()` を先に実行** — Combination Sum で `remaining < candidates[i]` の早期終了を使うためにソートが必要
- **重複使用の制御** — 重複OKなら `backtrack(i, ...)` (同じインデックス)、重複NGなら `backtrack(i+1, ...)`
- **Python の再帰上限** — デフォルトは 1000。必要なら `sys.setrecursionlimit(10000)` で拡張
- **バックトラック = 「試して戻す」** — `path.append` → `backtrack` → `path.pop` の3点セットを忘れない

## arai60 関連問題

| 問題 | 難易度 | ポイント |
|---|---|---|
| 78. Subsets | Medium | start インデックスで重複回避 |
| 39. Combination Sum | Medium | sort + 重複使用あり(i から) |
| 46. Permutations | Medium | remaining リストから選択 |
| 131. Palindrome Partitioning | Medium | パリンドローム判定 + バックトラック |

## 関連概念

- → [Tree](./concepts_arai60_tree.md)（木の操作は再帰と相性抜群）
- → [BFS/DFS](./concepts_arai60_bfs_dfs.md)（DFS は再帰で実装）
- → [Greedy + Backtracking](./concepts_arai60_greedy_backtracking.md)
- → [arai60 概要](./concepts_arai60_overview.md)
