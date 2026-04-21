"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import RouteGuard from "@/components/RouteGuard";
import { AvailabilitySlot, Rating, UserProfile } from "@/types";
import toast from "react-hot-toast";

function formatDate(ts: Timestamp) {
  return ts.toDate().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
function formatTime(ts: Timestamp) {
  return ts.toDate().toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function SpeakerProfileContent({ speakerId }: { speakerId: string }) {
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const [speaker, setSpeaker] = useState<UserProfile | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [isFavourite, setIsFavourite] = useState(false);

  /* Load speaker */
  useEffect(() => {
    const load = async () => {
      const snap = await getDoc(doc(db, "users", speakerId));
      if (snap.exists()) {
        setSpeaker(snap.data() as UserProfile);
      }
      setLoading(false);
    };
    load();
  }, [speakerId]);

  /* Live upcoming slots for this speaker */
  useEffect(() => {
    const q = query(
      collection(db, "availability"),
      where("speakerId", "==", speakerId),
      where("status", "==", "available"),
      orderBy("scheduledFor", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const now = new Date();
      const arr: AvailabilitySlot[] = [];
      snap.forEach((d) => {
        const s = { slotId: d.id, ...d.data() } as AvailabilitySlot;
        if (s.scheduledFor.toDate() > now) arr.push(s);
      });
      setSlots(arr);
    });
    return unsub;
  }, [speakerId]);

  /* Recent ratings */
  useEffect(() => {
    const load = async () => {
      const q = query(
        collection(db, "ratings"),
        where("speakerId", "==", speakerId),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const arr: Rating[] = [];
      snap.forEach((d) => arr.push({ ratingId: d.id, ...d.data() } as Rating));
      setRatings(arr.slice(0, 5));
    };
    load();
  }, [speakerId]);

  /* Is this speaker a favourite? */
  useEffect(() => {
    if (!user) return;
    const favRef = doc(db, "users", user.uid, "favourites", speakerId);
    const unsub = onSnapshot(favRef, (snap) => setIsFavourite(snap.exists()));
    return unsub;
  }, [user, speakerId]);

  const toggleFavourite = async () => {
    if (!user || !speaker) return;
    const ref = doc(db, "users", user.uid, "favourites", speakerId);
    if (isFavourite) {
      await deleteDoc(ref);
      toast.success(`Removed ${speaker.displayName} from favourites`);
    } else {
      await setDoc(ref, { createdAt: serverTimestamp() });
      toast.success(`Added ${speaker.displayName} to favourites`);
    }
  };

  /* Book an instant session (speaker is online) */
  const handleInstantBook = () => {
    router.push(`/booking/new?speakerId=${speakerId}`);
  };

  /* Book a specific future slot */
  const handleBookSlot = async (slot: AvailabilitySlot) => {
    if (!user || !userProfile) return;
    setBooking(true);
    try {
      await runTransaction(db, async (tx) => {
        const slotRef = doc(db, "availability", slot.slotId);
        const fresh = await tx.get(slotRef);
        if (!fresh.exists()) throw new Error("Slot is gone");
        const data = fresh.data() as AvailabilitySlot;
        if (data.status !== "available") throw new Error("Slot is no longer available");

        const bookingRef = doc(collection(db, "bookings"));
        tx.set(bookingRef, {
          learnerId: user.uid,
          speakerId,
          requestedAt: serverTimestamp(),
          status: data.autoConfirm ? "admitted" : "pending",
          scheduledFor: data.scheduledFor,
          slotId: slot.slotId,
          sessionId: null,
        });
        tx.update(slotRef, { status: "booked", bookingId: bookingRef.id });
      });
      toast.success("Slot booked");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not book");
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="animate-pulse text-teal-600">Loading speaker...</div>
      </div>
    );
  }

  if (!speaker) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <p className="mb-4 text-slate-600 dark:text-slate-300">Speaker not found.</p>
        <Link href="/dashboard/learner" className="text-sm font-medium text-teal-700 dark:text-teal-300 hover:text-teal-800 dark:hover:text-teal-200">
          Back to dashboard
        </Link>
      </div>
    );
  }

  /* Group slots by day */
  const groupedSlots = slots.reduce<Record<string, AvailabilitySlot[]>>((acc, s) => {
    const key = formatDate(s.scheduledFor);
    (acc[key] = acc[key] || []).push(s);
    return acc;
  }, {});

  const statusColour =
    speaker.status === "online"
      ? "bg-green-400"
      : speaker.status === "busy"
      ? "bg-yellow-400"
      : "bg-slate-300";

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <Link
        href="/dashboard/learner"
        className="inline-block text-sm font-medium text-teal-700 dark:text-teal-300 hover:text-teal-800 dark:hover:text-teal-200"
      >
        ← Back to dashboard
      </Link>

      {/* Header card */}
      <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-6 shadow-sm">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          {speaker.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={speaker.photoURL}
              alt={speaker.displayName}
              className="h-24 w-24 rounded-full object-cover ring-2 ring-teal-100 dark:ring-teal-900/50"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 text-3xl font-bold text-white shadow-sm">
              {speaker.displayName.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{speaker.displayName}</h1>
              <span className={`h-3 w-3 rounded-full ${statusColour}`} title={speaker.status} />
              <span className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {speaker.status ?? "offline"}
              </span>
              <button
                onClick={toggleFavourite}
                title={isFavourite ? "Remove from favourites" : "Add to favourites"}
                className={`ml-auto text-2xl leading-none transition ${
                  isFavourite ? "text-rose-500" : "text-slate-300 hover:text-rose-400"
                }`}
              >
                {isFavourite ? "♥" : "♡"}
              </button>
            </div>
            {speaker.nativeLanguage && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Native {speaker.nativeLanguage} speaker</p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-slate-100">${speaker.hourlyRate ?? 0}/hr</span>
              <span className="flex items-center gap-1 text-amber-500">
                {"*".repeat(Math.round(speaker.rating ?? 0))}
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  ({speaker.totalSessions ?? 0} sessions)
                </span>
              </span>
            </div>

            {speaker.awayMode ? (
              <p className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                This speaker is away and not accepting new bookings right now.
              </p>
            ) : (
              speaker.status === "online" && (
                <button
                  onClick={handleInstantBook}
                  className="mt-4 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
                >
                  Book now
                </button>
              )
            )}
          </div>
        </div>

        {speaker.bio && (
          <div className="mt-5 border-t border-slate-100 dark:border-slate-800 pt-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              {speaker.bio}
            </p>
          </div>
        )}
      </div>

      {/* Available slots (hidden when speaker is away) */}
      {!speaker.awayMode && (
      <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-6">
        <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">Upcoming slots</h2>
        {Object.keys(groupedSlots).length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 dark:bg-slate-900/60 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
            No upcoming slots published. Check back soon or book now if they&apos;re online.
          </p>
        ) : (
          <div className="space-y-5">
            {Object.entries(groupedSlots).map(([day, ds]) => (
              <div key={day}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {day}
                </p>
                <div className="flex flex-wrap gap-2">
                  {ds.map((s) => (
                    <button
                      key={s.slotId}
                      onClick={() => handleBookSlot(s)}
                      disabled={booking}
                      className="group rounded-lg border border-teal-200 dark:border-teal-900/60 bg-teal-50 dark:bg-teal-900/30 px-3 py-2 text-sm font-medium text-teal-800 dark:text-teal-300 transition hover:bg-teal-100 disabled:opacity-50"
                    >
                      <span className="block">{formatTime(s.scheduledFor)}</span>
                      <span className="block text-xs font-normal text-teal-600">
                        {s.autoConfirm ? "Open" : "Approval"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Recent reviews */}
      {ratings.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-6">
          <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">Recent reviews</h2>
          <div className="space-y-4">
            {ratings.map((r) => (
              <div key={r.ratingId} className="border-b border-slate-100 dark:border-slate-800 pb-3 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-amber-500">{"*".repeat(r.score)}</span>
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
    </div>
  );
}

export default function SpeakerProfilePage({
  params,
}: {
  params: Promise<{ speakerId: string }>;
}) {
  const { speakerId } = use(params);
  return (
    <RouteGuard allowedRole="learner">
      <SpeakerProfileContent speakerId={speakerId} />
    </RouteGuard>
  );
}
