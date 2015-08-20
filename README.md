---
title: Condanna
creator: Jonas Weber
---


Condanna - A simple implementation of Promises/A+
=================================================

**Condanna** (italian for "sentence") is a short, but complete implementation of
the [Promises/A+][1] standard. It was written to show interested readers one way
to implement promises.

Currently, native Promises are being implemented in modern JavaScript engines,
that (hopefully) will provide better performance than existing non-native
implementations. However, in my opininion it is still helpful for developers to
have knowledge about the technology and concepts that power their
applications.

## Introduction

Traditionally, JavaScript environments are single-threaded, i.e. at most one
function is executed at any given time. Threads controlled by the browser that
work in the background retrieving data from web servers or reading files do not
count into this.

Web browsers recently implemented (or ar still implementing) a technology
called Web Workers that allows code to start another thread from a web page
that executes in the background, but communication between the parent
environment controlling the user interface and the background thread is highly
restricted. The usual characteristic of a multi-threaded environment,
the shared memory, is not present when working with web workers.

In general, operations are taking different orders of magnitudes of time
depending on the scope of them.  Calculations on the CPU are very fast, while
requests to some remote server take a comparatively long time. To keep pages
responsive while loading more data from somewhere else traditionally plain
callbacks were used. `function`s were registered with the environment and called
later, when the result was present.

Unfortunately, this approach can easily lead to unmanageable and unwieldy code.
Promises introduce an abstracting layer encapsulating callbacks for success and
error. We can treat promises as a piece of data that happens to give us a
result of some operation later. The great advantage of having a piece of data
is that it is storable in a variable or pass to functions, in other words treat
a long-running operation as a first-level citizen.

### Promises/A+

Promises had a rocky start, and a lot of incompatible implementations popped
up. Not all of them provided the same semantics, and compatibility between
promises from different libraries was not given. This semantic compatibility
however is crucial for treating promises as first-level citizens (A function
can always be invoked the same way, regardless from where it's imported).

As a joint effort from major libraries, a common set of rules was established.
Since then, the [Promises/A+ standard][1] specifies a set of rules for
compatible implementations.

### Deferreds

A promise encapsulates the result of a calculation, but usually has no (and
shouldn't have) means of _specifying_ this result. Deferreds are a loose
concept covering a promise and accompanying functions setting this result. This
is part of the interface a promise library provides to _construct_ promises.

For simplicity deferreds will be used in this library. Another common approach
is the use of a constructor function that receives the functions to resolve or
reject the promise as parameters.

### Structure

The implementation of the library will contain three major modules:
- a deferred
- a promise resolver
- a function call queue

These modules will be introduced in the following. During the implementation
the paragraph from the standard demanding that design choice will be referred
to.

The language of the resulting library is [LiveScript][4]. It provides nice
syntactic features that abstract away most of the brackets and parantheses
mandated by JavaScript. A transpiler later transforms the code into plain
JavaScript which can be executed by browsers and also by NodeJS.

The standard differentiates between 'thenables' and 'promises'. A thenable is
an object with a `then` method, while a promise is an object with a `then`
method according to the standard. Certain guarantees can be taken for granted
when an object is a promise, leading to more performant code.  In this
implementation there won't be a way of distinguishing between foreign thenables
and trusted promises, which is why any thenable will be treated as just
that: a thenable. No difference will be made between the two in this document,
and the terms used interchangeably.

## The Deferred

A deferred is constructed (the main API for this library) by calling
`deferred()`. The first piece of state the deferred needs is a moded queue that
will run function calls having the appropriate mode. For example, if
there were two callbacks for the mode  `resolved` and three callbacks for
`reject` and later the mode set to `'resolved'`, the two callbacks mentioned
first will be called.  The mode of a queue can not be changed once it has been
set. The chapter introducing the moded queue will talk more about it.

```livescript
deferred = ->
  queue = modedQueue()
```

This is all the internal state that a deferred is going to keep.
The next step is to construct the resulting promise and the two functions
setting the actual result. Firstly, the promise:

```livescript
  promise:
    then: (onFulfilled, onRejected) ->
```

The only method provided as part of the promise is the `then` method. It can
take up to two callback as parameters.  Standard dictates (2.2.7) that it has
to return a promise, so let's just create the accompanying deferred
(the promise will be returned later) here:

```livescript
      resultingDeferred = deferred()
```

### When the promise is fulfilled, ...

If the passed parameter is a function (2.2.1.1), a callback to be executed when
the **F** queue is flushed is to be registered in the queue of _this_ promise:

```livescript
      if typeof onFulfilled is \function
        queue.push 'F', (resolvedWith) !->
```

At this point, `this` promise has been resolved, e.g., there is an actual
answer from the remote server.  It is now possible to call the supplied
callback from the user of this library. If this function throws (which it is
certainly allowed to do), the new promise has to be rejected with the throwed
value, i.e. the reason (2.2.7.2).

Note that `onFulfilled` is called as a function, and does not have a context
(2.2.5).

```livescript
          try
            newValue = onFulfilled resolvedWith
          catch
            resultingDeferred.reject e
```

`newValue` now holds the value that the new promise represented by
`resultingDeferred.promise` should resolve with. This value might still be a
promise, and it is to be resolved first. A standardized procedure is mandated
by the standard to make sure that the correct type of value is returned to the
user of the library here (2.2.7.1).  Note that the standard names this
procedure 'resolve', which could lead to confusion with the `resolve` method of
the deferred. In this document the procedure will be referred to it by
`resolvePromise` instead.  This procedure will be implemented in the next
chapter, for now it is just executed:

```livescript
          resolvePromise resultingDeferred, newValue
```

The section above handled the case where the user gave a callback for the case of
fulfillment. This parameter however is optional. If it is not set, the value
that resolved this promise has to be forwarded to the new promise as
fulfillment value (2.2.7.3). The easiest way to do this is to register the
`resolve` method of the _new_ deferred as callback for the _current_ promise,
if the `onFulfilled` parameter is not given or not a function:

```livescript
      else
        queue.push 'F', resultingDeferred.resolve
```

### and when it's not, ...

Promises can be fulfilled, but can also be rejected if they can't be fulfilled,
for example because of a network error when fetching external data.
Callbacks can be registered for this case by supplying them as a second parameter
to this, such as: `fetch(url).then(null, (reason) -> alert(reason))`.

To register the callback in the moded queue, the same steps have to be
executed, but with different variables. The callback will be placed in the 'R'
queue, if it is given (2.2.1.2). A thrown exception in the handler will also
reject the promise (2.2.7.2), and omission of the handler will forward the
reject to the new promise (2.2.7.4).

```livescript
      if typeof onRejected is \function
        queue.push 'R', (rejectedWith) !->
          try
            newValue = onRejected rejectedWith
          catch
            resultingDeferred.reject e

          resolvePromise resultingDeferred, newValue
      else
        queue.push 'R', resultingDeferred.reject
```

It is worth noting that a rejection handler can bring the promise 'back on course'
by returning a new value, e.g. by resolving the reason for the exception and
trying again, but can as well decide to keep the promise chain in rejection
by rethrowing the reason.

At this point, the `then` method is complete. It's a method that registers the
supplied parameters in a queue to be executed when the deferred resolves, and
either lets these callbacks transform the value of the resulting promise or
forwards the status to the next one. The new promise (as controlled by the
given callbacks) is given back to the caller:

```livescript
      return resultingDeferred.promise
```

The whole deferred is almost done as well. What is left is to give the
caller methods to resolve and reject the deferred. If the deferred resolves,
all registered callbacks for fulfillment have to be run (and any subsequently
registered callbacks as well), and similarly for rejection. This will be
implemented in the moded queue chapter, for now it suffices to just set mode
and value for the queue if the deferred resolves

```livescript
  resolve: (value) -> queue.setModeAndValue 'F', value
```

or rejects:

```livescript
  reject: (reason) -> queue.setModeAndValue 'R', reason
```

## The Promise Resolver

The promise resolver is a procedure defined in great detail by the standard.
There are already calls for the method in the code above, but it isn't
implement yet.

```livescript
resolvePromise = (deferred, value) !->
```

Firstly, a safety layer is introduced to make it more difficult to establish
'endless loops'. Otherwise, if a user did something like `d.resolve(-> d.promise)`,
the library would wait for the result of promise `d.promise` to resolve the promise
`d.promise`, which will never finish. The deferred is therefore rejected immediately,
if the promise accompanying the deferred is the same object as the given `value`,
and exit from the procedure (2.3.1).

```livescript
  if deferred.promise is value
    deferred.reject new TypeError("Tried to resolve promise with itself")
    return
```

The next step of the procedure allows the adoption of the state of a promise
whose implementation is known and trusted, and whose state is accessable
(2.3.2).  Because of simplicity, there is no way of knowing whether the given
value is a promise created from this library, and also no means of accessing its
state from outside¹.  Adopting the state of a promise in `value` is left as an
exercise to the reader.  An approach could be to reuse the queue of the `value`
promise as the queue of the current deferred.

Afterwards, it has to be checked whether `value` is an object or a function
(2.3.3).  If `value` is neither, the deferred can directly be resolved with
`value` (2.3.4), because `value` cannot be a promise if it's not an object or
function (it can't have a `.then`).  A test for `typeof value is 'object' or
typeof value is 'function'` is unfortunately not enough, because JavaScript
treats `null` as `object` as well.

```livescript
  unless value? and (typeof value is \object or typeof value is \function)
    deferred.resolve value
    return
```

At this point, it is known that a) `value` is an object or a function and b)
that it has properties (since it's not `null`). To protect against problems
caused by different results of repeatedly getting `value.then` it has to be
fetched exactly once (2.3.3.1 and 3.5). If anything goes wrong when the method
is retrieved, the deferred has to be rejected with the thrown exception
(2.3.3.2), and exited from the procedure.

Although fetching a property might seem unproblematic, it is in fact not: It is now
possible to define [`getters`][3], hiding a method call behind a property access.
Subsequent accesses might result in different results, and accesses might fail
because of exceptions.

```livescript
  _then = null

  try
    _then := value.then
  catch
    deferred.reject e
    return
```

Even though `value` has a property called `then`, it is not guaranteed that
this is actually a function. If it is not, it is not a thenable and the promise
has to be resolved with `value` instead (2.3.3.4) and exited the procedure:

```livescript
  unless typeof _then is \function
    deferred.resolve value
    return
```

At this point, `_then` points to a method `then` of an object. Unfortunately,
it is still not known if it is well behaved, i.e. conforms to the standard. A
safeguard has to be established to protect against multiple (instead of up to
one) calls to the callbacks that are given to it. The easiest way to do this is
to keep a flag around which tells if there were already calls and any
subsequent calls are to be ignored (2.3.3.3.3):

```livescript
  alreadyReceivedCalls = no
```

When the promise is fulfilled, i.e. the first callback is called,
`resolvePromise` is called 'recursively' again (2.3.3.3.1), but only if no
other callbacks have been called yet. This makes it possible to nest promises
arbitrarily deep.

```livescript
  fulfill = (value) !->
    unless alreadyReceivedCalls
      alreadyReceivedCalls := yes
      resolvePromise deferred, value
```

If the promise rejects, the promise is only rejected if no other callback has
yet been received (2.3.3.3.2).

```livescript
  reject = (reason) !->
    unless alreadyReceivedCalls
      alreadyReceivedCalls := yes
      deferred.reject reason
```

What remains is to call `then`. If anything goes wrong when calling `_then`
(i.e. an exception is thrown), the promise is rejected, *unless* it's already
received another call (e.g. if any of the callbacks were called synchronously
before returning from `_then`) (2.3.3.3.4). `_then` is called with its
containing object as context (2.3.3.3).

```livescript
  try
    _then.call value, fulfill, reject
  catch
    reject e
```

The moded queue will make sure that the deferred can only change its state once.
Why is the safeguard neccessary here as well? The answer is simple:
If the thenable firstly calls the fulfillment callback, `resolvePromise` might resolve
the deferred asynchronously because it first has to wait for a passed promise.
If in the meantime the thenable rejects, the standard mandates that the deferred will
be resolved anyways with the value of the first call (2.3.3.3.3).

This concludes the chapter implementing the promise resolver. It implements checks
testing whether the passed value is a thenable, and if yes, resolves them asynchronously
and passes the fulfilling values or the reasons for rejection on to the callbacks stored
in the queue, which will be implemented in the next chapter.

## The Moded Queue

The standard gives a few requirements for the calling of callbacks registered
with the `then` method. It doesn't mandate how these callbacks are executed.

1. The callbacks are to be executed in the order they were registered (2.2.6.1 and 2.2.6.2).
2. The callbacks are called as functions, with no `this` (2.2.5).
3. The callbacks are executed with only platform code in the stack (2.2.4).
4. The callbacks must not be executed more than once (2.2.2.3 and 2.2.3.3).

Each of this requirements is implemented by code, and they will be mentioned at
the the appropriate locations.

### Behavior

The moded queue will have the following characteristics:

- Initially, the moded queue won't be set to a mode. Callbacks can be added by
  specifying a queue and a function, and they are remembered for later
  invocation.
- A mode and value can be set at any time. Callbacks of the queue with the
  given mode will then be asynchronously called in order and with the value as
  parameter.
- Any subsequent addings to the moded queue will either result in an immediate
  schedule of the callback with parameter if the mode matches, or will be
  ignored.

### Implementation

```livescript
modedQueue = ->
```

To satisfy condition 1, callbacks will be stored in an array. Each new entry will be
appended to the existing list.

```livescript
  queue = []
```

Initially, the moded queue isn't set to a mode, and the argument isn't set either:

```livescript
  mode = null
  arg = null
```

Later in this function, function calls with a single parameter will be scheduled
asynchronously. For portability `setTimeout` with a delay
of zero is used.

The function is called without a context (2) and directly from the platform, with no
application code in the stack (3).

```livescript
  scheduleFunctionCall = (f) !->
    setTimeout (!-> f arg), 0
```

What remains is to define the 'public' interface of the queue.  If the user of the
moded queue wants to register a new callback, she has to specify a mode and a
function:

```livescript
  push: (callbackMode, callback) !->
```

If the `mode` is not yet set, add it to the queue:

```livescript
    if not mode?
      queue.push(mode: callbackMode, f: callback)
```

Otherwise, if the mode is set *and* equal to the mode of the callback,
the callback is to be immediately scheduled for execution.

```livescript
    else if mode is callbackMode
      scheduleFunctionCall callback
```

If the mode is set, but does not match the mode of this callback, the call is
simply ignored. The other method of the queue is setting the mode and value:

```livescript
  setModeAndValue: (newMode, value) !->
```

If the mode as already been set, ignore this call.  The mode can't be changed
once it's been set.

```livescript
    return unless not mode?
```

The new mode and value are now written into the corresponding variables, and
then all callbacks waiting in the queue that have the specified mode are executed.

```livescript
    mode := newMode
    arg := value
    queue
      .filter((entry) -> entry.mode is mode)
      .map (.f)
      .forEach scheduleFunctionCall
    queue := null
```

## Extension Points

The implemented library only implements the bare minimum of functionality.
However, it is very easy to extend it.

Some libraries provide the ability to add another type of callback to the promises, which
is fired when the promises settles, i.e. either when it resolves or rejects.
This can be added quite easily by a new method on the promise and adding the callback
to both queues.

The de facto standard interface to create promises appears to be `new
Promise((resolve, reject) -> ...)`. Since the deferred is available, it is
possible to synchronously call a constructor method.

Helpers to wait for the fulfillment of a whole array of promises are commonly found
in promise libraries. Adding such a method is also quite easy, as one only has to count
the number of already fulfilled promises and resolve the final promise in the end.

## Conclusion

```livescript
Condanna = deferred: deferred
```

This concludes the implementation of a fully working promises library.  The
build tool will pick up the Condanna object and export it to the various
environments.

<a href="https://promisesaplus.com/">
  <img src="logo-small.png" alt="Promises/A+ logo"
title="Promises/A+ 1.0 compliant" align="right" />
</a>

An object with a `deferred` method is exactly the format expected by the
[official promises test suite][2].  The test suite can be called directly on
the library to make sure it's compliant.

<code>$ promises-aplus-tests condanna</code><br>
<code style="color: green">  872 passing (16s)</code>

[1]: https://promisesaplus.com/
[2]: https://github.com/promises-aplus/promises-tests
[3]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/get
[4]: http://livescript.net/

----

1: Omission is not a blocker for Promises/A+ compliance, since state
adoption can also happen (with probably wore performance) by treating the promise
as an unknown and untrustable thenable.
