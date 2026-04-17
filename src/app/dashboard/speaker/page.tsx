"use client";

import { useState, useEffect } from "react";
import {
  doc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  getDocs,
  addDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import RouteGuard from "@/components/RouteGuard";
import { SpeakerStatus, Booking, Session, UserProfile, LEVELS, LevelCode } from "@/types";
import toast from "react-hot-toast";

function SpeakerDashboardContent() {
  const { userProfile } = useAuth();
  const [status, setStatus] = useState<SpeakerStatus>(userProfile?.status ?? "offline");
  const [pendingBookings, setPendingBookings] = useState<(Booking & { learnerProfile?: UserProfile })[]>([]);
  const [history, setHistory] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);

  // Sync status from profile
  useEffect(() => {
    if (userProfile?.status) setStatus(userProfile.status);
  }, [userProfile?.status]);

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
    window.location.href = `/call/${sessionRef.id}`;
  };

  const handleReject = async (booking: Booking) => {
    await updateDoc(doc(db, "bookings", booking.bookingId), {
      status: "rejected",
    });
  };

  const totalEarnings = history.reduce((sum, s) => sum + (s.speakerPayout ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{userProfile?.displayName}</h2>
          <p className="text-sm text-gray-500">Speaker Dashboard</p>
          <Link
            href="/dashboard/speaker/availability"
            className="mt-2 inline-block text-sm font-medium text-teal-700 hover:text-teal-800"
          >
            Manage availability &rarr;
          </Link>
        </div>
        {/* Status Toggle */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {(["online", "busy", "offline"] as SpeakerStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              className={`rounded-md px-4 py-2 text-sm font-medium capitalize transition ${
                status === s
                  ? s === "online"
                    ? "bg-green-500 text-white shadow-sm"
                    : s === "busy"
                    ? "bg-yellow-500 text-white shadow-sm"
                    : "bg-gray-400 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
          <p className="text-3xl font-bold text-teal-600">{userProfile?.totalSessions ?? 0}</p>
          <p className="text-sm text-gray-500">Sessions</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
          <p className="text-3xl font-bold text-teal-600">
            {"★".repeat(Math.round(userProfile?.rating ?? 0))}
          </p>
          <p className="text-sm text-gray-500">Rating</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
          <p className="text-3xl font-bold text-teal-600">${totalEarnings.toFixed(2)}</p>
          <p className="text-sm text-gray-500">Earnings</p>
        </div>
      </div>

      {/* Incoming Requests */}
      <div className="mb-6">
        <h3 className="mb-3 text-lg font-semibold text-gray-900">Incoming Requests</h3>
        {pendingBookings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 py-10 text-center text-gray-400">
            No pending requests
          </div>
        ) : (
          <div className="space-y-3">
            {pendingBookings.map((b) => (
              <div
                key={b.bookingId}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {b.learnerProfile?.displayName ?? "Learner"}
                  </p>
                  <p className="text-sm text-gray-500">
                    Level: {b.learnerProfile?.level ? LEVELS[b.learnerProfile.level as LevelCode] : "Unknown"}
                    {b.topicSuggestion && ` · Topic: ${b.topicSuggestion}`}
                  </p>
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
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History */}
      <div>
        <h3 className="mb-3 text-lg font-semibold text-gray-900">Session History</h3>
        {history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 py-10 text-center text-gray-400">
            No sessions yet
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((s) => (
              <div key={s.sessionId} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
                <div>
                  <p className="font-medium text-gray-900">Session #{s.sessionId.slice(0, 8)}</p>
                  <p className="text-sm text-gray-500">
                    {s.durationMinutes ?? 0} min · ${s.speakerPayout?.toFixed(2) ?? "0.00"}
                  </p>
                </div>
                <span className="text-sm text-gray-400">
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
      <SpeakerDashboardContent />
    </RouteGuard>
  );
}

