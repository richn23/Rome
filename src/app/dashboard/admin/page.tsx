"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
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
  where,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { ref, deleteObject, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import RouteGuard from "@/components/RouteGuard";
import { UserProfile, UserRole, Topic, Session, Resource, GuidanceDoc, Policy, LEVELS, LevelCode, TopicCategory } from "@/types";
import toast from "react-hot-toast";

type UserFilter = "all" | "learner" | "speaker" | "admin" | "suspended";

interface UserActivity {
  bookings: number;
  sessions: number;
  lastActivity: Timestamp | null;
  totalSpent: number;
  totalEarned: number;
}

function AdminDashboardContent() {
  const [tab, setTab] = useState<"users" | "topics" | "sessions" | "resources" | "guidance" | "policies">("users");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [guidanceDocs, setGuidanceDocs] = useState<GuidanceDoc[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showTopicForm, setShowTopicForm] = useState(false);
  /* Per-tab fetch errors — one failure shouldn't blank the others */
  const [tabErrors, setTabErrors] = useState<{
    users?: string;
    topics?: string;
    sessions?: string;
    resources?: string;
    guidance?: string;
    policies?: string;
  }>({});
  /* Sessions tab state */
  const [sessionView, setSessionView] = useState<"live" | "history">("live");
  const [sessionSearch, setSessionSearch] = useState("");
  const [sessionSortDesc, setSessionSortDesc] = useState(true);
  const [nowTick, setNowTick] = useState(Date.now());
  const router = useRouter();
  /* Users tab state */
  const [userFilter, setUserFilter] = useState<UserFilter>("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userActivity, setUserActivity] = useState<UserActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [savingUserAction, setSavingUserAction] = useState(false);
  /* Policies tab state */
  const [showNewPolicyForm, setShowNewPolicyForm] = useState(false);
  const [newPolicySlug, setNewPolicySlug] = useState("");
  const [newPolicyTitle, setNewPolicyTitle] = useState("");
  const [newPolicyFile, setNewPolicyFile] = useState<File | null>(null);
  const [newPolicyVersion, setNewPolicyVersion] = useState("");
  const [newPolicyEffective, setNewPolicyEffective] = useState("");
  const [versionUploadFor, setVersionUploadFor] = useState<string | null>(null);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [versionNumber, setVersionNumber] = useState("");
  const [versionEffective, setVersionEffective] = useState("");
  const [expandedSlugs, setExpandedSlugs] = useState<Set<string>>(new Set());
  const [savingPolicy, setSavingPolicy] = useState(false);
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

  const refreshPolicies = async () => {
    try {
      const snap = await getDocs(collection(db, "policies"));
      setPolicies(snap.docs.map((d) => ({ policyId: d.id, ...d.data() }) as Policy));
      setTabErrors((prev) => ({ ...prev, policies: undefined }));
    } catch (err) {
      setTabErrors((prev) => ({
        ...prev,
        policies: err instanceof Error ? err.message : "Failed to load policies",
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
    refreshPolicies();
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

  const filteredUsers = users.filter((u) => {
    if (userFilter === "suspended" && !u.suspended) return false;
    if (userFilter !== "all" && userFilter !== "suspended" && u.role !== userFilter) return false;
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const userCounts = {
    all: users.length,
    learner: users.filter((u) => u.role === "learner").length,
    speaker: users.filter((u) => u.role === "speaker").length,
    admin: users.filter((u) => u.role === "admin").length,
    suspended: users.filter((u) => u.suspended).length,
  };

  const selectedUser = selectedUserId ? users.find((u) => u.uid === selectedUserId) ?? null : null;

  const loadUserActivity = async (u: UserProfile) => {
    setActivityLoading(true);
    setUserActivity(null);
    try {
      // Sessions: filter from already-loaded admin list (rules permit admin reads)
      const userSessions = sessions.filter(
        (s) => s.speakerId === u.uid || (s.learnerIds && s.learnerIds.includes(u.uid)),
      );
      let lastActivity: Timestamp | null = null;
      let totalSpent = 0;
      let totalEarned = 0;
      for (const s of userSessions) {
        const ts = s.startedAt ?? s.scheduledAt ?? null;
        if (ts && (!lastActivity || ts.toMillis() > lastActivity.toMillis())) {
          lastActivity = ts;
        }
        if (s.learnerIds?.includes(u.uid) && s.amountCharged) {
          totalSpent += s.amountCharged;
        }
        if (s.speakerId === u.uid && s.speakerPayout) {
          totalEarned += s.speakerPayout;
        }
      }
      // Bookings: two queries (learner-side + speaker-side) since OR-on-different-fields needs that
      const [bLearner, bSpeaker] = await Promise.all([
        getDocs(query(collection(db, "bookings"), where("learnerId", "==", u.uid))),
        getDocs(query(collection(db, "bookings"), where("speakerId", "==", u.uid))),
      ]);
      setUserActivity({
        bookings: bLearner.size + bSpeaker.size,
        sessions: userSessions.length,
        lastActivity,
        totalSpent,
        totalEarned,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load activity");
    } finally {
      setActivityLoading(false);
    }
  };

  const openUserPanel = (u: UserProfile) => {
    setSelectedUserId(u.uid);
    loadUserActivity(u);
  };

  const closeUserPanel = () => {
    setSelectedUserId(null);
    setUserActivity(null);
  };

  const handleChangeRole = async (u: UserProfile, newRole: UserRole) => {
    if (newRole === u.role) return;
    setSavingUserAction(true);
    try {
      await updateDoc(doc(db, "users", u.uid), { role: newRole });
      setUsers((prev) => prev.map((x) => (x.uid === u.uid ? { ...x, role: newRole } : x)));
      toast.success(`Role set to ${newRole}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change role");
    } finally {
      setSavingUserAction(false);
    }
  };

  const handleToggleSuspend = async (u: UserProfile) => {
    if (u.uid === userProfile?.uid) {
      toast.error("You can't suspend your own account");
      return;
    }
    const next = !u.suspended;
    setSavingUserAction(true);
    try {
      await updateDoc(doc(db, "users", u.uid), { suspended: next });
      setUsers((prev) => prev.map((x) => (x.uid === u.uid ? { ...x, suspended: next } : x)));
      toast.success(next ? "User suspended" : "User unsuspended");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    } finally {
      setSavingUserAction(false);
    }
  };

  const formatTimestamp = (ts: Timestamp | null | undefined) => {
    if (!ts) return "—";
    return ts.toDate().toLocaleString();
  };

  /* Sessions tab — tick once a minute while live view is open so durations move */
  useEffect(() => {
    if (tab !== "sessions" || sessionView !== "live") return;
    const id = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [tab, sessionView]);

  const userById = useMemo(() => {
    const m = new Map<string, UserProfile>();
    users.forEach((u) => m.set(u.uid, u));
    return m;
  }, [users]);

  const topicById = useMemo(() => {
    const m = new Map<string, Topic>();
    topics.forEach((t) => m.set(t.topicId, t));
    return m;
  }, [topics]);

  const userName = (uid: string) => userById.get(uid)?.displayName ?? uid.slice(0, 8);

  const liveSessions = useMemo(
    () => sessions.filter((s) => s.status === "active"),
    [sessions],
  );

  const historySessions = useMemo(() => {
    const ended = sessions.filter((s) => s.status === "ended");
    const q = sessionSearch.toLowerCase().trim();
    const filtered = q
      ? ended.filter((s) => {
          const speakerName = userName(s.speakerId).toLowerCase();
          const learnerNames = (s.learnerIds ?? []).map((id) => userName(id).toLowerCase());
          return speakerName.includes(q) || learnerNames.some((n) => n.includes(q));
        })
      : ended;
    const sorted = [...filtered].sort((a, b) => {
      const aT = (a.endedAt ?? a.startedAt)?.toMillis() ?? 0;
      const bT = (b.endedAt ?? b.startedAt)?.toMillis() ?? 0;
      return sessionSortDesc ? bT - aT : aT - bT;
    });
    return sorted;
    // userById is referenced via userName, so include it in deps via ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, sessionSearch, sessionSortDesc, userById]);

  const sessionStats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    // Treat week as the trailing 7 days for simplicity
    const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    let today = 0;
    let week = 0;
    let month = 0;
    let monthRevenue = 0;
    for (const s of sessions) {
      const ts = (s.startedAt ?? s.scheduledAt)?.toMillis();
      if (!ts) continue;
      if (ts >= startOfToday) today++;
      if (ts >= startOfWeek) week++;
      if (ts >= startOfMonth) {
        month++;
        if (s.amountCharged) monthRevenue += s.amountCharged;
      }
    }
    return { today, week, month, monthRevenue };
  }, [sessions]);

  const liveDuration = (s: Session) => {
    const started = s.startedAt?.toMillis();
    if (!started) return "—";
    const mins = Math.max(0, Math.floor((nowTick - started) / 60_000));
    return `${mins} min`;
  };

  const escapeCsv = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  /* Policies — upload, version, delete */

  const policiesBySlug = useMemo(() => {
    const m = new Map<string, Policy[]>();
    for (const p of policies) {
      const arr = m.get(p.slug) ?? [];
      arr.push(p);
      m.set(p.slug, arr);
    }
    m.forEach((arr) => arr.sort((a, b) => b.uploadedAt.toMillis() - a.uploadedAt.toMillis()));
    return m;
  }, [policies]);

  const slugTitleMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of policies) {
      // Most recent upload's title wins per slug
      if (!m.has(p.slug)) m.set(p.slug, p.title);
    }
    return m;
  }, [policies]);

  const uploadPolicyVersion = async (
    slug: string,
    title: string,
    file: File,
    version: string,
    effectiveDateStr: string,
  ) => {
    if (!userProfile) return;
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are allowed");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File is too big — max 20 MB");
      return;
    }
    if (!version.trim()) {
      toast.error("Enter a version number");
      return;
    }
    if (!effectiveDateStr) {
      toast.error("Pick an effective date");
      return;
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `policies/${slug}/${Date.now()}_${safeName}`;
    setSavingPolicy(true);
    try {
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const fileURL = await getDownloadURL(storageRef);

      // Flip existing docs of this slug to non-current, then add the new one.
      const existing = policies.filter((p) => p.slug === slug && p.isCurrent);
      const batch = writeBatch(db);
      for (const p of existing) {
        batch.update(doc(db, "policies", p.policyId), { isCurrent: false });
      }
      await batch.commit();

      await addDoc(collection(db, "policies"), {
        slug,
        title,
        fileURL,
        storagePath,
        fileName: file.name,
        version: version.trim(),
        effectiveDate: Timestamp.fromDate(new Date(effectiveDateStr)),
        uploadedBy: userProfile.uid,
        uploadedAt: serverTimestamp(),
        isCurrent: true,
      });

      toast.success(`Uploaded v${version.trim()}`);
      await refreshPolicies();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSavingPolicy(false);
    }
  };

  const submitNewPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPolicyFile) {
      toast.error("Pick a PDF file");
      return;
    }
    const slug = newPolicySlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!slug) {
      toast.error("Enter a slug (e.g. terms, privacy)");
      return;
    }
    if (!newPolicyTitle.trim()) {
      toast.error("Enter a title");
      return;
    }
    if (slugTitleMap.has(slug)) {
      toast.error(`Slug "${slug}" already exists — use the upload-new-version button on its card`);
      return;
    }
    await uploadPolicyVersion(
      slug,
      newPolicyTitle.trim(),
      newPolicyFile,
      newPolicyVersion,
      newPolicyEffective,
    );
    setShowNewPolicyForm(false);
    setNewPolicySlug("");
    setNewPolicyTitle("");
    setNewPolicyFile(null);
    setNewPolicyVersion("");
    setNewPolicyEffective("");
  };

  const submitNewVersion = async (slug: string) => {
    if (!versionFile) {
      toast.error("Pick a PDF file");
      return;
    }
    const title = slugTitleMap.get(slug) ?? slug;
    await uploadPolicyVersion(slug, title, versionFile, versionNumber, versionEffective);
    setVersionUploadFor(null);
    setVersionFile(null);
    setVersionNumber("");
    setVersionEffective("");
  };

  const deletePolicySlug = async (slug: string) => {
    const versions = policiesBySlug.get(slug) ?? [];
    if (
      !confirm(
        `Delete the entire "${slug}" policy and all ${versions.length} version(s)? This cannot be undone.`,
      )
    )
      return;
    setSavingPolicy(true);
    try {
      for (const v of versions) {
        try {
          if (v.storagePath) await deleteObject(ref(storage, v.storagePath));
        } catch {
          /* file may already be gone; carry on */
        }
        await deleteDoc(doc(db, "policies", v.policyId));
      }
      toast.success("Policy deleted");
      await refreshPolicies();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setSavingPolicy(false);
    }
  };

  const toggleSlugExpanded = (slug: string) => {
    setExpandedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const exportHistoryCsv = () => {
    const header = [
      "Session ID",
      "Speaker",
      "Learners",
      "Topic",
      "Started",
      "Ended",
      "Duration (min)",
      "Amount",
      "Platform cut",
      "Speaker payout",
    ];
    const rows = historySessions.map((s) => [
      s.sessionId,
      userName(s.speakerId),
      (s.learnerIds ?? []).map(userName).join(" / "),
      s.topicId ? topicById.get(s.topicId)?.title ?? "" : "",
      s.startedAt ? s.startedAt.toDate().toISOString() : "",
      s.endedAt ? s.endedAt.toDate().toISOString() : "",
      s.durationMinutes ?? "",
      s.amountCharged?.toFixed(2) ?? "",
      s.platformCut?.toFixed(2) ?? "",
      s.speakerPayout?.toFixed(2) ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.map(escapeCsv).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `speakspace-sessions-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
        {(["users", "topics", "sessions", "resources", "guidance", "policies"] as const).map((t) => (
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
          {/* Filter pills */}
          <div className="mb-3 flex flex-wrap gap-2">
            {([
              ["all", "All"],
              ["learner", "Learners"],
              ["speaker", "Speakers"],
              ["admin", "Admins"],
              ["suspended", "Suspended"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setUserFilter(key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  userFilter === key
                    ? "bg-teal-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {label}
                <span className={`ml-1.5 ${userFilter === key ? "text-teal-100" : "text-slate-400 dark:text-slate-500"}`}>
                  {userCounts[key]}
                </span>
              </button>
            ))}
          </div>
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
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.map((u) => (
                  <tr
                    key={u.uid}
                    onClick={() => openUserPanel(u)}
                    className={`cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                      selectedUserId === u.uid ? "bg-teal-50 dark:bg-teal-900/20" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      <div className="flex items-center gap-2">
                        {u.displayName}
                        {u.suspended && (
                          <span className="rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-700 dark:text-red-300">
                            Suspended
                          </span>
                        )}
                      </div>
                    </td>
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
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                      No users match
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* User detail side panel */}
          {selectedUser && (
            <>
              <div
                onClick={closeUserPanel}
                className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
              />
              <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col overflow-y-auto bg-white dark:bg-slate-900 shadow-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 p-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {selectedUser.displayName}
                      </h3>
                      {selectedUser.suspended && (
                        <span className="rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-700 dark:text-red-300">
                          Suspended
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">{selectedUser.email}</p>
                  </div>
                  <button
                    onClick={closeUserPanel}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                {/* Activity */}
                <section className="border-b border-slate-200 dark:border-slate-800 p-5">
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Activity
                  </h4>
                  {activityLoading ? (
                    <p className="text-sm text-slate-400 dark:text-slate-500">Loading...</p>
                  ) : userActivity ? (
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-slate-500 dark:text-slate-400">Bookings</dt>
                        <dd className="font-medium text-slate-900 dark:text-slate-100">{userActivity.bookings}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500 dark:text-slate-400">Sessions</dt>
                        <dd className="font-medium text-slate-900 dark:text-slate-100">{userActivity.sessions}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500 dark:text-slate-400">Last activity</dt>
                        <dd className="font-medium text-slate-900 dark:text-slate-100">
                          {formatTimestamp(userActivity.lastActivity ?? selectedUser.createdAt)}
                        </dd>
                      </div>
                      {selectedUser.role === "learner" && (
                        <div className="flex justify-between">
                          <dt className="text-slate-500 dark:text-slate-400">Total spent</dt>
                          <dd className="font-medium text-slate-900 dark:text-slate-100">
                            ${userActivity.totalSpent.toFixed(2)}
                          </dd>
                        </div>
                      )}
                      {selectedUser.role === "speaker" && (
                        <>
                          <div className="flex justify-between">
                            <dt className="text-slate-500 dark:text-slate-400">Total earned</dt>
                            <dd className="font-medium text-slate-900 dark:text-slate-100">
                              ${userActivity.totalEarned.toFixed(2)}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-slate-500 dark:text-slate-400">Average rating</dt>
                            <dd className="font-medium text-slate-900 dark:text-slate-100">
                              {selectedUser.rating ? selectedUser.rating.toFixed(2) : "—"}
                            </dd>
                          </div>
                        </>
                      )}
                    </dl>
                  ) : (
                    <p className="text-sm text-slate-400 dark:text-slate-500">No activity loaded</p>
                  )}
                </section>

                {/* Actions */}
                <section className="space-y-4 p-5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Actions
                  </h4>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                      Role
                    </label>
                    <select
                      value={selectedUser.role}
                      disabled={savingUserAction}
                      onChange={(e) => handleChangeRole(selectedUser, e.target.value as UserRole)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none disabled:opacity-50"
                    >
                      <option value="learner">Learner</option>
                      <option value="speaker">Speaker</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <button
                    onClick={() => handleToggleSuspend(selectedUser)}
                    disabled={savingUserAction || selectedUser.uid === userProfile?.uid}
                    className={`w-full rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                      selectedUser.suspended
                        ? "bg-teal-600 text-white hover:bg-teal-700"
                        : "border border-red-300 dark:border-red-900/60 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                    }`}
                  >
                    {selectedUser.suspended ? "Unsuspend account" : "Suspend account"}
                  </button>

                  {selectedUser.role === "speaker" && (
                    <a
                      href={`/speakers/${selectedUser.uid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-center text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      View public speaker page ↗
                    </a>
                  )}
                </section>
              </aside>
            </>
          )}
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

          {/* Stats strip */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Today</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{sessionStats.today}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Last 7 days</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{sessionStats.week}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">This month</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{sessionStats.month}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Revenue (month)</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                ${sessionStats.monthRevenue.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="mb-3 flex gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            {(["live", "history"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setSessionView(v)}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
                  sessionView === v
                    ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                {v === "live" ? `Live now (${liveSessions.length})` : "History"}
              </button>
            ))}
          </div>

          {sessionView === "live" ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950">
                  <tr>
                    <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Speaker</th>
                    <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Learner(s)</th>
                    <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Topic</th>
                    <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Started</th>
                    <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {liveSessions.map((s) => (
                    <tr
                      key={s.sessionId}
                      onClick={() => router.push(`/sessions/${s.sessionId}`)}
                      className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                        {userName(s.speakerId)}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {(s.learnerIds ?? []).map(userName).join(", ")}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {s.topicId ? topicById.get(s.topicId)?.title ?? "—" : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {s.startedAt ? s.startedAt.toDate().toLocaleTimeString() : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                          {liveDuration(s)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {liveSessions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
                        No live sessions right now
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Search by speaker or learner name..."
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
                />
                <button
                  onClick={exportHistoryCsv}
                  disabled={historySessions.length === 0}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  Export CSV
                </button>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950">
                    <tr>
                      <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Speaker</th>
                      <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Learner(s)</th>
                      <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Topic</th>
                      <th
                        className="cursor-pointer select-none px-4 py-3 font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
                        onClick={() => setSessionSortDesc((v) => !v)}
                      >
                        Date {sessionSortDesc ? "↓" : "↑"}
                      </th>
                      <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Duration</th>
                      <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {historySessions.map((s) => (
                      <tr
                        key={s.sessionId}
                        onClick={() => router.push(`/sessions/${s.sessionId}`)}
                        className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      >
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                          {userName(s.speakerId)}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                          {(s.learnerIds ?? []).map(userName).join(", ")}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                          {s.topicId ? topicById.get(s.topicId)?.title ?? "—" : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                          {(s.endedAt ?? s.startedAt)?.toDate().toLocaleDateString() ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{s.durationMinutes ?? "—"} min</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                          ${s.amountCharged?.toFixed(2) ?? "0.00"}
                        </td>
                      </tr>
                    ))}
                    {historySessions.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
                          {sessionSearch ? "No sessions match" : "No completed sessions yet"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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

      {/* Policies Tab */}
      {tab === "policies" && (
        <div className="space-y-4">
          {tabErrors.policies && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
              Couldn&apos;t load policies: {tabErrors.policies}
            </div>
          )}
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Upload and version legal documents (terms, privacy, code of conduct, refunds).
              Visitors can read them at{" "}
              <a href="/policies" target="_blank" rel="noopener noreferrer" className="font-medium text-teal-700 dark:text-teal-300 hover:underline">
                /policies
              </a>{" "}
              without signing in.
            </p>
            <button
              onClick={() => setShowNewPolicyForm((v) => !v)}
              className="shrink-0 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            >
              {showNewPolicyForm ? "Cancel" : "+ Add policy"}
            </button>
          </div>

          {showNewPolicyForm && (
            <form
              onSubmit={submitNewPolicy}
              className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
            >
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                New policy type
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Slug (e.g. terms)"
                  value={newPolicySlug}
                  onChange={(e) => setNewPolicySlug(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Title (e.g. Terms of Service)"
                  value={newPolicyTitle}
                  onChange={(e) => setNewPolicyTitle(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Version (e.g. 1.0)"
                  value={newPolicyVersion}
                  onChange={(e) => setNewPolicyVersion(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
                />
                <input
                  type="date"
                  value={newPolicyEffective}
                  onChange={(e) => setNewPolicyEffective(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
                />
              </div>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setNewPolicyFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-slate-700 dark:text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 dark:file:bg-slate-800 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 dark:file:text-slate-200"
              />
              <button
                type="submit"
                disabled={savingPolicy}
                className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {savingPolicy ? "Uploading..." : "Upload"}
              </button>
            </form>
          )}

          {policiesBySlug.size === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 py-10 text-center text-slate-400 dark:text-slate-500">
              No policies uploaded yet
            </div>
          ) : (
            <div className="space-y-3">
              {Array.from(policiesBySlug.entries()).map(([slug, versions]) => {
                const current = versions.find((v) => v.isCurrent);
                const previous = versions.filter((v) => !v.isCurrent);
                const expanded = expandedSlugs.has(slug);
                const isUploadingHere = versionUploadFor === slug;
                return (
                  <div
                    key={slug}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                            {current?.title ?? slugTitleMap.get(slug)}
                          </h4>
                          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">
                            /{slug}
                          </span>
                        </div>
                        {current ? (
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Current: v{current.version} · effective{" "}
                            {current.effectiveDate.toDate().toLocaleDateString()} ·{" "}
                            <a
                              href={current.fileURL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-teal-600 dark:text-teal-300 hover:underline"
                            >
                              download
                            </a>
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                            No current version — upload one
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => {
                            setVersionUploadFor(isUploadingHere ? null : slug);
                            setVersionFile(null);
                            setVersionNumber("");
                            setVersionEffective("");
                          }}
                          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          {isUploadingHere ? "Cancel" : "Upload new version"}
                        </button>
                        <button
                          onClick={() => deletePolicySlug(slug)}
                          disabled={savingPolicy}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {isUploadingHere && (
                      <div className="mt-4 space-y-3 rounded-lg bg-slate-50 dark:bg-slate-950 p-4">
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            placeholder="Version (e.g. 2.0)"
                            value={versionNumber}
                            onChange={(e) => setVersionNumber(e.target.value)}
                            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
                          />
                          <input
                            type="date"
                            value={versionEffective}
                            onChange={(e) => setVersionEffective(e.target.value)}
                            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
                          />
                        </div>
                        <input
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => setVersionFile(e.target.files?.[0] ?? null)}
                          className="block w-full text-sm text-slate-700 dark:text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 dark:file:bg-slate-800 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 dark:file:text-slate-200"
                        />
                        <button
                          onClick={() => submitNewVersion(slug)}
                          disabled={savingPolicy}
                          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                        >
                          {savingPolicy ? "Uploading..." : "Upload"}
                        </button>
                      </div>
                    )}

                    {previous.length > 0 && (
                      <div className="mt-3">
                        <button
                          onClick={() => toggleSlugExpanded(slug)}
                          className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        >
                          {expanded ? "▾" : "▸"} Version history ({previous.length})
                        </button>
                        {expanded && (
                          <ul className="mt-2 space-y-1 border-l border-slate-200 dark:border-slate-800 pl-3">
                            {previous.map((v) => (
                              <li
                                key={v.policyId}
                                className="flex items-center justify-between text-xs"
                              >
                                <span className="text-slate-600 dark:text-slate-300">
                                  v{v.version} · effective{" "}
                                  {v.effectiveDate.toDate().toLocaleDateString()}
                                </span>
                                <a
                                  href={v.fileURL}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-teal-600 dark:text-teal-300 hover:underline"
                                >
                                  download
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
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
