---
title: "年末年始だし、Learn Reactに書かれたTipsを吟味するか"
date: 2025-01-03T22:23:28+09:00
image: images/feature2/react-paint.png
---

年末年始に予定が入ってなくて時間が有り余っているので、積読していた[Learn React](https://react.dev/learn) を一通り目を通して重要な部分を抜粋しました。ところどころChatGPTに手伝ってもらってます。Go言語100Tipsに出てきていた単語（race conditionや参照値は違う値として評価される）がちらほらReactにも出てきてました。

### **Render and Commit**

![](https://storage.googleapis.com/zenn-user-upload/1f7b24bbf90f-20250103.png)

![](https://storage.googleapis.com/zenn-user-upload/7eb2ed337f54-20250103.png)

1. **Triggering** a render (delivering the guest’s order to the kitchen)
2. **Rendering** the component (preparing the order in the kitchen)
3. **Committing** to the DOM (placing the order on the table)

### Trigger

it’s done by calling [`createRoot`](https://react.dev/reference/react-dom/client/createRoot) with the target DOM node, and then calling its `render` method with your component.

### Render

**“Rendering” is React calling your components.**

- **On initial render,** React will call the root component.
- **For subsequent renders,** React will call the function component whose state update triggered the render.

### Commit

After rendering (calling) your components, React will modify the DOM.

- **For the initial render,** React will use the [`appendChild()`](https://developer.mozilla.org/docs/Web/API/Node/appendChild) DOM API to put all the DOM nodes it has created on screen.
- **For re-renders,** React will apply the minimal necessary operations (calculated while rendering!) to make the DOM match the latest rendering output.

**React only changes the DOM nodes if there’s a difference between renders.**

### **Browser paint**

![](https://storage.googleapis.com/zenn-user-upload/4716c639e661-20250103.png)

https://react.dev/learn/render-and-commit#step-1-trigger-a-render

## **State as a Snapshot**

### React re-renders Logic

When React re-renders a component:

1. React calls your function again.
2. Your function returns a new JSX snapshot.
3. React then updates the screen to match the snapshot your function returned.

![](https://storage.googleapis.com/zenn-user-upload/142de8f244b0-20250103.png)

![](https://storage.googleapis.com/zenn-user-upload/7738adda397c-20250103.png)

### **Setting state only changes it for the *next* render**

so, this increments just one, even though you wanted to increment 3.

```tsx
<button onClick={() => {
        setNumber(number + 1);
        setNumber(number + 1);
        setNumber(number + 1);
      }}>+3</button>
```

Here is what this button’s click handler tells React to do:

1. `setNumber(number + 1)`: `number` is `0`so `setNumber(0 + 1)`.
    - React prepares to change `number` to `1` on the next render.
2. `setNumber(number + 1)`: `number` is `0`so `setNumber(0 + 1)`.
    - React prepares to change `number` to `1` on the next render.
3. `setNumber(number + 1)`: `number` is `0`so `setNumber(0 + 1)`.
    - React prepares to change `number` to `1` on the next render.

Instead, you need to pass a *function* that calculates the next state based on the previous one in the queue, like `setNumber(n => n + 1)`. It is a way to tell React to “do something with the state value” instead of just replacing it.

```tsx
<button onClick={() => {
        setNumber(n => n + 1);
        setNumber(n => n + 1);
        setNumber(n => n + 1);
    }}>+3</button>
```

https://react.dev/learn/state-as-a-snapshot

## **Optimizing Performance**

described about tools help findinding out bottlenecks and faster building(transpiling) way such as Rollup, Browselify, Webpack.

https://legacy.reactjs.org/docs/optimizing-performance.html

### **Controlled and uncontrolled components**

It is common to call a component with some local state “uncontrolled”

In contrast, you might say a component is “controlled” when the important information in it is driven by props rather than its own local state. This lets the parent component fully specify its behavior.

When writing a component, consider which information in it should be controlled (via props), and which information should be uncontrolled (via state)

https://react.dev/learn/sharing-state-between-components#controlled-and-uncontrolled-components

## **Preserving and Resetting State**

> Remember that **it’s the position in the UI tree—not in the JSX markup—that matters to React!** This component has two `return` clauses with different `<Counter />` JSX tags inside and outside the `if`:
> 

```tsx
import { useState } from 'react';

export default function App() {
  const [isFancy, setIsFancy] = useState(false);
  if (isFancy) {
    return (
      <div>
        <Counter isFancy={true} />
        <label>
          <input
            type="checkbox"
            checked={isFancy}
            onChange={e => {
              setIsFancy(e.target.checked)
            }}
          />
          Use fancy styling
        </label>
      </div>
    );
  }
  return (
    <div>
      <Counter isFancy={false} />
      <label>
        <input
          type="checkbox"
          checked={isFancy}
          onChange={e => {
            setIsFancy(e.target.checked)
          }}
        />
        Use fancy styling
      </label>
    </div>
  );
}

function Counter({ isFancy }) {
  const [score, setScore] = useState(0);
  const [hover, setHover] = useState(false);

  let className = 'counter';
  if (hover) {
    className += ' hover';
  }
  if (isFancy) {
    className += ' fancy';
  }

  return (
    <div
      className={className}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <h1>{score}</h1>
      <button onClick={() => setScore(score + 1)}>
        Add one
      </button>
    </div>
  );
```

You might expect the state to reset when you tick checkbox, but it doesn’t! 

This is because **both of these `<Counter />` tags are rendered at the same position.** 

React doesn’t know where you place the conditions in your function. 

All it “sees” is the tree you return.

In both cases, the `App` component returns a `<div>` with `<Counter />` as a first child. To React, these two counters have the same “address”: the first child of the first child of the root. This is how React matches them up between the previous and next renders, regardless of how you structure your logic.

https://react.dev/learn/preserving-and-resetting-state

Also, **when you render a different component in the same position, it resets the state of its entire subtree.** 

<aside>
💡

This is why you should not nest component function definitions.

Here, the `MyTextField` component function is defined *inside* `MyComponent`:

</aside>

```tsx
import { useState } from 'react';

export default function MyComponent() {
  const [counter, setCounter] = useState(0);

  function MyTextField() {
    const [text, setText] = useState('');

    return (
      <input
        value={text}
        onChange={e => setText(e.target.value)}
      />
    );
  }

  return (
    <>
      <MyTextField />
      <button onClick={() => {
        setCounter(counter + 1)
      }}>Clicked {counter} times</button>
    </>
  );
}

```

<aside>
💡

Every time you click the button, the input state disappears! This is because a *different* `MyTextField` function is created for every render of `MyComponent`. You’re rendering a *different* component in the same position, so React resets all state below. This leads to bugs and performance problems. To avoid this problem, **always declare component functions at the top level, and don’t nest their definitions.**

</aside>

Here, `n => n + 1` is called an **updater function.** When you pass it to a state setter:

1. React queues this function to be processed after all the other code in the event handler has run.
2. During the next render, React goes through the queue and gives you the final updated state.

`setNumber(n => n + 1);`

`setNumber(n => n + 1);`

`setNumber(n => n + 1);`

https://react.dev/learn/queueing-a-series-of-state-updates

# **What happens if you update state after replacing it**

What about this event handler? What do you think `number` will be in the next render?

```tsx
<button onClick={() => {
  setNumber(number + 5);
  setNumber(n => n + 1);
}}>
```

Here’s what this event handler tells React to do:

1. `setNumber(number + 5)`: `number` is `0`, so `setNumber(0 + 5)`. React adds *“replace with `5`”* to its queue.
2. `setNumber(n => n + 1)`: `n => n + 1` is an updater function. React adds *that function* to its queue.

![](https://storage.googleapis.com/zenn-user-upload/3827901760b1-20250103.png)

https://react.dev/learn/queueing-a-series-of-state-updates#what-happens-if-you-update-state-after-replacing-it

### **What happens if you replace state after updating it**

Here’s how React works through these lines of code while executing this event handler:

1. `setNumber(number + 5)`: `number` is `0`, so `setNumber(0 + 5)`. React adds *“replace with `5`”* to its queue.
2. `setNumber(n => n + 1)`: `n => n + 1` is an updater function. React adds *that function* to its queue.
3. `setNumber(42)`: React adds *“replace with `42`”* to its queue.

```tsx
<button onClick={() => {
  setNumber(number + 5);
  setNumber(n => n + 1);
  setNumber(42);
}}>
```

![](https://storage.googleapis.com/zenn-user-upload/4efb2edf4524-20250103.png)

https://react.dev/learn/queueing-a-series-of-state-updates#what-happens-if-you-replace-state-after-updating-it

### Strict Mode

In Strict Mode, React will run each updater function twice (but discard the second result) to help you find mistakes.

### **Treat state as read-only**

you should **treat any JavaScript object that you put into state as read-only.**

NO

```tsx

import { useState } from 'react';

export default function MovingDot() {
  const [position, setPosition] = useState({
    x: 0,
    y: 0
  });
onPointerMove={e => {
  position.x = e.clientX;
  position.y = e.clientY;
}}
```

OK

With `setPosition`, you’re telling React:

- Replace `position` with this new object
- And render this component again

```tsx
onPointerMove={e => {
  setPosition({
    x: e.clientX,
    y: e.clientY
  });
}}
```

https://react.dev/learn/updating-objects-in-state#treat-state-as-read-only

### Deep Dive

But code like this is **absolutely fine** because you’re mutating a fresh object you have *just created*:

`const nextPosition = {};`

`nextPosition.x = e.clientX;`

`nextPosition.y = e.clientY;`

`setPosition(nextPosition);`

In fact, it is completely equivalent to writing this:

`setPosition({  x: e.clientX,  y: e.clientY});`

Mutation is only a problem when you change *existing* objects that are already in state. Mutating an object you’ve just created is okay because *no other code references it yet.* Changing it isn’t going to accidentally impact something that depends on it. This is called a “local mutation”. 

```tsx
  const [person, setPerson] = useState({
    firstName: 'Barbara',
    lastName: 'Hepworth',
    email: 'bhepworth@sculpture.com'
  });

  function handleFirstNameChange(e) {
    setPerson({
      ...person,
      firstName: e.target.value
    });
  }

  function handleLastNameChange(e) {
    setPerson({
      ...person,
      lastName: e.target.value
    });
  }

  function handleEmailChange(e) {
    setPerson({
      ...person,
      email: e.target.value
    });
  }
```

```tsx
  const [person, setPerson] = useState({
    firstName: 'Barbara',
    lastName: 'Hepworth',
    email: 'bhepworth@sculpture.com'
  });

  function handleChange(e) {
    setPerson({
      ...person,
      [e.target.name]: e.target.value
    });
  }
```

### **Write concise update logic with Immer**

If your state is deeply nested, you might want to consider [flattening it.](https://react.dev/learn/choosing-the-state-structure#avoid-deeply-nested-state) But, if you don’t want to change your state structure, you might prefer a shortcut to nested spreads. [Immer](https://github.com/immerjs/use-immer) is a popular library that lets you write using the convenient but mutating syntax and takes care of producing the copies for you. With Immer, the code you write looks like you are “breaking the rules” and mutating an object:

```tsx
import { useImmer } from 'use-immer';

export default function Form() {
  const [person, updatePerson] = useImmer({
    name: 'Niki de Saint Phalle',
    artwork: {
      title: 'Blue Nana',
      city: 'Hamburg',
      image: 'https://i.imgur.com/Sd1AgUOm.jpg',
    }
  });

  function handleNameChange(e) {
    updatePerson(draft => {
      draft.name = e.target.value;
    });
  }

  function handleTitleChange(e) {
    updatePerson(draft => {
      draft.artwork.title = e.target.value;
    });
  }

  function handleCityChange(e) {
    updatePerson(draft => {
      draft.artwork.city = e.target.value;
    });
  }

  function handleImageChange(e) {
    updatePerson(draft => {
      draft.artwork.image = e.target.value;
    });
  }

```

https://react.dev/learn/updating-objects-in-state#write-concise-update-logic-with-immer

　

### **Making other changes to an array**

you may want to reverse or sort an array. The JavaScript `reverse()` and `sort()` methods are mutating the original array, so you can’t use them directly.

**However, you can copy the array first, and then make changes to it.**

```tsx
  const [list, setList] = useState(initialList);

  function handleClick() {
    const nextList = [...list];
    nextList.reverse();
    setList(nextList);
  }
```

now that the original array has copied, you can do sort or reverse or any array handling to the nextList. It does not affect the original array. 

However, **even if you copy an array, you can’t mutate existing items *inside* of it directly.** This is because copying is shallow—the new array will contain the same items as the original one. So if you modify an object inside the copied array, you are mutating the existing state. 

```tsx
const nextList = [...list];
nextList[0].seen = true; // Problem: mutates list[0]
setList(nextList);
```

Although `nextList` and `list` are two different arrays, **`nextList[0]` and `list[0]` point to the same object.** So by changing `nextList[0].seen`, you are also changing `list[0].seen`. 

**When updating nested state, you need to create copies from the point where you want to update, and all the way up to the top level.**

**You can use `map` to substitute an old item with its updated version without mutation.**

❌NO

```tsx
  
  const initialList = [
  { id: 0, title: 'Big Bellies', seen: false },
  { id: 1, title: 'Lunar Landscape', seen: false },
  { id: 2, title: 'Terracotta Army', seen: true },
];

export default function BucketList() {
  const [myList, setMyList] = useState(initialList);
  const [yourList, setYourList] = useState(
    initialList
  );

  function handleToggleMyList(artworkId, nextSeen) {
    const myNextList = [...myList];
    const artwork = myNextList.find(
      a => a.id === artworkId
    );
    artwork.seen = nextSeen;
    setMyList(myNextList);
  }
```

✅OK

```tsx
const initialList = [
  { id: 0, title: 'Big Bellies', seen: false },
  { id: 1, title: 'Lunar Landscape', seen: false },
  { id: 2, title: 'Terracotta Army', seen: true },
];

export default function BucketList() {
  const [myList, setMyList] = useState(initialList);
  const [yourList, setYourList] = useState(
    initialList
  );

  function handleToggleMyList(artworkId, nextSeen) {
    setMyList(myList.map(artwork => {
      if (artwork.id === artworkId) {
        // Create a *new* object with changes
        return { ...artwork, seen: nextSeen };
      } else {
        // No changes
        return artwork;
      }
    }));
  }

```

https://react.dev/learn/updating-arrays-in-state#making-other-changes-to-an-array

## **Referencing Values with Refs**

When you want a component to “remember” some information, but you don’t want that information to [trigger new renders](https://react.dev/learn/render-and-commit), you can use a *ref*.

`const ref = useRef(0);`

`useRef` returns an object like this:

`{`

　　`current: 0 // The value you passed to useRef`

`}`

 It’s like a secret pocket of your component that React doesn’t track. (This is what makes it an “escape hatch” from React’s one-way data flow—more on that below!)

Unlike state, ref is a plain JavaScript object with the `current` property that you can read and modify.

Note that **the component doesn’t re-render with every increment.** Like state, refs are retained by React between re-renders. However, setting state re-renders a component. Changing a ref does not!

https://react.dev/learn/referencing-values-with-refs

### **Differences between refs and state**

- **State**

<aside>
💡

値が変化したときに再レンダリングが必要なデータを管理する

</aside>

例: ユーザーが入力したテキスト、タイマーの残り時間、チェックボックスのオン／オフなど

setState（あるいは useState で得た setter）を呼び出すと、React はコンポーネントを再描画する

- **Ref**

<aside>
💡

値が変化しても再レンダリングを引き起こす必要がないデータを管理する

</aside>

DOM 要素への直接アクセスや、一時的に記憶しておきたいが描画には使わない値を保持したい場合などに利用する

例: フォーム入力要素へのフォーカス管理、再描画不要なタイマーの識別子(ID)の保持など

**まとめ**

**UI に反映される情報**（表示すべきテキストや数字・画面表示の ON/OFF に影響する値など）は State へ

**UI に直接関係ない情報**（描画には影響せず、一時的に保持しておきたい値や DOM へのアクセスが目的の場合など）は Ref へ

https://react.dev/learn/referencing-values-with-refs#differences-between-refs-and-state

### **How does useRef work inside?**

you can think of it as a regular state variable without a setter. If you’re familiar with object-oriented programming, refs might remind you of instance fields—but instead of `this.something` you write `somethingRef.current`

```tsx
// Inside of React
function useRef(initialValue) {
  const [ref, unused] = useState({ current: initialValue });
  return ref;
}
```

https://react.dev/learn/referencing-values-with-refs#how-does-use-ref-work-inside

### **Best practices for refs**

make your components more predictable enable you to create less bugs.

- **Treat refs as an escape hatch.** Refs are useful when you work with external systems or browser APIs
- **Don’t read or write `ref.current`during rendering.** If some information is needed during rendering, use [state](https://react.dev/learn/state-a-components-memory)instead. Since React doesn’t know when `ref.current` changes, even reading it while rendering makes your component’s behavior difficult to predict. (The only exception to this is code like `if (!ref.current) ref.current = new Thing()` which only sets the ref once during the first render.)

But when you mutate the current value of a ref, it changes immediately:

```tsx
ref.current = 5;
console.log(ref.current); // 5
```

### Manipulate DOM with Ref

```tsx
export default function CatFriends() {
  const firstCatRef = useRef(null);
　 
  function handleScrollToFirstCat() {
    firstCatRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center'
    });
  }
  return (
    <>
      <nav>
        <button onClick={handleScrollToFirstCat}>
          Neo
        </button>
      </nav>
      <div>
        <ul>
          <li>
            <img
              src="https://placecats.com/neo/300/200"
              alt="Neo"
              ref={firstCatRef}
            />
          </li>
        </ul>
      </div>
    </>
  );
}

```

https://react.dev/learn/manipulating-the-dom-with-refs

### **How to manage a list of refs using a ref callback**

```tsx
<ul>
  {items.map((item) => {
    // Doesn't work!
    const ref = useRef(null);
    return <li ref={ref} />;
  })}
</ul>
```

This is because **Hooks must only be called at the top-level of your component.** You can’t call `useRef` in a loop, in a condition, or inside a `map()` call.

solution is to **pass a function to the `ref` attribute.**

```tsx
// get ref so as to scrollto desired DOM
  function scrollToCat(cat) {
    const map = getMap();
    const node = map.get(cat);
    node.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }

  function getMap() {
    if (!itemsRef.current) {
      // Initialize the Map on first usage.
      itemsRef.current = new Map();
    }
    return itemsRef.current;
  }

// set refs
<li
  key={cat.id}
  ref={node => {
    const map = getMap();
    // Add to the Map
    map.set(cat, node);

    return () => {
      // Remove from the Map
      map.delete(cat);
    };
  }}
>
```

In this example, `itemsRef` doesn’t hold a single DOM node. Instead, it holds a [Map](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Map) from item ID to a DOM node. ([Refs can hold any values!](https://react.dev/learn/referencing-values-with-refs)) The [`ref` callback](https://react.dev/reference/react-dom/components/common#ref-callback) on every list item takes care to update the Map:

https://react.dev/learn/manipulating-the-dom-with-refs#how-to-manage-a-list-of-refs-using-a-ref-callback

## **Synchronizing with Effects**

Every time your component renders, React will update the screen *and then* run the code inside `useEffect`. In other words, **`useEffect` “delays” a piece of code from running until that render is reflected on the screen.**

```tsx
import { useEffect, useRef } from 'react';

function VideoPlayer({ src, isPlaying }) {
  const ref = useRef(null);

  useEffect(() => {
    if (isPlaying) {
      ref.current.play();
    } else {
      ref.current.pause();
    }
  });

  return <video ref={ref} src={src} loop playsInline />;
}
```

By wrapping the DOM update in an Effect, you let React update the screen first. Then your Effect runs.

https://react.dev/learn/synchronizing-with-effects

## **You Might Not Need an Effect**

### **How to remove unnecessary Effects**

```tsx
function Form() {
  const [firstName, setFirstName] = useState('Taylor');
  const [lastName, setLastName] = useState('Swift');
  // ✅ Good: calculated during rendering
  const fullName = firstName + ' ' + lastName;
  // ...
}
```

https://react.dev/learn/you-might-not-need-an-effect#how-to-remove-unnecessary-effects

### **Caching expensive calculations**

**When something can be calculated from the existing props or state, [don’t put it in state.](https://react.dev/learn/choosing-the-state-structure#avoid-redundant-state) Instead, calculate it during rendering**

You can cache (or [“memoize”](https://en.wikipedia.org/wiki/Memoization)) an expensive calculation by wrapping it in a [`useMemo`](https://react.dev/reference/react/useMemo) Hook:

```tsx
import { useMemo, useState } from 'react';

function TodoList({ todos, filter }) {
  const [newTodo, setNewTodo] = useState('');
  // ✅ Does not re-run getFilteredTodos() unless todos or filter change
  const visibleTodos = useMemo(() => getFilteredTodos(todos, filter), [todos, filter]);
  // ...
}
```

**This tells React that you don’t want the inner function to re-run unless either `todos` or `filter` have changed**

https://react.dev/learn/you-might-not-need-an-effect#caching-expensive-calculations

### **Sharing logic between event handlers**

**When you’re not sure whether some code should be in an Effect or in an event handler, ask yourself *why* this code needs to run. Use Effects only for code that should run *because* the component was displayed to the user.**

The below code should be avoided because generally notifications appear because the user *pressed the button*, not because the page was displayed!

```tsx
function ProductPage({ product, addToCart }) {
  // 🔴 Avoid: Event-specific logic inside an Effect
  useEffect(() => {
    if (product.isInCart) {
      showNotification(`Added ${product.name} to the shopping cart!`);
    }
  }, [product]);

  function handleBuyClick() {
    addToCart(product);
  }

  function handleCheckoutClick() {
    addToCart(product);
    navigateTo('/checkout');
  }
```

```tsx
function ProductPage({ product, addToCart }) {
  // ✅ Good: Event-specific logic is called from event handlers
  function buyProduct() {
    addToCart(product);
    showNotification(`Added ${product.name} to the shopping cart!`);
  }

  function handleBuyClick() {
    buyProduct();
  }

  function handleCheckoutClick() {
    buyProduct();
    navigateTo('/checkout');
  }
  // ..
```

<aside>
💡

When you choose whether to put some logic into an event handler or an Effect, the main question you need to answer is *what kind of logic* it is from the user’s perspective. If this logic is caused by a particular interaction, keep it in the event handler. If it’s caused by the user *seeing* the component on the screen, keep it in the Effect.

</aside>

https://react.dev/learn/you-might-not-need-an-effect#sharing-logic-between-event-handlers

### **Initializing the application**

Sometimes you attempted to load auth information at the first amounting phaze. It is intended to be called once but indeed twice in development mode, so it should be avoided.

```tsx
function App() {
  // 🔴 Avoid: Effects with logic that should only ever run once
  useEffect(() => {
    loadDataFromLocalStorage();
    checkAuthToken();
  }, []);
  // ...
}
```

```tsx
if (typeof window !== 'undefined') { // Check if we're running in the browser.
   // ✅ Only runs once per app load
  checkAuthToken();
  loadDataFromLocalStorage();
}

function App() {
  // ...
}
```

https://react.dev/learn/you-might-not-need-an-effect#initializing-the-application

### **Fetching data**

```tsx
function SearchResults({ query }) {
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    // 🔴 Avoid: Fetching without cleanup logic
    fetchResults(query, page).then(json => {
      setResults(json);
    });
  }, [query, page]);

  function handleNextPageClick() {
    setPage(page + 1);
  }
```

there is no guarantee about which order the responses will arrive in. For example, the `"hell"` response may arrive *after* the `"hello"` response. Since it will call `setResults()` last, you will be displaying the wrong search results

This is called a [“race condition”](https://en.wikipedia.org/wiki/Race_condition): two different requests “raced” against each other and came in a different order than you expected

**To fix the race condition, you need to [add a cleanup function](https://react.dev/learn/synchronizing-with-effects#fetching-data) to ignore stale responses:**

```tsx
function SearchResults({ query }) {
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  useEffect(() => {
    let ignore = false; // 最後に行われたリクエスト以外無視するためにクリーンアップ関数を入れる
    fetchResults(query, page).then(json => {
      if (!ignore) {
        setResults(json);
      }
    });
    return () => {
      ignore = true;
    };
  }, [query, page]);

  function handleNextPageClick() {
    setPage(page + 1);
  }
  // ..
```

https://react.dev/learn/you-might-not-need-an-effect#fetching-data

https://react.dev/learn/you-might-not-need-an-effect

## **Lifecycle of Reactive Effects**

Effects has only two life event in the lifecycle, to start synchronizing something, and later to stop synchronizing it .

```tsx
const serverUrl = 'https://localhost:1234';

function ChatRoom({ roomId }) {
  useEffect(() => {
    const connection = createConnection(serverUrl, roomId);
    // Your Effect’s body specifies how to start synchronizing:
    connection.connect();
    
    // how to stop synchronizing
    return () => {
      connection.disconnect();
    };
  }, [roomId]);
  // ...
}
```

### **How React re-synchronizes your Effect**

Recall that your `ChatRoom` component has received a new value for its `roomId` prop. It used to be `"general"`, and now it is `"travel"`. React needs to re-synchronize your Effect to re-connect you to a different room.

To **stop synchronizing,** React will call the cleanup function that your Effect returned after connecting to the `"general"` room. Since `roomId` was `"general"`, the cleanup function disconnects from the `"general"` room:

```tsx
function ChatRoom({ roomId /* "general" */ }) {
  useEffect(() => {
    const connection = createConnection(serverUrl, roomId); // Connects to the "general" room
    connection.connect();
    return () => {
      connection.disconnect(); // Disconnects from the "general" room
    };
    // ...
```

<aside>
💡

**All you need to do is to describe how to start synchronization and how to stop it. If you do it well, your Effect will be resilient to being started and stopped as many times as it’s needed.**

</aside>

**UI 視点**: 「コンポーネントに何を表示するか」「状態がどう変わったら UI がどう変わるか」を考える

**Effect 視点**: 「外部のリソースやサブスクライブをいつ開始し、いつ終わらせるか」「結果をどうコンポーネントに反映させるか」を考える

https://react.dev/learn/lifecycle-of-reactive-effects#how-react-re-synchronizes-your-effect

```tsx
function ChatRoom({ roomId }) {
  useEffect(() => {
    logVisit(roomId);
  }, [roomId]);

  useEffect(() => {
    const connection = createConnection(serverUrl, roomId);
    // ...
  }, [roomId]);
  // ...
}
```

This is why you should think whether the processes are same or separate, not whether the code looks cleaner.

**A mutable value like [`location.pathname`](https://developer.mozilla.org/en-US/docs/Web/API/Location/pathname) can’t be a dependency.** It’s mutable, so it can change at any time completely outside of the React rendering data flow

### **Declaring an Effect Event**

Use a special Hook called [`useEffectEvent`](https://react.dev/reference/react/experimental_useEffectEvent) to extract this non-reactive logic out of your Effect:

```tsx
function ChatRoom({ roomId, theme }) {
  const onConnected = useEffectEvent(() => {
    showNotification('Connected!', theme);
  });

  useEffect(() => {
    const connection = createConnection(serverUrl, roomId);
    connection.on('connected', () => {
      onConnected();
    });
    connection.connect();
    return () => connection.disconnect();
  }, [roomId]); // ✅ All dependencies declared
  // ...
```

https://react.dev/learn/lifecycle-of-reactive-effects

### **Is your Effect doing several unrelated things?**

**The problem with this code is that you’re synchronizing two different unrelated things:**

1. You want to synchronize the `cities`state to the network based on the `country` prop.
2. You want to synchronize the `areas`state to the network based on the `city`state.

```tsx
function ShippingForm({ country }) {
  const [cities, setCities] = useState(null);
  useEffect(() => {
    let ignore = false;
    fetch(`/api/cities?country=${country}`)
      .then(response => response.json())
      .then(json => {
        if (!ignore) {
          setCities(json);
        }
      });
    return () => {
      ignore = true;
    };
  }, [country]); // ✅ All dependencies declared

  const [city, setCity] = useState(null);
  const [areas, setAreas] = useState(null);
  useEffect(() => {
    if (city) {
      let ignore = false;
      fetch(`/api/areas?city=${city}`)
        .then(response => response.json())
        .then(json => {
          if (!ignore) {
            setAreas(json);
          }
        });
      return () => {
        ignore = true;
      };
    }
  }, [city]); // ✅ All dependencies declared

```

https://react.dev/learn/removing-effect-dependencies#is-your-effect-doing-several-unrelated-things

### **Does some reactive value change unintentionally?**

**コンポーネントが再レンダリングされるたびに新しいオブジェクトが毎回生成されることによって、依存配列に含めているオブジェクトが「前回と別物」とみなされてしまう。**

1.	**再レンダリングのたびにオブジェクトを作り直している**

たとえば、

```tsx
function ChatRoom() {

const options = {
 */* ...設定いろいろ... */*
};
}
```

このようにコンポーネントの中で {} を使って毎回オブジェクトを生成していると、レンダリングが起こるたびに「新しいオブジェクト」が作られます。

2.	**同じ中身でも“別オブジェクト”扱いになる**

JavaScript では、オブジェクトや関数の「実体（リファレンス）」が重要です。

見た目（中身）が同じでも、毎回 new や {} を使って作ったオブジェクトは**別のもの**として扱われます。

3.	**Effect の依存に含めていると、毎回“変更あり”と判定される**

もし useEffect の依存配列 ([options] のような箇所) にこのオブジェクトを入れている場合、React は「前回のオブジェクトと今回のオブジェクトが違う！」と判断します。

すると「依存が更新された」とみなされ、毎回 useEffect の処理が走ってしまい、再接続などの“副作用”が都度発生してしまいます。

Reactは前回のrenderと次のrenderをObject.isで比較している。

```tsx
// During the first render
const options1 = { serverUrl: 'https://localhost:1234', roomId: 'music' };

// During the next render
const options2 = { serverUrl: 'https://localhost:1234', roomId: 'music' };

// These are two different objects!
console.log(Object.is(options1, options2)); // false
```

In JavaScript, numbers and strings are compared by their content:

```tsx
// During the first render
const roomId1 = 'music';

// During the next render
const roomId2 = 'music';

```

**どう対策する？**

1.	**useMemo や useCallback を活用**

たとえばオブジェクトを useMemo でメモ化すると、依存関係に変化がない限り、同じオブジェクト参照を使いまわします。

```tsx
const options = useMemo(() => {

return { */* ...設定いろいろ... */* };

}, [*/* 変わり得る値 */*]);
```

2.	**オブジェクトを外で定義してしまう**

状況によっては、コンポーネントの外側で定義して同じ参照を使う。

ただし、外に出すと可変データの場合は同期が難しくなるので注意が必要。

3.	**依存配列にオブジェクトそのものを入れない**

依存関係が複雑になる場合は、実際に変わっているプロパティだけを依存配列に含めるなどの工夫をする。

https://react.dev/learn/removing-effect-dependencies#does-some-reactive-value-change-unintentionally

### **Read primitive values from objects**

When you receive an object as a prop, do not add it to the dependency array with it causes chat room re-connction when a parent re-rendered. This is because JS see object as different one even its content is same.

```tsx
<ChatRoom
  roomId={roomId}
  options={{
    serverUrl: serverUrl,
    roomId: roomId
  }}
/>

function ChatRoom({ options }) {
  const [message, setMessage] = useState('');

  useEffect(() => {
    const connection = createConnection(options);
    connection.connect();
    return () => connection.disconnect();
  }, [options]); // ✅ All dependencies declared
  // ...
```

To avoid re-connection, read information from the object *outside* the Effect

```tsx
function ChatRoom({ options }) {
  const [message, setMessage] = useState('');

  const { roomId, serverUrl } = options;
  useEffect(() => {
    const connection = createConnection({
      roomId: roomId,
      serverUrl: serverUrl
    });
    connection.connect();
    return () => connection.disconnect();
  }, [roomId, serverUrl]); // ✅ All dependencies declared
  // ...
```

or wrap object with useMemo to ensure that the object was not changed(same as before)

```tsx
function Parent({ serverUrl, roomId }) {
  const optionsObj = useMemo(() => {
    return {
      serverUrl,
      roomId
    };
  }, [serverUrl, roomId]); // これらが変わらない限り再生成しない

  return (
    <ChatRoom options={optionsObj} />
  );
}
```

or receive as variables since serverUrl and roomId are primitive value(string), they do not be affected by a parent re-rendering.

```tsx
// 親 (毎回オブジェクト作っちゃうけどOK)
function Parent({ serverUrl, roomId }) {
  return (
    <ChatRoom
      serverUrl={serverUrl}
      roomId={roomId}
      options={{ serverUrl, roomId }} // 実は使わない or fallback 用など
    />
  );
}

// 子
function ChatRoom({ serverUrl, roomId }) {
  useEffect(() => {
    const connection = createConnection({ serverUrl, roomId });
    connection.connect();
    return () => connection.disconnect();
  }, [serverUrl, roomId]);

  // こうすれば options は dependency に入れないで済む
  // ...
}
```

https://react.dev/learn/removing-effect-dependencies#read-primitive-values-from-objects

### **Custom Hooks let you share stateful logic, not state itself**

**Custom Hooks let you share *stateful logic* but not *state itself.* Each call to a Hook is completely independent from every other call to the same Hook.**

https://react.dev/learn/reusing-logic-with-custom-hooks#custom-hooks-let-you-share-stateful-logic-not-state-itself

## 所感

結構長かったですね。いつEffectを使うのか、stateに込めるべきものは何かなど、改めて勉強できてよかった。objectを依存配列に入れたuseEffectは親のre-renderingの影響をもろに受けてしまうから危険危険。rendering中にrefを参照するのも危険危険。
