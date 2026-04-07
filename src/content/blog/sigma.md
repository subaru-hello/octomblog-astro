---
title: "[Algorithms] Total sum of number sequence"
description: "let's calculate the winning lottery probability"
date: 2024-04-22T09:12:56+09:00
author: subaru
authorEmoji: 🐙
tags:
  - algorithms
  - sequence
categories:
  - algorithms
  - computer-science
series:
  - アルゴリズム
image: images/feature2/sigma.png
---

When we encounter mathematical theories in everyday contexts, they can often be surprising. In mathematics, the symbol Σ, known as sigma, is used to denote summation. Sigma sums up a series of values, providing a concise way to express total sums within a specified range.

For instance, consider an initial value of 1 and a maximum value of 5. We incrementally add 1 starting from the initial value until we reach the maximum. The summation can be represented and calculated as follows:

![](https://storage.googleapis.com/zenn-user-upload/01a66f167fa8-20240422.png)

More generally, the formula for the sum of the first N integers is given by:

![](https://storage.googleapis.com/zenn-user-upload/c5441780e363-20240422.png)

And for the sum of the squares of the first N integers, the formula is:

![](https://storage.googleapis.com/zenn-user-upload/4fe645a726e3-20240429.png)

These formulas are pivotal in calculating expected values, which are crucial in probability analyses, such as deciding whether to participate in a lottery.

### Example Scenario: Lottery Decision

Suppose you are considering entering a lottery with an entry fee of 1000 yen. The prizes and their probabilities are as follows:

- 1st prize: 10 million yen with a probability of 1/10000
- 2nd prize: 500 thousand yen with a probability of 1/50000
- 3rd prize: 100 thousand yen with a probability of 1/10000
- 4th prize: 10 thousand yen with a probability of 1/1000
- 5th prize: 1000 yen with a probability of 1/100

The expected value is calculated by multiplying each prize by its probability and summing these products:

```jsx
100万円 * 1/100000 +
50万円 * 1/50000 +
10万円 * 1/10000 +
1万円 * 1/1000 +
1000円 * 1/100
= 1000 + 10 + 10 + 10 + 10
= 1040
```

This results in an expected value of 1040 yen. Since the expected value exceeds the entry fee (1040 > 1000), it is statistically advantageous to enter the lottery.

### GoLang Script for Sum and Sum of Squares

Below is a GoLang script that calculates the sum and sum of squares for a given maximum value \(N\):

```go
package main

import (
	"fmt"
)

func sumAndSumOfSquares(n int) (int, int) {
	sum := n * (n + 1) / 2
	sumOfSquares := n * (n + 1) * (2*n + 1) / 6
	return sum, sumOfSquares
}

func main() {
	n := 5
	sum, sumOfSquares := sumAndSumOfSquares(n)
	fmt.Println("Sum:", sum)
	fmt.Println("Sum of Squares:", sumOfSquares)
}

```

This script defines a function to compute the sum and sum of squares using the formulas previously mentioned and then executes these calculations for N = 5.

This approach and script offer a practical way to apply mathematical formulas in programming to solve real-world problems efficiently.

## Advanced Version

**Problem Statement:**
Subaru uses a six-faced pencil, each face labeled from 1 to 6, to randomly decide his answers for a series of questions. Depending on the question type, which can vary from having 3 to 5 possible answers, the roll of the pencil determines his selected answer based on specific rules:

- For a question with 3 possible answers:
  - Rolls of 1 or 4 select answer 1.
  - Rolls of 2 or 5 select answer 2.
  - Rolls of 3 or 6 select answer 3.
- For a question with 4 possible answers:
  - Roll of 1 selects answer 1.
  - Rolls of 2 or 5 select answer 2.
  - Rolls of 3 or 6 select answer 3.
  - Roll of 4 selects answer 4.
- For a question with 5 possible answers:
  - Rolls of 1 or 4 select answer 1.
  - Rolls of 2 or 5 select answer 2.
  - Roll of 3 selects answer 3.
  - Roll of 4 selects answer 4.
  - Roll of 6 selects answer 5.

Subaru needs to answer a total of 50 questions, with each question's number of possible answers randomly determined to be either 3, 4, or 5.

**GoLang Solution:**
This solution simulates answering 50 questions using the rules defined above. It randomly decides the number of answers for each question, rolls the dice, and selects the answer based on the roll.

```go
package main

import (
	"fmt"
	"math/rand"
	"time"
)

func rollPencil() int {
	return rand.Intn(6) + 1
}

// choose a selection from given numbers.
func selectAnswer(roll int, answers int) int {
	if answers == 3 {
		switch roll {
		case 1, 4:
			return 1
		case 2, 5:
			return 2
		case 3, 6:
			return 3
		}
	} else if answers == 4 {
		switch roll {
		case 1:
			return 1
		case 2, 5:
			return 2
		case 3, 6:
			return 3
		case 4:
			return 4
		}
	} else if answers == 5 {
		switch roll {
		case 1, 4:
			return 1
		case 2, 5:
			return 2
		case 3:
			return 3
		case 4:
			return 4
		case 6:
			return 5
		}
	}
	return 0 // Fallback
}

func main() {
	rand.Seed(time.Now().UnixNano())
	totalQuestions := 50

	for i := 1; i <= totalQuestions; i++ {
		answers := rand.Intn(3) + 3 // Randomly choose between 3, 4, or 5 answers
		roll := rollPencil()
		answerSelected := selectAnswer(roll, answers)
		fmt.Printf("Question %d (Type %d answers): Roll %d selects Answer %d\n", i, answers, roll, answerSelected)
	}
}

```
