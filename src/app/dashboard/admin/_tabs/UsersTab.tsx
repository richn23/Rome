"use client";

import { useState, Dispatch, SetStateAction } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { UserProfile, UserRole, Session, LEVELS, LevelCode } from "@/types";
import toast from "react-hot-toast";

interface CreatedUserResult {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  level: string | null;
  resetLink: string | null;
}

type UserFilter = "all" | "learner" | "speaker" | "admin" | "suspended";

interface UserActivity {
  bookings: number;
  sessions: number;
  lastActivity: Timestamp | null;
  totalSpent: number;
  totalEarned: number;
}

interface Props {
  users: UserProfile[];
  setUsers: Dispatch<SetStateAction<UserProfile[]>>;
  sessions: Session[];
  error?: string;
}

export default function UsersTab({ users, setUsers, sessions, error }: Props) {
  const { userProfile } = useAuth();
  const [filter, setFilter] = useState<UserFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [activity, setActivity] = useState<UserActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  /* Add user form */
  const [showAdd, setShowAdd] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addDisplayName, setAddDisplayName] = useState("");
  const [addRole, setAddRole] = useState<UserRole>("learner");
  const [addLevel, setAddLevel] = useState<LevelCode | "">("");
  const [creating, setCreating] = useState(false);
  const [createdUser, setCreatedUser] = useState<CreatedUserResult | null>(null);

  const filtered = users.filter((u) => {
    if (filter === "suspended" && !u.suspended) return false;
    if (filter !== "all" && filter !== "suspended" && u.role !== filter) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const counts = {
    all: users.length,
    learner: users.filter((u) => u.role === "learner").length,
    speaker: users.filter((u) => u.role === "speaker").length,
    admin: users.filter((u) => u.role === "admin").length,
    suspended: users.filter((u) => u.suspended).length,
  };

  const selected = selectedUserId ? users.find((u) => u.uid === selectedUserId) ?? null : null;

  const loadActivity = async (u: UserProfile) => {
    setActivityLoading(true);
    setActivity(null);
    try {
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
      const [bLearner, bSpeaker] = await Promise.all([
        getDocs(query(collection(db, "bookings"), where("learnerId", "==", u.uid))),
        getDocs(query(collection(db, "bookings"), where("speakerId", "==", u.uid))),
      ]);
      setActivity({
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

  const openPanel = (u: UserProfile) => {
    setSelectedUserId(u.uid);
    loadActivity(u);
  };

  const closePanel = () => {
    setSelectedUserId(null);
    setActivity(null);
  };

  const changeRole = async (u: UserProfile, newRole: UserRole) => {
    if (newRole === u.role) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", u.uid), { role: newRole });
      setUsers((prev) => prev.map((x) => (x.uid === u.uid ? { ...x, role: newRole } : x)));
      toast.success(`Role set to ${newRole}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change role");
    } finally {
      setSaving(false);
    }
  };

  const toggleSuspend = async (u: UserProfile) => {
    if (u.uid === userProfile?.uid) {
      toast.error("You can't suspend your own account");
      return;
    }
    const next = !u.suspended;
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", u.uid), { suspended: next });
      setUsers((prev) => prev.map((x) => (x.uid === u.uid ? { ...x, suspended: next } : x)));
      toast.success(next ? "User suspended" : "User unsuspended");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    } finally {
      setSaving(false);
    }
  };

  const formatTimestamp = (ts: Timestamp | null | undefined) => {
    if (!ts) return "—";
    return ts.toDate().toLocaleString();
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addEmail.trim() || !addDisplayName.trim()) {
      toast.error("Email and name are required");
      return;
    }
    if (!auth?.currentUser) {
      toast.error("Not signed in");
      return;
    }
    setCreating(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          email: addEmail.trim(),
          displayName: addDisplayName.trim(),
          role: addRole,
          level: addRole === "learner" && addLevel ? addLevel : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? `Failed (HTTP ${res.status})`);
        return;
      }
      const created = json as CreatedUserResult;
      // Optimistically add to local list so admin sees them right away.
      const newUser: UserProfile = {
        uid: created.uid,
        email: created.email,
        displayName: created.displayName,
        role: created.role,
        photoURL: "",
        level: (created.level ?? undefined) as LevelCode | undefined,
        createdAt: Timestamp.now(),
      };
      setUsers((prev) => [...prev, newUser]);
      setCreatedUser(created);
      toast.success("User created");
      setAddEmail("");
      setAddDisplayName("");
      setAddRole("learner");
      setAddLevel("");
      setShowAdd(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create user");
    } finally {
      setCreating(false);
    }
  };

  const copyResetLink = async () => {
    if (!createdUser?.resetLink) return;
    try {
      await navigator.clipboard.writeText(createdUser.resetLink);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy — select and copy manually");
    }
  };

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
          Couldn&apos;t load users: {error}
        </div>
      )}

      {/* Add user button + form */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {users.length} user{users.length === 1 ? "" : "s"} total
        </p>
        <button
          onClick={() => {
            setShowAdd((v) => !v);
            setCreatedUser(null);
          }}
          className="shrink-0 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
        >
          {showAdd ? "Cancel" : "+ Add user"}
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={submitAdd}
          className="mb-4 space-y-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
        >
          <div className="grid grid-cols-2 gap-3">
            <input
              type="email"
              required
              placeholder="Email"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
            />
            <input
              type="text"
              required
              placeholder="Display name"
              value={addDisplayName}
              onChange={(e) => setAddDisplayName(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={addRole}
              onChange={(e) => setAddRole(e.target.value as UserRole)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
            >
              <option value="learner">Learner</option>
              <option value="speaker">Speaker</option>
              <option value="admin">Admin</option>
            </select>
            {addRole === "learner" && (
              <select
                value={addLevel}
                onChange={(e) => setAddLevel(e.target.value as LevelCode | "")}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
              >
                <option value="">Level (optional)</option>
                {Object.entries(LEVELS).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            We&apos;ll create the account with a random temporary password and return a one-time
            password-reset link you can send the user.
          </p>
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create user"}
          </button>
        </form>
      )}

      {createdUser && (
        <div className="mb-4 rounded-xl border border-teal-200 dark:border-teal-900/60 bg-teal-50 dark:bg-teal-900/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-teal-900 dark:text-teal-200">
                Created {createdUser.displayName} ({createdUser.email})
              </p>
              {createdUser.resetLink ? (
                <>
                  <p className="mt-1 text-xs text-teal-800 dark:text-teal-300">
                    Send this one-time link so they can set their own password:
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      readOnly
                      value={createdUser.resetLink}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      className="flex-1 truncate rounded-lg border border-teal-300 dark:border-teal-800 bg-white dark:bg-slate-900 px-3 py-1.5 font-mono text-xs text-slate-700 dark:text-slate-200"
                    />
                    <button
                      onClick={copyResetLink}
                      className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
                    >
                      Copy
                    </button>
                  </div>
                </>
              ) : (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  No reset link generated — admin can send a password reset from the Firebase
                  console.
                </p>
              )}
            </div>
            <button
              onClick={() => setCreatedUser(null)}
              className="rounded-lg p-1.5 text-teal-600 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/40"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        {(
          [
            ["all", "All"],
            ["learner", "Learners"],
            ["speaker", "Speakers"],
            ["admin", "Admins"],
            ["suspended", "Suspended"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === key
                ? "bg-teal-600 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {label}
            <span
              className={`ml-1.5 ${
                filter === key ? "text-teal-100" : "text-slate-400 dark:text-slate-500"
              }`}
            >
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder="Search users..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
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
            {filtered.map((u) => (
              <tr
                key={u.uid}
                onClick={() => openPanel(u)}
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
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400 capitalize">
                  {u.status ?? "—"}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                  No users match
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <>
          <div
            onClick={closePanel}
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
          />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col overflow-y-auto bg-white dark:bg-slate-900 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {selected.displayName}
                  </h3>
                  {selected.suspended && (
                    <span className="rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-700 dark:text-red-300">
                      Suspended
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
                  {selected.email}
                </p>
              </div>
              <button
                onClick={closePanel}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <section className="border-b border-slate-200 dark:border-slate-800 p-5">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Activity
              </h4>
              {activityLoading ? (
                <p className="text-sm text-slate-400 dark:text-slate-500">Loading...</p>
              ) : activity ? (
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-500 dark:text-slate-400">Bookings</dt>
                    <dd className="font-medium text-slate-900 dark:text-slate-100">{activity.bookings}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500 dark:text-slate-400">Sessions</dt>
                    <dd className="font-medium text-slate-900 dark:text-slate-100">{activity.sessions}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500 dark:text-slate-400">Last activity</dt>
                    <dd className="font-medium text-slate-900 dark:text-slate-100">
                      {formatTimestamp(activity.lastActivity ?? selected.createdAt)}
                    </dd>
                  </div>
                  {selected.role === "learner" && (
                    <div className="flex justify-between">
                      <dt className="text-slate-500 dark:text-slate-400">Total spent</dt>
                      <dd className="font-medium text-slate-900 dark:text-slate-100">
                        ${activity.totalSpent.toFixed(2)}
                      </dd>
                    </div>
                  )}
                  {selected.role === "speaker" && (
                    <>
                      <div className="flex justify-between">
                        <dt className="text-slate-500 dark:text-slate-400">Total earned</dt>
                        <dd className="font-medium text-slate-900 dark:text-slate-100">
                          ${activity.totalEarned.toFixed(2)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500 dark:text-slate-400">Average rating</dt>
                        <dd className="font-medium text-slate-900 dark:text-slate-100">
                          {selected.rating ? selected.rating.toFixed(2) : "—"}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500">No activity loaded</p>
              )}
            </section>

            <section className="space-y-4 p-5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Actions
              </h4>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Role
                </label>
                <select
                  value={selected.role}
                  disabled={saving}
                  onChange={(e) => changeRole(selected, e.target.value as UserRole)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="learner">Learner</option>
                  <option value="speaker">Speaker</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <button
                onClick={() => toggleSuspend(selected)}
                disabled={saving || selected.uid === userProfile?.uid}
                className={`w-full rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                  selected.suspended
                    ? "bg-teal-600 text-white hover:bg-teal-700"
                    : "border border-red-300 dark:border-red-900/60 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                }`}
              >
                {selected.suspended ? "Unsuspend account" : "Suspend account"}
              </button>

              {selected.role === "speaker" && (
                <a
                  href={`/speakers/${selected.uid}`}
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
  );
}
