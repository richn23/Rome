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
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import RouteGuard from "@/components/RouteGuard";
import { UserProfile, Topic, Session, Resource, GuidanceDoc, LEVELS, LevelCode, TopicCategory } from "@/types";
import toast from "react-hot-toast";

function AdminDashboardContent() {
  const [tab, setTab] = useState<"users" | "topics" | "sessions" | "resources" | "guidance">("users");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [guidanceDocs, setGuidanceDocs] = useState<GuidanceDoc[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showTopicForm, setShowTopicForm] = useState(false);
  /* Per-tab fetch errors — one failure shouldn't blank the others */
  const [tabErrors, setTabErrors] = useState<{
    users?: string;
    topics?: string;
    sessions?: string;
    resources?: string;
    guidance?: string;
  }>({});
  /* Guidance editor state */
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editBody, setEditBody] = useState("");
  const [savingGuidance, setSavingGuidance] = useState(false);
  const { userProfile } = useAuth();

  // Topic form state
  const [topicTitle, setTopicTitle] = useState("");
  const [topicCategory, setTopicCategory] = useState<TopicCategory>("everyday");
  const [topicLevel, setTopicLevel] = useState<LevelCode>("1a");
  const [topicQuestions, setTopicQuestions] = useState("");
  const [topicVocab, setTopicVocab] = useState("");

  const refreshResources = async () => {
    try {
      const snap = await getDocs(query(collection(db, "resources"), orderBy("createdAt", "desc")));
      setResources(snap.docs.map((d) => ({ resourceId: d.id, ...d.data() }) as Resource));
      setTabErrors((prev) => ({ ...prev, resources: undefined }));
    } catch (err) {
      setTabErrors((prev) => ({
        ...prev,
        resources: err instanceof Error ? err.message : "Failed to load resources",
      }));
    }
  };

  const refreshGuidance = async () => {
    try {
      const snap = await getDocs(collection(db, "guidance"));
      const arr = snap.docs.map((d) => ({ docId: d.id, ...d.data() }) as GuidanceDoc);
      arr.sort((a, b) => {
        if (a.audience !== b.audience) return a.audience < b.audience ? -1 : 1;
        return (a.order ?? 0) - (b.order ?? 0);
      });
      setGuidanceDocs(arr);
      setTabErrors((prev) => ({ ...prev, guidance: undefined }));
    } catch (err) {
      setTabErrors((prev) => ({
        ...prev,
        guidance: err instanceof Error ? err.message : "Failed to load guidance",
      }));
    }
  };

  useEffect(() => {
    // Each collection fetched independently so one denial doesn't cascade.
    const fetchUsers = async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        setUsers(snap.docs.map((d) => d.data() as UserProfile));
      } catch (err) {
        setTabErrors((prev) => ({
          ...prev,
          users: err instanceof Error ? err.message : "Failed to load users",
        }));
      }
    };
    const fetchTopics = async () => {
      try {
        const snap = await getDocs(collection(db, "topics"));
        setTopics(snap.docs.map((d) => ({ topicId: d.id, ...d.data() }) as Topic));
      } catch (err) {
        setTabErrors((prev) => ({
          ...prev,
          topics: err instanceof Error ? err.message : "Failed to load topics",
        }));
      }
    };
    const fetchSessions = async () => {
      try {
        const snap = await getDocs(query(collection(db, "sessions"), orderBy("startedAt", "desc")));
        setSessions(snap.docs.map((d) => ({ sessionId: d.id, ...d.data() }) as Session));
      } catch (err) {
        setTabErrors((prev) => ({
          ...prev,
          sessions: err instanceof Error ? err.message : "Failed to load sessions",
        }));
      }
    };
    fetchUsers();
    fetchTopics();
    fetchSessions();
    refreshResources();
    refreshGuidance();
  }, []);

  const handleDeleteResource = async (r: Resource) => {
    if (!confirm(`Delete "${r.title}"?`)) return;
    try {
      if (r.storagePath) {
        try { await deleteObject(ref(storage, r.storagePath)); } catch {}
      }
      await deleteDoc(doc(db, "resources", r.resourceId));
      toast.success("Deleted");
      refreshResources();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    }
  };

  const startEditGuidance = (g: GuidanceDoc) => {
    setEditingDocId(g.docId);
    setEditTitle(g.title);
    setEditSummary(g.summary ?? "");
    setEditBody(g.body ?? "");
  };

  const cancelEditGuidance = () => {
    setEditingDocId(null);
    setEditTitle("");
    setEditSummary("");
    setEditBody("");
  };

  const saveGuidance = async () => {
    if (!editingDocId || !userProfile) return;
    setSavingGuidance(true);
    try {
      await updateDoc(doc(db, "guidance", editingDocId), {
        title: editTitle.trim(),
        summary: editSummary.trim(),
        body: editBody,
        updatedAt: serverTimestamp(),
        updatedBy: userProfile.uid,
      });
      toast.success("Saved");
      cancelEditGuidance();
      refreshGuidance();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSavingGuidance(false);
    }
  };

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
      <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
        {(["users", "topics", "sessions", "resources", "guidance"] as const).map((t) => (
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
          {tabErrors.users && (
            <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
              Couldn&apos;t load users: {tabErrors.users}
            </div>
          )}
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
          {tabErrors.topics && (
            <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
              Couldn&apos;t load topics: {tabErrors.topics}
            </div>
          )}
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
                  <option value="everyday" className="bg-white dark:bg-slate-900">Everyday</option>
                  <option value="travel" className="bg-white dark:bg-slate-900">Travel</option>
                  <option value="work" className="bg-white dark:bg-slate-900">Work</option>
                  <option value="culture" className="bg-white dark:bg-slate-900">Culture</option>
                </select>
                <select
                  value={topicLevel}
                  onChange={(e) => setTopicLevel(e.target.value as LevelCode)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
                >
                  {Object.entries(LEVELS).map(([code, name]) => (
                    <option key={code} value={code} className="bg-white dark:bg-slate-900">{name}</option>
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
        <div>
          {tabErrors.sessions && (
            <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
              Couldn&apos;t load sessions: {tabErrors.sessions}
            </div>
          )}
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
        </div>
      )}

      {/* Resources Tab */}
      {tab === "resources" && (
        <div className="space-y-3">
          {tabErrors.resources && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
              Couldn&apos;t load resources: {tabErrors.resources}
            </div>
          )}
          <p className="text-sm text-slate-500 dark:text-slate-400">
            All files uploaded by speakers and admins. As admin, you can delete anything here.
            Upload new files from the{" "}
            <a href="/dashboard/speaker/resources" className="font-medium text-teal-700 dark:text-teal-300 hover:underline">
              Resources page
            </a>
            .
          </p>
          {resources.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 py-10 text-center text-slate-400 dark:text-slate-500">
              No resources uploaded yet
            </div>
          ) : (
            <div className="space-y-2">
              {resources.map((r) => (
                <div
                  key={r.resourceId}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{r.title}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.uploaderRole === "admin"
                          ? "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-200"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      }`}>
                        {r.uploaderRole}
                      </span>
                    </div>
                    {r.description && (
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{r.description}</p>
                    )}
                    <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                      {r.fileName} · by {r.uploaderName}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <a
                      href={r.fileURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
                    >
                      Download
                    </a>
                    <button
                      onClick={() => handleDeleteResource(r)}
                      className="text-xs font-medium text-red-600 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Guidance Tab */}
      {tab === "guidance" && (
        <div className="space-y-4">
          {tabErrors.guidance && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
              Couldn&apos;t load guidance: {tabErrors.guidance}
            </div>
          )}
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Edit the rules, FAQs, and advice shown to speakers and learners. Use blank lines
            to separate paragraphs, &ldquo;## &rdquo; for a subheading, and &ldquo;- &rdquo;
            for a bullet.
          </p>

          {guidanceDocs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 py-10 text-center text-slate-400 dark:text-slate-500">
              No guidance articles yet — run the Seed page to create the starter set.
            </div>
          ) : (
            <div className="space-y-2">
              {guidanceDocs.map((g) => {
                const isEditing = editingDocId === g.docId;
                return (
                  <div
                    key={g.docId}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            g.audience === "speaker"
                              ? "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-200"
                              : "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-200"
                          }`}>
                            {g.audience}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">/{g.slug}</span>
                        </div>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder="Title"
                          className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={editSummary}
                          onChange={(e) => setEditSummary(e.target.value)}
                          placeholder="Short summary"
                          className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
                        />
                        <textarea
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          rows={12}
                          className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono text-xs text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={saveGuidance}
                            disabled={savingGuidance}
                            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                          >
                            {savingGuidance ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={cancelEditGuidance}
                            className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              g.audience === "speaker"
                                ? "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-200"
                                : "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-200"
                            }`}>
                              {g.audience}
                            </span>
                            <p className="font-medium text-slate-900 dark:text-slate-100">{g.title}</p>
                          </div>
                          {g.summary && (
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{g.summary}</p>
                          )}
                        </div>
                        <button
                          onClick={() => startEditGuidance(g)}
                          className="shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
