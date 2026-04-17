"use client";

import { useState } from "react";
import {
  collection,
  doc,
  setDoc,
  addDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import toast from "react-hot-toast";

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

const DEMO_LEARNERS = [
  {
    uid: "learner-alex",
    role: "learner",
    displayName: "Alex Chen",
    email: "alex@demo.com",
    photoURL: "",
    level: "2b",
    createdAt: serverTimestamp(),
  },
  {
    uid: "learner-sarah",
    role: "learner",
    displayName: "Sarah Johnson",
    email: "sarah@demo.com",
    photoURL: "",
    level: "3a",
    createdAt: serverTimestamp(),
  },
];

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

export default function SeedPage() {
  const [seeding, setSeeding] = useState(false);
  const [done, setDone] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      // Seed speakers
      for (const speaker of DEMO_SPEAKERS) {
        await setDoc(doc(db, "users", speaker.uid), speaker);
      }
      // Seed learners
      for (const learner of DEMO_LEARNERS) {
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
    } catch (err: any) {
      toast.error(err.message || "Seeding failed");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-teal-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
        <h1 className="mb-2 text-2xl font-bold text-teal-700">Seed Demo Data</h1>
        <p className="mb-6 text-sm text-gray-500">
          This will create demo speakers, learners, topics, and a completed session.
        </p>
        {done ? (
          <div className="text-green-600 font-medium">
            Done! Demo data has been seeded.
          </div>
        ) : (
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="w-full rounded-lg bg-teal-600 px-4 py-3 font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
          >
            {seeding ? "Seeding..." : "Seed Data"}
          </button>
        )}
      </div>
    </div>
  );
}
