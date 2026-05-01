"use client";

import { useState, Dispatch, SetStateAction } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Topic, LEVELS, LevelCode, TopicCategory } from "@/types";
import toast from "react-hot-toast";

interface Props {
  topics: Topic[];
  setTopics: Dispatch<SetStateAction<Topic[]>>;
  error?: string;
}

export default function TopicsTab({ topics, setTopics, error }: Props) {
  const { userProfile } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<TopicCategory>("everyday");
  const [level, setLevel] = useState<LevelCode>("1a");
  const [questions, setQuestions] = useState("");
  const [vocab, setVocab] = useState("");

  const toggleActive = async (topic: Topic) => {
    await updateDoc(doc(db, "topics", topic.topicId), { isActive: !topic.isActive });
    setTopics((prev) =>
      prev.map((t) => (t.topicId === topic.topicId ? { ...t, isActive: !t.isActive } : t)),
    );
    toast.success(`Topic ${topic.isActive ? "hidden" : "activated"}`);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    await addDoc(collection(db, "topics"), {
      title,
      category,
      level,
      promptQuestions: questions.split("\n").filter(Boolean),
      vocabularyHints: vocab.split("\n").filter(Boolean),
      isActive: true,
      createdBy: userProfile.uid,
      createdAt: serverTimestamp(),
    });
    toast.success("Topic created");
    setShowForm(false);
    setTitle("");
    setQuestions("");
    setVocab("");
    const snap = await getDocs(collection(db, "topics"));
    setTopics(snap.docs.map((d) => ({ topicId: d.id, ...d.data() }) as Topic));
  };

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
          Couldn&apos;t load topics: {error}
        </div>
      )}
      <button
        onClick={() => setShowForm(!showForm)}
        className="mb-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700"
      >
        {showForm ? "Cancel" : "+ New Topic"}
      </button>
      {showForm && (
        <form
          onSubmit={create}
          className="mb-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
        >
          <input
            placeholder="Topic title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-4">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TopicCategory)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
            >
              <option value="everyday" className="bg-white dark:bg-slate-900">Everyday</option>
              <option value="travel" className="bg-white dark:bg-slate-900">Travel</option>
              <option value="work" className="bg-white dark:bg-slate-900">Work</option>
              <option value="culture" className="bg-white dark:bg-slate-900">Culture</option>
            </select>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as LevelCode)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
            >
              {Object.entries(LEVELS).map(([code, name]) => (
                <option key={code} value={code} className="bg-white dark:bg-slate-900">
                  {name}
                </option>
              ))}
            </select>
          </div>
          <textarea
            placeholder="Prompt questions (one per line)"
            value={questions}
            onChange={(e) => setQuestions(e.target.value)}
            rows={3}
            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
          />
          <textarea
            placeholder="Vocabulary hints (one per line)"
            value={vocab}
            onChange={(e) => setVocab(e.target.value)}
            rows={3}
            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-teal-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-teal-700"
          >
            Create Topic
          </button>
        </form>
      )}
      <div className="space-y-3">
        {topics.map((t) => (
          <div
            key={t.topicId}
            className={`flex items-center justify-between rounded-xl border bg-white dark:bg-slate-900 p-4 ${
              t.isActive
                ? "border-slate-200 dark:border-slate-800"
                : "border-slate-200 dark:border-slate-800 opacity-50"
            }`}
          >
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">{t.title}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t.category} · {LEVELS[t.level as LevelCode]} ·{" "}
                {t.promptQuestions?.length ?? 0} questions
              </p>
            </div>
            <button
              onClick={() => toggleActive(t)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                t.isActive
                  ? "border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800"
                  : "bg-teal-600 text-white hover:bg-teal-700"
              }`}
            >
              {t.isActive ? "Hide" : "Show"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
