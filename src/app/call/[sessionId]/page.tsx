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
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Session, ChatMessage, UserProfile, Topic, LevelSignalType, LEVELS, LevelCode, Handoff } from "@/types";
import { computeSessionClose } from "@/lib/sessionClose";
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
  const [ratingComment, setRatingComment] = useState("");
  const [challengeUp, setChallengeUp] = useState(false);
  const [showLevelPrompt, setShowLevelPrompt] = useState(false);
  const [levelSignalSubmitting, setLevelSignalSubmitting] = useState(false);
  /* End-of-session speaker feedback form */
  const [notesToLearner, setNotesToLearner] = useState("");
  const [notesToNextSpeaker, setNotesToNextSpeaker] = useState("");
  const [topicsDiscussedText, setTopicsDiscussedText] = useState("");
  const [challengeRating, setChallengeRating] = useState(0); // 0 = unset
  /* Handoff notes from whichever speaker saw this learner most recently
   * (excluding the session currently in progress). Keyed by learner uid. */
  const [handoffsByLearner, setHandoffsByLearner] = useState<Record<string, Handoff>>({});
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
          // Speaker: show level signal prompt before redirecting
          setShowLevelPrompt(true);
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

      // Check if any booking for this session had Challenge Up selected
      const bookingsSnap = await getDocs(
        query(collection(db, "bookings"), where("sessionId", "==", session.sessionId))
      );
      const anyChallenge = bookingsSnap.docs.some((d) => d.data()?.challengeUp === true);
      setChallengeUp(anyChallenge);

      // Fetch the most recent handoff note for each learner (excluding this
      // session's in-progress one). Shown in the speaker sidebar.
      const handoffMap: Record<string, Handoff> = {};
      await Promise.all(
        session.learnerIds.map(async (lid) => {
          const hq = query(
            collection(db, "handoffs"),
            where("learnerId", "==", lid),
            orderBy("createdAt", "desc")
          );
          const hsnap = await getDocs(hq);
          const latest = hsnap.docs
            .map((d) => ({ handoffId: d.id, ...d.data() }) as Handoff)
            .find((h) => h.sessionId !== session.sessionId);
          if (latest) handoffMap[lid] = latest;
        })
      );
      setHandoffsByLearner(handoffMap);
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
    // Shared helper caps duration at 3h so zombie sessions can't produce
    // nonsense payment numbers like "10222 minutes".
    const startedAt = session.startedAt?.toDate?.() ?? null;
    const closeNumbers = computeSessionClose(startedAt);

    // Single write covers close-out fields + (if present) the speaker's
    // in-call notes. Avoids two round trips.
    await updateDoc(doc(db, "sessions", sessionId), {
      status: "ended",
      endedAt: serverTimestamp(),
      endedBy: user.uid,
      ...closeNumbers,
      ...(isSpeaker && speakerNotes.trim()
        ? { speakerNotes: speakerNotes.trim() }
        : {}),
    });

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
      comment: ratingComment.trim() || null,
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

  /** Map a 1-5 challenge rating to the legacy level-signal value. */
  const signalFromRating = (rating: number): LevelSignalType | null => {
    if (rating <= 0) return null;
    if (rating <= 2) return "too_hard";
    if (rating >= 5) return "too_easy";
    return "just_right";
  };

  /* Speaker submits end-of-session feedback: topics, notes, and star rating. */
  const submitSpeakerFeedback = async () => {
    if (!user || !session) return;
    setLevelSignalSubmitting(true);
    try {
      const topicsDiscussed = topicsDiscussedText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      // Persist the feedback onto the session doc so it's visible to the
      // learner (notes + topics) and to the next speaker (handoff notes).
      await updateDoc(doc(db, "sessions", sessionId), {
        topicsDiscussed,
        notesToLearner: notesToLearner.trim(),
        notesToNextSpeaker: notesToNextSpeaker.trim(),
        challengeRating: challengeRating > 0 ? challengeRating : null,
      });

      // Derive a level signal from the star rating for the existing level-up
      // suggestion engine. One signal per learner in the session.
      const signalType = signalFromRating(challengeRating);
      if (signalType) {
        await Promise.all(
          learnerProfiles.map(async (lp) => {
            if (!lp.level) return; // skip learners without a level set
            await addDoc(collection(db, "levelSignals"), {
              sessionId,
              speakerId: user.uid,
              learnerId: lp.uid,
              signalType,
              atLevel: lp.level,
              createdAt: serverTimestamp(),
            });
          })
        );
      }

      // Write a handoff doc per learner so the next speaker can read these
      // notes without needing access to the full session (which contains
      // private chat messages).
      const speakerName = userProfile?.displayName ?? "Speaker";
      const trimmedHandoff = notesToNextSpeaker.trim();
      if (trimmedHandoff || topicsDiscussed.length > 0 || challengeRating > 0) {
        await Promise.all(
          learnerProfiles.map(async (lp) => {
            await addDoc(collection(db, "handoffs"), {
              learnerId: lp.uid,
              speakerId: user.uid,
              speakerName,
              sessionId,
              notesToNextSpeaker: trimmedHandoff,
              topicsDiscussed,
              challengeRating: challengeRating > 0 ? challengeRating : null,
              atLevel: lp.level ?? null,
              createdAt: serverTimestamp(),
            });
          })
        );
      }

      toast.success("Feedback saved — thanks!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save feedback");
    } finally {
      setLevelSignalSubmitting(false);
      router.push("/dashboard/speaker");
    }
  };

  /* Speaker skips the feedback form (still goes to dashboard) */
  const skipLevelSignal = () => {
    router.push("/dashboard/speaker");
  };

  // Speaker end-of-session feedback overlay
  if (showLevelPrompt) {
    const firstLearner = learnerProfiles[0];
    const learnerName = firstLearner?.displayName ?? "this learner";
    const currentLevel = firstLearner?.level ? LEVELS[firstLearner.level as LevelCode] : null;

    // Legend for each star value so speakers know what they mean
    const ratingLabels: Record<number, { title: string; hint: string }> = {
      1: { title: "Struggling", hint: "Way below their level — slow right down next time" },
      2: { title: "Slow down",  hint: "Finding it hard — pull back a little on difficulty" },
      3: { title: "Average",    hint: "Bang on their current level" },
      4: { title: "Doing well", hint: "Comfortable — slight push would suit" },
      5: { title: "Ready for a challenge", hint: "Could handle material a level up" },
    };
    const activeLabel = challengeRating > 0 ? ratingLabels[challengeRating] : null;

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
        <div className="pointer-events-none absolute -top-20 -left-20 h-[32rem] w-[32rem] rounded-full bg-teal-500/20 blur-3xl drift" />
        <div className="pointer-events-none absolute -right-20 top-40 h-[28rem] w-[28rem] rounded-full bg-cyan-400/15 blur-3xl drift-delay" />
        <div className="relative z-10 w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
          <h2 className="mb-1 text-2xl font-bold text-white">Nice session!</h2>
          <p className="mb-6 text-sm text-slate-400">
            A few notes on <strong className="text-white">{learnerName}</strong>
            {currentLevel && ` (${currentLevel})`}. Shared with the learner and kept as a handoff for whoever teaches them next.
          </p>

          <div className="space-y-5">
            {/* Topics discussed */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-300">
                Topics discussed
              </label>
              <input
                type="text"
                value={topicsDiscussedText}
                onChange={(e) => setTopicsDiscussedText(e.target.value)}
                placeholder="Ordering food, past tense, weekend plans"
                className="block w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 transition focus:border-teal-400/60 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
              />
              <p className="mt-1 text-xs text-slate-500">Comma-separated. Shared with the learner and the next speaker.</p>
            </div>

            {/* Notes to learner */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-300">
                Notes to learner
              </label>
              <textarea
                value={notesToLearner}
                onChange={(e) => setNotesToLearner(e.target.value)}
                placeholder="Recap, things to practise, words to look up…"
                rows={3}
                maxLength={1000}
                className="block w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 transition focus:border-teal-400/60 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
              />
            </div>

            {/* Notes for next speaker */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-300">
                Notes for next speaker
              </label>
              <textarea
                value={notesToNextSpeaker}
                onChange={(e) => setNotesToNextSpeaker(e.target.value)}
                placeholder="What worked, what they struggled with, what to try next…"
                rows={3}
                maxLength={1000}
                className="block w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 transition focus:border-teal-400/60 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
              />
            </div>

            {/* Challenge rating */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-300">
                Challenge rating
              </label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setChallengeRating(star === challengeRating ? 0 : star)}
                    disabled={levelSignalSubmitting}
                    aria-label={`${star} — ${ratingLabels[star].title}`}
                    title={ratingLabels[star].title}
                    className={`text-3xl leading-none transition ${
                      star <= challengeRating ? "text-amber-400" : "text-slate-600 hover:text-slate-400"
                    }`}
                  >
                    ★
                  </button>
                ))}
                {activeLabel && (
                  <span className="ml-3 text-sm font-medium text-teal-300">{activeLabel.title}</span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {activeLabel?.hint ?? "3 = on level · 2 = slow down · 5 = ready for a challenge"}
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={skipLevelSignal}
              disabled={levelSignalSubmitting}
              className="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={submitSpeakerFeedback}
              disabled={levelSignalSubmitting}
              className="rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 px-6 py-2.5 text-sm font-semibold text-slate-900 shadow-lg shadow-teal-500/30 transition hover:shadow-teal-400/60 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {levelSignalSubmitting ? "Saving…" : "Save & finish"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Rating overlay
  if (showRating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-teal-50 px-4 py-8 dark:bg-slate-950">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-2 text-xl font-bold text-slate-900 dark:text-slate-100">Session Complete!</h2>
          <p className="mb-6 text-slate-500 dark:text-slate-400">
            Duration: {session?.durationMinutes ?? 0} minutes
          </p>
          <p className="mb-4 text-sm font-medium text-slate-700 dark:text-slate-200">How was your session?</p>
          <div className="mb-6 flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRatingScore(star)}
                aria-label={`${star} star${star > 1 ? "s" : ""}`}
                className={`text-3xl transition ${
                  star <= ratingScore
                    ? "text-amber-400"
                    : "text-slate-300 hover:text-amber-300 dark:text-slate-600"
                }`}
              >
                ★
              </button>
            ))}
          </div>

          {/* Optional free-text comment */}
          <div className="mb-6 text-left">
            <label
              htmlFor="rating-comment"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
            >
              Leave a comment (optional)
            </label>
            <textarea
              id="rating-comment"
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              placeholder="What did you enjoy? What could be better?"
              rows={3}
              maxLength={500}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-600"
            />
            <p className="mt-1 text-right text-xs text-slate-400 dark:text-slate-500">
              {ratingComment.length}/500
            </p>
          </div>

          <button
            type="button"
            onClick={submitRating}
            disabled={ratingScore === 0}
            className="w-full rounded-lg bg-teal-600 px-4 py-3 font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
          >
            Submit Rating
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/learner")}
            className="mt-3 w-full text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Skip
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-900">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white">SpeakSpace</span>
          <span className="h-2 w-2 rounded-full bg-green-400" />
          <span className="text-sm text-slate-400">Live</span>
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
        <div className="flex w-80 flex-col border-l border-slate-700 bg-slate-800">
          {/* Speaker-only Panel */}
          {isSpeaker && (
            <div className="border-b border-slate-700">
              <button
                onClick={() => setNotesOpen(!notesOpen)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-300 hover:text-white"
              >
                <span>Speaker Notes</span>
                <span>{notesOpen ? "▼" : "▶"}</span>
              </button>
              {notesOpen && (
                <div className="px-4 pb-4 space-y-3">
                  {/* Challenge Up prompt */}
                  {challengeUp && (
                    <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Challenge Up</p>
                      <p className="mt-1 text-xs text-amber-100">
                        The learner asked to be pushed for this session — lean into harder vocabulary or trickier questions than their level suggests.
                      </p>
                    </div>
                  )}
                  {/* Learner info + handoff from previous speaker */}
                  {learnerProfiles.map((lp) => {
                    const handoff = handoffsByLearner[lp.uid];
                    return (
                      <div key={lp.uid} className="space-y-2">
                        <div className="rounded-lg bg-slate-700/50 p-3">
                          <p className="text-sm font-medium text-teal-400">{lp.displayName}</p>
                          <p className="text-xs text-slate-400">
                            Level: {lp.level ? LEVELS[lp.level as LevelCode] : "Unknown"}
                          </p>
                        </div>
                        {handoff && (
                          <div className="rounded-lg border border-teal-400/40 bg-teal-500/10 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-teal-300">
                                Handoff note
                              </p>
                              <span className="text-[10px] text-teal-200/70">
                                {handoff.speakerName}
                                {handoff.createdAt?.toDate
                                  ? ` · ${handoff.createdAt.toDate().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                                  : ""}
                              </span>
                            </div>
                            {typeof handoff.challengeRating === "number" && handoff.challengeRating > 0 && (
                              <p className="mt-1 text-xs text-amber-300">
                                {"*".repeat(handoff.challengeRating)}
                                <span className="text-slate-500">{"*".repeat(5 - handoff.challengeRating)}</span>
                                <span className="ml-2 text-teal-100/80">
                                  {handoff.challengeRating <= 2
                                    ? "slow down"
                                    : handoff.challengeRating >= 5
                                    ? "ready for a challenge"
                                    : "on level"}
                                </span>
                              </p>
                            )}
                            {handoff.topicsDiscussed?.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {handoff.topicsDiscussed.slice(0, 6).map((t) => (
                                  <span
                                    key={t}
                                    className="rounded bg-slate-800/60 px-1.5 py-0.5 text-[10px] text-slate-200"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                            {handoff.notesToNextSpeaker && (
                              <p className="mt-2 whitespace-pre-wrap text-xs text-teal-50">
                                {handoff.notesToNextSpeaker}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {/* Topic prompts */}
                  {topic && (
                    <div className="rounded-lg bg-slate-700/50 p-3">
                      <p className="mb-1 text-xs font-medium text-teal-400">{topic.title}</p>
                      {topic.promptQuestions?.map((q, i) => (
                        <p key={i} className="text-xs text-slate-300">• {q}</p>
                      ))}
                      {topic.vocabularyHints?.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-teal-400">Vocabulary</p>
                          {topic.vocabularyHints.map((v, i) => (
                            <span key={i} className="mr-1 inline-block rounded bg-slate-600 px-1.5 py-0.5 text-xs text-slate-200">
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
                    className="w-full rounded-lg bg-slate-700 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* Chat */}
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className="flex w-full items-center justify-between border-b border-slate-700 px-4 py-3 text-sm font-medium text-slate-300 hover:text-white"
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
                        : "bg-slate-700 text-slate-200"
                    } max-w-[85%]`}
                  >
                    {m.text}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={sendMessage} className="border-t border-slate-700 p-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 rounded-lg bg-slate-700 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
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
