"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import RouteGuard from "@/components/RouteGuard";
import Avatar from "@/components/Avatar";
import { Session, UserProfile, Topic, Rating } from "@/types";

function SessionDetailsContent({ sessionId }: { sessionId: string }) {
  const { user, userProfile } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [speaker, setSpeaker] = useState<UserProfile | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [rating, setRating] = useState<Rating | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const snap = await getDoc(doc(db, "sessions", sessionId));
      if (!snap.exists()) {
        setLoading(false);
        return;
      }
      const s = { sessionId: snap.id, ...snap.data() } as Session;
      setSession(s);

      // Speaker
      const sp = await getDoc(doc(db, "users", s.speakerId));
      if (sp.exists()) setSpeaker(sp.data() as UserProfile);

      // Topic
      if (s.topicId) {
        const tp = await getDoc(doc(db, "topics", s.topicId));
        if (tp.exists()) setTopic({ topicId: tp.id, ...tp.data() } as Topic);
      }

      // Rating given by this learner
      if (user) {
        const rq = query(
          collection(db, "ratings"),
          where("sessionId", "==", sessionId),
          where("learnerId", "==", user.uid)
        );
        const rsnap = await getDocs(rq);
        if (!rsnap.empty) {
          const d = rsnap.docs[0];
          setRating({ ratingId: d.id, ...d.data() } as Rating);
        }
      }

      setLoading(false);
    };
    load();
  }, [sessionId, user]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="animate-pulse text-teal-600 dark:text-teal-400">Loading session...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center">
        <p className="mb-4 text-slate-600 dark:text-slate-300">Session not found.</p>
        <Link href="/dashboard/learner" className="text-sm font-medium text-teal-700 dark:text-teal-300 hover:text-teal-800 dark:hover:text-teal-200">
          Back to dashboard
        </Link>
      </div>
    );
  }

  // Only the learner who was in this session (or the speaker) should see it
  const isParticipant =
    userProfile &&
    (session.learnerIds?.includes(userProfile.uid) ||
      session.speakerId === userProfile.uid);

  if (!isParticipant) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center">
        <p className="mb-4 text-slate-600 dark:text-slate-300">You don&apos;t have access to this session.</p>
        <Link href="/dashboard/learner" className="text-sm font-medium text-teal-700 dark:text-teal-300 hover:text-teal-800 dark:hover:text-teal-200">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const startedAt = session.startedAt?.toDate?.();
  const endedAt = session.endedAt?.toDate?.();

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <Link href="/dashboard/learner" className="inline-block text-sm font-medium text-teal-700 dark:text-teal-300 hover:text-teal-800 dark:hover:text-teal-200">
        ← Back to dashboard
      </Link>

      <div>
        <p className="text-sm font-medium uppercase tracking-[0.15em] text-teal-600 dark:text-teal-400">Session</p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {startedAt
            ? startedAt.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
            : "Session"}
        </h1>
      </div>

      {/* Speaker */}
      {speaker && (
        <Link
          href={`/speakers/${speaker.uid}`}
          className="flex items-center gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition"
        >
          <Avatar
            photoURL={speaker.photoURL}
            displayName={speaker.displayName}
            className="h-14 w-14 rounded-full ring-1 ring-teal-100 dark:ring-teal-900/50"
            textClassName="text-xl"
          />
          <div className="flex-1">
            <p className="font-semibold text-slate-900 dark:text-slate-100">{speaker.displayName}</p>
            {speaker.nativeLanguage && (
              <p className="text-sm text-slate-500 dark:text-slate-400">Native {speaker.nativeLanguage} speaker</p>
            )}
          </div>
          <span className="text-sm text-teal-700 dark:text-teal-300">View profile →</span>
        </Link>
      )}

      {/* Session facts */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Duration</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {session.durationMinutes ?? 0} <span className="text-base font-normal text-slate-500 dark:text-slate-400">min</span>
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Started</p>
          <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
            {startedAt ? startedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "-"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ended</p>
          <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
            {endedAt ? endedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "-"}
          </p>
        </div>
      </div>

      {/* Topics discussed (captured by speaker) */}
      {session.topicsDiscussed && session.topicsDiscussed.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Topics covered</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {session.topicsDiscussed.map((t) => (
              <span
                key={t}
                className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Notes to learner (from speaker) */}
      {session.notesToLearner && (
        <div className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50 p-5 dark:border-teal-900/60 dark:from-teal-950/60 dark:to-cyan-950/60">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-500/20 text-sm">
              💬
            </span>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
              Notes from {speaker?.displayName ?? "your speaker"}
            </p>
          </div>
          <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
            {session.notesToLearner}
          </p>
        </div>
      )}

      {/* Challenge rating (visible to learner as a level-fit indicator) */}
      {typeof session.challengeRating === "number" && session.challengeRating > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Level fit
          </p>
          <p className="mt-2 text-2xl text-amber-500">
            {"*".repeat(session.challengeRating)}
            <span className="text-slate-300 dark:text-slate-600">{"*".repeat(5 - session.challengeRating)}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {session.challengeRating <= 2
              ? "Your speaker felt this was a stretch — a little practice at this level will help."
              : session.challengeRating >= 5
              ? "Your speaker thinks you're ready for a challenge!"
              : "On level — keep going."}
          </p>
        </div>
      )}

      {/* Topic */}
      {topic && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Topic</p>
          <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">{topic.title}</h3>
          {topic.promptQuestions?.length > 0 && (
            <div className="mt-3 space-y-1">
              {topic.promptQuestions.slice(0, 3).map((q, i) => (
                <p key={i} className="text-sm italic text-slate-600 dark:text-slate-300">&ldquo;{q}&rdquo;</p>
              ))}
            </div>
          )}
          {topic.vocabularyHints?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {topic.vocabularyHints.map((v) => (
                <span key={v} className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-300">
                  {v}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rating given */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Your rating</p>
        {rating ? (
          <div className="mt-2">
            <p className="text-2xl text-amber-500">{"*".repeat(rating.score)}{"-".repeat(5 - rating.score)}</p>
            {rating.comment && (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">&ldquo;{rating.comment}&rdquo;</p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">No rating given</p>
        )}
      </div>
    </div>
  );
}

export default function SessionDetailsPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  return (
    <RouteGuard allowedRole="learner">
      <SessionDetailsContent sessionId={sessionId} />
    </RouteGuard>
  );
}
