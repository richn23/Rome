/**
 * Learner-scoped layout.
 *
 * Same ambient aurora drift as the speaker layout, but with a slightly
 * warmer palette (a rose accent alongside the teal/cyan) so the learner
 * space reads subtly distinct from the speaker space without needing
 * explicit labels beyond the role pill in the nav.
 *
 * Reuses the `aurora` / `aurora-delay` / `aurora-delay-2` keyframes from
 * globals.css — the reduced-motion guard there already disables them for
 * users who've opted out of motion.
 */
export default function LearnerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative isolate overflow-hidden">
      {/* Top-left — teal (shared brand colour) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-40 z-0 h-[44rem] w-[44rem] rounded-full bg-teal-400/15 blur-3xl aurora dark:bg-teal-500/20"
      />
      {/* Top-right — rose (warm accent that says "learner") */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 right-[-14rem] z-0 h-[40rem] w-[40rem] rounded-full bg-rose-400/10 blur-3xl aurora-delay dark:bg-rose-500/15"
      />
      {/* Mid-right — cyan (keeps the cool side alive) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/3 right-[-8rem] z-0 h-[32rem] w-[32rem] rounded-full bg-cyan-400/10 blur-3xl aurora-delay-2 dark:bg-cyan-400/15"
      />
      {/* Bottom-left — amber/peach (warmth on the lower half) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-16rem] left-1/4 z-0 h-[40rem] w-[40rem] rounded-full bg-amber-300/10 blur-3xl aurora dark:bg-amber-400/15"
      />

      {/* Content sits above the aurora */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
