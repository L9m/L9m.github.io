---
title: Promise实现原理
tags:
---

# Promise 实现原理

## Promise 简史

Promise 作为一种异步编程的解决方案，在 JavaScript 被广泛使用。Promise 并不是一个新的概念，Promise 的概念在 1976 年就已经被提出。
在 2011年初，Promise 随着 jQuery 1.5 的发布，而变得越来越流行。2012 年，Promise 被提出作为规范。Promise 在 ECMAScript 2015 中成为正式规范，并已被几乎所有的浏览器和 Node 实现。

## 从设计模式来看 Promise

Promise 在一定程度上继承自观察者和发布/订阅模式。

下面是一个极简的例子，我们可以从观察者模式和发布/订阅模式来理解 Promise.

```js
class MyPromise {
  callbacks = []
  constructor(executor) {
    const callbacks = value => this.callbacks.forEach(callback => callback(value))
    executor(callbacks) // 相当于 emit 或 nosify
  }
  then(onFulfilled) {
    this.callbacks.push(onFulfilled) // 相当于 subscribe 或 on
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

但是 Promise 是一种高度封装的接口，它的 API 不止如此简单，Promise 有其自身的 Promise.

## Promise 规范

Promise 的实现有不同的规范，如 [Promise/A](http://wiki.commonjs.org/wiki/Promises/A)，[Promise/A+](https://promisesaplus.com/differences-from-promises-a)，[Promise/B](http://wiki.commonjs.org/wiki/Promises/B)，[Promise/KISS](http://wiki.commonjs.org/wiki/Promises/KISS)，Promise/C，[Promise/D](http://wiki.commonjs.org/wiki/Promises/D) 规范。
Promise/A 规范定义了什么是 Promise，其他规范在其基础上扩展了相关 API.ES6 的 Promise 是基于 Promise/A+ 规范的实现。而 Promise/A+ 是基于 Promise/A 规范的升级。相关规范也提供了[测试](https://github.com/promises-aplus/promises-tests)，以检测实现是否兼容规范。由于ECMAScript 使用 Promise/A+ 规范，这里我们使用 JavaScript 实现 Promise/A+ 规范。[这里](https://promisesaplus.com/implementations)有相关 Promise/A+ 规范。

## 实现 Promise/A+ 规范

Promise 表示异步操作的最终结果，与之交互的主要方式是通过 `then` 方法，该方法注册两个回调函数，用于接受 Promise 终值或 promise 抛出的异常。

### 相关术语

1. Promise 指拥有 `then` 方法的对象或者函数,其行为符合此规范；
2. thenable  指定义 `then` 方法的对象或函数；
3. value 指任何合法的 JavaScript 值（包括 `undefined`, thenable 或 promise）；
4. exception 指使用 `throw` 语句抛出的值；
5. reason 指 promise 被拒绝的原因；

### 要求

#### Promise 的状态

Promise 有三种状态：pending, fulfilled 或 rejected.
  当 promise 处于 pending 状态时
    其可以转换为 fulfilled 或 rejected
  当处于 fulfilled 状态后
    不能转换为其他状态
    返回一个不可变的终值
  当处于 rejected 状态后
    不能转换为其他状态
    返回一个不可变的 reason
这里的不可变指标识的不可变（immutable identity）（全等），但不是深度不可变。
identity 可以理解为内存地址，这里我们举个例子：

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

#### `then` 方法

Promise 必须有一个 `then` 方法，并且 `then` 方法接受两个参数：

```js
promise.then(onFulfilled, onRejected)
```

`onFulfilled` 和 `onRejected` 都是可选参数
  如果 `onFulfilled` 不是函数，则被忽略
  如果 `onRejected` 不是函数，则被忽略
如果 `onFulfilled` 是函数
  它会在 promise 被解决后执行，并以 promise 的值作为它的第一个参数
  它必须在 promise fulfilled 状态之后调用
  只调用一次
如果 `onRejected` 是函数
  它会在 promise 被拒绝后执行，并以 promise 拒绝的原因作为它的第一个参数
  它必须在 promise rejected 状态之后调用
  只调用一次
`onFulfilled` 或 `onRejected` 只有在执行环境包含平台代码后才能调用。 // ？？？
`onFulfilled` 或 `onRejected` 一定是作为函数调用（没有 this 值）
`then` 可以在同一个 promise 上调用多次
  当 promise 被解决后，相应的 `onFulfilled` 回调会按照指定的顺序执行
  当 promise 被拒绝后，相应的 `onRejected` 回调会按照指定的顺序执行

`then` 方法返回 Promise

 ```js
 promise2 = promise1.then(onFulfilled, onRejected)
 ```

如果 `onFulfilled` 或 `onRejected` 返回值 x, 则运行 Promise 解决过程 `[[Resolve]](promise2, x)`。
如果 `onFulfilled` 或 `onRejected` 抛出异常 e，promise2 必须拒绝（reject）执行, 并以 e 作为原因。
如果 `onFulfiled` 不是函数且 `promise1` 被解决，则 `promise2` 解决并返回和 `promise1` 同样的值。
如果 `onRejected` 不是函数且 `promise1` 被拒绝，则 `promise2` 拒绝并返回和 `promise1` 同样的原因。




## Promise 优缺点

Promise 相对于观察者模式和发布/订阅模式的优点是：

1. Promise 一定程度上解决了深度嵌套的问题；
2. Promise API 暴露相对简洁，也更为优雅；
3. 支持序列执行，利于多异步协作；
4. 更好的错误处理；

主要缺点是：高级接口对 API 的封装使其失去了一定的灵活性。
