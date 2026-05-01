/**
 * Shared close-out logic for a live session.
 *
 * Two call sites need the same numbers:
 *   - `call/[sessionId]` endSession()  (normal "End Session" button)
 *   - `dashboard/speaker` handleEndOrphanSession()  (the "End it" button on
 *      the zombie-session banner)
 *
 * Both must cap the duration so a stale session that's been in `active` for
 * hours/days doesn't produce "10222 minutes" on the summary screen.
 *
 * Returns the numeric fields ready to be spread into the sessions/{id} doc.
 */

export const MAX_SESSION_MINUTES = 180;          // hard cap — 3 hours
export const MIN_SESSION_MINUTES = 1;
export const DEFAULT_HOURLY_RATE = 15;           // placeholder rate, was inline
export const PLATFORM_CUT_RATE = 0.2;

export interface SessionCloseNumbers {
  durationMinutes: number;
  amountCharged: number;
  platformCut: number;
  speakerPayout: number;
}

/**
 * Compute the fields a session needs when it closes.
 *
 * - Duration is capped at `MAX_SESSION_MINUTES` regardless of how long the
 *   session has technically been open (zombie-session safety).
 * - Payment numbers are derived from the capped duration so they can't
 *   overflow either.
 */
export function computeSessionClose(
  startedAt: Date | null | undefined,
  now: Date = new Date(),
  hourlyRate: number = DEFAULT_HOURLY_RATE
): SessionCloseNumbers {
  const started = startedAt ?? now;
  const rawMinutes = Math.round((now.getTime() - started.getTime()) / 60000);
  const durationMinutes = Math.max(
    MIN_SESSION_MINUTES,
    Math.min(MAX_SESSION_MINUTES, rawMinutes)
  );

  const amountCharged = parseFloat(((hourlyRate / 60) * durationMinutes).toFixed(2));
  const platformCut = parseFloat((amountCharged * PLATFORM_CUT_RATE).toFixed(2));
  const speakerPayout = parseFloat((amountCharged - platformCut).toFixed(2));

  return { durationMinutes, amountCharged, platformCut, speakerPayout };
}
