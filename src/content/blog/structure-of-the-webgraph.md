---
title: "[Algorithm] The Structure Of The Web Graph"
date: 2024-06-03T07:58:52+09:00
description: "how does the structure of the web graph look like?"
draft: false
author: subaru
authorEmoji: 🐙
tags:
  - computer-science
  - algorithms
categories:
  - computer-science
  - algorithms
image: images/feature2/scc-web-graph.png
---

## Overview

The structure of the Web Graph can be understood through the application of a strongly connected components (SCC) graph algorithm.
In this context, vertices correspond to webpages, and edges correspond to hyperlinks between them.
Imagine a blog with numerous references to other blogs or webpages, and you'll have a good idea of how this graph is structured.

## Question

**What does the Web Graph look like?**

The Web Graph resembles a "Bow Tie." At the center is a giant SCC, often referred to as the "core of the web." This core is connected to smaller SCC components, which can be categorized as "IN" and "OUT" segments.

![Bow Tie Structure](https://storage.googleapis.com/zenn-user-upload/7526c7dd4a1d-20240603.png)

Additionally, there are "tubes" that allow for direct connections between the IN and OUT components, bypassing the core.

The web is vast and difficult to fully crawl. In the 21st century, it was estimated to contain almost 200 million nodes and 1 billion edges.

## Main Findings

1. All four parts (giant SCC, IN, OUT, tubes/tendrils) are roughly the same size.
2. Within the core, the graph is very well connected, exhibiting the "small world" property, also known as the six-degrees of separation phenomenon.
3. Outside the core, the graph becomes sparse.

## Examples of the Bow Tie Structure

**Example 1: Social Media Platforms**

- **IN:** New social media profiles or pages that link to established profiles but have not yet gained backlinks.
- **Core (Giant SCC):** Highly interconnected profiles and pages with numerous mutual links, such as popular influencers and major brands.
- **OUT:** Archived or inactive profiles that still receive links from the core but do not link back.
- **Tubes:** Promotional pages that link new profiles directly to older, established ones.
- **Tendrils:** Smaller niche groups or communities that link to the core but do not form part of the main interconnected network.

**Example 2: E-commerce Websites**

- **IN:** Newly launched product pages that link to popular products or categories but are not yet widely referenced.
- **Core (Giant SCC):** Major product categories and high-traffic product pages with many interlinks.
- **OUT:** Discontinued product pages that still receive traffic but do not link to other parts of the site.
- **Tubes:** Seasonal promotion pages that link new products directly to popular categories.
- **Tendrils:** Niche product pages that connect to the main categories but are not extensively linked.

## The Algorithm

### Step 1: Create a Graph

The first step in analyzing the Web Graph is to create a graph structure where each vertex represents a webpage and each edge represents a hyperlink.

### Step 2: Identify Strongly Connected Components (SCCs)

Using algorithms like Tarjan's or Kosaraju's, identify the SCCs within the graph. These are subsets of the graph where every vertex is reachable from every other vertex within the subset.

### Step 3: Categorize SCCs

Categorize the identified SCCs into the core (giant SCC), IN, OUT, tubes, and tendrils based on their connections:

- **Core (Giant SCC):** The largest SCC with the most interconnections.
- **IN:** SCCs that can reach the core but are not reachable from the core.
- **OUT:** SCCs that are reachable from the core but do not link back to the core.
- **Tubes:** Direct connections between IN and OUT that bypass the core.
- **Tendrils:** Smaller SCCs that either link to IN or OUT sections but do not form part of the main interconnected network.

### Step 4: Analyze and Visualize

Analyze the structure and visualize it using tools such as graph visualization software to better understand the layout and connectivity of the web.

---

## References

- [The Structure of the Web Graph](https://www.youtube.com/watch?v=7YodysGShlo&list=PLXFMmlk03Dt7Q0xr1PIAriY5623cKiH7V&index=53)
