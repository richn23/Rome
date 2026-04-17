"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { UserProfile } from "@/types";
import toast from "react-hot-toast";

function NewBookingContent() {
  const searchParams = useSearchParams();
  const speakerId = searchParams.get("speakerId");
  const { user } = useAuth();
  const router = useRouter();
  const [speaker, setSpeaker] = useState<UserProfile | null>(null);
  const [topicSuggestion, setTopicSuggestion] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!speakerId) return;
    const fetchSpeaker = async () => {
      const snap = await getDoc(doc(db, "users", speakerId));
      if (snap.exists()) setSpeaker(snap.data() as UserProfile);
    };
    fetchSpeaker();
  }, [speakerId]);

  const handleBook = async () => {
    if (!user || !speakerId) return;
    setSubmitting(true);
    try {
      const bookingRef = await addDoc(collection(db, "bookings"), {
        learnerId: user.uid,
        speakerId,
        requestedAt: serverTimestamp(),
        status: "pending",
        topicSuggestion: topicSuggestion || null,
        sessionId: null,
      });
      router.push(`/waiting-room/${bookingRef.id}`);
    } catch (err: any) {
      toast.error(err.message || "Booking failed");
      setSubmitting(false);
    }
  };

  if (!speaker) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-teal-600">Loading speaker...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-teal-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-teal-100 text-3xl font-bold text-teal-700">
            {speaker.displayName.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-xl font-bold text-gray-900">{speaker.displayName}</h2>
          <p className="text-sm text-gray-500">${speaker.hourlyRate}/hr</p>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Topic suggestion (optional)
          </label>
          <input
            type="text"
            value={topicSuggestion}
            onChange={(e) => setTopicSuggestion(e.target.value)}
            placeholder="What would you like to talk about?"
            className="block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none"
          />
        </div>
        <button
          onClick={handleBook}
          disabled={submitting}
          className="w-full rounded-lg bg-teal-600 px-4 py-3 font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
        >
          {submitting ? "Booking..." : "Request Session"}
        </button>
        <button
          onClick={() => router.back()}
          className="mt-3 w-full rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-600 transition hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function NewBookingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="animate-pulse text-teal-600">Loading...</div>
        </div>
      }
    >
      <NewBookingContent />
    </Suspense>
  );
}
