/**
 * Speaker-scoped layout.
 *
 * Sits INSIDE the shared /dashboard layout (which provides the Navbar and
 * page padding) so nothing below has to change. Its only job is to paint
 * an ambient aurora drift behind speaker-facing content — a slow multi-blob
 * wash that's visible but not distracting.
 *
 * Why a dedicated layout here:
 *   - /dashboard/layout.tsx wraps all roles (learner, speaker, admin).
 *   - Aurora should appear on speaker routes only (profile, availability,
 *     resources, guidance, …) — Next's nested-layout convention does the rest.
 *
 * Sizing notes:
 *   - Blobs are larger than the viewport corners so their centres sit just
 *     off-screen; what you see is the outer fall-off of the radial blur,
 *     which is what makes it read as "atmospheric" rather than "three dots".
 *   - The `aurora` / `aurora-delay` / `aurora-delay-2` classes each run a
 *     20–32 s keyframe with ±80px translation — visible without being busy.
 *     The reduced-motion media query in globals.css disables it entirely.
 */
export default function SpeakerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative isolate overflow-hidden">
      {/* Top-left — teal */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-40 z-0 h-[44rem] w-[44rem] rounded-full bg-teal-400/15 blur-3xl aurora dark:bg-teal-500/20"
      />
      {/* Top-right — cyan */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 right-[-14rem] z-0 h-[40rem] w-[40rem] rounded-full bg-cyan-400/12 blur-3xl aurora-delay dark:bg-cyan-400/20"
      />
      {/* Mid-right — sky (gives the right side of the page some life) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/3 right-[-8rem] z-0 h-[32rem] w-[32rem] rounded-full bg-sky-400/10 blur-3xl aurora-delay-2 dark:bg-sky-500/15"
      />
      {/* Bottom-left — teal/mint (anchors the lower half) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-16rem] left-1/4 z-0 h-[40rem] w-[40rem] rounded-full bg-emerald-400/10 blur-3xl aurora dark:bg-emerald-500/12"
      />

      {/* Content sits above the aurora */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
