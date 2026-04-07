---
category: "概念"
order: 102
title: arai60 - Sliding Window（スライディングウィンドウ）
description: 可変長・固定長の「窓」をスライドさせて部分配列を効率的に処理するテクニック
tags: ["arai60", "アルゴリズム", "LeetCode", "Sliding Window"]
emoji: "🪟"
date: "2026-04-04"
source: "https://1kohei1.com/leetcode/"
series:
  - arai60
---

## 概念

配列・文字列上を **「窓（window）」** をスライドさせながら部分配列を処理する手法。
ブルートフォースで全部分配列を調べると O(n²) になるところを、**ウィンドウの追加・削除だけで更新** することで O(n) に改善する。

```
[a, b, c, d, e, f]
 [   window   ]     →
    [   window   ]  →
```

## いつ使うか（問題パターン）

以下のシグナルがあれば Sliding Window を疑う：

- **連続する部分配列・部分文字列** の最大/最小/和を求める
- 「ちょうど K 個」「K 個以下」「K 種類以下」の条件
- 「最長の〜〜を求めよ」という連続区間問題
- 文字列のアナグラム・包含関係の探索

## アプローチ

### 固定長ウィンドウ

```python
# サイズ k の窓を右にスライド
window_sum = sum(arr[:k])
for i in range(k, len(arr)):
    window_sum += arr[i]       # 右端を追加
    window_sum -= arr[i - k]   # 左端を削除
```

### 可変長ウィンドウ（縮小・拡大）

```python
left = 0
for right in range(len(s)):
    # 右端を追加
    window.add(s[right])
    
    # 条件違反なら左端を縮小
    while 条件違反:
        window.remove(s[left])
        left += 1
    
    # 有効な窓のサイズを更新
    result = max(result, right - left + 1)
```

## Pythonコード例

### Longest Substring Without Repeating Characters（重複なし最長部分文字列）

```python
def lengthOfLongestSubstring(s: str) -> int:
    char_set = set()
    left = 0
    max_len = 0
    for right in range(len(s)):
        # 重複があれば左端を縮小
        while s[right] in char_set:
            char_set.remove(s[left])
            left += 1
        char_set.add(s[right])
        max_len = max(max_len, right - left + 1)
    return max_len
```

### Longest Repeating Character Replacement（最大K回変換後の最長同一文字列）

```python
def characterReplacement(s: str, k: int) -> int:
    count = {}
    left = 0
    max_count = 0  # ウィンドウ内の最頻文字数
    result = 0
    for right in range(len(s)):
        count[s[right]] = count.get(s[right], 0) + 1
        max_count = max(max_count, count[s[right]])
        
        # ウィンドウサイズ - 最頻文字数 > k なら左縮小
        window_size = right - left + 1
        if window_size - max_count > k:
            count[s[left]] -= 1
            left += 1
        
        result = max(result, right - left + 1)
    return result
```

### Minimum Window Substring（最小包含ウィンドウ）

```python
from collections import Counter

def minWindow(s: str, t: str) -> str:
    if not t:
        return ""
    
    need = Counter(t)   # 必要な文字数
    have = {}           # 現在のウィンドウの文字数
    formed = 0          # 条件を満たしている文字種数
    required = len(need)
    
    left = 0
    min_len = float("inf")
    result = ""
    
    for right in range(len(s)):
        c = s[right]
        have[c] = have.get(c, 0) + 1
        if c in need and have[c] == need[c]:
            formed += 1
        
        # 全条件満たしたら左から縮小
        while formed == required:
            if right - left + 1 < min_len:
                min_len = right - left + 1
                result = s[left:right + 1]
            have[s[left]] -= 1
            if s[left] in need and have[s[left]] < need[s[left]]:
                formed -= 1
            left += 1
    
    return result
```

### Best Time to Buy and Sell Stock（株の売買利益最大化）

```python
def maxProfit(prices: list[int]) -> int:
    min_price = float("inf")
    max_profit = 0
    for price in prices:
        min_price = min(min_price, price)
        max_profit = max(max_profit, price - min_price)
    return max_profit
```

## Tips

- **`max_count` はデクリメントしない** — Longest Repeating では、ウィンドウを縮小しても `max_count` を減らさない。これにより最適なウィンドウサイズが自然に保持される
- **可変長は `left` のループ内で `right - left + 1` を更新** — `right` のループ外で更新すると off-by-one が起きやすい
- **`formed == required` の条件** — Minimum Window では「何種類の文字を満たしているか」で管理するのが定石
- **Two Pointers との違い** — Two Pointers はソート済み配列の「対探索」、Sliding Window は「連続区間の最適化」

## arai60 関連問題

| 問題 | 難易度 | ポイント |
|---|---|---|
| 121. Best Time to Buy and Sell Stock | Easy | min_price を更新しながら差分を計算 |
| 3. Longest Substring Without Repeating | Medium | set で重複管理 |
| 424. Longest Repeating Character Replacement | Medium | max_count をデクリメントしないトリック |
| 76. Minimum Window Substring | Hard | formed/required パターン |

## 関連概念

- → [Two Pointers](./concepts_arai60_two_pointers.md)（同方向ポインタの基礎）
- → [HashMap](./concepts_arai60_hashmap.md)（文字頻度の管理）
- → [arai60 概要](./concepts_arai60_overview.md)
