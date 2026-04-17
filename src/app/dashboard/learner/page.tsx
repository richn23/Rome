"use client";

import { useState, useEffect, useMemo } from "react";
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
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import RouteGuard from "@/components/RouteGuard";
import { UserProfile, Session, Topic, AvailabilitySlot, LEVELS, LevelCode } from "@/types";
import toast from "react-hot-toast";

function SpeakerCard({
  speaker,
  onBook,
}: {
  speaker: UserProfile;
  onBook: (speaker: UserProfile) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 text-xl font-bold text-white shadow-sm">
          {speaker.displayName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900">{speaker.displayName}</h3>
          {speaker.nativeLanguage && (
            <p className="text-sm text-slate-500">{speaker.nativeLanguage}</p>
          )}
        </div>
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
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span>${speaker.hourlyRate ?? 0}/hr</span>
          <span className="text-amber-400">
            {"*".repeat(Math.round(speaker.rating ?? 0))}
          </span>
        </div>
        {speaker.status === "online" ? (
          <button
            onClick={() => onBook(speaker)}
            className="rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
          >
            Book
          </button>
        ) : (
          <span className="text-sm text-slate-400 capitalize">{speaker.status}</span>
        )}
      </div>
    </div>
  );
}

function TopicCard({ topic }: { topic: Topic }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 capitalize">
          {topic.category}
        </span>
      </div>
      <h3 className="mb-2 font-semibold text-slate-900">{topic.title}</h3>
      {topic.promptQuestions?.[0] && (
        <p className="text-sm italic text-slate-500">&ldquo;{topic.promptQuestions[0]}&rdquo;</p>
      )}
      <div className="mt-3 flex flex-wrap gap-1">
        {topic.vocabularyHints?.slice(0, 3).map((v) => (
          <span key={v} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}

function LearnerDashboardContent() {
  const { userProfile } = useAuth();
  const [tab, setTab] = useState<"available" | "scheduled" | "history">("available");
  const [speakers, setSpeakers] = useState<UserProfile[]>([]);
  const [history, setHistory] = useState<Session[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotSpeakers, setSlotSpeakers] = useState<Record<string, UserProfile>>({});

  useEffect(() => {
    const q = query(
      collection(db, "users"),
      where("role", "==", "speaker"),
      where("status", "in", ["online", "busy"])
    );
    const unsub = onSnapshot(q, (snap) => {
      const results: UserProfile[] = [];
      snap.forEach((doc) => results.push(doc.data() as UserProfile));
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

  const stats = useMemo(() => {
    const totalSessions = history.length;
    const totalMinutes = history.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);
    return { totalSessions, totalMinutes };
  }, [history]);

  const levelCodes: LevelCode[] = ["1a", "1b", "2a", "2b", "3a", "3b", "4a", "4b"];

  const handleChallengeUp = async () => {
    if (!userProfile?.level) return;
    const currentIdx = levelCodes.indexOf(userProfile.level as LevelCode);
    if (currentIdx >= levelCodes.length - 1) {
      toast("You're already at the highest level!");
      return;
    }
    const nextLevel = levelCodes[currentIdx + 1];
    await updateDoc(doc(db, "users", userProfile.uid), { level: nextLevel });
    toast.success(`Level up! You're now ${LEVELS[nextLevel]}`);
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

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-xl md:p-10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-56 w-56 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="relative z-10">
          <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-teal-300">Welcome back</p>
          <h2 className="mb-5 text-3xl font-bold md:text-4xl">Hi {firstName}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm text-slate-200 backdrop-blur-sm">
              Level: <span className="font-semibold text-white">{levelName}</span>
            </span>
            {userProfile?.level && userProfile.level !== "4b" && (
              <button
                onClick={handleChallengeUp}
                className="rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 px-4 py-1.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:shadow-md"
              >
                Challenge Up
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">Sessions</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{stats.totalSessions}</p>
          <p className="text-xs text-slate-400">conversations so far</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">Minutes practised</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{stats.totalMinutes}</p>
          <p className="text-xs text-slate-400">keep going!</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-teal-50 to-cyan-50 p-5">
          <p className="text-sm font-medium text-teal-700">Current level</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{levelName}</p>
          <p className="text-xs text-teal-600">
            {userProfile?.level === "4b" ? "Top level!" : "Level up when you're ready"}
          </p>
        </div>
      </div>

      <div>
        <div className="mb-5 flex gap-1 rounded-xl bg-slate-100 p-1">
          <button
            onClick={() => setTab("available")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === "available" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Available Now
          </button>
          <button
            onClick={() => setTab("scheduled")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === "scheduled" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Scheduled
          </button>
          <button
            onClick={() => setTab("history")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === "history" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            History
          </button>
        </div>

        {tab === "available" && (
          <div>
            {speakers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-12 px-6 text-center">
                <h3 className="mb-1 font-semibold text-slate-700">No speakers online right now</h3>
                <p className="text-sm text-slate-500">Check back soon &mdash; or browse topics below while you wait.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {speakers.map((s) => (
                  <SpeakerCard key={s.uid} speaker={s} onBook={handleBook} />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "scheduled" && (
          <div>
            {slots.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-12 px-6 text-center">
                <h3 className="mb-1 font-semibold text-slate-700">No scheduled slots yet</h3>
                <p className="text-sm text-slate-500">When speakers publish their hours, you&apos;ll see bookable slots here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(
                  slots.reduce((acc, s) => {
                    const key = s.scheduledFor.toDate().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
                    (acc[key] = acc[key] || []).push(s);
                    return acc;
                  }, {} as Record<string, AvailabilitySlot[]>)
                ).map(([day, ds]) => (
                  <div key={day}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{day}</p>
                    <div className="space-y-2">
                      {ds.map((s) => {
                        const sp = slotSpeakers[s.speakerId];
                        return (
                          <div key={s.slotId} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 font-bold text-white">
                                {sp?.displayName?.charAt(0).toUpperCase() ?? "?"}
                              </div>
                              <div>
                                <p className="font-medium text-slate-900">{sp?.displayName ?? "Speaker"}</p>
                                <p className="text-sm text-slate-500">
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
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-12 px-6 text-center text-slate-500">
                <p>No sessions yet. Book your first conversation!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((s) => (
                  <div key={s.sessionId} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
                    <div>
                      <p className="font-medium text-slate-900">Session #{s.sessionId.slice(0, 8)}</p>
                      <p className="text-sm text-slate-500">
                        {s.durationMinutes ?? 0} min &middot; {s.endedAt?.toDate?.()?.toLocaleDateString() ?? ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 capitalize">
                      {s.status}
                    </span>
                  </div>
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
              <p className="text-sm font-medium uppercase tracking-[0.15em] text-teal-600">For your level</p>
              <h3 className="text-xl font-bold text-slate-900">Topics to try</h3>
            </div>
            <p className="text-sm text-slate-500">{topics.length} available</p>
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
