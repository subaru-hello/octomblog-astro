---
title: "Anonymous functions are easier to read when converted to named functions."
description: "Good Code, Bad Code, Episode 5"
date: 2024-06-11T22:53:56+09:00
authorEmoji: 🐙
tags:
  - read-books
  - be-a-professional-developer
categories:
  - read-books
  - be-a-professional-developer
image: images/feature2/goodcode.jpeg
---

Since I started reading "Good Code, Bad Code," I've found a wealth of beneficial information. One key takeaway is how using named functions instead of anonymous functions can significantly improve readability. Here are some examples to illustrate this point.

### Example with Anonymous Functions

Consider the following code, which filters a list of election candidates to include only those from a specific party, sorts them by the number of votes, and maps them to a simplified object:

```jsx
const candidates = [
  { name: "Alice", votes: 3500, party: "PartyA" },
  { name: "Bob", votes: 4200, party: "PartyB" },
  { name: "Charlie", votes: 2900, party: "PartyA" },
  { name: "Dave", votes: 3100, party: "PartyC" },
];

const partyACandidates = candidates
  .filter((candidate) => candidate.party === "PartyA")
  .sort((a, b) => b.votes - a.votes)
  .map((candidate) => ({ name: candidate.name, votes: candidate.votes }));

console.log(partyACandidates);
```

### Named Functions

The same logic can be rewritten using named functions, enhancing readability and maintainability:

```jsx
const candidates = [
  { name: "Alice", votes: 3500, party: "PartyA" },
  { name: "Bob", votes: 4200, party: "PartyB" },
  { name: "Charlie", votes: 2900, party: "PartyA" },
  { name: "Dave", votes: 3100, party: "PartyC" },
];

const partyACandidates = candidates
  .filter(isFromPartyA)
  .sort(sortByVotesDesc)
  .map(extractCandidateInfo);

/**
 * @param {Object} candidate - The candidate object.
 * @returns {boolean} - True if the candidate belongs to "PartyA", false otherwise.
 */
function isFromPartyA(candidate) {
  return candidate.party === "PartyA";
}

/**
 * @param {Object} candidateA - The first candidate object.
 * @param {Object} candidateB - The second candidate object.
 * @returns {number} - A negative number if candidateB has more votes, a positive number if candidateA has more votes, or zero if they have the same number of votes.
 */
function sortByVotesDesc(candidateA, candidateB) {
  return candidateB.votes - candidateA.votes;
}

/**
 * @param {Object} candidate - The candidate object.
 * @returns {Object} - An object containing the name and votes of the candidate.
 */
function extractCandidateInfo(candidate) {
  return { name: candidate.name, votes: candidate.votes };
}

console.log(partyACandidates);
```

### Improvements with Named Functions

The modifications from using anonymous functions to named functions have improved the code in the following aspects:

1. **Readability**:
   - **Anonymous Functions**: Inline anonymous functions can obscure the purpose of each operation, making the main logic harder to follow.
   - **Named Functions**: Each named function clearly states its purpose, improving the readability of the main processing pipeline. It is immediately clear what each step is doing.
2. **Maintainability**:
   - **Anonymous Functions**: Any changes to the logic require modifying the inline code, which can be cumbersome and error-prone.
   - **Named Functions**: Named functions can be updated independently, making the codebase easier to maintain and extend.
3. **Reusability**:
   - **Anonymous Functions**: The logic encapsulated in anonymous functions cannot be reused easily.
   - **Named Functions**: Named functions like `isFromPartyA`, `sortByVotesDesc`, and `extractCandidateInfo` can be reused in other parts of the code, promoting code reuse.
4. **Debugging and Testing**:
   - **Anonymous Functions**: Debugging can be more difficult as the stack traces may not provide meaningful function names.
   - **Named Functions**: Named functions provide meaningful names in stack traces, aiding in debugging. Additionally, each function can be independently tested, ensuring the correctness of each part of the logic.

## Summary

By using named functions, the code becomes more readable, maintainable, reusable, and easier to debug and test.

## References

https://www.amazon.co.jp/-/en/Tom-Long/dp/4798068160
