/**
 * Performance utility functions for optimizing event handlers and function calls
 *
 * @example
 * // Debounce search input
 * import { debounce } from './utils/performance';
 *
 * const handleSearch = debounce((value) => {
 *   // API call or expensive operation
 *   fetchResults(value);
 * }, 300);
 *
 * <input onChange={(e) => handleSearch(e.target.value)} />
 *
 * @example
 * // Throttle scroll handler
 * import { throttle } from './utils/performance';
 *
 * const handleScroll = throttle(() => {
 *   // Update UI based on scroll position
 *   updateScrollPosition();
 * }, 100);
 *
 * useEffect(() => {
 *   window.addEventListener('scroll', handleScroll);
 *   return () => {
 *     window.removeEventListener('scroll', handleScroll);
 *     handleScroll.cancel();
 *   };
 * }, []);
 *
 * @example
 * // Use RAF throttle for animations
 * import { rafThrottle } from './utils/performance';
 *
 * const handleMouseMove = rafThrottle((e) => {
 *   // Update animation based on mouse position
 *   updateCursorPosition(e.clientX, e.clientY);
 * });
 */

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 *
 * @param {Function} func - The function to debounce
 * @param {number} wait - The number of milliseconds to delay
 * @param {Object} options - Options object
 * @param {boolean} options.leading - Invoke on the leading edge of the timeout
 * @param {boolean} options.trailing - Invoke on the trailing edge of the timeout
 * @returns {Function} The debounced function
 */
export function debounce(func, wait = 300, options = {}) {
  let timeout;
  let lastArgs;
  let lastThis;
  let result;
  let lastCallTime;

  const { leading = false, trailing = true } = options;

  function invokeFunc(time) {
    const args = lastArgs;
    const thisArg = lastThis;

    lastArgs = lastThis = undefined;
    result = func.apply(thisArg, args);
    return result;
  }

  function leadingEdge(time) {
    lastCallTime = time;
    timeout = setTimeout(timerExpired, wait);
    return leading ? invokeFunc(time) : result;
  }

  function remainingWait(time) {
    const timeSinceLastCall = time - lastCallTime;
    const timeWaiting = wait - timeSinceLastCall;
    return timeWaiting;
  }

  function shouldInvoke(time) {
    const timeSinceLastCall = time - lastCallTime;
    return (
      lastCallTime === undefined ||
      timeSinceLastCall >= wait
    );
  }

  function timerExpired() {
    const time = Date.now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    timeout = setTimeout(timerExpired, remainingWait(time));
  }

  function trailingEdge(time) {
    timeout = undefined;

    if (trailing && lastArgs) {
      return invokeFunc(time);
    }
    lastArgs = lastThis = undefined;
    return result;
  }

  function debounced(...args) {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastThis = this;
    lastCallTime = time;

    if (isInvoking) {
      if (timeout === undefined) {
        return leadingEdge(lastCallTime);
      }
    }
    if (timeout === undefined) {
      timeout = setTimeout(timerExpired, wait);
    }
    return result;
  }

  debounced.cancel = function() {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
    lastCallTime = undefined;
    lastArgs = lastThis = timeout = undefined;
  };

  debounced.flush = function() {
    return timeout === undefined ? result : trailingEdge(Date.now());
  };

  return debounced;
}

/**
 * Creates a throttled function that only invokes func at most once per every wait milliseconds.
 *
 * @param {Function} func - The function to throttle
 * @param {number} wait - The number of milliseconds to throttle invocations to
 * @param {Object} options - Options object
 * @param {boolean} options.leading - Invoke on the leading edge of the timeout
 * @param {boolean} options.trailing - Invoke on the trailing edge of the timeout
 * @returns {Function} The throttled function
 */
export function throttle(func, wait = 300, options = {}) {
  let timeout;
  let previous = 0;
  let result;

  const { leading = true, trailing = true } = options;

  function later(context, args) {
    previous = leading === false ? 0 : Date.now();
    timeout = null;
    result = func.apply(context, args);
  }

  function throttled(...args) {
    const now = Date.now();
    if (!previous && leading === false) {
      previous = now;
    }

    const remaining = wait - (now - previous);
    const context = this;

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      result = func.apply(context, args);
    } else if (!timeout && trailing) {
      timeout = setTimeout(() => later(context, args), remaining);
    }

    return result;
  }

  throttled.cancel = function() {
    if (timeout) {
      clearTimeout(timeout);
    }
    previous = 0;
    timeout = null;
  };

  return throttled;
}

/**
 * Request Animation Frame throttle - ensures function runs at most once per frame (60fps)
 * Useful for scroll handlers and animations
 *
 * @param {Function} func - The function to throttle
 * @returns {Function} The throttled function
 */
export function rafThrottle(func) {
  let rafId = null;
  let lastArgs = null;

  function throttled(...args) {
    lastArgs = args;

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        func.apply(this, lastArgs);
        rafId = null;
        lastArgs = null;
      });
    }
  }

  throttled.cancel = function() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
      lastArgs = null;
    }
  };

  return throttled;
}

/**
 * Memoize function results based on arguments
 * Useful for expensive computations with repeated calls
 *
 * @param {Function} func - The function to memoize
 * @param {Function} resolver - Optional function to compute cache key
 * @returns {Function} The memoized function
 */
export function memoize(func, resolver) {
  const cache = new Map();

  function memoized(...args) {
    const key = resolver ? resolver.apply(this, args) : args[0];

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = func.apply(this, args);
    cache.set(key, result);
    return result;
  }

  memoized.cache = cache;

  memoized.clear = function() {
    cache.clear();
  };

  return memoized;
}

/**
 * Batch multiple rapid calls into a single call
 * Useful for batch processing of events
 *
 * @param {Function} func - The function to batch
 * @param {number} wait - Time to wait before processing batch
 * @returns {Function} The batched function
 */
export function batch(func, wait = 100) {
  let timeout;
  let items = [];

  function batched(item) {
    items.push(item);

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      const batch = items.slice();
      items = [];
      func(batch);
      timeout = null;
    }, wait);
  }

  batched.flush = function() {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    if (items.length > 0) {
      const batch = items.slice();
      items = [];
      func(batch);
    }
  };

  batched.cancel = function() {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    items = [];
  };

  return batched;
}
