import { debounce, throttle, rafThrottle, memoize, batch } from '../performance';

describe('Performance Utilities', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('debounce', () => {
    it('should delay function execution', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(50);
      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should reset timer on multiple calls', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      jest.advanceTimersByTime(50);
      debouncedFn();
      jest.advanceTimersByTime(50);
      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments correctly', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('arg1', 'arg2');
      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should cancel pending execution', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      debouncedFn.cancel();
      jest.advanceTimersByTime(100);

      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('throttle', () => {
    it('should execute immediately on first call', () => {
      const fn = jest.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should prevent execution within limit period', () => {
      const fn = jest.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      throttledFn();
      throttledFn();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should allow execution after limit period', () => {
      const fn = jest.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      jest.advanceTimersByTime(100);
      throttledFn();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should pass arguments correctly', () => {
      const fn = jest.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn('arg1', 'arg2');
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('rafThrottle', () => {
    let mockRequestAnimationFrame;
    let mockCancelAnimationFrame;
    let frameCallbacks;

    beforeEach(() => {
      frameCallbacks = [];
      mockRequestAnimationFrame = jest.fn((callback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      });
      mockCancelAnimationFrame = jest.fn((id) => {
        frameCallbacks[id - 1] = null;
      });
      global.requestAnimationFrame = mockRequestAnimationFrame;
      global.cancelAnimationFrame = mockCancelAnimationFrame;
    });

    afterEach(() => {
      delete global.requestAnimationFrame;
      delete global.cancelAnimationFrame;
    });

    it('should throttle using requestAnimationFrame', () => {
      const fn = jest.fn();
      const throttledFn = rafThrottle(fn);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(fn).not.toHaveBeenCalled();
      expect(mockRequestAnimationFrame).toHaveBeenCalledTimes(1);

      frameCallbacks[0]();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass latest arguments', () => {
      const fn = jest.fn();
      const throttledFn = rafThrottle(fn);

      throttledFn('arg1');
      throttledFn('arg2');
      throttledFn('arg3');

      frameCallbacks[0]();
      expect(fn).toHaveBeenCalledWith('arg3');
    });

    it('should cancel pending frame', () => {
      const fn = jest.fn();
      const throttledFn = rafThrottle(fn);

      throttledFn();
      throttledFn.cancel();

      expect(mockCancelAnimationFrame).toHaveBeenCalled();
    });
  });

  describe('memoize', () => {
    it('should cache function results', () => {
      const fn = jest.fn((x, y) => x + y);
      const memoizedFn = memoize(fn);

      const result1 = memoizedFn(1, 2);
      const result2 = memoizedFn(1, 2);

      expect(result1).toBe(3);
      expect(result2).toBe(3);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should call function with new arguments', () => {
      const fn = jest.fn((x, y) => x + y);
      const memoizedFn = memoize(fn);

      memoizedFn(1, 2);
      memoizedFn(2, 3);

      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should use custom key resolver', () => {
      const fn = jest.fn((obj) => obj.value);
      const keyResolver = (obj) => obj.id;
      const memoizedFn = memoize(fn, keyResolver);

      const obj1 = { id: 1, value: 'a' };
      const obj2 = { id: 1, value: 'b' };

      memoizedFn(obj1);
      memoizedFn(obj2);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should clear cache', () => {
      const fn = jest.fn((x) => x * 2);
      const memoizedFn = memoize(fn);

      memoizedFn(5);
      memoizedFn.clear();
      memoizedFn(5);

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('batch', () => {
    it('should batch multiple calls', () => {
      const fn = jest.fn((items) => items);
      const batchedFn = batch(fn, 50);

      batchedFn(1);
      batchedFn(2);
      batchedFn(3);

      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledWith([1, 2, 3]);
    });

    it('should execute immediately when batch size reached', () => {
      const fn = jest.fn((items) => items);
      const batchedFn = batch(fn, 50, 3);

      batchedFn(1);
      batchedFn(2);
      expect(fn).not.toHaveBeenCalled();

      batchedFn(3);
      expect(fn).toHaveBeenCalledWith([1, 2, 3]);
    });

    it('should handle multiple batches', () => {
      const fn = jest.fn((items) => items);
      const batchedFn = batch(fn, 50, 2);

      batchedFn(1);
      batchedFn(2);
      expect(fn).toHaveBeenCalledTimes(1);

      batchedFn(3);
      batchedFn(4);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should flush pending items', () => {
      const fn = jest.fn((items) => items);
      const batchedFn = batch(fn, 50);

      batchedFn(1);
      batchedFn(2);
      batchedFn.flush();

      expect(fn).toHaveBeenCalledWith([1, 2]);
    });
  });
});
