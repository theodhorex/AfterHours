import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  getReducedMotion,
  subscribeReducedMotion,
} from "../src/lib/a11y/reduced-motion.ts";

describe("Reduced Motion Pure Helpers (TDD)", () => {
  type Listener = (e: { matches: boolean }) => void;

  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    originalWindow = globalThis.window;
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  it("getReducedMotion returns false in SSR / non-browser environment", () => {
    // @ts-expect-error - simulating SSR environment
    delete globalThis.window;
    assert.equal(getReducedMotion(), false);
  });

  it("getReducedMotion queries prefers-reduced-motion: reduce accurately", () => {
    let mockMatches = true;
    globalThis.window = {
      matchMedia: (query: string) => {
        assert.equal(query, "(prefers-reduced-motion: reduce)");
        return {
          matches: mockMatches,
          addEventListener: () => {},
          removeEventListener: () => {},
        } as unknown as MediaQueryList;
      },
    } as unknown as Window & typeof globalThis;

    assert.equal(getReducedMotion(), true);

    mockMatches = false;
    assert.equal(getReducedMotion(), false);
  });

  it("subscribeReducedMotion returns no-op unsubscribe when window is undefined", () => {
    // @ts-expect-error - simulating SSR
    delete globalThis.window;
    let called = false;
    const unsubscribe = subscribeReducedMotion(() => {
      called = true;
    });
    assert.equal(typeof unsubscribe, "function");
    unsubscribe();
    assert.equal(called, false);
  });

  it("subscribeReducedMotion notifies callback on change and unsubscribes properly", () => {
    const listeners: Listener[] = [];
    let matchesState = false;

    globalThis.window = {
      matchMedia: (query: string) => {
        assert.equal(query, "(prefers-reduced-motion: reduce)");
        return {
          matches: matchesState,
          addEventListener: (event: string, fn: Listener) => {
            if (event === "change") listeners.push(fn);
          },
          removeEventListener: (event: string, fn: Listener) => {
            if (event === "change") {
              const idx = listeners.indexOf(fn);
              if (idx !== -1) listeners.splice(idx, 1);
            }
          },
        } as unknown as MediaQueryList;
      },
    } as unknown as Window & typeof globalThis;

    const received: boolean[] = [];
    const unsubscribe = subscribeReducedMotion((reduced) => {
      received.push(reduced);
    });

    assert.equal(listeners.length, 1);

    // Simulate system preference change to reduced motion
    matchesState = true;
    listeners[0]({ matches: true });
    assert.deepEqual(received, [true]);

    // Simulate change back to false
    matchesState = false;
    listeners[0]({ matches: false });
    assert.deepEqual(received, [true, false]);

    // Unsubscribe
    unsubscribe();
    assert.equal(listeners.length, 0);

    // Should not receive further changes
    if (listeners[0]) listeners[0]({ matches: true });
    assert.deepEqual(received, [true, false]);
  });

  it("supports fallback to legacy addListener/removeListener if addEventListener is absent", () => {
    const listeners: Listener[] = [];
    globalThis.window = {
      matchMedia: () => ({
        matches: false,
        addListener: (fn: Listener) => {
          listeners.push(fn);
        },
        removeListener: (fn: Listener) => {
          const idx = listeners.indexOf(fn);
          if (idx !== -1) listeners.splice(idx, 1);
        },
      } as unknown as MediaQueryList),
    } as unknown as Window & typeof globalThis;

    let count = 0;
    const unsubscribe = subscribeReducedMotion(() => {
      count++;
    });
    assert.equal(listeners.length, 1);
    listeners[0]({ matches: true });
    assert.equal(count, 1);

    unsubscribe();
    assert.equal(listeners.length, 0);
  });
});
