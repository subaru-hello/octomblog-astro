---
category: "概念"
order: 108
title: arai60 - Tree / BT / BST（木構造・二分木・BST）
description: 木のトラバーサル・再帰・BSTの性質を使った問題群。arai60最多の11問
tags: ["arai60", "アルゴリズム", "LeetCode", "Tree", "BST", "BinaryTree"]
emoji: "🌳"
date: "2026-04-04"
source: "https://1kohei1.com/leetcode/"
series:
  - arai60
---

## 概念

**二分木（Binary Tree）**: 各ノードが最大2つの子を持つ木構造。
**BST（Binary Search Tree）**: 左の子 < ノード < 右の子 の性質を持つ二分木。

```python
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right
```

## トラバーサルの種類

| 種類 | 順序 | 用途 |
|---|---|---|
| Preorder | root → left → right | コピー、シリアライズ |
| Inorder | left → root → right | BST のソート順 |
| Postorder | left → right → root | 削除、サイズ計算 |
| Level Order | 層ごと（BFS） | 層ごとの処理 |

## Pythonコード例

### Invert Binary Tree（木の左右反転）

```python
def invertTree(root: TreeNode) -> TreeNode:
    if not root:
        return None
    root.left, root.right = invertTree(root.right), invertTree(root.left)
    return root
```

### Maximum Depth of Binary Tree（最大深さ）

```python
def maxDepth(root: TreeNode) -> int:
    if not root:
        return 0
    return 1 + max(maxDepth(root.left), maxDepth(root.right))
```

### Same Tree（同一かどうか）

```python
def isSameTree(p: TreeNode, q: TreeNode) -> bool:
    if not p and not q:
        return True
    if not p or not q or p.val != q.val:
        return False
    return isSameTree(p.left, q.left) and isSameTree(p.right, q.right)
```

### Binary Tree Level Order Traversal（レベル順トラバーサル）

```python
from collections import deque

def levelOrder(root: TreeNode) -> list[list[int]]:
    if not root:
        return []
    result = []
    queue = deque([root])
    while queue:
        level = []
        for _ in range(len(queue)):  # この層のノード数だけ処理
            node = queue.popleft()
            level.append(node.val)
            if node.left:
                queue.append(node.left)
            if node.right:
                queue.append(node.right)
        result.append(level)
    return result
```

### Validate Binary Search Tree（BST の検証）

```python
def isValidBST(root: TreeNode) -> bool:
    def validate(node, min_val, max_val):
        if not node:
            return True
        if not (min_val < node.val < max_val):
            return False
        return (validate(node.left, min_val, node.val) and
                validate(node.right, node.val, max_val))
    return validate(root, float('-inf'), float('inf'))
```

### Lowest Common Ancestor of BST（BST の最近共通祖先）

```python
def lowestCommonAncestor(root: TreeNode, p: TreeNode, q: TreeNode) -> TreeNode:
    # BST の性質: 両方より大きければ左、両方より小さければ右
    while root:
        if p.val < root.val and q.val < root.val:
            root = root.left
        elif p.val > root.val and q.val > root.val:
            root = root.right
        else:
            return root  # ここが LCA
```

### Construct Binary Tree from Preorder and Inorder（preorder と inorder から木を構築）

```python
def buildTree(preorder: list[int], inorder: list[int]) -> TreeNode:
    if not preorder:
        return None
    root_val = preorder[0]
    root = TreeNode(root_val)
    mid = inorder.index(root_val)
    root.left = buildTree(preorder[1:mid+1], inorder[:mid])
    root.right = buildTree(preorder[mid+1:], inorder[mid+1:])
    return root
```

### Binary Tree Maximum Path Sum（最大パス和）

```python
def maxPathSum(root: TreeNode) -> int:
    result = [float('-inf')]
    
    def dfs(node):
        if not node:
            return 0
        left = max(dfs(node.left), 0)   # 負なら無視
        right = max(dfs(node.right), 0)
        # このノードを経由するパスの最大値を更新
        result[0] = max(result[0], node.val + left + right)
        # 親に返せるのは片側だけ
        return node.val + max(left, right)
    
    dfs(root)
    return result[0]
```

### Serialize and Deserialize Binary Tree

```python
class Codec:
    def serialize(self, root: TreeNode) -> str:
        if not root:
            return "N"
        return f"{root.val},{self.serialize(root.left)},{self.serialize(root.right)}"
    
    def deserialize(self, data: str) -> TreeNode:
        vals = iter(data.split(','))
        
        def build():
            val = next(vals)
            if val == 'N':
                return None
            node = TreeNode(int(val))
            node.left = build()
            node.right = build()
            return node
        
        return build()
```

## Tips

- **再帰の基底ケースは `if not node: return`** — None チェックを最初に行う
- **BST は inorder でソート順** — BST の問題で「K番目に小さい」は inorder traversal が有効
- **Max Path Sum は「片側しか親に返せない」** — 両側を使ったパスは親に繋げないため、`result` を外部変数で管理する
- **Level Order の `for _ in range(len(queue))`** — キューに次の層が混ざらないよう、ループ開始時のキューサイズだけ処理する
- **`float('-inf')` で初期化** — 全ノードが負のケースを考慮し、0 ではなく `-inf` で初期化する

## arai60 関連問題

| 問題 | 難易度 | ポイント |
|---|---|---|
| 226. Invert Binary Tree | Easy | 再帰で left/right を swap |
| 104. Maximum Depth of Binary Tree | Easy | 1 + max(左深さ, 右深さ) |
| 100. Same Tree | Easy | 値比較 + 左右の再帰 |
| 102. Binary Tree Level Order Traversal | Medium | BFS + 層サイズ分ループ |
| 572. Subtree of Another Tree | Easy | isSameTree を全ノードで試す |
| 105. Construct from Preorder and Inorder | Medium | inorder のルート位置で分割 |
| 98. Validate BST | Medium | min/max の範囲を引数で渡す |
| 230. Kth Smallest Element in BST | Medium | inorder + カウンタ |
| 235. LCA of BST | Medium | BST の性質で方向決定 |
| 124. Binary Tree Maximum Path Sum | Hard | 片側のみ親に返す |
| 297. Serialize and Deserialize Binary Tree | Hard | "N" でnullを表現 |

## 関連概念

- → [BFS/DFS](./concepts_arai60_bfs_dfs.md)（木はグラフの特殊形）
- → [Recursion](./concepts_arai60_recursion.md)（木は再帰と相性抜群）
- → [arai60 概要](./concepts_arai60_overview.md)
