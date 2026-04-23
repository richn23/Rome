"use client";

import { useEffect } from "react";

/**
 * Adds the class `in` to any element matching `selector` once it scrolls into
 * view. Used by our motion primitives that need trigger-on-scroll:
 *   - .kin      (kinetic text reveal)
 *   - .flourish (SVG path draw)
 *
 * Unobserves the element after firing so motion only plays once per session.
 * Safe under prefers-reduced-motion — CSS handles fallback.
 *
 * Pass `immediate: true` for elements that should animate on mount regardless
 * of viewport (e.g. hero headline on first paint).
 */
export function useScrollReveal(
  selector: string,
  opts: { threshold?: number; immediate?: boolean } = {}
) {
  const { threshold = 0.2, immediate = false } = opts;

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(selector);
    if (els.length === 0) return;

    if (immediate) {
      // One frame of breathing room lets the browser paint the initial state
      // before the animation starts — avoids a visual jolt.
      requestAnimationFrame(() => els.forEach((el) => el.classList.add("in")));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold }
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [selector, threshold, immediate]);
}
