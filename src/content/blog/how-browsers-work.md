---
title: "Understanding How Browsers Work"
description: "【Browsers】Fill your curiosity towards web technologies."
date: 2024-05-12T14:34:40+09:00
draft: false
author: subaru
authorEmoji: 🐙
tags:
  - frontend
  - mechanism
categories:
  - mechanism
image: images/feature2/browsers.jpeg
---

As a software engineer, diving into the mechanics behind web browsers has always piqued my curiosity.

It's fascinating to uncover the series of operations that transform a simple URL into the rich, interactive experiences we encounter daily on our screens.

## High-Level Overview

![](https://storage.googleapis.com/zenn-user-upload/44f62a25a19e-20240512.png)

The browser's journey can be broken down into several key stages:

- **Page Requesting**: Initiation of a request by entering a URL.
- **Parsing**: Tokenization and the creation of the DOM and CSSOM.
- **Rendering**: Building a render tree and layout processing.
- **Painting**: Final display of content on the screen.

## Journey of a Web Page

![](https://storage.googleapis.com/zenn-user-upload/0288f43fd014-20240512.png)

The browser's journey from URL input to content display involves several intricate steps:

- **DNS Lookup**: Initiates when you enter a URL. The browser requests a DNS server to resolve the domain to an IP address, which is necessary for establishing a connection.
- **TCP Connection and Slow Start**: To connect to the server, the browser establishes a TCP connection using a three-way handshake. The 'slow start' mechanism gradually increases data transmission rates to prevent congestion.

## DNS Lookup

When a URL is entered into the search bar, the browser requests a DNS server to find the corresponding IP address where the webpage is hosted. Upon retrieving the IP address, the browser initiates a TCP connection using a three-way handshake (SYN, SYN-ACK, ACK).

### TCP Connection and Slow Start

The TCP slow start is a mechanism to avoid network congestion by adjusting the rate of data transmission.

It uses a 'congestion window' (CWND) to control the number of packets sent.

Starting small, the CWND size doubles upon each successful ACK received, allowing the transmission rate to increase exponentially until maximum bandwidth capacity is reached or packet loss occurs, which then halves the CWIND, balancing data transmission efficiency.

## Parsing and DOM Construction

![](https://storage.googleapis.com/zenn-user-upload/072f89237253-20240512.png)

### Parsing and Rendering: The Core of Browser Mechanics

- **Parsing**: This is where the browser breaks down HTML and CSS into tokens to construct the DOM (Document Object Model) and CSSOM (CSS Object Model). Scripts may block parsing unless they are asynchronous or deferred.
- **Rendering**: The browser then builds a render tree from the DOM and CSSOM, calculates the layout (the exact position and dimensions of the content), and finally, paints the content on the screen.

### Parsing

![](https://storage.googleapis.com/zenn-user-upload/32a9551c94ee-20240512.png)

![](https://storage.googleapis.com/zenn-user-upload/a85424f39b7b-20240512.png)

The parsing process involves breaking down the HTML document into a structure that the browser can understand and interact with:

- **Tokenization**: This phase breaks down the syntax of HTML and CSS into tokens, which are the smallest meaningful components of the syntax.
- **Tree Construction**: Using the tokens, the browser builds a DOM tree, where each node represents an HTML element on the page. Simultaneously, a CSSOM tree is constructed that represents the CSS rules applied to the DOM.

![](https://storage.googleapis.com/zenn-user-upload/60f7a878c10d-20240512.png)

This phase is critical because errors during parsing can affect how the page is displayed.

Scripts can block parsing unless they have `async` or `defer` attributes, which allow the rest of the page to load without waiting for the script to finish.

## Rendering Process

The rendering process involves several steps to convert the DOM and CSSOM trees into a visible format that users can interact with on their screens.

![](https://storage.googleapis.com/zenn-user-upload/a85424f39b7b-20240512.png)

### Render Tree Construction

Once the DOM and CSSOM are built, the browser constructs a Render Tree by combining DOM nodes with their corresponding CSSOM rules.

The Render Tree only includes nodes that affect the way the content is displayed on the screen. (however, an element with `visibility: hidden` is in the layout tree).

### Layout

During the Layout phase, the browser calculates the exact position and dimensions of the content as it should appear on the screen.

This stage involves calculating the layout of every visible element and is often referred to as "reflow."

Layout is computationally intensive as it involves calculating the size and position of each element and can be triggered often if elements change size or position after the initial layout.

## Painting and Interactivity: Bringing Pages to Life

- **Painting**: After layout calculations, the browser paints the content on the screen, drawing text, colors, images, and other visual elements.
- **Interactivity**: Post-painting, the browser handles user inputs and dynamic scripts. This includes processing events like clicks and scrolls, executing JavaScript, and managing animations. Efficient handling ensures the page remains responsive and updates appear seamlessly.

Once the first chunk of data arrives at the browser, it starts parsing data into a DOM or CSSOM which is used for page rendering.

### Painting

![](https://storage.googleapis.com/zenn-user-upload/02b28b9ef674-20240512.png)

(image from [**Inside look at modern web browser (part 3)**](https://developer.chrome.com/blog/inside-browser-part3) )

Painting is the process where the final visual representation of the page is created. The browser fills out the pixels in the frame buffer with the visual content of each Render Tree node. This step involves drawing text, colors, images, borders, and other visual elements onto the screen.

Turning this information into pixels on the screen is called rasterizing

### Interactivity

After the painting process, the browser enters the interactivity phase where it handles user inputs and scripts that modify the page dynamically.

This stage is critical for a responsive user experience.

- **Event Handling**: The browser listens for user actions such as clicks, scrolls, and keyboard inputs. Event listeners trigger JavaScript functions that may manipulate the DOM or initiate other actions that change the page content or appearance.
- **Script Execution**: JavaScript that modifies the DOM or CSSOM after the initial page load can lead to additional rendering cycles. Scripts may be deferred or loaded asynchronously to minimize their impact on the initial page load speed.
- **Updates and Reflows**: Any change to the DOM or CSSOM typically requires a reflow and repaint. The browser optimizes this process by batching DOM changes and minimizing the number of reflows and repaints.
- **Animation and Frame Rendering**: For animations and ongoing visual updates, browsers optimize rendering to occur at a steady rate, usually matching the display refresh rate (commonly 60 frames per second). This is managed through APIs like `requestAnimationFrame`, which helps to synchronize visual changes with the display hardware.

By effectively managing these interactions, the browser ensures that the page remains responsive and that updates appear smooth and timely, enhancing the overall user experience.

## **Compositing: The Final Phase**

After the browser has painted the visual elements, it enters the compositing phase.

This is where the browser optimizes the page's layers for smooth animations and transitions called rustering.

Compositing allows the browser to manipulate visual elements efficiently without repainting, by using layers that can be independently drawn.

Compositing works at a Compositor thread, so it works behind a main thread, which means it does not need to wait on style calculation or JavaScript execution.

If layout or paint needs to be calculated again then the main thread has to be involved

This is crucial for performance, especially for complex animations and effects that involve moving elements or changing styles.

By handling these changes through layer manipulation rather than direct redrawing, the browser minimizes resource usage and enhances the responsiveness of the page.

## Conclusion

The entire process, from DNS lookups and TCP handshakes to parsing, rendering, and interactivity, reveals the complexity behind seemingly instantaneous web interactions. This knowledge not only demystifies browsing but also aids in optimizing web applications for better performance and user experience.

Understanding these foundational elements enriches our appreciation for the technology and its continuous evolution, enhancing our capabilities as developers to create better web solutions.

## References

[ttps://www.chromium.org/developers/the-rendering-critical-path/](https://www.chromium.org/developers/the-rendering-critical-path/)

https://developer.chrome.com/blog/inside-browser-part3

https://developer.mozilla.org/en-US/docs/Web/Performance/How_browsers_work

https://youtu.be/SmE4OwHztCc?feature=shared

https://youtu.be/0IsQqJ7pwhw?feature=shared
