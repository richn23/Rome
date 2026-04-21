"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  setDoc,
  deleteDoc,
  documentId,
} from "firebase/firestore";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import RouteGuard from "@/components/RouteGuard";
import { UserProfile, Session, Topic, AvailabilitySlot, Booking, LevelSignal, LEVELS, LevelCode } from "@/types";
import toast from "react-hot-toast";

function SpeakerCard({
  speaker,
  onBook,
  isFavourite,
  onToggleFavourite,
}: {
  speaker: UserProfile;
  onBook: (speaker: UserProfile) => void;
  isFavourite?: boolean;
  onToggleFavourite?: (speaker: UserProfile) => void;
}) {
  return (
    <Link
      href={`/speakers/${speaker.uid}`}
      className="block rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center gap-4">
        {speaker.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={speaker.photoURL}
            alt=""
            className="h-14 w-14 rounded-full object-cover ring-1 ring-teal-100"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 text-xl font-bold text-white shadow-sm">
            {speaker.displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">{speaker.displayName}</h3>
          {speaker.nativeLanguage && (
            <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">{speaker.nativeLanguage}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onToggleFavourite && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavourite(speaker);
              }}
              title={isFavourite ? "Remove from favourites" : "Add to favourites"}
              className={`text-lg leading-none transition ${
                isFavourite ? "text-rose-500" : "text-slate-300 hover:text-rose-400"
              }`}
            >
              {isFavourite ? "♥" : "♡"}
            </button>
          )}
          <span
            className={`h-3 w-3 rounded-full ${
              speaker.status === "online"
                ? "bg-green-400"
                : speaker.status === "busy"
                ? "bg-yellow-400"
                : "bg-slate-300"
            }`}
          />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
          <span>${speaker.hourlyRate ?? 0}/hr</span>
          <span className="text-amber-400">
            {"*".repeat(Math.round(speaker.rating ?? 0))}
          </span>
        </div>
        {speaker.status === "online" ? (
          <button
            onClick={(e) => {
              e.preventDefault();
              onBook(speaker);
            }}
            className="rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
          >
            Book
          </button>
        ) : (
          <span className="text-sm text-slate-400 dark:text-slate-500 capitalize">{speaker.status}</span>
        )}
      </div>
    </Link>
  );
}

function TopicCard({ topic }: { topic: Topic }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-full bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 text-xs font-medium text-teal-700 dark:text-teal-300 capitalize">
          {topic.category}
        </span>
      </div>
      <h3 className="mb-2 font-semibold text-slate-900 dark:text-slate-100">{topic.title}</h3>
      {topic.promptQuestions?.[0] && (
        <p className="text-sm italic text-slate-500 dark:text-slate-400 dark:text-slate-500">&ldquo;{topic.promptQuestions[0]}&rdquo;</p>
      )}
      <div className="mt-3 flex flex-wrap gap-1">
        {topic.vocabularyHints?.slice(0, 3).map((v) => (
          <span key={v} className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-300">
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}

function LearnerDashboardContent() {
  const { userProfile } = useAuth();
  const [tab, setTab] = useState<"available" | "favourites" | "scheduled" | "history">("available");
  const [speakers, setSpeakers] = useState<UserProfile[]>([]);
  const [history, setHistory] = useState<Session[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotSpeakers, setSlotSpeakers] = useState<Record<string, UserProfile>>({});
  /* Filters */
  const [searchText, setSearchText] = useState("");
  const [filterLanguage, setFilterLanguage] = useState("");
  const [filterMaxPrice, setFilterMaxPrice] = useState(0); // 0 = any
  const [filterMinRating, setFilterMinRating] = useState(0);
  /* My bookings */
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [bookingSpeakers, setBookingSpeakers] = useState<Record<string, UserProfile>>({});
  /* Favourites */
  const [favouriteIds, setFavouriteIds] = useState<string[]>([]);
  const [favouriteSpeakers, setFavouriteSpeakers] = useState<UserProfile[]>([]);
  const prevFavouriteStatuses = useRef<Record<string, string | undefined>>({});
  /* Level signals received */
  const [levelSignals, setLevelSignals] = useState<LevelSignal[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, "users"),
      where("role", "==", "speaker"),
      where("status", "in", ["online", "busy"])
    );
    const unsub = onSnapshot(q, (snap) => {
      const results: UserProfile[] = [];
      snap.forEach((doc) => {
        const p = doc.data() as UserProfile;
        if (p.awayMode) return; // hide speakers in away mode
        results.push(p);
      });
      results.sort((a, b) => {
        if (a.status === "online" && b.status !== "online") return -1;
        if (a.status !== "online" && b.status === "online") return 1;
        return (b.rating ?? 0) - (a.rating ?? 0);
      });
      setSpeakers(results);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!userProfile) return;
    const fetchHistory = async () => {
      const q = query(
        collection(db, "sessions"),
        where("learnerIds", "array-contains", userProfile.uid),
        where("status", "==", "ended"),
        orderBy("endedAt", "desc")
      );
      const snap = await getDocs(q);
      setHistory(snap.docs.map((d) => ({ sessionId: d.id, ...d.data() }) as Session));
    };
    fetchHistory();
  }, [userProfile]);

  useEffect(() => {
    if (!userProfile?.level) return;
    const fetchTopics = async () => {
      const q = query(
        collection(db, "topics"),
        where("level", "==", userProfile.level),
        where("isActive", "==", true)
      );
      const snap = await getDocs(q);
      setTopics(snap.docs.map((d) => ({ topicId: d.id, ...d.data() }) as Topic));
    };
    fetchTopics();
  }, [userProfile?.level]);

  /* Listen to my own pending + admitted bookings */
  useEffect(() => {
    if (!userProfile) return;
    const q = query(
      collection(db, "bookings"),
      where("learnerId", "==", userProfile.uid),
      where("status", "in", ["pending", "admitted"])
    );
    const unsub = onSnapshot(q, async (snap) => {
      const arr: Booking[] = [];
      snap.forEach((d) => arr.push({ bookingId: d.id, ...d.data() } as Booking));
      // Sort by scheduledFor (or requestedAt for instant)
      arr.sort((a, b) => {
        const at = (a.scheduledFor ?? a.requestedAt)?.toMillis?.() ?? 0;
        const bt = (b.scheduledFor ?? b.requestedAt)?.toMillis?.() ?? 0;
        return at - bt;
      });
      setMyBookings(arr);

      // Hydrate speaker profiles
      const ids = Array.from(new Set(arr.map((b) => b.speakerId)));
      const profiles: Record<string, UserProfile> = {};
      await Promise.all(
        ids.map(async (uid) => {
          const p = await getDoc(doc(db, "users", uid));
          if (p.exists()) profiles[uid] = p.data() as UserProfile;
        })
      );
      setBookingSpeakers(profiles);
    });
    return unsub;
  }, [userProfile]);

  /* Level signals — subscribe to signals at the learner's current level */
  useEffect(() => {
    if (!userProfile?.uid) return;
    const q = query(
      collection(db, "levelSignals"),
      where("learnerId", "==", userProfile.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const arr: LevelSignal[] = [];
      snap.forEach((d) => arr.push({ signalId: d.id, ...d.data() } as LevelSignal));
      setLevelSignals(arr);
    });
    return unsub;
  }, [userProfile?.uid]);

  /* Favourites — subscribe to favourite IDs */
  useEffect(() => {
    if (!userProfile) return;
    const favsRef = collection(db, "users", userProfile.uid, "favourites");
    const unsub = onSnapshot(favsRef, (snap) => {
      const ids: string[] = [];
      snap.forEach((d) => ids.push(d.id));
      setFavouriteIds(ids);
    });
    return unsub;
  }, [userProfile]);

  /* Subscribe to full profiles of favourites (online/offline) */
  useEffect(() => {
    if (favouriteIds.length === 0) {
      setFavouriteSpeakers([]);
      return;
    }
    // Firestore 'in' query limited to 10 ids
    const idsChunk = favouriteIds.slice(0, 10);
    const q = query(collection(db, "users"), where(documentId(), "in", idsChunk));
    const unsub = onSnapshot(q, (snap) => {
      const arr: UserProfile[] = [];
      snap.forEach((d) => arr.push(d.data() as UserProfile));
      arr.sort((a, b) => {
        if (a.status === "online" && b.status !== "online") return -1;
        if (a.status !== "online" && b.status === "online") return 1;
        return (b.rating ?? 0) - (a.rating ?? 0);
      });

      /* Detect online transitions */
      arr.forEach((s) => {
        const prev = prevFavouriteStatuses.current[s.uid];
        if (prev && prev !== "online" && s.status === "online") {
          toast(`${s.displayName} just came online`, { icon: "💚", duration: 6000 });
        }
        prevFavouriteStatuses.current[s.uid] = s.status;
      });

      setFavouriteSpeakers(arr);
    });
    return unsub;
  }, [favouriteIds]);

  const toggleFavourite = async (speaker: UserProfile) => {
    if (!userProfile) return;
    const ref = doc(db, "users", userProfile.uid, "favourites", speaker.uid);
    if (favouriteIds.includes(speaker.uid)) {
      await deleteDoc(ref);
      toast.success(`Removed ${speaker.displayName} from favourites`);
    } else {
      await setDoc(ref, { createdAt: serverTimestamp() });
      toast.success(`Added ${speaker.displayName} to favourites`);
    }
  };

  /* Pre-session reminders — tick every 30s, fire toast when a session is 10 min away */
  const notifiedBookingIds = useRef<Set<string>>(new Set());
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const now = Date.now();
    myBookings.forEach((b) => {
      const when = b.scheduledFor?.toMillis?.();
      if (!when) return;
      const minutesAway = (when - now) / 60_000;
      if (
        minutesAway > 0 &&
        minutesAway <= 10 &&
        !notifiedBookingIds.current.has(b.bookingId)
      ) {
        notifiedBookingIds.current.add(b.bookingId);
        const speakerName = bookingSpeakers[b.speakerId]?.displayName ?? "your speaker";
        toast(
          `Your session with ${speakerName} starts in ${Math.max(1, Math.round(minutesAway))} min`,
          { icon: "🔔", duration: 8000 }
        );
      }
    });
  }, [nowTick, myBookings, bookingSpeakers]);

  /* Cancel one of my bookings */
  const handleCancelBooking = async (b: Booking) => {
    if (!confirm("Cancel this booking?")) return;
    try {
      await updateDoc(doc(db, "bookings", b.bookingId), { status: "cancelled" });
      // If the booking was tied to a slot, free the slot
      if (b.slotId) {
        await updateDoc(doc(db, "availability", b.slotId), {
          status: "available",
          bookingId: null,
        });
      }
      toast.success("Booking cancelled");
    } catch (err: any) {
      toast.error(err.message || "Could not cancel");
    }
  };

  // Listen to bookable scheduled slots (auto-confirm only for now)
  useEffect(() => {
    const q = query(
      collection(db, "availability"),
      where("status", "==", "available"),
      where("autoConfirm", "==", true),
      where("scheduledFor", ">", Timestamp.now()),
      orderBy("scheduledFor", "asc")
    );
    const unsub = onSnapshot(q, async (snap) => {
      const arr: AvailabilitySlot[] = [];
      snap.forEach((d) => arr.push({ slotId: d.id, ...d.data() } as AvailabilitySlot));
      setSlots(arr);

      // Fetch speaker profiles we haven't seen yet
      const uniqueIds = Array.from(new Set(arr.map((s) => s.speakerId)));
      const profiles: Record<string, UserProfile> = {};
      await Promise.all(
        uniqueIds.map(async (uid) => {
          const p = await getDoc(doc(db, "users", uid));
          if (p.exists()) profiles[uid] = p.data() as UserProfile;
        })
      );
      setSlotSpeakers(profiles);
    });
    return unsub;
  }, []);

  /* Filtered speakers */
  const filteredSpeakers = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    return speakers.filter((s) => {
      if (term) {
        const haystack = `${s.displayName ?? ""} ${s.bio ?? ""} ${s.nativeLanguage ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (filterLanguage && s.nativeLanguage !== filterLanguage) return false;
      if (filterMaxPrice > 0 && (s.hourlyRate ?? 0) > filterMaxPrice) return false;
      if (filterMinRating > 0 && (s.rating ?? 0) < filterMinRating) return false;
      return true;
    });
  }, [speakers, searchText, filterLanguage, filterMaxPrice, filterMinRating]);

  /* Languages available in current speaker list (for filter dropdown) */
  const availableLanguages = useMemo(() => {
    const set = new Set<string>();
    speakers.forEach((s) => {
      if (s.nativeLanguage) set.add(s.nativeLanguage);
    });
    return Array.from(set).sort();
  }, [speakers]);

  const clearFilters = () => {
    setSearchText("");
    setFilterLanguage("");
    setFilterMaxPrice(0);
    setFilterMinRating(0);
  };

  const filtersActive =
    searchText !== "" || filterLanguage !== "" || filterMaxPrice > 0 || filterMinRating > 0;

  const stats = useMemo(() => {
    const totalSessions = history.length;
    const totalMinutes = history.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);
    return { totalSessions, totalMinutes };
  }, [history]);

  const levelCodes: LevelCode[] = ["1a", "1b", "2a", "2b", "3a", "3b", "4a", "4b"];

  /* Level suggestion based on signals from different speakers */
  const levelSuggestion = useMemo(() => {
    if (!userProfile?.level) return null;
    const currentLevel = userProfile.level;
    const signalsAtCurrent = levelSignals.filter((s) => s.atLevel === currentLevel);

    const tooEasySpeakers = new Set(
      signalsAtCurrent.filter((s) => s.signalType === "too_easy").map((s) => s.speakerId)
    );
    const tooHardSpeakers = new Set(
      signalsAtCurrent.filter((s) => s.signalType === "too_hard").map((s) => s.speakerId)
    );

    const currentIdx = levelCodes.indexOf(currentLevel);

    if (tooEasySpeakers.size >= 3 && currentIdx < levelCodes.length - 1) {
      return { direction: "up" as const, count: tooEasySpeakers.size, nextLevel: levelCodes[currentIdx + 1] };
    }
    if (tooHardSpeakers.size >= 3 && currentIdx > 0) {
      return { direction: "down" as const, count: tooHardSpeakers.size, nextLevel: levelCodes[currentIdx - 1] };
    }
    return null;
  }, [levelSignals, userProfile?.level]);

  const handleAcceptLevelChange = async () => {
    if (!userProfile || !levelSuggestion) return;
    const ok = confirm(
      levelSuggestion.direction === "up"
        ? `Move up to ${LEVELS[levelSuggestion.nextLevel]}?\n\nYou can always come back if it feels too hard.`
        : `Move down to ${LEVELS[levelSuggestion.nextLevel]}?\n\nThis just changes which topics get suggested for you.`
    );
    if (!ok) return;
    await updateDoc(doc(db, "users", userProfile.uid), { level: levelSuggestion.nextLevel });
    toast.success(
      levelSuggestion.direction === "up"
        ? `Level up! You're now ${LEVELS[levelSuggestion.nextLevel]}`
        : `Level changed to ${LEVELS[levelSuggestion.nextLevel]}`
    );
  };

  const handleBook = (speaker: UserProfile) => {
    window.location.href = `/booking/new?speakerId=${speaker.uid}`;
  };

  // Book a scheduled slot (auto-confirm path). Uses a transaction so two
  // learners can't both grab the same slot.
  const handleBookSlot = async (slot: AvailabilitySlot) => {
    if (!userProfile) return;
    try {
      await runTransaction(db, async (txn) => {
        const slotRef = doc(db, "availability", slot.slotId);
        const latest = await txn.get(slotRef);
        if (!latest.exists() || latest.data().status !== "available") {
          throw new Error("Slot is no longer available");
        }
        const bookingRef = doc(collection(db, "bookings"));
        txn.set(bookingRef, {
          learnerId: userProfile.uid,
          speakerId: slot.speakerId,
          requestedAt: serverTimestamp(),
          status: "admitted",
          scheduledFor: slot.scheduledFor,
          slotId: slot.slotId,
          sessionId: null,
        });
        txn.update(slotRef, { status: "booked", bookingId: bookingRef.id });
      });
      toast.success("Slot booked! See you then.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Booking failed";
      toast.error(msg);
    }
  };

  const levelName = userProfile?.level ? LEVELS[userProfile.level as LevelCode] : "Not set";
  const firstName = userProfile?.displayName?.split(" ")[0] ?? "there";
  const profileIncomplete =
    !userProfile?.level ||
    !userProfile?.learningLanguage ||
    !userProfile?.nativeLanguage;

  return (
    <div className="space-y-8">
      {profileIncomplete && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 p-4">
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-200">Finish setting up your profile</p>
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Add your language and level so we can match you with the right speakers.
            </p>
          </div>
          <Link
            href="/dashboard/learner/profile"
            className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Complete profile
          </Link>
        </div>
      )}

      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-xl md:p-10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-teal-50 dark:bg-teal-900/300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-56 w-56 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="relative z-10">
          <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-teal-300">Welcome back</p>
          <h2 className="mb-5 text-3xl font-bold md:text-4xl">Hi {firstName}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm text-slate-200 backdrop-blur-sm">
              Level: <span className="font-semibold text-white">{levelName}</span>
            </span>
            {levelSuggestion && (
              <button
                onClick={handleAcceptLevelChange}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold shadow-sm transition hover:shadow-md ${
                  levelSuggestion.direction === "up"
                    ? "bg-gradient-to-r from-teal-400 to-cyan-400 text-slate-900 dark:text-slate-100"
                    : "bg-amber-100 text-amber-900 dark:text-amber-200"
                }`}
              >
                {levelSuggestion.direction === "up"
                  ? `${levelSuggestion.count} speakers say you're ready to level up →`
                  : `${levelSuggestion.count} speakers suggest an easier level →`}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500">Sessions</p>
          <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">{stats.totalSessions}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">conversations so far</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500">Minutes practised</p>
          <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">{stats.totalMinutes}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">keep going!</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-teal-50 to-cyan-50 p-5">
          <p className="text-sm font-medium text-teal-700 dark:text-teal-300">Current level</p>
          <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{levelName}</p>
          <p className="text-xs text-teal-600 dark:text-teal-400">
            {userProfile?.level === "4b" ? "Top level!" : "Level up when you're ready"}
          </p>
        </div>
      </div>

      {/* Upcoming bookings */}
      {myBookings.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.15em] text-teal-600 dark:text-teal-400">Upcoming</p>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Your bookings</h3>
            </div>
            <span className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">{myBookings.length} scheduled</span>
          </div>
          <div className="space-y-3">
            {myBookings.map((b) => {
              const sp = bookingSpeakers[b.speakerId];
              const when = b.scheduledFor?.toDate?.();
              const minutesAway = when ? (when.getTime() - nowTick) / 60_000 : null;
              const joinable =
                b.status === "admitted" &&
                (minutesAway === null || minutesAway <= 15);
              return (
                <div
                  key={b.bookingId}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    {sp?.photoURL ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sp.photoURL}
                        alt=""
                        className="h-12 w-12 rounded-full object-cover ring-1 ring-teal-100"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 font-bold text-white">
                        {sp?.displayName?.charAt(0).toUpperCase() ?? "?"}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {sp?.displayName ?? "Speaker"}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                        {when
                          ? when.toLocaleString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : "Instant booking"}
                      </p>
                      <span
                        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          b.status === "admitted"
                            ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                            : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        {b.status === "admitted" ? "Confirmed" : "Waiting for approval"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {joinable && (
                      <Link
                        href={`/waiting-room/${b.bookingId}`}
                        className="rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:shadow-md"
                      >
                        Join now
                      </Link>
                    )}
                    {!joinable && b.status === "pending" && (
                      <Link
                        href={`/waiting-room/${b.bookingId}`}
                        className="rounded-lg border border-teal-200 dark:border-teal-900/60 bg-white px-3 py-1.5 text-sm font-medium text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:bg-teal-900/30"
                      >
                        Open waiting room
                      </Link>
                    )}
                    <button
                      onClick={() => handleCancelBooking(b)}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
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

      <div>
        <div className="mb-5 flex gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
          <button
            onClick={() => setTab("available")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === "available" ? "bg-white text-teal-700 dark:text-teal-300 shadow-sm" : "text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-200"
            }`}
          >
            Available Now
          </button>
          <button
            onClick={() => setTab("favourites")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === "favourites" ? "bg-white text-teal-700 dark:text-teal-300 shadow-sm" : "text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-200"
            }`}
          >
            Favourites{favouriteIds.length > 0 && (
              <span className="ml-1 text-xs text-rose-500">({favouriteIds.length})</span>
            )}
          </button>
          <button
            onClick={() => setTab("scheduled")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === "scheduled" ? "bg-white text-teal-700 dark:text-teal-300 shadow-sm" : "text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-200"
            }`}
          >
            Scheduled
          </button>
          <button
            onClick={() => setTab("history")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === "history" ? "bg-white text-teal-700 dark:text-teal-300 shadow-sm" : "text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-200"
            }`}
          >
            History
          </button>
        </div>

        {tab === "available" && (
          <div>
            {/* Filter bar */}
            <div className="mb-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search by name..."
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-teal-500 focus:outline-none"
                />
                <select
                  value={filterLanguage}
                  onChange={(e) => setFilterLanguage(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
                >
                  <option value="">Any language</option>
                  {availableLanguages.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
                <select
                  value={filterMaxPrice}
                  onChange={(e) => setFilterMaxPrice(Number(e.target.value))}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
                >
                  <option value={0}>Any price</option>
                  <option value={10}>Up to $10/hr</option>
                  <option value={20}>Up to $20/hr</option>
                  <option value={30}>Up to $30/hr</option>
                  <option value={50}>Up to $50/hr</option>
                </select>
                <select
                  value={filterMinRating}
                  onChange={(e) => setFilterMinRating(Number(e.target.value))}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
                >
                  <option value={0}>Any rating</option>
                  <option value={3}>3+ stars</option>
                  <option value={4}>4+ stars</option>
                  <option value={4.5}>4.5+ stars</option>
                </select>
              </div>
              {filtersActive && (
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                  <span>
                    {filteredSpeakers.length} of {speakers.length} speakers match
                  </span>
                  <button
                    onClick={clearFilters}
                    className="font-medium text-teal-700 dark:text-teal-300 hover:text-teal-800 dark:text-teal-300"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>

            {speakers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 py-12 px-6 text-center">
                <h3 className="mb-1 font-semibold text-slate-700 dark:text-slate-200">No speakers online right now</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">Check back soon &mdash; or browse topics below while you wait.</p>
              </div>
            ) : filteredSpeakers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 py-12 px-6 text-center">
                <h3 className="mb-1 font-semibold text-slate-700 dark:text-slate-200">No speakers match your filters</h3>
                <button
                  onClick={clearFilters}
                  className="mt-2 text-sm font-medium text-teal-700 dark:text-teal-300 hover:text-teal-800 dark:text-teal-300"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSpeakers.map((s) => (
                  <SpeakerCard
                    key={s.uid}
                    speaker={s}
                    onBook={handleBook}
                    isFavourite={favouriteIds.includes(s.uid)}
                    onToggleFavourite={toggleFavourite}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "favourites" && (
          <div>
            {favouriteSpeakers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 py-12 px-6 text-center">
                <h3 className="mb-1 font-semibold text-slate-700 dark:text-slate-200">No favourites yet</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                  Tap the heart on a speaker to save them. We&apos;ll let you know when they come online.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {favouriteSpeakers.map((s) => (
                  <SpeakerCard
                    key={s.uid}
                    speaker={s}
                    onBook={handleBook}
                    isFavourite={true}
                    onToggleFavourite={toggleFavourite}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "scheduled" && (
          <div>
            {slots.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 py-12 px-6 text-center">
                <h3 className="mb-1 font-semibold text-slate-700 dark:text-slate-200">No scheduled slots yet</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">When speakers publish their hours, you&apos;ll see bookable slots here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(
                  slots
                    .filter((s) => !slotSpeakers[s.speakerId]?.awayMode)
                    .reduce((acc, s) => {
                      const key = s.scheduledFor.toDate().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
                      (acc[key] = acc[key] || []).push(s);
                      return acc;
                    }, {} as Record<string, AvailabilitySlot[]>)
                ).map(([day, ds]) => (
                  <div key={day}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">{day}</p>
                    <div className="space-y-2">
                      {ds.map((s) => {
                        const sp = slotSpeakers[s.speakerId];
                        return (
                          <div key={s.slotId} className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 font-bold text-white">
                                {sp?.displayName?.charAt(0).toUpperCase() ?? "?"}
                              </div>
                              <div>
                                <p className="font-medium text-slate-900 dark:text-slate-100">{sp?.displayName ?? "Speaker"}</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                                  {s.scheduledFor.toDate().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                                  {sp?.nativeLanguage && ` - ${sp.nativeLanguage}`}
                                  {sp?.hourlyRate ? ` - $${sp.hourlyRate}/hr` : ""}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleBookSlot(s)}
                              className="rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
                            >
                              Book
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "history" && (
          <div>
            {history.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 py-12 px-6 text-center text-slate-500 dark:text-slate-400 dark:text-slate-500">
                <p>No sessions yet. Book your first conversation!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((s) => (
                  <Link
                    key={s.sessionId}
                    href={`/sessions/${s.sessionId}`}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">Session #{s.sessionId.slice(0, 8)}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                        {s.durationMinutes ?? 0} min &middot; {s.endedAt?.toDate?.()?.toLocaleDateString() ?? ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs text-slate-600 dark:text-slate-300 capitalize">
                      {s.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {topics.length > 0 && (
        <div>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.15em] text-teal-600 dark:text-teal-400">For your level</p>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Topics to try</h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">{topics.length} available</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topics.slice(0, 6).map((t) => (
              <TopicCard key={t.topicId} topic={t} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LearnerDashboard() {
  return (
    <RouteGuard allowedRole="learner">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <LearnerDashboardContent />
      </div>
    </RouteGuard>
  );
}
