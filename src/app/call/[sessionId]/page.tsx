"use client";

import { useState, useEffect, useRef, use } from "react";
import {
  doc,
  onSnapshot,
  updateDoc,
  addDoc,
  collection,
  query,
  orderBy,
  serverTimestamp,
  getDoc,
  getDocs,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Session, ChatMessage, UserProfile, Topic, LEVELS, LevelCode } from "@/types";
import toast from "react-hot-toast";

export default function CallRoomPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [chatOpen, setChatOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(true);
  const [speakerNotes, setSpeakerNotes] = useState("");
  const [learnerProfiles, setLearnerProfiles] = useState<UserProfile[]>([]);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [ratingScore, setRatingScore] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isSpeaker = userProfile?.role === "speaker";

  // Listen to session doc
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "sessions", sessionId), (snap) => {
      if (!snap.exists()) return;
      const data = { sessionId: snap.id, ...snap.data() } as Session;
      setSession(data);
      if (data.status === "ended") {
        if (userProfile?.role === "learner") {
          setShowRating(true);
        } else {
          router.push("/dashboard/speaker");
        }
      }
    });
    return unsub;
  }, [sessionId, router, userProfile?.role]);

  // Listen to messages
  useEffect(() => {
    const q = query(
      collection(db, "sessions", sessionId, "messages"),
      orderBy("sentAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ messageId: d.id, ...d.data() }) as ChatMessage));
    });
    return unsub;
  }, [sessionId]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch learner profiles and topic
  useEffect(() => {
    if (!session) return;
    const fetchData = async () => {
      // Fetch learner profiles
      const profiles: UserProfile[] = [];
      for (const lid of session.learnerIds) {
        const snap = await getDoc(doc(db, "users", lid));
        if (snap.exists()) profiles.push(snap.data() as UserProfile);
      }
      setLearnerProfiles(profiles);

      // Fetch topic if set
      if (session.topicId) {
        const topicSnap = await getDoc(doc(db, "topics", session.topicId));
        if (topicSnap.exists()) setTopic({ topicId: topicSnap.id, ...topicSnap.data() } as Topic);
      }
    };
    fetchData();
  }, [session]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;
    await addDoc(collection(db, "sessions", sessionId, "messages"), {
      senderId: user.uid,
      text: newMessage.trim(),
      sentAt: serverTimestamp(),
    });
    setNewMessage("");
  };

  const endSession = async () => {
    if (!session || !user) return;
    const startedAt = session.startedAt?.toDate?.() ?? new Date();
    const now = new Date();
    const durationMinutes = Math.max(1, Math.round((now.getTime() - startedAt.getTime()) / 60000));
    // Calculate payment fields (placeholder rates)
    const hourlyRate = 15; // Default
    const amountCharged = parseFloat(((hourlyRate / 60) * durationMinutes).toFixed(2));
    const platformCut = parseFloat((amountCharged * 0.2).toFixed(2));
    const speakerPayout = parseFloat((amountCharged - platformCut).toFixed(2));

    await updateDoc(doc(db, "sessions", sessionId), {
      status: "ended",
      endedAt: serverTimestamp(),
      endedBy: user.uid,
      durationMinutes,
      amountCharged,
      platformCut,
      speakerPayout,
    });

    // Save speaker notes
    if (isSpeaker && speakerNotes.trim()) {
      await updateDoc(doc(db, "sessions", sessionId), {
        speakerNotes: speakerNotes.trim(),
      });
    }

    // Update speaker status back to online and increment session count
    if (isSpeaker && userProfile) {
      await updateDoc(doc(db, "users", userProfile.uid), {
        status: "online",
        totalSessions: (userProfile.totalSessions ?? 0) + 1,
      });
    }
  };

  const submitRating = async () => {
    if (!user || !session || ratingScore === 0) return;
    await addDoc(collection(db, "ratings"), {
      sessionId,
      learnerId: user.uid,
      speakerId: session.speakerId,
      score: ratingScore,
      createdAt: serverTimestamp(),
    });

    // Update speaker average rating
    const ratingsSnap = await getDocs(
      query(collection(db, "ratings"), where("speakerId", "==", session.speakerId))
    );
    const allRatings = ratingsSnap.docs.map((d) => d.data().score as number);
    const avgRating = allRatings.reduce((a, b) => a + b, 0) / allRatings.length;
    await updateDoc(doc(db, "users", session.speakerId), {
      rating: parseFloat(avgRating.toFixed(1)),
    });

    toast.success("Thanks for your feedback!");
    router.push("/dashboard/learner");
  };

  // Rating overlay
  if (showRating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-teal-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <h2 className="mb-2 text-xl font-bold text-gray-900">Session Complete!</h2>
          <p className="mb-6 text-gray-500">
            Duration: {session?.durationMinutes ?? 0} minutes
          </p>
          <p className="mb-4 text-sm font-medium text-gray-700">How was your session?</p>
          <div className="mb-6 flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRatingScore(star)}
                className={`text-3xl transition ${
                  star <= ratingScore ? "text-yellow-400" : "text-gray-300"
                }`}
              >
                ★
              </button>
            ))}
          </div>
          <button
            onClick={submitRating}
            disabled={ratingScore === 0}
            className="w-full rounded-lg bg-teal-600 px-4 py-3 font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
          >
            Submit Rating
          </button>
          <button
            onClick={() => router.push("/dashboard/learner")}
            className="mt-3 w-full text-sm text-gray-500 hover:text-gray-700"
          >
            Skip
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-900">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white">SpeakSpace</span>
          <span className="h-2 w-2 rounded-full bg-green-400" />
          <span className="text-sm text-gray-400">Live</span>
        </div>
        <button
          onClick={endSession}
          className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600"
        >
          End Session
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Jitsi Video Area */}
        <div className="flex-1">
          {session?.jitsiRoomId && (
            <iframe
              src={`https://meet.jit.si/${session.jitsiRoomId}#config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false`}
              className="h-full w-full"
              allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
            />
          )}
        </div>

        {/* Right Sidebar */}
        <div className="flex w-80 flex-col border-l border-gray-700 bg-gray-800">
          {/* Speaker-only Panel */}
          {isSpeaker && (
            <div className="border-b border-gray-700">
              <button
                onClick={() => setNotesOpen(!notesOpen)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-300 hover:text-white"
              >
                <span>Speaker Notes</span>
                <span>{notesOpen ? "▼" : "▶"}</span>
              </button>
              {notesOpen && (
                <div className="px-4 pb-4 space-y-3">
                  {/* Learner info */}
                  {learnerProfiles.map((lp) => (
                    <div key={lp.uid} className="rounded-lg bg-gray-700/50 p-3">
                      <p className="text-sm font-medium text-teal-400">{lp.displayName}</p>
                      <p className="text-xs text-gray-400">
                        Level: {lp.level ? LEVELS[lp.level as LevelCode] : "Unknown"}
                      </p>
                    </div>
                  ))}
                  {/* Topic prompts */}
                  {topic && (
                    <div className="rounded-lg bg-gray-700/50 p-3">
                      <p className="mb-1 text-xs font-medium text-teal-400">{topic.title}</p>
                      {topic.promptQuestions?.map((q, i) => (
                        <p key={i} className="text-xs text-gray-300">• {q}</p>
                      ))}
                      {topic.vocabularyHints?.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-teal-400">Vocabulary</p>
                          {topic.vocabularyHints.map((v, i) => (
                            <span key={i} className="mr-1 inline-block rounded bg-gray-600 px-1.5 py-0.5 text-xs text-gray-200">
                              {v}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Notes field */}
                  <textarea
                    value={speakerNotes}
                    onChange={(e) => setSpeakerNotes(e.target.value)}
                    placeholder="Your private notes..."
                    rows={3}
                    className="w-full rounded-lg bg-gray-700 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* Chat */}
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className="flex w-full items-center justify-between border-b border-gray-700 px-4 py-3 text-sm font-medium text-gray-300 hover:text-white"
          >
            <span>Chat</span>
            <span>{chatOpen ? "▼" : "▶"}</span>
          </button>
          {chatOpen && (
            <div className="flex flex-1 flex-col">
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {messages.map((m) => (
                  <div
                    key={m.messageId}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      m.senderId === user?.uid
                        ? "ml-auto bg-teal-600 text-white"
                        : "bg-gray-700 text-gray-200"
                    } max-w-[85%]`}
                  >
                    {m.text}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={sendMessage} className="border-t border-gray-700 p-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 rounded-lg bg-gray-700 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                  >
                    Send
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
