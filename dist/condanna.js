;(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.Condanna = factory();
  }
}(this, function() {
var deferred, resolvePromise, modedQueue, Condanna;
deferred = function(){
  var queue;
  queue = modedQueue();
  return {
    promise: {
      then: function(onFulfilled, onRejected){
        var resultingDeferred;
        resultingDeferred = deferred();
        if (typeof onFulfilled === 'function') {
          queue.push('F', function(resolvedWith){
            var newValue, e;
            try {
              newValue = onFulfilled(resolvedWith);
            } catch (e$) {
              e = e$;
              resultingDeferred.reject(e);
            }
            resolvePromise(resultingDeferred, newValue);
          });
        } else {
          queue.push('F', resultingDeferred.resolve);
        }
        if (typeof onRejected === 'function') {
          queue.push('R', function(rejectedWith){
            var newValue, e;
            try {
              newValue = onRejected(rejectedWith);
            } catch (e$) {
              e = e$;
              resultingDeferred.reject(e);
            }
            resolvePromise(resultingDeferred, newValue);
          });
        } else {
          queue.push('R', resultingDeferred.reject);
        }
        return resultingDeferred.promise;
      }
    },
    resolve: function(value){
      return queue.setModeAndValue('F', value);
    },
    reject: function(reason){
      return queue.setModeAndValue('R', reason);
    }
  };
};
resolvePromise = function(deferred, value){
  var _then, e, alreadyReceivedCalls, fulfill, reject;
  if (deferred.promise === value) {
    deferred.reject(new TypeError("Tried to resolve promise with itself"));
    return;
  }
  if (!(value != null && (typeof value === 'object' || typeof value === 'function'))) {
    deferred.resolve(value);
    return;
  }
  _then = null;
  try {
    _then = value.then;
  } catch (e$) {
    e = e$;
    deferred.reject(e);
    return;
  }
  if (typeof _then !== 'function') {
    deferred.resolve(value);
    return;
  }
  alreadyReceivedCalls = false;
  fulfill = function(value){
    if (!alreadyReceivedCalls) {
      alreadyReceivedCalls = true;
      resolvePromise(deferred, value);
    }
  };
  reject = function(reason){
    if (!alreadyReceivedCalls) {
      alreadyReceivedCalls = true;
      deferred.reject(reason);
    }
  };
  try {
    _then.call(value, fulfill, reject);
  } catch (e$) {
    e = e$;
    reject(e);
  }
};
modedQueue = function(){
  var queue, mode, arg, scheduleFunctionCall;
  queue = [];
  mode = null;
  arg = null;
  scheduleFunctionCall = function(f){
    setTimeout(function(){
      f(arg);
    }, 0);
  };
  return {
    push: function(callbackMode, callback){
      if (mode == null) {
        queue.push({
          mode: callbackMode,
          f: callback
        });
      } else if (mode === callbackMode) {
        scheduleFunctionCall(callback);
      }
    },
    setModeAndValue: function(newMode, value){
      if (mode != null) {
        return;
      }
      mode = newMode;
      arg = value;
      queue.filter(function(entry){
        return entry.mode === mode;
      }).map(function(it){
        return it.f;
      }).forEach(scheduleFunctionCall);
      queue = null;
    }
  };
};
Condanna = {
  deferred: deferred
};
return Condanna;
}));
