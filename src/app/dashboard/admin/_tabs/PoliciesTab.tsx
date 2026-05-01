"use client";

import { useMemo, useState } from "react";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { ref, deleteObject, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Policy } from "@/types";
import toast from "react-hot-toast";

interface Props {
  policies: Policy[];
  refresh: () => Promise<void>;
  error?: string;
}

export default function PoliciesTab({ policies, refresh, error }: Props) {
  const { userProfile } = useAuth();
  /* New policy form */
  const [showNew, setShowNew] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newVersion, setNewVersion] = useState("");
  const [newEffective, setNewEffective] = useState("");
  /* Per-card upload form */
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [versionNumber, setVersionNumber] = useState("");
  const [versionEffective, setVersionEffective] = useState("");
  /* Misc */
  const [expandedSlugs, setExpandedSlugs] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

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
      if (!m.has(p.slug)) m.set(p.slug, p.title);
    }
    return m;
  }, [policies]);

  const upload = async (
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
    setSaving(true);
    try {
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const fileURL = await getDownloadURL(storageRef);

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
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSaving(false);
    }
  };

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFile) {
      toast.error("Pick a PDF file");
      return;
    }
    const slug = newSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!slug) {
      toast.error("Enter a slug (e.g. terms, privacy)");
      return;
    }
    if (!newTitle.trim()) {
      toast.error("Enter a title");
      return;
    }
    if (slugTitleMap.has(slug)) {
      toast.error(`Slug "${slug}" already exists — use the upload-new-version button on its card`);
      return;
    }
    await upload(slug, newTitle.trim(), newFile, newVersion, newEffective);
    setShowNew(false);
    setNewSlug("");
    setNewTitle("");
    setNewFile(null);
    setNewVersion("");
    setNewEffective("");
  };

  const submitNewVersion = async (slug: string) => {
    if (!versionFile) {
      toast.error("Pick a PDF file");
      return;
    }
    const title = slugTitleMap.get(slug) ?? slug;
    await upload(slug, title, versionFile, versionNumber, versionEffective);
    setUploadFor(null);
    setVersionFile(null);
    setVersionNumber("");
    setVersionEffective("");
  };

  const deleteSlug = async (slug: string) => {
    const versions = policiesBySlug.get(slug) ?? [];
    if (
      !confirm(
        `Delete the entire "${slug}" policy and all ${versions.length} version(s)? This cannot be undone.`,
      )
    )
      return;
    setSaving(true);
    try {
      for (const v of versions) {
        try {
          if (v.storagePath) await deleteObject(ref(storage, v.storagePath));
        } catch {
          /* file may already be gone */
        }
        await deleteDoc(doc(db, "policies", v.policyId));
      }
      toast.success("Policy deleted");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setSaving(false);
    }
  };

  const toggleExpanded = (slug: string) => {
    setExpandedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
          Couldn&apos;t load policies: {error}
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Upload and version legal documents (terms, privacy, code of conduct, refunds).
          Visitors can read them at{" "}
          <a
            href="/policies"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-teal-700 dark:text-teal-300 hover:underline"
          >
            /policies
          </a>{" "}
          without signing in.
        </p>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="shrink-0 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
        >
          {showNew ? "Cancel" : "+ Add policy"}
        </button>
      </div>

      {showNew && (
        <form
          onSubmit={submitNew}
          className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
        >
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            New policy type
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Slug (e.g. terms)"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
            />
            <input
              type="text"
              placeholder="Title (e.g. Terms of Service)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Version (e.g. 1.0)"
              value={newVersion}
              onChange={(e) => setNewVersion(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
            />
            <input
              type="date"
              value={newEffective}
              onChange={(e) => setNewEffective(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
            />
          </div>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-700 dark:text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 dark:file:bg-slate-800 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 dark:file:text-slate-200"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? "Uploading..." : "Upload"}
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
            const isUploadingHere = uploadFor === slug;
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
                        setUploadFor(isUploadingHere ? null : slug);
                        setVersionFile(null);
                        setVersionNumber("");
                        setVersionEffective("");
                      }}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {isUploadingHere ? "Cancel" : "Upload new version"}
                    </button>
                    <button
                      onClick={() => deleteSlug(slug)}
                      disabled={saving}
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
                      disabled={saving}
                      className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                    >
                      {saving ? "Uploading..." : "Upload"}
                    </button>
                  </div>
                )}

                {previous.length > 0 && (
                  <div className="mt-3">
                    <button
                      onClick={() => toggleExpanded(slug)}
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
  );
}
