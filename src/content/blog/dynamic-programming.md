---
title: "[Algorithms] Dynamic Programming Overview"
date: 2024-05-25T19:47:43+09:00
description: "【Algorithms】Solve a Big problem, breaking down into smaller subproblems."
draft: false
author: subaru
authorEmoji: 🐙
tags:
  - computer-science
  - algorithms
categories:
  - computer-science
  - algorithms
image: images/feature2/dp.png
---

Dynamic Programming is a method used to solve complex problems by breaking down into simpler subproblems. It is applicable when the problem has overlapping subproblems and optimal substructure properties. The core idea is to store the results of subproblems to avoid redundant computations.

Let’s delve into some famous DP cases, breaking down each concept into small pieces step by step.

## 1. Frog Problem (Optimal Substructure)

**Problem Statement:**

Given a series of stones, each with a certain height, calculate the minimum stamina required for a frog to reach the goal. The frog can jump to the next stone or skip one stone.

**Variables:**

- `ground` : Array representing the height of each stone.
- `height` : Array of heights.
- `stamina` : Energy or cost required to jump between stones.

**Objective:**

Minimize the total stamina required to reach the last stone.

**DP Approach:**

We use a DP array `dp[i]` where `dp[i]` represents the minimum stamina required to reach the `i-th` stone.

Here is the important point for the DP that the dp array holds final outputs in this time `stamina` .

**Steps:**

1. Initialization:

- `dp[0] = 0` : No cost(consume some stamina) to stay on the first stone.
- `dp[1] = abs(height[1] - height[0])` : Cost(consume some stamina) to jump to the second stone.

1. Recurrence Relation:

   For each stone `i` from 2 to `n`

   ```jsx
   oneStoneJump = dp[i - 1] + abs(height[i] - height[i - 1]);
   skipOneStoneJump = dp[i - 2] + abs(height[i] - height[i - 2]);

   dp[i] = min(oneStoneJump, skipOneStoneJump);
   ```

2. Template Function (Relaxation):

It is a modeling strategy that aims to solve a difficult problem by approximating it with a nearby problem that is easier to solve.

[https://en.wikipedia.org/wiki/Relaxation\_(approximation)](<https://en.wikipedia.org/wiki/Relaxation_(approximation)>)

```jsx

// choose smaller stamina between two steps.
void chmin(int &a, int b) {
  if(a > b) a = b
}
```

### Pull-Based and Push-Based Approaches:

- Push-Based: Calculate `dp[i]` from previous points (`dp[i-1]` and `dp[i-2]`).

```jsx
for (int i = 2; i < grounds; ++i) {
  dp[i] = dp[i-1] + abs(height[i] - height[i-1]));
  chmin(dp[i], dp[i-2] + abs(height[i] - height[i-2]));
}
```

- Push-Based: Update future points from the current point.

```jsx
for (int i = 0; i < grounds -1; ++i) {
  if (i + 1 < grounds) {
    chmin(*dp[i + 1], dp[i] + abs(heights[i+1] - heights[i]))
  }

  if (i + 2 < grounds) {
    chmin(*dp[i + 2], dp[i] + abs(heights[i+2] - heights[i]))
  }
}
```

**Memoization:**

Store intermidiate results to avoid redundant calculations

## 2. Knapsack Problem

**Problem Statement:**

Given `N` items, each with a weight and a value, find the maximum value you can obtain without exceeding a total weight `W` .

**Variables:**

- `N` : Number of items.
- `weights`: Array of weights of items.
- `values` : Array of values of items.
- `W` : Maximum allowable weight.

**Objective:**

Maximize the total value without exceeding the weight `W` .

**DP Approach:**

We use DP array `dp[i][w]` where `dp[i][w]` represents the maximum value achievable with the first `i` items and weight `w` .

**Steps:**

1. Initialization:

```jsx
for (int i = 0; i <= N; ++i) dp[i][0] = 0;
for (int w = 0; w <= W; ++w) dp[0][w] = 0;
```

1. Recurrence Relation:

For each item `i` and weight `w` :

```jsx
if (weights[i - 1] <= w) {
  dp[i][w] = max(dp[i - 1][w], dp[i - 1][w - weights[i - 1]] + values[i - 1]);
} else {
  dp[i][w] = dp[i - 1][w];
}
```

### 3. Edit Distance

Problem Statement:

Given two strings, calculate the minimum number of operations (insert, delete, substitue) required to transform one string into another.

**Variables:**

- `str1` , `str2` : The two strings to be transformed.

O**bjective:**

Minimize the number of operations to transform `str1` into `str2`

**DP Approach:**

We use a DP array `dp[i][j]` when `dp[i][j]` represents the minimum number of operations required to transform the first `i`characters of `str1` to the first `j` characters of `str2`.

**Steps:**

1. Initialization

prepare a table referirng each defined strings 0 case.

i represents first str, and j represents second str.

```jsx
for (int i = 0; i<=m; ++i) dp[i][0] = i;
for (int j = 0; j<=n; j++) dp[0][j] = j;
```

1. Recurrence Relation:

For each character `i` in `str1` and `j` in `str2` .

```jsx
if (str1[i - 1] == str2[j - 1]) {
	dp[i][j] = dp[i - 1][j - 1];
} else {
	dp[i][j] = 1 + min({ dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1] })
}
```

- When `str1[i - 1] == str2[j - 1]` : if the characters are the same, no edit operation is needed, so the cost remains the same as for the previous characters, `dp[i - 1][j - 1]` .
- When `str1[i - 1] != str2[j - 1]` : If the characters are diffrent, it requires one of the three operations(insert, delete, substitute) to make the characters match. Hence, the example adds 1 to the minimum cost of the three possible previous operations:
  - `dp[i - 1][j]` : Represents deleting a character from `str1` (moving up in the DP table)
  - `dp[i][j - 1]` : Represents inserting a character into `str1` (moving left in the DP table)
  - `dp[i - 1][j - 1]` : Represents substituting a character in `str1` with a character from `str2` (moving diagonally in the DP table)

**Example:**

Consider transforming `str1 = "konokuniwo"` to `str2 = "kaetai"` :

1. **`dp[0][0]`** to **`dp[0][6]`** and **`dp[1][0]`** to **`dp[10][0]`** are initialized based on the length of the substrings.
2. For **`dp[1][1]`**:
   - **`str1[0] == str2[0]`** ('k' == 'k'), so **`dp[1][1] = dp[0][0] = 0`**.
3. For **`dp[1][2]`**:
   - **`str1[0] != str2[1]`** ('k' != 'a'), so **`dp[1][2] = 1 + min(dp[0][2], dp[1][1], dp[0][1]) = 1 + min(2, 0, 1) = 1`**.

The final value `dp[len(str1)][len[str2]` will give the minimum number of operations required to transform `str1` into `str2`.

## Summary

Dynamic programming is such a powerful technique for solving optimization problems by breaking them down into simpler subproblems and storing the results of thses subproblems to avoid redundant computations that we can achieve efficent and effective solutions.
