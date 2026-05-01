"use client";

import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import RouteGuard from "@/components/RouteGuard";
import {
  UserProfile,
  Topic,
  Session,
  Resource,
  GuidanceDoc,
  Policy,
} from "@/types";
import UsersTab from "./_tabs/UsersTab";
import TopicsTab from "./_tabs/TopicsTab";
import SessionsTab from "./_tabs/SessionsTab";
import ResourcesTab from "./_tabs/ResourcesTab";
import GuidanceTab from "./_tabs/GuidanceTab";
import PoliciesTab from "./_tabs/PoliciesTab";

type TabKey = "users" | "topics" | "sessions" | "resources" | "guidance" | "policies";

interface TabErrors {
  users?: string;
  topics?: string;
  sessions?: string;
  resources?: string;
  guidance?: string;
  policies?: string;
}

function AdminDashboardContent() {
  const [tab, setTab] = useState<TabKey>("users");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [guidanceDocs, setGuidanceDocs] = useState<GuidanceDoc[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [tabErrors, setTabErrors] = useState<TabErrors>({});

  const setError = (k: keyof TabErrors, msg: string | undefined) =>
    setTabErrors((prev) => ({ ...prev, [k]: msg }));

  const refreshResources = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, "resources"), orderBy("createdAt", "desc")));
      setResources(snap.docs.map((d) => ({ resourceId: d.id, ...d.data() }) as Resource));
      setError("resources", undefined);
    } catch (err) {
      setError("resources", err instanceof Error ? err.message : "Failed to load resources");
    }
  }, []);

  const refreshGuidance = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "guidance"));
      const arr = snap.docs.map((d) => ({ docId: d.id, ...d.data() }) as GuidanceDoc);
      arr.sort((a, b) => {
        if (a.audience !== b.audience) return a.audience < b.audience ? -1 : 1;
        return (a.order ?? 0) - (b.order ?? 0);
      });
      setGuidanceDocs(arr);
      setError("guidance", undefined);
    } catch (err) {
      setError("guidance", err instanceof Error ? err.message : "Failed to load guidance");
    }
  }, []);

  const refreshPolicies = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "policies"));
      setPolicies(snap.docs.map((d) => ({ policyId: d.id, ...d.data() }) as Policy));
      setError("policies", undefined);
    } catch (err) {
      setError("policies", err instanceof Error ? err.message : "Failed to load policies");
    }
  }, []);

  useEffect(() => {
    // Each collection fetched independently so one denial doesn't cascade.
    const fetchUsers = async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        setUsers(snap.docs.map((d) => d.data() as UserProfile));
      } catch (err) {
        setError("users", err instanceof Error ? err.message : "Failed to load users");
      }
    };
    const fetchTopics = async () => {
      try {
        const snap = await getDocs(collection(db, "topics"));
        setTopics(snap.docs.map((d) => ({ topicId: d.id, ...d.data() }) as Topic));
      } catch (err) {
        setError("topics", err instanceof Error ? err.message : "Failed to load topics");
      }
    };
    const fetchSessions = async () => {
      try {
        const snap = await getDocs(query(collection(db, "sessions"), orderBy("startedAt", "desc")));
        setSessions(snap.docs.map((d) => ({ sessionId: d.id, ...d.data() }) as Session));
      } catch (err) {
        setError("sessions", err instanceof Error ? err.message : "Failed to load sessions");
      }
    };
    const loadAll = async () => {
      await Promise.all([
        fetchUsers(),
        fetchTopics(),
        fetchSessions(),
        refreshResources(),
        refreshGuidance(),
        refreshPolicies(),
      ]);
    };
    loadAll();
  }, [refreshResources, refreshGuidance, refreshPolicies]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
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

      <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
        {(["users", "topics", "sessions", "resources", "guidance", "policies"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
              tab === t
                ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <UsersTab users={users} setUsers={setUsers} sessions={sessions} error={tabErrors.users} />
      )}
      {tab === "topics" && (
        <TopicsTab topics={topics} setTopics={setTopics} error={tabErrors.topics} />
      )}
      {tab === "sessions" && (
        <SessionsTab sessions={sessions} users={users} topics={topics} error={tabErrors.sessions} />
      )}
      {tab === "resources" && (
        <ResourcesTab resources={resources} refresh={refreshResources} error={tabErrors.resources} />
      )}
      {tab === "guidance" && (
        <GuidanceTab guidanceDocs={guidanceDocs} refresh={refreshGuidance} error={tabErrors.guidance} />
      )}
      {tab === "policies" && (
        <PoliciesTab policies={policies} refresh={refreshPolicies} error={tabErrors.policies} />
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
