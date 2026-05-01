"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Policy } from "@/types";

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "policies"), where("isCurrent", "==", true)),
        );
        const arr = snap.docs.map((d) => ({ policyId: d.id, ...d.data() }) as Policy);
        arr.sort((a, b) => a.title.localeCompare(b.title));
        setPolicies(arr);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load policies");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-sm text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-300"
        >
          ← Back
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-slate-900 dark:text-slate-100">
          Policies & legal
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          The current versions of SpeakSpace&apos;s policies. Download to read offline.
        </p>

        <div className="mt-8 space-y-3">
          {loading && (
            <p className="text-sm text-slate-400 dark:text-slate-500">Loading...</p>
          )}
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
          {!loading && !error && policies.length === 0 && (
            <p className="text-sm text-slate-400 dark:text-slate-500">
              No policies have been published yet.
            </p>
          )}
          {policies.map((p) => (
            <Link
              key={p.policyId}
              href={`/policies/${p.slug}`}
              className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 transition hover:border-teal-400 dark:hover:border-teal-500"
            >
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">{p.title}</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  v{p.version} · effective {p.effectiveDate.toDate().toLocaleDateString()}
                </p>
              </div>
              <span className="text-sm text-teal-600 dark:text-teal-300">View →</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
