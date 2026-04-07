---
category: "概念"
order: 103
title: arai60 - LinkedList（連結リスト）
description: ノードがポインタで繋がるデータ構造。ポインタ操作とRunner Techniqueが核心
tags: ["arai60", "アルゴリズム", "LeetCode", "LinkedList"]
emoji: "🔗"
date: "2026-04-04"
source: "https://1kohei1.com/leetcode/"
series:
  - arai60
---

## 概念

各ノードが **値（val）と次のノードへの参照（next）** を持つ線形データ構造。
配列と異なりランダムアクセスは O(n) だが、**先頭/中間への挿入・削除は O(1)**。

```python
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next
```

## いつ使うか（問題パターン）

- 連結リストの **反転・マージ・サイクル検出**
- **中間ノードの検索**（Runner Technique）
- 順序を保ちながらの挿入・削除

## アプローチ

### Dummy Node パターン

先頭ノードが変わりうる場合、ダミーノードを先頭に置くと処理が統一できる。

```python
dummy = ListNode(0)
dummy.next = head
curr = dummy
# 処理...
return dummy.next
```

### Runner Technique（Fast/Slow Pointer）

2つのポインタを異なる速度で動かし、**中間点やサイクルを O(n) で検出**する。

```python
slow, fast = head, head
while fast and fast.next:
    slow = slow.next
    fast = fast.next.next
# slow が中間ノードに到達
```

## Pythonコード例

### Reverse Linked List（連結リストの反転）

```python
def reverseList(head: ListNode) -> ListNode:
    prev = None
    curr = head
    while curr:
        next_node = curr.next  # 次を保存
        curr.next = prev       # 反転
        prev = curr            # prevを進める
        curr = next_node       # currを進める
    return prev
```

### Merge Two Sorted Lists（ソート済みリストのマージ）

```python
def mergeTwoLists(list1: ListNode, list2: ListNode) -> ListNode:
    dummy = ListNode(0)
    curr = dummy
    while list1 and list2:
        if list1.val <= list2.val:
            curr.next = list1
            list1 = list1.next
        else:
            curr.next = list2
            list2 = list2.next
        curr = curr.next
    curr.next = list1 or list2
    return dummy.next
```

### Linked List Cycle（サイクル検出）

```python
def hasCycle(head: ListNode) -> bool:
    slow, fast = head, head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        if slow == fast:  # 追いついたらサイクルあり
            return True
    return False
```

### Middle of the Linked List（中間ノード）

```python
def middleNode(head: ListNode) -> ListNode:
    slow, fast = head, head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
    return slow  # slow が中間（偶数長なら後ろの中間）
```

### Reorder List（リストの再配置）

```python
def reorderList(head: ListNode) -> None:
    # 1. 中間を見つける
    slow, fast = head, head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
    
    # 2. 後半を反転
    prev, curr = None, slow.next
    slow.next = None
    while curr:
        next_node = curr.next
        curr.next = prev
        prev = curr
        curr = next_node
    
    # 3. マージ
    first, second = head, prev
    while second:
        tmp1, tmp2 = first.next, second.next
        first.next = second
        second.next = tmp1
        first = tmp1
        second = tmp2
```

## Tips

- **`curr.next` を保存してから書き換える** — 反転時に `next_node = curr.next` を先に保存しないと参照が失われる
- **Dummy Node で先頭変更を統一** — `head` 自体が変わるかもしれない問題は必ず Dummy を使う
- **Fast/Slow でノード数の偶奇に注意** — 偶数長リストの「中間」が前後どちらを指すかを問題で確認する
- **`while fast and fast.next`** — `fast.next.next` を参照するため両方の null チェックが必要

## arai60 関連問題

| 問題 | 難易度 | ポイント |
|---|---|---|
| 206. Reverse Linked List | Easy | prev/curr の3変数パターン |
| 21. Merge Two Sorted Lists | Easy | Dummy Node + 小さい方を選択 |
| 141. Linked List Cycle | Easy | Fast/Slow Pointer |
| 876. Middle of the Linked List | Easy | Fast/Slow の停止条件 |
| 143. Reorder List | Medium | 中間検出 + 反転 + マージの合わせ技 |

## 関連概念

- → [Two Pointers](./concepts_arai60_two_pointers.md)（Fast/Slow Pointer の応用）
- → [Recursion](./concepts_arai60_recursion.md)（再帰的な反転・マージ）
- → [arai60 概要](./concepts_arai60_overview.md)
