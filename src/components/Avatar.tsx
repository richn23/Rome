"use client";

import { useState } from "react";

/**
 * Reusable avatar with graceful fallback.
 *
 * Tries to render `photoURL`; if the image fails to load (broken URL, CORS,
 * 403, stale Firebase Storage token, etc.) it swaps to a gradient-initial
 * fallback so the layout never collapses into empty space.
 *
 * Callers own the sizing + shape via `className` (e.g. "h-7 w-7 rounded-full")
 * so this single component works for nav, cards, detail pages, etc.
 *
 * `textClassName` controls the initial's font size for the fallback.
 *
 * Implementation note: we track "which URL errored" rather than a boolean
 * `errored` flag so state resets automatically when photoURL changes —
 * avoids a setState-in-effect that the React Compiler rightly flags.
 */
export default function Avatar({
  photoURL,
  displayName,
  initial: initialProp,
  className = "h-10 w-10 rounded-full",
  textClassName = "text-sm",
  alt = "",
}: {
  photoURL?: string;
  displayName?: string;
  /** Optional explicit fallback character — overrides first letter of displayName. */
  initial?: string;
  className?: string;
  textClassName?: string;
  alt?: string;
}) {
  const [erroredURL, setErroredURL] = useState<string | null>(null);

  const initial = (initialProp || displayName?.charAt(0) || "?").toUpperCase();
  const showImg = !!photoURL && photoURL !== erroredURL;

  if (showImg) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoURL}
        alt={alt}
        onError={() => setErroredURL(photoURL ?? null)}
        className={`object-cover ${className}`}
      />
    );
  }

  return (
    <span
      aria-label={displayName ? `${displayName}'s avatar` : undefined}
      className={`flex items-center justify-center bg-gradient-to-br from-teal-400 to-cyan-500 font-bold text-white ${textClassName} ${className}`}
    >
      {initial}
    </span>
  );
}
