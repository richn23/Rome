"use client";

import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { db } from "@/lib/firebase";
import RouteGuard from "@/components/RouteGuard";
import { GuidanceDoc } from "@/types";

function SpeakerGuidanceContent() {
  const [docs, setDocs] = useState<GuidanceDoc[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, "guidance"),
      where("audience", "==", "speaker")
    );
    const unsub = onSnapshot(q, (snap) => {
      const arr: GuidanceDoc[] = [];
      snap.forEach((d) => arr.push({ docId: d.id, ...d.data() } as GuidanceDoc));
      arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setDocs(arr);
    });
    return unsub;
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.15em] text-teal-600 dark:text-teal-400">
            Guidance
          </p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Speaker guidance
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Rules, advice, and FAQs to help you run great sessions.
          </p>
        </div>
        <Link
          href="/dashboard/speaker"
          className="text-sm font-medium text-teal-700 dark:text-teal-300 hover:text-teal-800"
        >
          Back to dashboard
        </Link>
      </div>

      {docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 py-12 px-6 text-center">
          <h3 className="mb-1 font-semibold text-slate-700 dark:text-slate-200">
            No guidance articles yet
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            An admin needs to seed the guidance content.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {docs.map((d) => (
            <Link
              key={d.docId}
              href={`/guidance/speaker/${d.slug}`}
              className="group block rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-teal-700 dark:group-hover:text-teal-300">
                {d.title}
              </h3>
              {d.summary && (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {d.summary}
                </p>
              )}
              <p className="mt-3 text-xs font-medium text-teal-700 dark:text-teal-300">
                Read →
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SpeakerGuidancePage() {
  return (
    <RouteGuard allowedRole={["speaker", "admin"]}>
      <SpeakerGuidanceContent />
    </RouteGuard>
  );
}
