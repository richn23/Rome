"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Session, Topic, UserProfile } from "@/types";

interface Props {
  sessions: Session[];
  users: UserProfile[];
  topics: Topic[];
  error?: string;
}

export default function SessionsTab({ sessions, users, topics, error }: Props) {
  const router = useRouter();
  const [view, setView] = useState<"live" | "history">("live");
  const [search, setSearch] = useState("");
  const [sortDesc, setSortDesc] = useState(true);
  const [nowTick, setNowTick] = useState(Date.now());

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
    const q = search.toLowerCase().trim();
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
      return sortDesc ? bT - aT : aT - bT;
    });
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, search, sortDesc, userById]);

  const stats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
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

  /* Tick once a minute while on live view so durations move */
  useEffect(() => {
    if (view !== "live") return;
    const id = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [view]);

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

  const exportCsv = () => {
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

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
          Couldn&apos;t load sessions: {error}
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Today</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.today}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Last 7 days</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.week}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">This month</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.month}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Revenue (month)</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            ${stats.monthRevenue.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="mb-3 flex gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
        {(["live", "history"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
              view === v
                ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            {v === "live" ? `Live now (${liveSessions.length})` : "History"}
          </button>
        ))}
      </div>

      {view === "live" ? (
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
            />
            <button
              onClick={exportCsv}
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
                    onClick={() => setSortDesc((v) => !v)}
                  >
                    Date {sortDesc ? "↓" : "↑"}
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
                      {search ? "No sessions match" : "No completed sessions yet"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
