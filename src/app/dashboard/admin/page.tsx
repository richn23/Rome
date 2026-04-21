"use client";

import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import RouteGuard from "@/components/RouteGuard";
import { UserProfile, Topic, Session, LEVELS, LevelCode, TopicCategory } from "@/types";
import toast from "react-hot-toast";

function AdminDashboardContent() {
  const [tab, setTab] = useState<"users" | "topics" | "sessions">("users");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showTopicForm, setShowTopicForm] = useState(false);
  const { userProfile } = useAuth();

  // Topic form state
  const [topicTitle, setTopicTitle] = useState("");
  const [topicCategory, setTopicCategory] = useState<TopicCategory>("everyday");
  const [topicLevel, setTopicLevel] = useState<LevelCode>("1a");
  const [topicQuestions, setTopicQuestions] = useState("");
  const [topicVocab, setTopicVocab] = useState("");

  useEffect(() => {
    const fetchAll = async () => {
      const [usersSnap, topicsSnap, sessionsSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "topics")),
        getDocs(query(collection(db, "sessions"), orderBy("startedAt", "desc"))),
      ]);
      setUsers(usersSnap.docs.map((d) => d.data() as UserProfile));
      setTopics(topicsSnap.docs.map((d) => ({ topicId: d.id, ...d.data() }) as Topic));
      setSessions(sessionsSnap.docs.map((d) => ({ sessionId: d.id, ...d.data() }) as Session));
    };
    fetchAll();
  }, []);

  const filteredUsers = users.filter(
    (u) =>
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleTopicActive = async (topic: Topic) => {
    await updateDoc(doc(db, "topics", topic.topicId), { isActive: !topic.isActive });
    setTopics((prev) =>
      prev.map((t) => (t.topicId === topic.topicId ? { ...t, isActive: !t.isActive } : t))
    );
    toast.success(`Topic ${topic.isActive ? "hidden" : "activated"}`);
  };

  const createTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    await addDoc(collection(db, "topics"), {
      title: topicTitle,
      category: topicCategory,
      level: topicLevel,
      promptQuestions: topicQuestions.split("\n").filter(Boolean),
      vocabularyHints: topicVocab.split("\n").filter(Boolean),
      isActive: true,
      createdBy: userProfile.uid,
      createdAt: serverTimestamp(),
    });
    toast.success("Topic created");
    setShowTopicForm(false);
    setTopicTitle("");
    setTopicQuestions("");
    setTopicVocab("");
    // Refresh
    const snap = await getDocs(collection(db, "topics"));
    setTopics(snap.docs.map((d) => ({ topicId: d.id, ...d.data() }) as Topic));
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-xl md:p-10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-56 w-56 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="relative z-10">
          <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-teal-300">Admin</p>
          <h2 className="text-3xl font-bold md:text-4xl">Dashboard</h2>
          <p className="mt-3 max-w-lg text-slate-300">
            Manage users, topics, and session activity.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
        {(["users", "topics", "sessions"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
              tab === t ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {tab === "users" && (
        <div>
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-4 w-full rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-3 text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/40 focus:outline-none"
          />
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Name</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Email</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Role</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Level</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => (
                  <tr key={u.uid}>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{u.displayName}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700 dark:text-teal-300 capitalize">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {u.level ? LEVELS[u.level as LevelCode] : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 capitalize">{u.status ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Topics Tab */}
      {tab === "topics" && (
        <div>
          <button
            onClick={() => setShowTopicForm(!showTopicForm)}
            className="mb-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700"
          >
            {showTopicForm ? "Cancel" : "+ New Topic"}
          </button>
          {showTopicForm && (
            <form onSubmit={createTopic} className="mb-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <input
                placeholder="Topic title"
                value={topicTitle}
                onChange={(e) => setTopicTitle(e.target.value)}
                required
                className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-4">
                <select
                  value={topicCategory}
                  onChange={(e) => setTopicCategory(e.target.value as TopicCategory)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
                >
                  <option value="everyday">Everyday</option>
                  <option value="travel">Travel</option>
                  <option value="work">Work</option>
                  <option value="culture">Culture</option>
                </select>
                <select
                  value={topicLevel}
                  onChange={(e) => setTopicLevel(e.target.value as LevelCode)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
                >
                  {Object.entries(LEVELS).map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
              </div>
              <textarea
                placeholder="Prompt questions (one per line)"
                value={topicQuestions}
                onChange={(e) => setTopicQuestions(e.target.value)}
                rows={3}
                className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
              />
              <textarea
                placeholder="Vocabulary hints (one per line)"
                value={topicVocab}
                onChange={(e) => setTopicVocab(e.target.value)}
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
                  t.isActive ? "border-slate-200 dark:border-slate-800" : "border-slate-200 dark:border-slate-800 opacity-50"
                }`}
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{t.title}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t.category} · {LEVELS[t.level as LevelCode]} · {t.promptQuestions?.length ?? 0} questions
                  </p>
                </div>
                <button
                  onClick={() => toggleTopicActive(t)}
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
      )}

      {/* Sessions Tab */}
      {tab === "sessions" && (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Session</th>
                <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Status</th>
                <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Duration</th>
                <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.map((s) => (
                <tr key={s.sessionId}>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">#{s.sessionId.slice(0, 8)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                      s.status === "active" ? "bg-green-100 text-green-700" :
                      s.status === "ended" ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{s.durationMinutes ?? "—"} min</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">${s.amountCharged?.toFixed(2) ?? "0.00"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <RouteGuard allowedRole="admin">
      <AdminDashboardContent />
    </RouteGuard>
  );
}
