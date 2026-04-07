---
category: "概念"
order: 113
title: arai60 - Greedy + Backtracking（貪欲法・バックトラッキング）
description: 貪欲法は局所最適を積み上げ、バックトラッキングは条件違反で戻る全探索
tags: ["arai60", "アルゴリズム", "LeetCode", "Greedy", "Backtracking"]
emoji: "🎲"
date: "2026-04-04"
source: "https://1kohei1.com/leetcode/"
series:
  - arai60
---

## 概念

### 貪欲法（Greedy）

**各ステップで局所的に最良の選択** をすることで、全体最適を達成するアルゴリズム。
「今の状態で最善」を選び続けることが全体最適に繋がる場合にのみ適用できる。

### バックトラッキング（Backtracking）

**全候補を試し、条件を満たさない時点で戻る（枝刈り）** 全探索法。
→ 詳細は [Recursion](./concepts_arai60_recursion.md) を参照。

## 貪欲法の適用条件

以下の性質が成り立つ場合に貪欲法が使える：

1. **貪欲選択性** — 局所最適な選択が全体最適解に含まれる
2. **最適部分構造** — 部分問題の最適解から全体の最適解が構成できる

## Pythonコード例

### Maximum Subarray（最大部分配列和）

```python
def maxSubArray(nums: list[int]) -> int:
    max_sum = nums[0]
    curr_sum = nums[0]
    for n in nums[1:]:
        # 現在の合計が負なら切り捨て（新たに始め直す）
        curr_sum = max(n, curr_sum + n)
        max_sum = max(max_sum, curr_sum)
    return max_sum
```

### Jump Game（ゴールに到達できるか）

```python
def canJump(nums: list[int]) -> bool:
    max_reach = 0
    for i, jump in enumerate(nums):
        if i > max_reach:
            return False  # 到達不可能な位置
        max_reach = max(max_reach, i + jump)
    return True
```

### Jump Game II（最小ジャンプ回数）

```python
def jump(nums: list[int]) -> int:
    jumps = 0
    curr_end = 0   # 現在のジャンプで到達できる最大位置
    farthest = 0   # 次のジャンプで到達できる最大位置
    
    for i in range(len(nums) - 1):
        farthest = max(farthest, i + nums[i])
        if i == curr_end:
            jumps += 1
            curr_end = farthest
    return jumps
```

## 貪欲法の思考プロセス

1. **「各ステップで何を最大化/最小化するか」を決める**
2. **反例を探す** — この選択が失敗するケースがないか確認
3. **証明できれば実装** — 直感的に正しくても反例がないか必ず確認

## Tips

- **Maximum Subarray の Kadane's Algorithm** — `curr_sum = max(n, curr_sum + n)` が核心。負になったら切り捨てて新たにスタート
- **Jump Game は「到達可能範囲の維持」** — 現在位置が `max_reach` 以下かどうかをチェックするだけ
- **Jump Game II の「BFS 的思考」** — 現在の「層」（curr_end まで）を全て見てから次の層（farthest）に進む
- **貪欲法は証明が難しい** — 直感が正しくないことも多い。反例を考える習慣を持つ

## arai60 関連問題

| 問題 | 難易度 | ポイント |
|---|---|---|
| 53. Maximum Subarray | Medium | Kadane's Algorithm |
| 55. Jump Game | Medium | max_reach を維持 |
| 45. Jump Game II | Medium | BFS 的な層ごと更新 |

## 関連概念

- → [Recursion](./concepts_arai60_recursion.md)（バックトラッキングの実装）
- → [Dynamic Programming](./concepts_arai60_dynamic_programming.md)（貪欲法で解けない場合の代替）
- → [arai60 概要](./concepts_arai60_overview.md)
