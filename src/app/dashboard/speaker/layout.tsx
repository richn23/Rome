/**
 * Speaker-scoped layout.
 *
 * Sits INSIDE the shared /dashboard layout (which provides the Navbar and
 * page padding) so nothing below has to change. Its only job is to paint a
 * very subtle aurora drift behind speaker-facing content — the same teal +
 * cyan blobs used on the call page hero, but dialled down to "barely there".
 *
 * Why a dedicated layout here:
 *   - /dashboard/layout.tsx wraps all roles (learner, speaker, admin).
 *   - The brief is explicit: aurora ONLY on speaker pages.
 *   - Next.js automatically applies this layout to every child route under
 *     /dashboard/speaker (profile, availability, resources, guidance, …).
 *
 * The blobs are pointer-events-none and sit at z-0 so nothing above them
 * becomes unclickable. The content is lifted to z-10 so it paints above.
 * The `drift` / `drift-delay` keyframes in globals.css already include a
 * prefers-reduced-motion guard — no extra work needed for a11y.
 */
export default function SpeakerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative isolate overflow-hidden">
      {/* Aurora blobs — subtle, ambient, behind all content */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -left-24 z-0 h-[32rem] w-[32rem] rounded-full bg-teal-400/10 blur-3xl drift dark:bg-teal-500/15"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 right-[-8rem] z-0 h-[28rem] w-[28rem] rounded-full bg-cyan-400/10 blur-3xl drift-delay dark:bg-cyan-400/15"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-10rem] left-1/3 z-0 h-[24rem] w-[24rem] rounded-full bg-sky-400/10 blur-3xl drift dark:bg-sky-500/10"
      />

      {/* Content sits above the aurora */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
