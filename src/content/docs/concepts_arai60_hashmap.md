---
category: "概念"
order: 106
title: arai60 - HashMap（ハッシュマップ）
description: O(1)の検索・挿入を活かして重複・頻度・グループ化問題を解くテクニック
tags: ["arai60", "アルゴリズム", "LeetCode", "HashMap", "HashSet"]
emoji: "🗺️"
date: "2026-04-04"
source: "https://1kohei1.com/leetcode/"
series:
  - arai60
---

## 概念

**キーと値のマッピング**を O(1) で管理するデータ構造。Pythonでは `dict` と `set` が該当する。

| 操作 | dict | set |
|---|---|---|
| 挿入 | O(1) | O(1) |
| 検索 | O(1) | O(1) |
| 削除 | O(1) | O(1) |

## いつ使うか（問題パターン）

- **重複チェック** — 「配列に重複が含まれるか」
- **頻度カウント** — 「最も頻繁に出現する要素」
- **2つの要素の対応** — 「Two Sum: a + b = target」
- **グループ化** — 「アナグラムをグループにまとめる」
- **連続性の確認** — 「最長連続列の長さ」

## Pythonコード例

### Contains Duplicate（重複の存在確認）

```python
def containsDuplicate(nums: list[int]) -> bool:
    return len(nums) != len(set(nums))
    # または
    seen = set()
    for n in nums:
        if n in seen:
            return True
        seen.add(n)
    return False
```

### Two Sum（合計が target になる2つのインデックス）

```python
def twoSum(nums: list[int], target: int) -> list[int]:
    seen = {}  # {値: インデックス}
    for i, n in enumerate(nums):
        complement = target - n
        if complement in seen:
            return [seen[complement], i]
        seen[n] = i
    return []
```

### Valid Anagram（アナグラムの判定）

```python
from collections import Counter

def isAnagram(s: str, t: str) -> bool:
    return Counter(s) == Counter(t)
    # または
    if len(s) != len(t):
        return False
    count = {}
    for c in s:
        count[c] = count.get(c, 0) + 1
    for c in t:
        if count.get(c, 0) == 0:
            return False
        count[c] -= 1
    return True
```

### Group Anagrams（アナグラムのグループ化）

```python
from collections import defaultdict

def groupAnagrams(strs: list[str]) -> list[list[str]]:
    groups = defaultdict(list)
    for s in strs:
        key = tuple(sorted(s))  # ソートした文字列をキーに
        groups[key].append(s)
    return list(groups.values())
```

### Top K Frequent Elements（上位K個の頻出要素）

```python
from collections import Counter

def topKFrequent(nums: list[int], k: int) -> list[int]:
    count = Counter(nums)
    # バケットソート: インデックスが出現回数
    bucket = [[] for _ in range(len(nums) + 1)]
    for num, freq in count.items():
        bucket[freq].append(num)
    
    result = []
    for i in range(len(bucket) - 1, 0, -1):
        result.extend(bucket[i])
        if len(result) >= k:
            return result[:k]
    return result
```

### Longest Consecutive Sequence（最長連続列）

```python
def longestConsecutive(nums: list[int]) -> int:
    num_set = set(nums)
    max_len = 0
    
    for n in num_set:
        # 連続列の開始点のみ処理（n-1 が存在しない場合）
        if n - 1 not in num_set:
            length = 1
            while n + length in num_set:
                length += 1
            max_len = max(max_len, length)
    
    return max_len
```

## Tips

- **`defaultdict(list)` でグループ化** — `defaultdict` はキーが存在しない場合にデフォルト値を返すため、`if key not in d` のチェックが不要
- **`Counter` は最強の頻度カウンター** — `Counter(s)` で文字列の頻度辞書が即座に作れる。`Counter.most_common(k)` で上位 K 個も取れる
- **バケットソート vs ヒープ** — Top K 頻出要素は `heapq.nlargest` でも解けるが、バケットソートは O(n) で最速
- **連続列は「始点のみ」処理** — `n - 1 not in set` の条件で始点だけ処理することで O(n) を実現

## arai60 関連問題

| 問題 | 難易度 | ポイント |
|---|---|---|
| 217. Contains Duplicate | Easy | set の長さ比較 |
| 242. Valid Anagram | Easy | Counter の比較 |
| 1. Two Sum | Easy | seen dict で complement を探す |
| 49. Group Anagrams | Medium | sorted(s) をキーにした defaultdict |
| 347. Top K Frequent Elements | Medium | バケットソートで O(n) |
| 128. Longest Consecutive Sequence | Medium | set + 始点からの探索 |

## 関連概念

- → [Sliding Window](./concepts_arai60_sliding_window.md)（ウィンドウ内の文字頻度管理）
- → [Heap](./concepts_arai60_heap.md)（Top K の別解法）
- → [arai60 概要](./concepts_arai60_overview.md)
