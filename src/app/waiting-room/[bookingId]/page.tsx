"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { doc, onSnapshot, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Booking, UserProfile } from "@/types";

export default function WaitingRoomPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = use(params);
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [speaker, setSpeaker] = useState<UserProfile | null>(null);
  const [rejected, setRejected] = useState(false);

  // Listen for booking status changes
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "bookings", bookingId), (snap) => {
      if (!snap.exists()) return;
      const data = { bookingId: snap.id, ...snap.data() } as Booking;
      setBooking(data);

      if (data.status === "admitted" && data.sessionId) {
        router.push(`/call/${data.sessionId}`);
      }
      if (data.status === "rejected") {
        setRejected(true);
      }
    });
    return unsub;
  }, [bookingId, router]);

  // Fetch speaker profile
  useEffect(() => {
    if (!booking?.speakerId) return;
    const fetch = async () => {
      const snap = await getDoc(doc(db, "users", booking.speakerId));
      if (snap.exists()) setSpeaker(snap.data() as UserProfile);
    };
    fetch();
  }, [booking?.speakerId]);

  const handleCancel = async () => {
    await updateDoc(doc(db, "bookings", bookingId), { status: "rejected" });
    router.push("/dashboard/learner");
  };

  if (rejected) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-teal-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-2xl">
            ✕
          </div>
          <h2 className="mb-2 text-xl font-bold text-slate-900 dark:text-slate-100">Session Declined</h2>
          <p className="mb-6 text-slate-500 dark:text-slate-400">
            {speaker?.displayName ?? "The speaker"} is not available right now.
          </p>
          <button
            onClick={() => router.push("/dashboard/learner")}
            className="w-full rounded-lg bg-teal-600 px-4 py-3 font-semibold text-white transition hover:bg-teal-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-teal-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-teal-100 text-3xl font-bold text-teal-700">
          {speaker?.displayName?.charAt(0)?.toUpperCase() ?? "?"}
        </div>
        <h2 className="mb-2 text-xl font-bold text-slate-900 dark:text-slate-100">
          Waiting for {speaker?.displayName ?? "speaker"}...
        </h2>
        <p className="mb-8 text-slate-500 dark:text-slate-400">
          Hang tight! {speaker?.displayName ?? "Your speaker"} will admit you shortly.
        </p>
        <div className="mb-8 flex justify-center">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 animate-bounce rounded-full bg-teal-400" style={{ animationDelay: "0ms" }} />
            <div className="h-3 w-3 animate-bounce rounded-full bg-teal-400" style={{ animationDelay: "150ms" }} />
            <div className="h-3 w-3 animate-bounce rounded-full bg-teal-400" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
        <button
          onClick={handleCancel}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-3 font-medium text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
