---
category: "概念"
order: 107
title: arai60 - BFS / DFS（グラフ探索）
description: グラフ・格子の探索アルゴリズム。BFSは最短経路、DFSは全探索に使う
tags: ["arai60", "アルゴリズム", "LeetCode", "BFS", "DFS", "Graph"]
emoji: "🕸️"
date: "2026-04-04"
source: "https://1kohei1.com/leetcode/"
series:
  - arai60
---

## 概念

グラフ（頂点と辺の集合）を探索する2つの基本アルゴリズム。

| | BFS（幅優先探索） | DFS（深さ優先探索） |
|---|---|---|
| データ構造 | キュー（deque） | スタック（再帰 or list） |
| 探索順 | 近い順（層ごと） | 深く潜ってから戻る |
| 最短経路 | 保証される | 保証されない |
| 用途 | 最短経路、レベル順処理 | 全探索、連結確認、サイクル検出 |

## いつ使うか（問題パターン）

**BFS を使う場合:**
- 「最短ステップ数」「最短経路」
- グラフのレベル（層）ごとの処理
- 2点間の最短距離

**DFS を使う場合:**
- 「繋がっているか」「到達できるか」
- 全パターンの列挙（バックトラッキングと組み合わせ）
- サイクルの検出
- 島・連結成分の数を数える

## Pythonコード例

### BFS テンプレート

```python
from collections import deque

def bfs(graph: dict, start: int) -> None:
    visited = set([start])
    queue = deque([start])
    
    while queue:
        node = queue.popleft()
        for neighbor in graph[node]:
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)
```

### DFS テンプレート（再帰）

```python
def dfs(graph: dict, node: int, visited: set) -> None:
    visited.add(node)
    for neighbor in graph[node]:
        if neighbor not in visited:
            dfs(graph, neighbor, visited)
```

### Number of Islands（島の数）

```python
def numIslands(grid: list[list[str]]) -> int:
    if not grid:
        return 0
    rows, cols = len(grid), len(grid[0])
    count = 0
    
    def dfs(r, c):
        if r < 0 or r >= rows or c < 0 or c >= cols or grid[r][c] != '1':
            return
        grid[r][c] = '0'  # 訪問済みにする（in-place 変更）
        dfs(r + 1, c)
        dfs(r - 1, c)
        dfs(r, c + 1)
        dfs(r, c - 1)
    
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == '1':
                dfs(r, c)
                count += 1
    return count
```

### Clone Graph（グラフのディープコピー）

```python
from collections import deque

class Node:
    def __init__(self, val=0, neighbors=None):
        self.val = val
        self.neighbors = neighbors or []

def cloneGraph(node: Node) -> Node:
    if not node:
        return None
    
    cloned = {node: Node(node.val)}
    queue = deque([node])
    
    while queue:
        curr = queue.popleft()
        for neighbor in curr.neighbors:
            if neighbor not in cloned:
                cloned[neighbor] = Node(neighbor.val)
                queue.append(neighbor)
            cloned[curr].neighbors.append(cloned[neighbor])
    
    return cloned[node]
```

### Course Schedule（コーストポロジカルソート・サイクル検出）

```python
def canFinish(numCourses: int, prerequisites: list[list[int]]) -> bool:
    graph = [[] for _ in range(numCourses)]
    for a, b in prerequisites:
        graph[b].append(a)
    
    # 0: 未訪問, 1: 訪問中, 2: 完了
    state = [0] * numCourses
    
    def has_cycle(node):
        if state[node] == 1:
            return True   # 訪問中のノードに再訪 = サイクル
        if state[node] == 2:
            return False  # 完了済み
        state[node] = 1
        for neighbor in graph[node]:
            if has_cycle(neighbor):
                return True
        state[node] = 2
        return False
    
    return not any(has_cycle(i) for i in range(numCourses))
```

### Pacific Atlantic Water Flow（太平洋・大西洋に流れる座標）

```python
from collections import deque

def pacificAtlantic(heights: list[list[int]]) -> list[list[int]]:
    rows, cols = len(heights), len(heights[0])
    
    def bfs(starts):
        visited = set(starts)
        queue = deque(starts)
        while queue:
            r, c = queue.popleft()
            for dr, dc in [(1,0),(-1,0),(0,1),(0,-1)]:
                nr, nc = r + dr, c + dc
                if (0 <= nr < rows and 0 <= nc < cols
                        and (nr, nc) not in visited
                        and heights[nr][nc] >= heights[r][c]):
                    visited.add((nr, nc))
                    queue.append((nr, nc))
        return visited
    
    pacific = [(0, c) for c in range(cols)] + [(r, 0) for r in range(rows)]
    atlantic = [(rows-1, c) for c in range(cols)] + [(r, cols-1) for r in range(rows)]
    
    return [[r, c] for r, c in bfs(pacific) & bfs(atlantic)]
```

## Tips

- **`visited` set の忘れに注意** — 訪問済みチェックなしだと無限ループ
- **BFS は `deque` を使う** — `queue.pop(0)` はリストで O(n)。`deque.popleft()` は O(1)
- **DFS での再帰深度制限** — Python のデフォルト再帰上限は 1000。大きいグリッドは `sys.setrecursionlimit` か反復DFSに変更する
- **サイクル検出は3状態** — 未訪問(0)・訪問中(1)・完了(2) の3状態で管理する。2値では検出できない
- **逆方向BFS** — Pacific Atlantic のように「どこから流れてくるか」は海岸から逆方向に BFS するのが定石

## arai60 関連問題

| 問題 | 難易度 | ポイント |
|---|---|---|
| 200. Number of Islands | Medium | DFS でグリッドを '0' に潰す |
| 133. Clone Graph | Medium | BFS + visited dict で元→コピー |
| 417. Pacific Atlantic Water Flow | Medium | 両海から逆BFS して積集合 |
| 207. Course Schedule | Medium | DFS + 3状態でサイクル検出 |
| 323. Number of Connected Components | Medium | Union Find も有効 |
| 684. Redundant Connection | Medium | Union Find で閉路検出 |

## 関連概念

- → [Tree](./concepts_arai60_tree.md)（木もグラフの一種）
- → [Recursion](./concepts_arai60_recursion.md)（DFS の再帰実装）
- → [Stack](./concepts_arai60_stack.md)（DFS の反復実装）
- → [arai60 概要](./concepts_arai60_overview.md)
