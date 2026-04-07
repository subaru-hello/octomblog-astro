---
category: "概念"
order: 104
title: arai60 - Stack（スタック）
description: LIFO構造で括弧のマッチング・単調スタック・式評価に使う
tags: ["arai60", "アルゴリズム", "LeetCode", "Stack"]
emoji: "📚"
date: "2026-04-04"
source: "https://1kohei1.com/leetcode/"
series:
  - arai60
---

## 概念

**LIFO（Last In First Out）** のデータ構造。Pythonではリストをスタックとして使用する（`append` / `pop`）。

```
push → [1, 2, 3] ← pop
            top
```

## いつ使うか（問題パターン）

- **括弧のマッチング** — 開き括弧をプッシュ、閉じ括弧でポップして対応確認
- **後入れ先出しが必要な処理** — 式評価、履歴管理
- **単調スタック** — 次の大きい要素、ヒストグラムの最大面積
- **DFS の反復実装**（再帰を使わない場合）

## アプローチ

### 括弧マッチングパターン

```python
stack = []
pairs = {')': '(', ']': '[', '}': '{'}
for c in s:
    if c in '([{':
        stack.append(c)
    elif not stack or stack[-1] != pairs[c]:
        return False
    else:
        stack.pop()
return len(stack) == 0
```

### 単調スタックパターン（次の大きい要素）

```python
stack = []  # 単調減少スタック
for i, val in enumerate(arr):
    while stack and arr[stack[-1]] < val:
        idx = stack.pop()
        result[idx] = val  # idx の次の大きい要素は val
    stack.append(i)
```

## Pythonコード例

### Valid Parentheses（括弧の有効性）

```python
def isValid(s: str) -> bool:
    stack = []
    pairs = {')': '(', ']': '[', '}': '{'}
    for c in s:
        if c in '([{':
            stack.append(c)
        elif not stack or stack[-1] != pairs[c]:
            return False
        else:
            stack.pop()
    return len(stack) == 0
```

### Min Stack（最小値を O(1) で取得するスタック）

```python
class MinStack:
    def __init__(self):
        self.stack = []
        self.min_stack = []  # 最小値をトラッキング

    def push(self, val: int) -> None:
        self.stack.append(val)
        min_val = min(val, self.min_stack[-1] if self.min_stack else val)
        self.min_stack.append(min_val)

    def pop(self) -> None:
        self.stack.pop()
        self.min_stack.pop()

    def top(self) -> int:
        return self.stack[-1]

    def getMin(self) -> int:
        return self.min_stack[-1]
```

### Evaluate Reverse Polish Notation（逆ポーランド記法の評価）

```python
def evalRPN(tokens: list[str]) -> int:
    stack = []
    ops = {
        '+': lambda a, b: a + b,
        '-': lambda a, b: a - b,
        '*': lambda a, b: a * b,
        '/': lambda a, b: int(a / b),  # ゼロ方向への切り捨て
    }
    for token in tokens:
        if token in ops:
            b, a = stack.pop(), stack.pop()
            stack.append(ops[token](a, b))
        else:
            stack.append(int(token))
    return stack[0]
```

### Largest Rectangle in Histogram（ヒストグラムの最大長方形）

```python
def largestRectangleArea(heights: list[int]) -> int:
    stack = []  # (index, height) の単調増加スタック
    max_area = 0
    
    for i, h in enumerate(heights):
        start = i
        while stack and stack[-1][1] > h:
            idx, height = stack.pop()
            # idx から i-1 まで height の高さで延ばせる
            max_area = max(max_area, height * (i - idx))
            start = idx
        stack.append((start, h))
    
    # 残ったスタックの処理
    for idx, height in stack:
        max_area = max(max_area, height * (len(heights) - idx))
    
    return max_area
```

## Tips

- **Pythonの除算は `int(a / b)`** — `//` だと負の数で `-3 // 2 = -2`（数学的切り捨て）になりLeetCodeと結果が違う。`int()` はゼロ方向への切り捨て
- **`stack[-1]` でトップ参照** — Pythonリストはインデックス -1 でスタックトップを参照できる
- **単調スタックの方向** — 「次の小さい要素」→単調増加スタック、「次の大きい要素」→単調減少スタック
- **Min Stack の min_stack** — push 時に現在の最小値を更新した値を min_stack に push することで、pop 後も最小値が正しく取れる

## arai60 関連問題

| 問題 | 難易度 | ポイント |
|---|---|---|
| 20. Valid Parentheses | Easy | 対応マップ `{')': '('}` で判定 |
| 155. Min Stack | Easy | min_stack を並走させる |
| 150. Evaluate Reverse Polish Notation | Medium | 演算子でpop×2してpush |
| 84. Largest Rectangle in Histogram | Hard | 単調増加スタック + start を遡らせる |

## 関連概念

- → [BFS/DFS](./concepts_arai60_bfs_dfs.md)（DFS の反復実装にスタックを使用）
- → [Recursion](./concepts_arai60_recursion.md)（再帰とスタックの等価性）
- → [arai60 概要](./concepts_arai60_overview.md)
