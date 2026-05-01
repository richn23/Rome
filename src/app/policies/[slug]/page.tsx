"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Policy } from "@/types";

function PolicyDetailContent({ slug }: { slug: string }) {
  const [versions, setVersions] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "policies"), where("slug", "==", slug)),
        );
        const arr = snap.docs.map((d) => ({ policyId: d.id, ...d.data() }) as Policy);
        arr.sort((a, b) => b.uploadedAt.toMillis() - a.uploadedAt.toMillis());
        setVersions(arr);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load policy");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  const current = versions.find((v) => v.isCurrent);
  const previous = versions.filter((v) => !v.isCurrent);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/policies"
          className="text-sm text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-300"
        >
          ← All policies
        </Link>

        {loading && (
          <p className="mt-6 text-sm text-slate-400 dark:text-slate-500">Loading...</p>
        )}
        {error && (
          <div className="mt-6 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
        {!loading && !error && versions.length === 0 && (
          <p className="mt-6 text-sm text-slate-400 dark:text-slate-500">
            No policy found at this URL.
          </p>
        )}

        {current && (
          <>
            <h1 className="mt-4 text-3xl font-bold text-slate-900 dark:text-slate-100">
              {current.title}
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Current version: v{current.version} · effective{" "}
              {current.effectiveDate.toDate().toLocaleDateString()}
            </p>
            <a
              href={current.fileURL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-block rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
            >
              Download {current.fileName}
            </a>
          </>
        )}

        {previous.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Previous versions
            </h2>
            <ul className="mt-3 space-y-2">
              {previous.map((v) => (
                <li
                  key={v.policyId}
                  className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-200">
                      v{v.version}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      effective {v.effectiveDate.toDate().toLocaleDateString()}
                    </p>
                  </div>
                  <a
                    href={v.fileURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-600 dark:text-teal-300 hover:underline"
                  >
                    Download
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

export default function PolicyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  return <PolicyDetailContent slug={slug} />;
}
