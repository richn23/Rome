"use client";

import { useMemo, useState } from "react";
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, deleteObject, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Resource } from "@/types";
import toast from "react-hot-toast";

interface Props {
  resources: Resource[];
  refresh: () => Promise<void>;
  error?: string;
}

export default function ResourcesTab({ resources, refresh, error }: Props) {
  const { userProfile } = useAuth();
  const [filter, setFilter] = useState<"all" | "visible" | "hidden">("all");
  const [uploaderFilter, setUploaderFilter] = useState<string>("all");
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    return resources.filter((r) => {
      if (filter === "visible" && r.hidden) return false;
      if (filter === "hidden" && !r.hidden) return false;
      if (uploaderFilter !== "all" && r.uploaderUid !== uploaderFilter) return false;
      return true;
    });
  }, [resources, filter, uploaderFilter]);

  const uploaders = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of resources) {
      if (!map.has(r.uploaderUid)) map.set(r.uploaderUid, r.uploaderName);
    }
    return Array.from(map.entries());
  }, [resources]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !userProfile) return;
    if (!title.trim()) {
      toast.error("Give the resource a title");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File is too big — max 20 MB");
      return;
    }
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `resources/${userProfile.uid}/${Date.now()}_${safeName}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const fileURL = await getDownloadURL(storageRef);
      await addDoc(collection(db, "resources"), {
        title: title.trim(),
        description: description.trim() || null,
        uploaderUid: userProfile.uid,
        uploaderName: userProfile.displayName ?? "Admin",
        uploaderRole: "admin",
        fileURL,
        storagePath,
        fileName: file.name,
        fileSizeBytes: file.size,
        contentType: file.type || "application/octet-stream",
        tags: [],
        hidden: false,
        createdAt: serverTimestamp(),
      });
      toast.success("Uploaded");
      setShowUpload(false);
      setFile(null);
      setTitle("");
      setDescription("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const startEdit = (r: Resource) => {
    setEditingId(r.resourceId);
    setEditTitle(r.title);
    setEditDescription(r.description ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditDescription("");
  };

  const saveEdit = async (resourceId: string) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "resources", resourceId), {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
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

  const toggleHidden = async (r: Resource) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "resources", r.resourceId), { hidden: !r.hidden });
      toast.success(r.hidden ? "Resource unhidden" : "Resource hidden");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r: Resource) => {
    if (!confirm(`Delete "${r.title}"?`)) return;
    try {
      if (r.storagePath) {
        try {
          await deleteObject(ref(storage, r.storagePath));
        } catch {
          /* file may already be gone */
        }
      }
      await deleteDoc(doc(db, "resources", r.resourceId));
      toast.success("Deleted");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
          Couldn&apos;t load resources: {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          All files uploaded by speakers and admins. Hidden resources stay on file but are
          excluded from the speaker library.
        </p>
        <button
          onClick={() => setShowUpload((v) => !v)}
          className="shrink-0 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
        >
          {showUpload ? "Cancel" : "+ Upload"}
        </button>
      </div>

      {showUpload && (
        <form
          onSubmit={handleUpload}
          className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
        >
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
          />
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
          />
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-700 dark:text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 dark:file:bg-slate-800 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 dark:file:text-slate-200"
          />
          <button
            type="submit"
            disabled={uploading}
            className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(["all", "visible", "hidden"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
              filter === k
                ? "bg-teal-600 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {k}
          </button>
        ))}
        <select
          value={uploaderFilter}
          onChange={(e) => setUploaderFilter(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1 text-xs text-slate-700 dark:text-slate-200 focus:border-teal-500 focus:outline-none"
        >
          <option value="all">All uploaders</option>
          {uploaders.map(([uid, name]) => (
            <option key={uid} value={uid}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 py-10 text-center text-slate-400 dark:text-slate-500">
          {resources.length === 0 ? "No resources uploaded yet" : "No resources match"}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const isEditing = editingId === r.resourceId;
            return (
              <div
                key={r.resourceId}
                className={`rounded-xl border p-4 ${
                  r.hidden
                    ? "border-amber-200 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-900/10"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                }`}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Title"
                      className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
                    />
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Description"
                      rows={2}
                      className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(r.resourceId)}
                        disabled={saving}
                        className="rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900 dark:text-slate-100">{r.title}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.uploaderRole === "admin"
                              ? "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-200"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {r.uploaderRole}
                        </span>
                        {r.hidden && (
                          <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-300">
                            Hidden
                          </span>
                        )}
                      </div>
                      {r.description && (
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{r.description}</p>
                      )}
                      <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                        {r.fileName} · by {r.uploaderName}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <a
                        href={r.fileURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
                      >
                        Download
                      </a>
                      <div className="flex gap-2 text-xs">
                        <button
                          onClick={() => startEdit(r)}
                          className="font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleHidden(r)}
                          disabled={saving}
                          className="font-medium text-amber-600 hover:text-amber-700 disabled:opacity-50"
                        >
                          {r.hidden ? "Unhide" : "Hide"}
                        </button>
                        <button
                          onClick={() => handleDelete(r)}
                          className="font-medium text-red-600 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
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
