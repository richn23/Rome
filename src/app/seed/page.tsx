"use client";

import { useState } from "react";
import {
  collection,
  doc,
  setDoc,
  addDoc,
  serverTimestamp,
  Timestamp,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import toast from "react-hot-toast";
import { ALL_GUIDANCE } from "@/lib/guidanceSeed";

const DEMO_SPEAKERS = [
  {
    uid: "speaker-maria",
    role: "speaker",
    displayName: "Maria Garcia",
    email: "maria@demo.com",
    photoURL: "",
    nativeLanguage: "Spanish",
    bio: "Born and raised in Madrid. Love helping people practice everyday Spanish!",
    status: "online",
    hourlyRate: 18,
    rating: 4.8,
    totalSessions: 47,
    createdAt: serverTimestamp(),
  },
  {
    uid: "speaker-yuki",
    role: "speaker",
    displayName: "Yuki Tanaka",
    email: "yuki@demo.com",
    photoURL: "",
    nativeLanguage: "Japanese",
    bio: "Software engineer from Tokyo. Casual conversation about tech, travel, and life in Japan.",
    status: "online",
    hourlyRate: 22,
    rating: 4.9,
    totalSessions: 31,
    createdAt: serverTimestamp(),
  },
  {
    uid: "speaker-pierre",
    role: "speaker",
    displayName: "Pierre Dupont",
    email: "pierre@demo.com",
    photoURL: "",
    nativeLanguage: "French",
    bio: "Journalist from Lyon. Great at structured conversation and storytelling topics.",
    status: "busy",
    hourlyRate: 20,
    rating: 4.6,
    totalSessions: 63,
    createdAt: serverTimestamp(),
  },
  {
    uid: "speaker-anna",
    role: "speaker",
    displayName: "Anna Mueller",
    email: "anna@demo.com",
    photoURL: "",
    nativeLanguage: "German",
    bio: "University student in Berlin. Fun and patient, perfect for beginners!",
    status: "offline",
    hourlyRate: 15,
    rating: 4.7,
    totalSessions: 22,
    createdAt: serverTimestamp(),
  },
];

/**
 * Numbered generic demo speakers — useful for smoke-testing lists, filters,
 * and the Scheduled tab. Languages and statuses spread across sensible ranges.
 */
const NUMBERED_DEMO_SPEAKERS = [
  { lang: "English",    status: "online",  rate: 18, rating: 4.5, sessions: 12 },
  { lang: "Portuguese", status: "online",  rate: 16, rating: 4.7, sessions: 28 },
  { lang: "Italian",    status: "busy",    rate: 19, rating: 4.4, sessions: 19 },
  { lang: "Korean",     status: "online",  rate: 24, rating: 4.8, sessions: 40 },
  { lang: "Dutch",      status: "offline", rate: 17, rating: 4.3, sessions: 9  },
].map((s, i) => ({
  uid: `demo-speaker-${i + 1}`,
  role: "speaker",
  displayName: `Demo Speaker ${i + 1}`,
  email: `demo.speaker.${i + 1}@demo.com`,
  photoURL: "",
  nativeLanguage: s.lang,
  bio: `Generic demo speaker #${i + 1} (native ${s.lang}). Use for smoke-testing.`,
  status: s.status,
  hourlyRate: s.rate,
  rating: s.rating,
  totalSessions: s.sessions,
  createdAt: serverTimestamp(),
}));

const DEMO_LEARNERS = [
  {
    uid: "learner-alex",
    role: "learner",
    displayName: "Alex Chen",
    email: "alex@demo.com",
    photoURL: "",
    level: "2b",
    nativeLanguage: "English",
    learningLanguage: "Spanish",
    createdAt: serverTimestamp(),
  },
  {
    uid: "learner-sarah",
    role: "learner",
    displayName: "Sarah Johnson",
    email: "sarah@demo.com",
    photoURL: "",
    level: "3a",
    nativeLanguage: "English",
    learningLanguage: "French",
    createdAt: serverTimestamp(),
  },
];

const NUMBERED_DEMO_LEARNERS = [
  { level: "1b", learning: "Spanish"  },
  { level: "2a", learning: "Japanese" },
  { level: "3b", learning: "French"   },
].map((l, i) => ({
  uid: `demo-learner-${i + 1}`,
  role: "learner",
  displayName: `Demo Learner ${i + 1}`,
  email: `demo.learner.${i + 1}@demo.com`,
  photoURL: "",
  level: l.level,
  nativeLanguage: "English",
  learningLanguage: l.learning,
  createdAt: serverTimestamp(),
}));

const DEMO_ADMIN = {
  uid: "admin-main",
  role: "admin",
  displayName: "Admin User",
  email: "admin@speakspace.com",
  photoURL: "",
  createdAt: serverTimestamp(),
};

const DEMO_TOPICS = [
  {
    title: "Weekend Plans",
    category: "everyday",
    level: "1b",
    promptQuestions: [
      "What do you usually do on weekends?",
      "Do you prefer staying home or going out?",
      "What's your favourite weekend activity?",
    ],
    vocabularyHints: ["relax", "hang out", "go for a walk", "catch up with friends", "sleep in"],
    isActive: true,
  },
  {
    title: "Travel Adventures",
    category: "travel",
    level: "2a",
    promptQuestions: [
      "What's the best place you've ever visited?",
      "Do you prefer beach or mountain holidays?",
      "Have you ever had a travel disaster?",
    ],
    vocabularyHints: ["itinerary", "backpacking", "layover", "sightseeing", "jet lag"],
    isActive: true,
  },
  {
    title: "Work & Career",
    category: "work",
    level: "3a",
    promptQuestions: [
      "What does a typical workday look like for you?",
      "What would your dream job be?",
      "How do you handle work-life balance?",
    ],
    vocabularyHints: ["deadline", "promotion", "remote work", "colleague", "networking"],
    isActive: true,
  },
  {
    title: "Food & Culture",
    category: "culture",
    level: "2b",
    promptQuestions: [
      "What's a dish from your country everyone should try?",
      "Do you enjoy cooking or eating out more?",
      "Have you tried any unusual foods?",
    ],
    vocabularyHints: ["recipe", "ingredient", "cuisine", "delicacy", "street food"],
    isActive: true,
  },
  {
    title: "Debating Opinions",
    category: "culture",
    level: "4a",
    promptQuestions: [
      "Should social media have age restrictions?",
      "Is it better to rent or buy a home?",
      "What's more important: talent or hard work?",
    ],
    vocabularyHints: ["perspective", "counterargument", "on the other hand", "compelling", "controversial"],
    isActive: true,
  },
];

/** Build a Date set to days-from-now at hour:minute in local time. */
function futureDate(daysFromNow: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export default function SeedPage() {
  const [seeding, setSeeding] = useState(false);
  const [done, setDone] = useState(false);

  // Hard gate in production — the seed page is a dev convenience only.
  // Returning a 404-style message prevents accidental prod seeds AND prevents
  // any future bug from letting a button run against the live DB.
  if (process.env.NODE_ENV === "production") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-center">
        <div className="max-w-md">
          <h1 className="mb-2 font-display text-2xl font-semibold text-white">
            Not available
          </h1>
          <p className="text-sm text-slate-400">
            The seed tool is disabled in production.
          </p>
        </div>
      </div>
    );
  }

  const handleSeed = async () => {
    setSeeding(true);
    try {
      // Seed named + numbered speakers
      for (const speaker of [...DEMO_SPEAKERS, ...NUMBERED_DEMO_SPEAKERS]) {
        await setDoc(doc(db, "users", speaker.uid), speaker);
      }
      // Seed named + numbered learners
      for (const learner of [...DEMO_LEARNERS, ...NUMBERED_DEMO_LEARNERS]) {
        await setDoc(doc(db, "users", learner.uid), learner);
      }
      // Seed admin
      await setDoc(doc(db, "users", DEMO_ADMIN.uid), DEMO_ADMIN);

      // Seed topics
      for (const topic of DEMO_TOPICS) {
        await addDoc(collection(db, "topics"), {
          ...topic,
          createdBy: DEMO_ADMIN.uid,
          createdAt: serverTimestamp(),
        });
      }

      // Seed guidance docs (upsert by audience+slug so re-running doesn't duplicate).
      for (const g of ALL_GUIDANCE) {
        const existing = await getDocs(
          query(
            collection(db, "guidance"),
            where("audience", "==", g.audience),
            where("slug", "==", g.slug)
          )
        );
        if (existing.empty) {
          await addDoc(collection(db, "guidance"), {
            audience: g.audience,
            slug: g.slug,
            title: g.title,
            summary: g.summary,
            body: g.body,
            order: g.order,
            updatedAt: serverTimestamp(),
            updatedBy: DEMO_ADMIN.uid,
          });
        }
      }

      // Seed availability slots so the learner Scheduled tab has content.
      // Spread across a few speakers over the next 2 weeks.
      // Mix of 30 and 45 minute slots so both durations are visible.
      const slotPlan: Array<{ speakerId: string; when: Date; duration: 30 | 45; autoConfirm: boolean }> = [
        { speakerId: "speaker-maria",   when: futureDate(1, 9,  0),  duration: 30, autoConfirm: true  },
        { speakerId: "speaker-maria",   when: futureDate(1, 17, 30), duration: 45, autoConfirm: true  },
        { speakerId: "speaker-yuki",    when: futureDate(2, 8,  0),  duration: 30, autoConfirm: true  },
        { speakerId: "speaker-yuki",    when: futureDate(3, 20, 0),  duration: 45, autoConfirm: false },
        { speakerId: "speaker-pierre",  when: futureDate(2, 14, 0),  duration: 45, autoConfirm: true  },
        { speakerId: "demo-speaker-1",  when: futureDate(1, 10, 0),  duration: 30, autoConfirm: true  },
        { speakerId: "demo-speaker-1",  when: futureDate(4, 10, 0),  duration: 45, autoConfirm: true  },
        { speakerId: "demo-speaker-2",  when: futureDate(3, 12, 0),  duration: 30, autoConfirm: true  },
        { speakerId: "demo-speaker-4",  when: futureDate(5, 18, 0),  duration: 30, autoConfirm: true  },
        { speakerId: "demo-speaker-4",  when: futureDate(6, 18, 0),  duration: 45, autoConfirm: true  },
      ];
      for (const s of slotPlan) {
        await addDoc(collection(db, "availability"), {
          speakerId: s.speakerId,
          scheduledFor: Timestamp.fromDate(s.when),
          durationMinutes: s.duration,
          autoConfirm: s.autoConfirm,
          status: "available",
          bookingId: null,
          recurrenceId: null,
          createdAt: serverTimestamp(),
        });
      }

      // Seed a pending instant booking WITH challengeUp so the speaker dashboard
      // shows the Challenge Up badge straight away.
      await addDoc(collection(db, "bookings"), {
        learnerId: "learner-alex",
        speakerId: "speaker-yuki",
        requestedAt: serverTimestamp(),
        status: "pending",
        topicSuggestion: "Ordering food at a restaurant",
        challengeUp: true,
        sessionId: null,
      });

      // Seed a scheduled booking WITH challengeUp (future, already admitted)
      // so the speaker's Upcoming Sessions list also shows the badge.
      await addDoc(collection(db, "bookings"), {
        learnerId: "learner-sarah",
        speakerId: "speaker-maria",
        requestedAt: serverTimestamp(),
        status: "admitted",
        scheduledFor: Timestamp.fromDate(futureDate(2, 10, 0)),
        challengeUp: true,
        sessionId: null,
      });

      // Seed a completed session
      const sessionRef = await addDoc(collection(db, "sessions"), {
        speakerId: "speaker-maria",
        learnerIds: ["learner-alex"],
        status: "ended",
        jitsiRoomId: crypto.randomUUID(),
        startedAt: Timestamp.fromDate(new Date(Date.now() - 3600000)),
        endedAt: Timestamp.fromDate(new Date(Date.now() - 1800000)),
        endedBy: "learner-alex",
        durationMinutes: 30,
        amountCharged: 9.0,
        platformCut: 1.8,
        speakerPayout: 7.2,
      });

      // Seed chat messages for that session
      await addDoc(collection(db, "sessions", sessionRef.id, "messages"), {
        senderId: "speaker-maria",
        text: "Hola! How are you today?",
        sentAt: Timestamp.fromDate(new Date(Date.now() - 3500000)),
      });
      await addDoc(collection(db, "sessions", sessionRef.id, "messages"), {
        senderId: "learner-alex",
        text: "Muy bien, gracias! I want to practice ordering food.",
        sentAt: Timestamp.fromDate(new Date(Date.now() - 3400000)),
      });

      // Seed a rating
      await addDoc(collection(db, "ratings"), {
        sessionId: sessionRef.id,
        learnerId: "learner-alex",
        speakerId: "speaker-maria",
        score: 5,
        comment: "Maria was amazing! Very patient and fun.",
        createdAt: serverTimestamp(),
      });

      setDone(true);
      toast.success("Demo data seeded successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Seeding failed");
    } finally {
      setSeeding(false);
    }
  };

  const totalSpeakers = DEMO_SPEAKERS.length + NUMBERED_DEMO_SPEAKERS.length;
  const totalLearners = DEMO_LEARNERS.length + NUMBERED_DEMO_LEARNERS.length;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="pointer-events-none absolute -top-20 -left-20 h-[32rem] w-[32rem] rounded-full bg-teal-500/20 blur-3xl drift" />
      <div className="pointer-events-none absolute -right-20 top-40 h-[28rem] w-[28rem] rounded-full bg-cyan-400/15 blur-3xl drift-delay" />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl">
        <h1 className="mb-2 text-2xl font-bold text-white">Seed Demo Data</h1>
        <p className="mb-6 text-sm text-slate-400">
          Creates {totalSpeakers} speakers ({DEMO_SPEAKERS.length} named + {NUMBERED_DEMO_SPEAKERS.length} numbered),{" "}
          {totalLearners} learners, 5 topics, a mix of 30 and 45-minute availability slots,
          two Challenge Up bookings (one pending, one scheduled), a completed session with a rating,
          and {ALL_GUIDANCE.length} starter guidance articles for speakers and learners.
        </p>
        {done ? (
          <div className="font-medium text-teal-300">
            Done! Demo data has been seeded.
          </div>
        ) : (
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="w-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 px-4 py-3 font-semibold text-slate-900 shadow-lg shadow-teal-500/30 transition hover:shadow-teal-400/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {seeding ? "Seeding..." : "Seed Data"}
          </button>
        )}

        <p className="mt-6 text-xs text-slate-500">
          Admin role must be assigned manually via the Firebase Console (Firestore
          users/{"{uid}"}/role).
        </p>
      </div>
    </div>
  );
}
