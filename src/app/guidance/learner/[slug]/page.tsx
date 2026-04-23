"use client";

import { useState, useEffect, use } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import Link from "next/link";
import { db } from "@/lib/firebase";
import RouteGuard from "@/components/RouteGuard";
import { GuidanceDoc } from "@/types";
import { renderGuidanceBody } from "@/lib/renderGuidance";

function LearnerGuidanceDetailContent({ slug }: { slug: string }) {
  const [doc, setDoc] = useState<GuidanceDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const q = query(
        collection(db, "guidance"),
        where("audience", "==", "learner"),
        where("slug", "==", slug)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        setDoc({ docId: d.id, ...d.data() } as GuidanceDoc);
      }
      setLoading(false);
    };
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center text-slate-500 dark:text-slate-400">
        Loading...
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Not found
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          That guidance article doesn&apos;t exist (yet).
        </p>
        <Link
          href="/dashboard/learner/guidance"
          className="mt-4 inline-block text-sm font-medium text-teal-700 dark:text-teal-300"
        >
          ← Back to guidance
        </Link>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-6">
      <Link
        href="/dashboard/learner/guidance"
        className="text-sm font-medium text-teal-700 dark:text-teal-300 hover:text-teal-800"
      >
        ← Back to guidance
      </Link>

      <header className="mt-4 mb-6 border-b border-slate-200 dark:border-slate-800 pb-4">
        <p className="text-sm font-medium uppercase tracking-[0.15em] text-teal-600 dark:text-teal-400">
          Learner guidance
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">
          {doc.title}
        </h1>
        {doc.summary && (
          <p className="mt-2 text-base text-slate-500 dark:text-slate-400">
            {doc.summary}
          </p>
        )}
      </header>

      <div className="space-y-4">
        {renderGuidanceBody(doc.body)}
      </div>
    </article>
  );
}

export default function LearnerGuidanceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  return (
    <RouteGuard allowedRole={["learner", "admin"]}>
      <LearnerGuidanceDetailContent slug={slug} />
    </RouteGuard>
  );
}
