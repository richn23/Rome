"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  doc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  getDocs,
  getDoc,
  addDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import RouteGuard from "@/components/RouteGuard";
import { SpeakerStatus, Booking, Session, UserProfile, Rating, SessionRequest, LEVELS, LevelCode } from "@/types";
import CountUp from "@/components/motion/CountUp";
import Avatar from "@/components/Avatar";
import toast from "react-hot-toast";

function SpeakerDashboardContent() {
  const { userProfile } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<SpeakerStatus>(userProfile?.status ?? "offline");
  const [pendingBookings, setPendingBookings] = useState<(Booking & { learnerProfile?: UserProfile })[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<(Booking & { learnerProfile?: UserProfile })[]>([]);
  const [history, setHistory] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  /* Marketplace flow #1 — open learner requests waiting for a speaker */
  const [openRequests, setOpenRequests] = useState<SessionRequest[]>([]);
  const [claimingRequestId, setClaimingRequestId] = useState<string | null>(null);
  /* Tick for "join now" buttons */
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Toggle speaker status
  const handleStatusChange = async (newStatus: SpeakerStatus) => {
    if (!userProfile) return;
    setStatus(newStatus);
    await updateDoc(doc(db, "users", userProfile.uid), { status: newStatus });
  };

  // Real-time listener for pending bookings
  useEffect(() => {
    if (!userProfile) return;
    const q = query(
      collection(db, "bookings"),
      where("speakerId", "==", userProfile.uid),
      where("status", "==", "pending")
    );
    const unsub = onSnapshot(q, async (snap) => {
      const bookings: (Booking & { learnerProfile?: UserProfile })[] = [];
      for (const d of snap.docs) {
        const booking = { bookingId: d.id, ...d.data() } as Booking;
        // Fetch learner profile
        const learnerSnap = await getDocs(
          query(collection(db, "users"), where("uid", "==", booking.learnerId))
        );
        const learnerProfile = learnerSnap.docs[0]?.data() as UserProfile | undefined;
        bookings.push({ ...booking, learnerProfile });
      }
      setPendingBookings(bookings);
    });
    return unsub;
  }, [userProfile]);

  // Listen for active session (for 3-way support)
  useEffect(() => {
    if (!userProfile) return;
    const q = query(
      collection(db, "sessions"),
      where("speakerId", "==", userProfile.uid),
      where("status", "==", "active")
    );
    const unsub = onSnapshot(q, (snap) => {
      if (snap.docs.length > 0) {
        setActiveSession({ sessionId: snap.docs[0].id, ...snap.docs[0].data() } as Session);
      } else {
        setActiveSession(null);
      }
    });
    return unsub;
  }, [userProfile]);

  /* Track previously-seen pending bookings so we can toast on new arrivals */
  const seenPendingIds = useRef<Set<string>>(new Set());
  const isInitialPendingLoad = useRef(true);
  useEffect(() => {
    const currentIds = new Set(pendingBookings.map((b) => b.bookingId));
    if (!isInitialPendingLoad.current) {
      currentIds.forEach((id) => {
        if (!seenPendingIds.current.has(id)) {
          const b = pendingBookings.find((x) => x.bookingId === id);
          const name = b?.learnerProfile?.displayName ?? "A learner";
          toast(`New booking request from ${name}`, { icon: "📩", duration: 6000 });
        }
      });
    }
    seenPendingIds.current = currentIds;
    isInitialPendingLoad.current = false;
  }, [pendingBookings]);

  /* Upcoming bookings: admitted + scheduled + in the future */
  useEffect(() => {
    if (!userProfile) return;
    const q = query(
      collection(db, "bookings"),
      where("speakerId", "==", userProfile.uid),
      where("status", "==", "admitted")
    );
    const unsub = onSnapshot(q, async (snap) => {
      const all: Booking[] = [];
      snap.forEach((d) => all.push({ bookingId: d.id, ...d.data() } as Booking));
      const now = new Date();
      const future = all.filter(
        (b) => b.scheduledFor && b.scheduledFor.toDate() > now
      );
      future.sort(
        (a, b) =>
          (a.scheduledFor?.toMillis?.() ?? 0) - (b.scheduledFor?.toMillis?.() ?? 0)
      );

      // Hydrate learner profiles
      const enriched = await Promise.all(
        future.map(async (b) => {
          const p = await getDoc(doc(db, "users", b.learnerId));
          return {
            ...b,
            learnerProfile: p.exists() ? (p.data() as UserProfile) : undefined,
          };
        })
      );
      setUpcomingBookings(enriched);
    });
    return unsub;
  }, [userProfile]);

  /* Ratings received */
  useEffect(() => {
    if (!userProfile) return;
    const fetchRatings = async () => {
      const q = query(
        collection(db, "ratings"),
        where("speakerId", "==", userProfile.uid),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const arr: Rating[] = [];
      snap.forEach((d) => arr.push({ ratingId: d.id, ...d.data() } as Rating));
      setRatings(arr);
    };
    fetchRatings();
  }, [userProfile]);

  /* Open learner requests — marketplace board. We only show future ones.
   * Filter client-side by language match against the speaker's nativeLanguage
   * so the feed stays relevant (but keep the query cheap — single field). */
  useEffect(() => {
    const q = query(
      collection(db, "requests"),
      where("status", "==", "open"),
      orderBy("requestedFor", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const now = Timestamp.now();
      const arr: SessionRequest[] = [];
      snap.forEach((d) => {
        const r = { requestId: d.id, ...d.data() } as SessionRequest;
        if (r.requestedFor && r.requestedFor.toMillis() > now.toMillis()) {
          arr.push(r);
        }
      });
      setOpenRequests(arr);
    });
    return unsub;
  }, []);

  /* Claim an open request — transaction so two speakers can't both grab it.
   * Converts the request doc to status=claimed and creates an admitted
   * booking atomically; the learner's snapshot listener picks up both. */
  const handleClaimRequest = async (req: SessionRequest) => {
    if (!userProfile) return;
    if (userProfile.awayMode) {
      toast.error("Turn off Away mode first");
      return;
    }
    setClaimingRequestId(req.requestId);
    try {
      await runTransaction(db, async (txn) => {
        const reqRef = doc(db, "requests", req.requestId);
        const latest = await txn.get(reqRef);
        if (!latest.exists() || latest.data().status !== "open") {
          throw new Error("Too late — someone else just claimed it");
        }
        const bookingRef = doc(collection(db, "bookings"));
        txn.set(bookingRef, {
          learnerId: req.learnerId,
          speakerId: userProfile.uid,
          requestedAt: serverTimestamp(),
          status: "admitted",
          scheduledFor: req.requestedFor,
          requestId: req.requestId,
          topicSuggestion: req.topic ?? null,
          sessionId: null,
        });
        txn.update(reqRef, {
          status: "claimed",
          claimedBySpeakerId: userProfile.uid,
          claimedAt: serverTimestamp(),
          bookingId: bookingRef.id,
        });
      });
      toast.success("Claimed — it's on your calendar");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not claim");
    } finally {
      setClaimingRequestId(null);
    }
  };

  // Fetch session history
  useEffect(() => {
    if (!userProfile) return;
    const fetchHistory = async () => {
      const q = query(
        collection(db, "sessions"),
        where("speakerId", "==", userProfile.uid),
        where("status", "==", "ended"),
        orderBy("endedAt", "desc")
      );
      const snap = await getDocs(q);
      setHistory(snap.docs.map((d) => ({ sessionId: d.id, ...d.data() }) as Session));
    };
    fetchHistory();
  }, [userProfile]);

  const handleAdmit = async (booking: Booking) => {
    if (!userProfile) return;

    // If there's an active session, add learner to it (3-way support)
    if (activeSession && activeSession.learnerIds.length < 2) {
      const updatedLearnerIds = [...activeSession.learnerIds, booking.learnerId];
      await updateDoc(doc(db, "sessions", activeSession.sessionId), {
        learnerIds: updatedLearnerIds,
      });
      await updateDoc(doc(db, "bookings", booking.bookingId), {
        status: "admitted",
        sessionId: activeSession.sessionId,
      });
      toast.success("Learner added to active session!");
      return;
    }

    // Create new session
    const jitsiRoomId = crypto.randomUUID();
    const sessionRef = await addDoc(collection(db, "sessions"), {
      speakerId: userProfile.uid,
      learnerIds: [booking.learnerId],
      status: "active",
      jitsiRoomId,
      startedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "bookings", booking.bookingId), {
      status: "admitted",
      sessionId: sessionRef.id,
    });
    await updateDoc(doc(db, "users", userProfile.uid), { status: "busy" });
    setStatus("busy");
    router.push(`/call/${sessionRef.id}`);
  };

  const handleReject = async (booking: Booking) => {
    await updateDoc(doc(db, "bookings", booking.bookingId), {
      status: "rejected",
    });
  };

  /* Cancel an upcoming booking (speaker side) */
  const handleCancelUpcoming = async (b: Booking) => {
    if (!confirm("Cancel this scheduled session? The learner will be notified.")) return;
    try {
      await updateDoc(doc(db, "bookings", b.bookingId), { status: "cancelled" });
      if (b.slotId) {
        await updateDoc(doc(db, "availability", b.slotId), {
          status: "available",
          bookingId: null,
        });
      }
      toast.success("Session cancelled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel");
    }
  };

  /* Earnings breakdown */
  const earnings = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Sunday
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let week = 0;
    let month = 0;
    let all = 0;
    history.forEach((s) => {
      const pay = s.speakerPayout ?? 0;
      all += pay;
      const endedDate = s.endedAt?.toDate?.();
      if (!endedDate) return;
      if (endedDate >= monthStart) month += pay;
      if (endedDate >= weekStart) week += pay;
    });
    return { week, month, all };
  }, [history]);

  /* Avg rating */
  const avgRating = useMemo(() => {
    if (ratings.length === 0) return userProfile?.rating ?? 0;
    const total = ratings.reduce((sum, r) => sum + r.score, 0);
    return total / ratings.length;
  }, [ratings, userProfile?.rating]);

  const firstName = userProfile?.displayName?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-xl md:p-10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-56 w-56 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-teal-300">Speaker</p>
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">Hi {firstName}</h2>
            <div className="flex flex-wrap gap-4 text-sm font-medium">
              <Link
                href="/dashboard/speaker/profile"
                className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-slate-200 backdrop-blur-sm transition hover:bg-white/10 hover:text-white"
              >
                Edit profile &rarr;
              </Link>
              <Link
                href="/dashboard/speaker/availability"
                className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-slate-200 backdrop-blur-sm transition hover:bg-white/10 hover:text-white"
              >
                Manage availability &rarr;
              </Link>
              <Link
                href="/dashboard/speaker/resources"
                className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-slate-200 backdrop-blur-sm transition hover:bg-white/10 hover:text-white"
              >
                Resources &rarr;
              </Link>
              <Link
                href="/dashboard/speaker/guidance"
                className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-slate-200 backdrop-blur-sm transition hover:bg-white/10 hover:text-white"
              >
                Guidance &rarr;
              </Link>
            </div>
            {userProfile?.awayMode && (
              <span className="mt-3 inline-block rounded-full border border-amber-300/30 bg-amber-400/15 px-3 py-1 text-xs font-medium text-amber-200">
                Away mode on — learners can&apos;t see you
              </span>
            )}
          </div>
          {/* Status Toggle */}
          <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1 backdrop-blur-sm">
            {(["online", "busy", "offline"] as SpeakerStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
                  status === s
                    ? s === "online"
                      ? "bg-green-500 text-white shadow-sm"
                      : s === "busy"
                      ? "bg-yellow-500 text-white shadow-sm"
                      : "bg-slate-500 text-white shadow-sm"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">This week</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-teal-600 dark:text-teal-400">
            <CountUp to={earnings.week} decimals={2} prefix="$" />
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">This month</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-teal-600 dark:text-teal-400">
            <CountUp to={earnings.month} decimals={2} prefix="$" />
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">All time</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-teal-600 dark:text-teal-400">
            <CountUp to={earnings.all} decimals={2} prefix="$" />
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Sessions</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-teal-600 dark:text-teal-400">
            <CountUp to={history.length} />
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Rating</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-amber-500">
            {avgRating > 0 ? <CountUp to={avgRating} decimals={1} /> : "—"}
            <span className="ml-1 font-sans text-sm font-normal text-slate-400 dark:text-slate-500">({ratings.length})</span>
          </p>
        </div>
      </div>

      {/* Resource Bank — link into the full Resources page */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {/* Stack header + CTA on mobile; side-by-side at sm+. */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-400 to-cyan-500 text-base">
                📚
              </span>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Resource Bank
              </h3>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Shared handouts, prompts, and materials across all speakers.
            </p>
          </div>
          <Link
            href="/dashboard/speaker/resources"
            className="shrink-0 self-start whitespace-nowrap rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-500/20 dark:text-teal-300"
          >
            Open resources &rarr;
          </Link>
        </div>
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-8 px-6 text-center dark:border-slate-700 dark:bg-slate-900/60">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Browse or share a resource
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Upload a PDF, handout, or slide deck, or download something another speaker has shared.
          </p>
        </div>
      </div>

      {/* Incoming Requests */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Incoming Requests</h3>
          {pendingBookings.length > 0 && (
            <span className="rounded-full bg-teal-600 px-2 py-0.5 text-xs font-semibold text-white">
              {pendingBookings.length}
            </span>
          )}
        </div>
        {pendingBookings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 py-10 text-center text-slate-400 dark:text-slate-500">
            No pending requests
          </div>
        ) : (
          <div className="space-y-3">
            {pendingBookings.map((b) => (
              <div
                key={b.bookingId}
                className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    photoURL={b.learnerProfile?.photoURL}
                    displayName={b.learnerProfile?.displayName}
                    className="h-11 w-11 rounded-full ring-1 ring-teal-100 dark:ring-teal-900/50"
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {b.learnerProfile?.displayName ?? "Learner"}
                      </p>
                      {b.challengeUp && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                          Challenge Up
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {b.learnerProfile?.level
                        ? LEVELS[b.learnerProfile.level as LevelCode]
                        : "Unknown level"}
                      {b.learnerProfile?.learningLanguage &&
                        ` · Learning ${b.learnerProfile.learningLanguage}`}
                    </p>
                    {b.challengeUp && (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                        Learner wants to be pushed up a level for this session.
                      </p>
                    )}
                    {b.topicSuggestion && (
                      <p className="mt-1 text-sm italic text-slate-600 dark:text-slate-300">
                        &ldquo;{b.topicSuggestion}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAdmit(b)}
                    className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700"
                  >
                    Admit
                  </button>
                  <button
                    onClick={() => handleReject(b)}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========= Marketplace flow #1 — Open learner requests ========= */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Open learner requests
          </h3>
          {openRequests.length > 0 && (
            <span className="rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 px-2 py-0.5 text-xs font-semibold text-slate-900">
              {openRequests.length}
            </span>
          )}
        </div>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          Learners posted these without a specific speaker. Claim one and it lands on your calendar.
        </p>
        {openRequests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
            Nothing open right now — check back later.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {openRequests.map((r) => {
              const when = r.requestedFor?.toDate?.();
              const matchesMyLang =
                !!userProfile?.nativeLanguage && r.language === userProfile.nativeLanguage;
              const aboveBudget =
                r.budgetMax !== undefined &&
                r.budgetMax > 0 &&
                (userProfile?.hourlyRate ?? 0) > r.budgetMax;
              const isClaiming = claimingRequestId === r.requestId;
              return (
                <div
                  key={r.requestId}
                  className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-400/40 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-400/30"
                >
                  {matchesMyLang && (
                    <span className="absolute right-3 top-3 rounded-full bg-teal-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-teal-700 dark:text-teal-300">
                      YOUR LANGUAGE
                    </span>
                  )}
                  <div className="flex items-start gap-3">
                    <Avatar
                      photoURL={r.learnerPhotoURL}
                      displayName={r.learnerName}
                      className="h-11 w-11 rounded-xl ring-1 ring-teal-100 dark:ring-teal-900/40"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                        {r.learnerName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {r.language} · {r.durationMinutes} min
                        {r.learnerLevel ? ` · ${LEVELS[r.learnerLevel as LevelCode]}` : ""}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
                    {when
                      ? when.toLocaleString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : ""}
                  </p>
                  {r.topic && (
                    <p className="mt-1 text-sm italic text-slate-500 dark:text-slate-400">
                      &ldquo;{r.topic}&rdquo;
                    </p>
                  )}
                  {r.budgetMax !== undefined && r.budgetMax > 0 && (
                    <p
                      className={`mt-2 font-mono text-xs ${
                        aboveBudget
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      Budget: up to ${r.budgetMax}/hr
                      {aboveBudget && " — above your rate"}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={isClaiming}
                    onClick={() => handleClaimRequest(r)}
                    className="mt-4 w-full rounded-lg bg-gradient-to-r from-teal-400 to-cyan-400 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:shadow-[0_8px_24px_-8px_rgba(45,212,191,0.7)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isClaiming ? "Claiming…" : "Claim session"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upcoming Sessions */}
      {upcomingBookings.length > 0 && (
        <div>
          <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Upcoming Sessions</h3>
          <div className="space-y-3">
            {upcomingBookings.map((b) => {
              const when = b.scheduledFor?.toDate?.();
              const minutesAway = when
                ? (when.getTime() - nowTick) / 60_000
                : null;
              const joinable = minutesAway !== null && minutesAway <= 15;
              return (
                <div
                  key={b.bookingId}
                  className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      photoURL={b.learnerProfile?.photoURL}
                      displayName={b.learnerProfile?.displayName}
                      className="h-11 w-11 rounded-full ring-1 ring-teal-100 dark:ring-teal-900/50"
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {b.learnerProfile?.displayName ?? "Learner"}
                        </p>
                        {b.challengeUp && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                            Challenge Up
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {when?.toLocaleString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {b.learnerProfile?.level &&
                          ` · ${LEVELS[b.learnerProfile.level as LevelCode]}`}
                      </p>
                      {b.topicSuggestion && (
                        <p className="mt-1 text-sm italic text-slate-600 dark:text-slate-300">
                          &ldquo;{b.topicSuggestion}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {joinable && b.sessionId && (
                      <Link
                        href={`/call/${b.sessionId}`}
                        className="rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:shadow-md"
                      >
                        Join
                      </Link>
                    )}
                    <button
                      onClick={() => handleCancelUpcoming(b)}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ratings Received */}
      {ratings.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Recent Reviews</h3>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {avgRating.toFixed(1)} average
            </span>
          </div>
          <div className="space-y-3">
            {ratings.slice(0, 5).map((r) => (
              <div
                key={r.ratingId}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="text-amber-500">
                    {"★".repeat(r.score)}
                    <span className="text-slate-300">{"★".repeat(5 - r.score)}</span>
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {r.createdAt?.toDate?.()?.toLocaleDateString() ?? ""}
                  </span>
                </div>
                {r.comment && (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">&ldquo;{r.comment}&rdquo;</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      <div>
        <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Session History</h3>
        {history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 py-10 text-center text-slate-400 dark:text-slate-500">
            No sessions yet
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((s) => (
              <div key={s.sessionId} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">Session #{s.sessionId.slice(0, 8)}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {s.durationMinutes ?? 0} min · ${s.speakerPayout?.toFixed(2) ?? "0.00"}
                  </p>
                </div>
                <span className="text-sm text-slate-400 dark:text-slate-500">
                  {s.endedAt?.toDate?.()?.toLocaleDateString() ?? ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SpeakerDashboard() {
  return (
    <RouteGuard allowedRole="speaker">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <SpeakerDashboardContent />
      </div>
    </RouteGuard>
  );
}

