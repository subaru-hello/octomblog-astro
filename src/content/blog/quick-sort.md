---
title: "[Algorithms] How A Quick Sort works"
description: "learn a quick sort's concept to write a sorting algorithm efficiently"
date: 2024-04-29T18:02:25+09:00
authorEmoji: 🐙
tags:
  - algorithms
  - quicksort
categories:
  - algorithms
  - computer-science
image: images/feature2/quick-sort.png
---

Quicksort, a divide-and-conquer strategy, is renowned for its efficiency in sorting arrays.

The performance of Quicksort hinges significantly on the choice of the pivot; depending on this choice, the time complexity can vary from O(n^2) to O(n log n). Ideally, selecting the median index of the array as the pivot leads to the fastest sorting times.

Let's delve deeper into how this algorithm functions.

## How Quicksort Works:

For a highly explanation, a Quicksort algorithm works as follows.

1. **Selecting a Pivot**: The choice of pivot is crucial for the efficiency of Quicksort. There are various strategies like choosing the first element, the last element, the median, or a random element as the pivot.
2. **Partitioning**: After choosing a pivot, the array is partitioned into two sub-arrays - elements less than the pivot and elements greater than the pivot. The pivot is then placed in its correct position in the sorted array.
3. **Recursion**: Quicksort is then recursively applied to the sub-arrays. This process continues until the base case is reached, which is an array with one or zero elements.

Simply spealing, it recursively selects a pivot and partitions an array into two sub-arrays until the array length reaches to 1 or zero.

It is really surprising that it requires only those steps to finish sorting.

## Performance Analysis:

Well, Now that We understood a Quicksort is quite a simple algorithm and beside it works fast, what about a performance?

As I already said that the time of calculation depends on which pivot is selected.

- **Worst-Case Scenario**: If the smallest or largest element is consistently chosen as the pivot, the algorithm will perform poorly with O(n^2) time complexity. This situation can occur if the array is already sorted or reverse sorted.
- **Best-Case Scenario**: The best case occurs when the pivot divides the array into two equal halves leading to a time complexity of O(n log n).

when implementing the quick sort algorithm, it is advantageous to select a meddle number as a pivot.

It helps to mitigate the worst-case performance that occurs when the smallest or largest element is consistently chosen as a pivot.

## Pivot Selection Strategies:

For these reasons, it is crucial to select a median pivot when using the QuickSort algorithm:

- **First or Last Element**: Choosing either the first or the last element as a pivot can lead to the worst-case time complexity, particularly if the array is already in some order. This scenario significantly slows down the performance.
- **Median**: Ideally, selecting the median element as the pivot leads to equally sized partitions, which helps maintain the algorithm's efficiency. If successfully implemented, this strategy ensures that QuickSort operates in O(n log n) time, comparable to merge sort.

Additionally, another strategy called Random Selection can further optimize runtime. This method involves randomly selecting the pivot, which helps prevent the predictable pitfalls of consistently choosing the first, last, or median elements, especially in arrays with specific ordering or patterns.

- **Random Selection**: By randomly selecting a pivot, the algorithm avoids the pitfall of a worst-case scenario tied to the input's initial order. On average, a randomly chosen pivot yields O(n log n) time complexity, making it a reliable choice for most applications.

## **Random Pivots vs. Median Pivots:**

So far, we have explored three types of pivot selection strategies. Now that we understand the importance of using either random or median pivots, which one is better? Here is a comparison of the two:

- **Random Pivot**: This approach simplifies the algorithm and typically delivers good performance, regardless of the initial order of the input. On average, it achieves a time complexity of O(n log n).
- **Median Pivot**: This method can potentially yield a perfectly balanced split, but finding the true median can be computationally demanding. However, employing a 'median of three' strategy—selecting the median from the first, middle, and last elements—offers a practical compromise.

I prefer the random pivot selection because it is indifferent to the input’s initial arrangement, unlike the median pivot, which requires selecting and evaluating three specific elements. This additional step can be cumbersome.

## Conclusion:

Quicksort is generally faster than other O(n log n) algorithms like merge sort, due to lower overhead and better locality of reference.

However, its performance heavily depends on the choice of pivot.

In practical implementations, a hybrid approach often works best, such as using insertion sort for small sub-arrays and a 'median of three' for pivot selection to balance the efficiency and computational cost.

Random pivots are a good default choice due to their simplicity and good average case performance.

## when chosen the first element of the array

!https://storage.googleapis.com/zenn-user-upload/b7b628769612-20240429.png

!https://storage.googleapis.com/zenn-user-upload/9c24e90ad398-20240429.png

## reference

https://www.youtube.com/watch?v=ETo1cpLN7kk&list=PLXFMmlk03Dt7Q0xr1PIAriY5623cKiH7V&index=26https://github.com/subaru-hello/stanford-algorithms-go/blob/main/Course1/quick-sort/index.gohttps://github.com/pco2699/algorithms/blob/master/quicksort/src/main.rs
