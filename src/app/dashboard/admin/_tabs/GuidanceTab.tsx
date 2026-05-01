"use client";

import { useState } from "react";
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { GuidanceDoc } from "@/types";
import toast from "react-hot-toast";

interface Props {
  guidanceDocs: GuidanceDoc[];
  refresh: () => Promise<void>;
  error?: string;
}

export default function GuidanceTab({ guidanceDocs, refresh, error }: Props) {
  const { userProfile } = useAuth();
  /* Edit state */
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  /* New article form */
  const [showNew, setShowNew] = useState(false);
  const [newAudience, setNewAudience] = useState<"speaker" | "learner">("speaker");
  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newSummary, setNewSummary] = useState("");
  const [newBody, setNewBody] = useState("");

  const startEdit = (g: GuidanceDoc) => {
    setEditingDocId(g.docId);
    setEditTitle(g.title);
    setEditSummary(g.summary ?? "");
    setEditBody(g.body ?? "");
  };

  const cancelEdit = () => {
    setEditingDocId(null);
    setEditTitle("");
    setEditSummary("");
    setEditBody("");
  };

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    const slug = newSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!slug) {
      toast.error("Enter a slug");
      return;
    }
    if (!newTitle.trim()) {
      toast.error("Enter a title");
      return;
    }
    const sameAudience = guidanceDocs.filter((g) => g.audience === newAudience);
    const nextOrder = sameAudience.reduce((m, g) => Math.max(m, g.order ?? 0), 0) + 10;
    setSaving(true);
    try {
      await addDoc(collection(db, "guidance"), {
        audience: newAudience,
        slug,
        title: newTitle.trim(),
        summary: newSummary.trim(),
        body: newBody,
        order: nextOrder,
        updatedAt: serverTimestamp(),
        updatedBy: userProfile.uid,
      });
      toast.success("Article created");
      setShowNew(false);
      setNewSlug("");
      setNewTitle("");
      setNewSummary("");
      setNewBody("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create");
    } finally {
      setSaving(false);
    }
  };

  const move = async (g: GuidanceDoc, direction: "up" | "down") => {
    const peers = guidanceDocs
      .filter((x) => x.audience === g.audience)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const idx = peers.findIndex((x) => x.docId === g.docId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= peers.length) return;
    const other = peers[swapIdx];
    setSaving(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "guidance", g.docId), { order: other.order ?? 0 });
      batch.update(doc(db, "guidance", other.docId), { order: g.order ?? 0 });
      await batch.commit();
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reorder");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (g: GuidanceDoc) => {
    if (!confirm(`Delete "${g.title}"? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, "guidance", g.docId));
      toast.success("Deleted");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!editingDocId || !userProfile) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "guidance", editingDocId), {
        title: editTitle.trim(),
        summary: editSummary.trim(),
        body: editBody,
        updatedAt: serverTimestamp(),
        updatedBy: userProfile.uid,
      });
      toast.success("Saved");
      cancelEdit();
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
          Couldn&apos;t load guidance: {error}
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Edit the rules, FAQs, and advice shown to speakers and learners. Use blank lines
          to separate paragraphs, &ldquo;## &rdquo; for a subheading, and &ldquo;- &rdquo;
          for a bullet.
        </p>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="shrink-0 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
        >
          {showNew ? "Cancel" : "+ New article"}
        </button>
      </div>

      {showNew && (
        <form
          onSubmit={submitNew}
          className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
        >
          <div className="grid grid-cols-2 gap-3">
            <select
              value={newAudience}
              onChange={(e) => setNewAudience(e.target.value as "speaker" | "learner")}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
            >
              <option value="speaker">Speaker</option>
              <option value="learner">Learner</option>
            </select>
            <input
              type="text"
              placeholder="slug-like-this"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
            />
          </div>
          <input
            type="text"
            placeholder="Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
          />
          <input
            type="text"
            placeholder="Short summary"
            value={newSummary}
            onChange={(e) => setNewSummary(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
          />
          <textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder="Body (markdown-ish)"
            rows={8}
            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono text-xs text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create"}
          </button>
        </form>
      )}

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
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          g.audience === "speaker"
                            ? "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-200"
                            : "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-200"
                        }`}
                      >
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
                        onClick={save}
                        disabled={saving}
                        className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={cancelEdit}
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
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            g.audience === "speaker"
                              ? "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-200"
                              : "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-200"
                          }`}
                        >
                          {g.audience}
                        </span>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{g.title}</p>
                      </div>
                      {g.summary && (
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{g.summary}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => move(g, "up")}
                        disabled={saving}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 disabled:opacity-30"
                        aria-label="Move up"
                        title="Move up"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => move(g, "down")}
                        disabled={saving}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 disabled:opacity-30"
                        aria-label="Move down"
                        title="Move down"
                      >
                        ▼
                      </button>
                      <a
                        href={`/guidance/${g.audience}/${g.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Preview ↗
                      </a>
                      <button
                        onClick={() => startEdit(g)}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(g)}
                        disabled={saving}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
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
