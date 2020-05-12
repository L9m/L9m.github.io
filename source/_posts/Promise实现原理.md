---
title: Promise实现原理
date: 2020-05-12 15:06:02
tags:
---


# Promise 实现原理

## Promise 简史

Promise 作为一种异步编程的解决方案，在 JavaScript 被广泛使用。Promise 并不是一个新的概念，Promise 的概念在 1976 年就已经被提出。
在 2011年初，Promise 随着 jQuery 1.5 的发布，而变得越来越流行。2012 年，Promise 被提出作为规范。Promise 在 ECMAScript 2015 中成为正式规范，并已被几乎所有的浏览器和 Node 兼容。

## 从设计模式来看 Promise

Promise 在一定程度上继承自观察者和发布/订阅模式。

下面是一个极简的例子，我们可以从观察者模式和发布/订阅模式来理解 Promise.

```js
class Promise {
  _callbacks = []
  constructor(executor) {
    const callbacks = value => this._callbacks.forEach(callback => callback(value))
    executor(callbacks) // 相当于 emit 或 notify
  }
  then(onFulfilled) {
    this._callbacks.push(onFulfilled) // 相当于 subscribe 或 on
  }
}

const promise1 = new MyPromise((callback) => {
  setTimeout(() => {
    callback('promise1')
  }, 1000)
})

promise1.then((value) => {
  console.log('1 秒后', value)
})

promise1.then((value) => {
  console.log('1 秒后', value)
})

```

但是 Promise 是一种高度封装的接口，它的 API 不止如此简单，Promise 有其自身的 Promise。

## Promise 规范

Promise 的实现有不同的规范，如 [Promise/A](http://wiki.commonjs.org/wiki/Promises/A)，[Promise/A+](https://promisesaplus.com/differences-from-promises-a)，[Promise/B](http://wiki.commonjs.org/wiki/Promises/B)，[Promise/KISS](http://wiki.commonjs.org/wiki/Promises/KISS)，Promise/C，[Promise/D](http://wiki.commonjs.org/wiki/Promises/D) 规范。
Promise/A 规范定义了什么是 Promise，其他规范在其基础上扩展了相关 API.ES6 的 Promise 是基于 Promise/A+ 规范的实现。而 Promise/A+ 是基于 Promise/A 规范的升级。相关规范也提供了[测试](https://github.com/promises-aplus/promises-tests)，以检测实现是否兼容规范。由于ECMAScript 使用 Promise/A+ 规范，这里我们使用 JavaScript 来实现 Promise/A+ 规范。[这里](https://promisesaplus.com/implementations)有很多 Promise/A+ 的实现。

## 实现 Promise/A+ 规范

下面是关于 Promise/A+ 规范的介绍。先了解规范以便于实现该规范。
Promise 表示异步操作的最终结果，与之交互的主要方式是通过 `then` 方法，该方法注册两个回调函数，用于接受 Promise 终值或 promise 抛出的异常。

### 相关术语

1. Promise 表示拥有 `then` 方法的对象或者函数,其行为符合本规范；
2. Thenable  表示拥有 `then` 方法的对象或函数；
3. 值（value）指合法的 JavaScript 值（包括 `undefined`, thenable 或 promise）；
4. 异常（exception） 指使用 `throw` 语句抛出的值；
5. 拒因（reason）指 promise 被拒绝的原因；

### 规范要求

#### Promise 的状态

Promise 有三种状态：等待态（Pending）, 执行态（Fulfilled） 或 拒绝态（Rejected）。

- 等待态（Pending）
  - 可以转换为 fulfilled 或 rejected
- 执行态（Fulfilled）
  - 不能转换为其他状态
  - 拥一个**不可变**的终值
- 拒绝态（Rejected）。
  - 不能转换为其他状态
  - 拥有一个不可变的拒因
这里的不可变指标识的不可变（immutable identity）（可用 `===` 判断相等），但不是深度不可变。
（引用地址相等，但可更改属性值）。这里我们举个例子

```js
let value = [1]

const p = Promise.resolve(value)

p.then(val => console.log(val)) // [1]
p.then(val => console.log(val === value)) // true

p.then(val => { val = [2]; console.log(val)}) // [2]
p.then(val => { console.log(val) }) // [1]

p.then(val => { val[0] = 2; console.log(val === value)}) // [2] true
p.then(val => console.log(val)) // [2]
p.then(val => console.log(val === value)) //  true

```

#### Then 方法

Promise 一定有一个 `then` 方法，`then` 方法接受两个参数：

```js
promise.then(onFulfilled, onRejected)
```

- `onFulfilled` 和 `onRejected` 都为可选参数；
  - 若 `onFulfilled` 不是函数，则被忽略；
  - 若 `onRejected` 不是函数，则被忽略；
- `onFulfilled`
  - 在 `promise` 执行（fulfilled）后调用，其第一个参数为 `promise` 的终值；
  - 在 `promise` 执行结束（fulfilled）前不可调用；
  - 其只调用一次；
- `onRejected`：
  - 在 `promise` 决绝（rejected）后调用，其第一个参数为 `promise` 的据因；
  - 它必须在 promise rejected 状态之后调用；
  - 其只调用一次；
- `onFulfilled` 或 `onRejected` 只有在[执行环境](http://es5.github.io/#x10.3)堆栈仅包含平台代码[^注1]后才可调用
- `onFulfilled` 或 `onRejected` 是作为函数调用（即没有 this 值）[^注2]；
- `then` 可以在同一个 promise 上调用多次
  - 当 `promise` 被执行后，所有的 `onFulfilled` 回调会按照注册的顺序依次执行；
  - 当 `promise` 被拒绝后，所有的 `onRejected` 回调会按照指定的顺序执行；

- `then` 方法一定返回 `promise` 对象。[^注3]

 ```js
 promise2 = promise1.then(onFulfilled, onRejected)
 ```

- 如果 `onFulfilled` 或 `onRejected` 返回一个值 `x`, 则运行 Promise 解决过程 `[[Resolve]](promise2, x)`;
- 如果 `onFulfilled` 或 `onRejected` 抛出异常 `e`，`promise2` 必须拒绝执行, 并以 `e` 作为拒因;
- 如果 `onFulfiled` 不是函数且 `promise1` 被执行，则 `promise2` 执行并返回和 `promise1` 相同的值。
- 如果 `onRejected` 不是函数且 `promise1` 被拒绝，则 `promise2` 拒绝并返回和 `promise1` 相同的拒因。

（**不论 `promise1` reject 还是 resolve , `promise2` 都会被 resolve，只有在 `promise1` 抛出异常后，`promise2` 才会被拒绝（reject）,其余都会被执行完成**）

### Promise 解决过程

**Promise 的解决过程**是一个抽象的操作，其需输入一个 promise 和一个值 `x`，将其表示为 `[[resolve]](promise, x)`。

如果 `x` 有 `then` 方法 ，且行为像 `promise`, 解决程序会试图使 `promise` 接受 `x` 的状态，否则其用 `x` 的值执行 `promise`。

Thenable 的特性使得 `promise` 的实现更具通用性：只要其暴露出一个遵循 Promise/A+ 规范的 `then` 方法即可，同时也使 Promise/A+ 规范能与那些不太规范实现良好兼容。

运行 `[[resolve]](promise, x)`，会执行以下步骤：

1. 如果 `promise` 和 `x` 指向同一个对象，抛出 `TypeError` 为拒因并拒绝 `promise`。

2. `x` 为 Promise：如果 `x` 为 `promise`，则使 `promise` 接受 `x` 的状态。[^注4]
    - `x` 处于等待态（`pending`）， `promise` 需保持等待态（`pending`）直到 `x` 被解决或被拒绝；
    - `x` 处于执行态（`fulfilled`），用同样的值执行 `promise`；
    - `x` 处于拒绝态（`rejected`），用同样的据因拒绝 `promise`；
3. `x` 为对象或函数：
    - 把 `x.then` 赋值给 `then`；[^注5]
    - 如果取 `x.then` 值抛出错误 `e`，则将 `e` 作为据因拒绝 `promise`；
    - 如果 `then` 是函数，将 `x` 作为其 `this` 值（绑定至 `x`）来调用，第一个参数为 `resolvePromise` ，第二个参数是 `rejectPromise`
        - 如果 `resolvePromise`以参数 `y` 调用，运行 `[[resolve]](promise, y)`
        - 如果 `rejectPromise`以据因 `r` 调用，则以 `r` 为原因拒绝 `promise`
        - 如果 `resolvePromise` 和 `rejectPromise` 均被调用，或者被同样的参数调用多次，则第一个调用优先，其他的调用都将被忽略。
        - 如果调用 `then` 抛出异常 `e`
          - 如果 `resolvePromise` 和 `rejectPromise` 已调用过，则忽略
          - 否则以 `e` 为原因拒绝 `Promise`
        - 如果 `then` 不是函数，则 `x` 为值执行 `promise`
        - 如果 `x` 不是一个对象或函数，则以 `x` 为值执行 `promise`

（这里 `then` 是函数，为 `promise` 核心。）

如果一个 `promise` 被一个循环的 thenable 链中的对象解决, 而 `[[resolve]](promise, thenable)` 的递归性质使得其被再次调用，将导致无线递归。鼓励（但不是必需的）检测这种递归，并以 `TypeError` 为据因拒绝 `promise`。[^注6]

### 注解

[^注1]: 这里的平台代码是指引擎、环境以及 promise 的实现代码。实际上，此要求可确保在事件循环回合之后调用 `onFulfilled` 或 `onRejected` 并随后以新的栈异步执行。可使用**宏任务(macro-task)**机制（如 `setTimeout` 或 `setImmetiate` 或**微任务(micro-task)**机制（如 `MutationObserver` 或 `process.nextTick`）来实现。由于 promise 实现代码就是平台代码，因此它本身可能包含一个任务调度队列或 trampoline 在其中调用处理程序。

> （这里提到了事件循环（EventLoop）、宏任务（macro-task）和微任务（micro-task）等概念，事件循环是一个执行模型。在执行 JavaScript 代码时，将整个脚本作为一个宏任务（macro-task）执行，执行过程中，同步代码会直接执行，而其他代码引擎会将任务按照类别分到这两个队列中，分别是宏任务（macro-task）和微任务（micro-task）队列，首先在 macrotask 的队列（这个队列也被叫做 task queue）中取出第一个任务，执行完毕后取出 microtask 队列中的所有任务顺序执行；之后再取 macrotask 任务，周而复始，直到两个队列执行完毕。）

- > 宏任务（macro-task）：`script` 、`setTimeout`、`setInterval` 、`setImmediate` 、I/O 、UI rendering
- > 微任务（micro-task）：`process.nextTick`, `Promises`（浏览器原生，和基于此的技术，如 `fetch` 等）, `Object.observe`, `MutationObserver`

[^注2]: 在严格模式下，`this` 会是 `undefined`。在宽松模式下其为 `global` 对象。

[^注3]: 如果符合所有其他规范要求，可以允许 `promise2 === promise1`。每种实现都应说明 `promise2 === promise1` 是否可以成立，以及在什么条件下成立。

[^注4]: 通常，只有它来自当前的实现，才能判断 `x` 是否是一个真正的 promise。此条款允许采取已知符合 promise 标准实现的状态。

[^注5]：我们首先储存了指向 `x.then` 的引用，然后测试并调用该引用，以避免在过程中对 `x.then` 属性的多次访问。这是为了避免访问器属性在不同访问过程中发生改变，保证访问器属性的一致性。

[^注6]: 实现不应对 thenable 链的深度设限，并假设超出深度限制就是无限递归。只有真正的循环递归才应抛出 `TypeError` 异常。如果链上有多个不同的 thenable，则递归下去才是正确的行为。

### 代码实现

Promise 的原理是使用回调函数在异步操作后执行，只不过时将回调封装在内部，通过 `then` 方法实现链式使得多层回调看似变一层，而同一个 `promise` 的 `then` 方法可以调用多次。所以可以将回调函数（`onFulfilled` 和 `onRejected`）保存到数组中，在完成后执行。

代码实现：[code](https://github.com/L9m/promise.git)

这样我基本实现了 Promise/A+ 规范，相比 ES6 中的 Promise, 还缺少一些 API，这些 API 相对简单。对于 Promise, executor 会立即执行， executor 会接受两个参数——回调函数，回调函数绑定 `this` 至当前 promise，当 executor 执行完毕或拒绝后，会执行回调函数，改变当前 promise，如改变 promise 的状态，然后调用 `then` 注册的回调函数，所以回调函数是链接上下 Promise 的关键。`then` 方法会注册回调函数，并且返回 promise, 以进行链式调用，不过它的内部还对接受的参数进行了一些判断和处理。

## Promise 优缺点

Promise 相对于观察者模式和发布/订阅模式的优点是：

1. Promise 一定程度上解决了深度嵌套的问题；
2. Promise API 暴露相对简洁，也更为优雅；
3. 支持序列执行，利于多异步协作；
4. 更好的错误处理；

主要缺点是：高级接口对 API 的封装使其失去了一定的灵活性。

## 参考

- [Promises/A+](https://promisesaplus.com/)
- [TS 版 Promise ，promise-polyfill 实现过程详解](https://github.com/leer0911/myPromise)
- [promised](https://github.com/yanguango/promised)
- [图解 Promise 实现原理](https://zhuanlan.zhihu.com/p/58428287)
