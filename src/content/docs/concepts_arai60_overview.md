---
category: "概念"
order: 100
title: arai60 概要・練習方法
description: 新井康平氏が厳選したLeetCode60問。BigTech面接対策として一般社団法人ソフトウェアエンジニアリング協会が採用
tags: ["arai60", "アルゴリズム", "LeetCode", "面接対策", "Google"]
emoji: "🎯"
date: "2026-04-04"
source: "https://1kohei1.com/leetcode/"
series:
  - arai60
---

## arai60とは

新井康平（Kohei Arai）氏がLeetCodeの数千問から厳選した60問。**「これら60問を30分以内にエラーなく実装できれば、コーディング面接対策は完了」** というベンチマークを提供する。

一般社団法人ソフトウェアエンジニアリング協会（SWE協会）がGoogleなどのBigTech就職対策教材として採用しており、Discordでの練習会・レビューセッションで使用されている。

- 公式問題リスト: https://1kohei1.com/leetcode/
- LeetCode リスト: https://leetcode.com/list/?selectedList=xt2qzsi5

## 練習方法（SWE協会推奨）

### Step 1: 自力で解く

何も見ずに問題を解く。**5〜10分考えてわからなければ答えを見る**（粘りすぎない）。

### Step 2: 洗練された解法を学ぶ

- 他の実装者のコード（GitHub・LeetCode Discussion）
- Pythonの標準ライブラリ公式ドキュメント（`collections`, `heapq`, `bisect`等）
- より良い計算量の解法を理解する

### Step 3: 反復練習

**10分以内にエラーなく実装できるまで反復**する。3回連続で書けるようになることが目標。

## 問題カテゴリ一覧

| カテゴリ | 問題数 | ドキュメント |
|---|---|---|
| LinkedList（連結リスト） | 5問 | [→ LinkedList](./concepts_arai60_linked_list.md) |
| Stack（スタック） | 4問 | [→ Stack](./concepts_arai60_stack.md) |
| Heap / PriorityQueue（ヒープ） | 6問 | [→ Heap](./concepts_arai60_heap.md) |
| HashMap（ハッシュマップ） | 6問 | [→ HashMap](./concepts_arai60_hashmap.md) |
| Graph / BFS / DFS | 6問 | [→ BFS/DFS](./concepts_arai60_bfs_dfs.md) |
| Tree / BT / BST（木構造） | 11問 | [→ Tree](./concepts_arai60_tree.md) |
| Sort（ソート） | 3問 | [→ Sort](./concepts_arai60_sort.md) |
| Dynamic Programming（DP） | 9問 | [→ DP](./concepts_arai60_dynamic_programming.md) |
| Binary Search（二分探索） | 3問 | [→ Binary Search](./concepts_arai60_binary_search.md) |
| Recursion（再帰） | 4問 | [→ Recursion](./concepts_arai60_recursion.md) |
| Sliding Window | 4問 | [→ Sliding Window](./concepts_arai60_sliding_window.md) |
| Two Pointers（二ポインタ） | 5問 | [→ Two Pointers](./concepts_arai60_two_pointers.md) |
| Greedy + Backtracking | 3問 | [→ Greedy](./concepts_arai60_greedy_backtracking.md) |

## よく使うPythonの標準ライブラリ

```python
from collections import deque, defaultdict, Counter
import heapq
from bisect import bisect_left, bisect_right
```

| ライブラリ | 用途 | 計算量 |
|---|---|---|
| `collections.deque` | BFS のキュー | O(1) append/popleft |
| `collections.defaultdict` | グラフの隣接リスト、頻度カウント | O(1) アクセス |
| `collections.Counter` | 文字列・配列の頻度カウント | O(n) 構築 |
| `heapq` | ヒープ（最小ヒープ） | O(log n) push/pop |
| `bisect` | ソート済み配列への二分探索挿入 | O(log n) |

## 面接での立ち回り方

1. **問題を繰り返し言語化する** — 「つまり〜〜をすればよい」と自分の言葉で確認
2. **例を手で動かす** — 小さな入力で期待する出力を確認してから実装
3. **計算量を先に言う** — 「時間O(n)、空間O(1)で解けます」と宣言してから実装
4. **エッジケースを明示する** — 空配列・null・重複値などを事前に確認
