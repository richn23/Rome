"use client";

/**
 * A small pulsing dot for "live"/"online" states. Uses the .breathe CSS
 * class so reduced-motion users get a plain dot.
 *
 * `variant="online"` → green (speaker status / user online).
 * `variant="busy"`   → amber, no pulse (in-session).
 * `variant="live"`   → teal (live-data cards, count-ups).
 */
export default function LiveDot({
  variant = "online",
  size = "sm",
  className = "",
}: {
  variant?: "online" | "busy" | "live" | "offline";
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const sizeClass =
    size === "xs" ? "h-2 w-2" : size === "md" ? "h-3.5 w-3.5" : "h-2.5 w-2.5";

  const colour =
    variant === "online"
      ? "bg-green-400"
      : variant === "busy"
      ? "bg-amber-400"
      : variant === "live"
      ? "bg-teal-300"
      : "bg-slate-400";

  const pulse =
    variant === "online"
      ? "breathe"
      : variant === "live"
      ? "breathe-teal"
      : "";

  return (
    <span className={`relative inline-flex ${sizeClass} ${className}`}>
      {pulse && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full ${colour} ${pulse}`}
        />
      )}
      <span className={`relative inline-flex rounded-full ${sizeClass} ${colour}`} />
    </span>
  );
}
