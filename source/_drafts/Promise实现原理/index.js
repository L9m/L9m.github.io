const STATE = {
  PENDING: 'PENDING',
  FULFILLED: 'FULFILLED',
  REJECTED: 'REJECTED'
}

const Util = {
  isFunction(val) {
    return val && typeof val === 'function'
  },
  isObject(val) {
    return val && typeof val === 'object'
  }
}

class Promise {
  _callbacks = []
  _state = STATE.PENDING
  _value = null
  constructor(executor) {
    // 绑定至当前的 promise
    executor(this._resolve.bind(this), this._reject.bind(this))
  }

  _isPending() {
    return this._state === STATE.PENDING
  }

  _isFulfilled() {
    return this._state === STATE.FULFILLED
  }

  _isRejected() {
    return this._state === STATE.REJECTED
  }

  _hasResolved() {
    return this._isFulfilled() || this._isRejected()
  }

  _resolve(x) {
    // 只执行一次，改变状态之后就不再改变
    if (this._hasResolved()) return

    // 判断传入的 x 是否是 promise 本身
    // 避免无限循环
    if (x === this) {
      throw new Error('Resolving object can not be the same object')
    } else if (x instanceof Promise) {
      // 如果传入的值 x 是 promise, 则调用 x 的then 方法，进行递归调用,直到最后 x 不是 promise
      // 绑定到当前 promise, 链接起两个 promise
      x.then(this._resolve.bind(this), this._reject.bind(this))
    // 如果 x 是对象或函数
    } else if (Util.isObject(x) || Util.isFunction(x)) {
      try {
        // 如果 x 是 thenable
        // 尝试读取 then 方法，并保存
        const thenable = x.then
        if (Util.isFunction(thenable)) {
          thenable.call(
            x,
            value => {
              this._resolve(value)
            },
            error => {
              this._reject(error)
            }
          )
        } else {
          // thenable 不是函数
          this._fulfill(x)
        }
      } catch (err) {
        // 抛出错误
        this._reject(err)
      }
    } else {
      // 如果 x 不是对象或函数
      this._fulfill(x)
    }
  }

  _fulfill(result) {
    // 只执行一次
    if (this._hasResolved()) return

    this._state = STATE.FULFILLED
    this._value = result
    // 完成后，执行回调函数数组中的回调方法
    this._callbacks.forEach(handler => this._callHandler(handler))
  }

  _reject(error) {
    // 只执行一次
    if (this._hasResolved()) return

    this._state = STATE.REJECTED
    this._value = error
    // 被拒绝后，执行回调函数数组中的回调方法
    this._callbacks.forEach(handler => this._callHandler(handler))
  }

  _addHandler(onFulfilled, onRejected) {
    // pending 状态下将其放入回调
    this._callbacks.push({
      onFulfilled,
      onRejected
    })
  }

  _callHandler(handler) {
    // 判断是否已经转换为对应状态，并执行 handler 中的函数
    if (this._isFulfilled() && Util.isFunction(handler.onFulfilled)) {
      handler.onFulfilled(this._value)
    } else if (this._isRejected() && Util.isFunction(handler.onRejected)) {
      handler.onRejected(this._value)
    }
  }

  then(onFulfilled, onRejected) {
    switch (this._state) {
      case STATE.PENDING: {
        // 返回 promise 用于链接上下 promise
        return new Promise((resolve, reject) => {
          new Promise((resolve, reject) => {
            this._addHandler(
              (value) => {
                setTimeout(() => {
                  try {
                    if (Util.isFunction(onFulfilled)) {
                      // 将值传递给 onFulfilled 进行处理
                      resolve(onFulfilled(value))
                    } else {
                      // 直接传递值
                      resolve(value)
                    }
                  } catch (err) {
                    reject(err)
                  }
                })
              },
              (error) => {
                setTimeout(() => {
                  try {
                    if (Util.isFunction(onRejected)) {
                      // 将值传递给 onRejected 进行处理
                      resolve(onRejected(error))
                    } else {
                      // 拒绝 promise
                      reject(error)
                    }
                  } catch (err) {
                    reject(err)
                  }
                })
              }
            )
          })
        })
      }
      case STATE.FULFILLED: {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            try {
              if (Util.isFunction(onFulfilled)) {
                // 执行后，将值传入 onFulfilled 进行处理
                resolve(onFulfilled(this._value))
              } else {
                // 不是函数，则忽略
                resolve(this._value)
              }
            } catch (err) {
              reject(err)
            }
          })
        })
      }
      case STATE.REJECTED: {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            try {
              // 如果是函数
              if (Util.isFunction(onRejected)) {
                resolve(onRejected(this._value))
              } else {
                // 不是函数
                reject(this._value)
              }
            } catch (err) {
              reject(err)
            }
          })
        })
      }
    }
    debugger
  }
}

const p1 = new Promise((resolve, reject) => {
  setTimeout(() => {
    reject('1')
    console.log('ww')
  }, 1000)
})

console.log(p1)

p1.then((val) => {
  console.log(val, '1s')
}, (err) => {
  console.log(err)
})