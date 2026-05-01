"use client";

import { useState, useEffect, useMemo } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import Link from "next/link";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import RouteGuard from "@/components/RouteGuard";
import { Resource } from "@/types";
import toast from "react-hot-toast";

const MAX_FILE_SIZE_MB = 20;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function ResourcesContent() {
  const { user, userProfile } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  /* Upload form */
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);

  const isAdmin = userProfile?.role === "admin";

  /* Subscribe to all resources */
  useEffect(() => {
    const q = query(collection(db, "resources"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const arr: Resource[] = [];
      snap.forEach((d) => arr.push({ resourceId: d.id, ...d.data() } as Resource));
      setResources(arr);
    });
    return unsub;
  }, []);

  /* Group by uploader role so admin-uploaded show on top.
     Admin-hidden resources are filtered out of the speaker library. */
  const { adminUploads, speakerUploads } = useMemo(() => {
    const visible = resources.filter((r) => !r.hidden);
    return {
      adminUploads: visible.filter((r) => r.uploaderRole === "admin"),
      speakerUploads: visible.filter((r) => r.uploaderRole === "speaker"),
    };
  }, [resources]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !user || !userProfile) return;
    if (!title.trim()) {
      toast.error("Give your resource a title");
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`File is too big — max ${MAX_FILE_SIZE_MB}MB`);
      return;
    }

    setUploading(true);
    try {
      // Upload to Firebase Storage under a per-user folder so rules are easy.
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `resources/${user.uid}/${Date.now()}_${safeName}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const fileURL = await getDownloadURL(storageRef);

      await addDoc(collection(db, "resources"), {
        title: title.trim(),
        description: description.trim() || null,
        uploaderUid: user.uid,
        uploaderName: userProfile.displayName ?? "Unknown",
        uploaderRole: userProfile.role === "admin" ? "admin" : "speaker",
        fileURL,
        storagePath,
        fileName: file.name,
        fileSizeBytes: file.size,
        contentType: file.type || "application/octet-stream",
        tags: [],
        createdAt: serverTimestamp(),
      });

      toast.success("Uploaded!");
      setFile(null);
      setTitle("");
      setDescription("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (r: Resource) => {
    if (!user) return;
    const canDelete = isAdmin || r.uploaderUid === user.uid;
    if (!canDelete) return;
    if (!confirm(`Delete "${r.title}"? This can't be undone.`)) return;
    try {
      if (r.storagePath) {
        try {
          await deleteObject(ref(storage, r.storagePath));
        } catch {
          // File already gone; continue to remove the doc anyway
        }
      }
      await deleteDoc(doc(db, "resources", r.resourceId));
      toast.success("Deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    }
  };

  const renderCard = (r: Resource) => {
    const canDelete = isAdmin || r.uploaderUid === user?.uid;
    return (
      <div
        key={r.resourceId}
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                {r.title}
              </h3>
              {r.uploaderRole === "admin" && (
                <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-700 dark:bg-teal-900/40 dark:text-teal-200">
                  Official
                </span>
              )}
            </div>
            {r.description && (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {r.description}
              </p>
            )}
            <p className="mt-2 truncate text-xs text-slate-500 dark:text-slate-400">
              {r.fileName} · {formatBytes(r.fileSizeBytes)} · uploaded by {r.uploaderName}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <a
              href={r.fileURL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:shadow-md"
            >
              Download
            </a>
            {canDelete && (
              <button
                onClick={() => handleDelete(r)}
                className="text-xs font-medium text-red-600 hover:text-red-700"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.15em] text-teal-600 dark:text-teal-400">
            Resources
          </p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Speaker resource folder
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Share handouts, prompts, slides, and anything that helps other speakers run great sessions.
          </p>
        </div>
        <Link
          href="/dashboard/speaker"
          className="text-sm font-medium text-teal-700 dark:text-teal-300 hover:text-teal-800"
        >
          Back to dashboard
        </Link>
      </div>

      {/* Upload form */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <h2 className="mb-1 text-lg font-bold text-slate-900 dark:text-slate-100">
          Upload a resource
        </h2>
        <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
          PDFs, Word docs, images, slides — anything up to {MAX_FILE_SIZE_MB}MB.
        </p>
        <form onSubmit={handleUpload} className="space-y-3">
          <input
            type="text"
            placeholder="Title (e.g. Travel vocabulary handout)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
          />
          <textarea
            placeholder="Short description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
          />
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
            className="block w-full text-sm text-slate-700 dark:text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-teal-700"
          />
          <button
            type="submit"
            disabled={uploading}
            className="rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </form>
      </section>

      {/* Official admin resources */}
      {adminUploads.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-slate-900 dark:text-slate-100">
            Official resources
          </h2>
          <div className="space-y-3">
            {adminUploads.map(renderCard)}
          </div>
        </section>
      )}

      {/* Speaker-uploaded resources */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-900 dark:text-slate-100">
          Shared by speakers
        </h2>
        {speakerUploads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Nothing shared yet — be the first to upload something useful.
          </div>
        ) : (
          <div className="space-y-3">
            {speakerUploads.map(renderCard)}
          </div>
        )}
      </section>
    </div>
  );
}

export default function SpeakerResourcesPage() {
  return (
    <RouteGuard allowedRole={["speaker", "admin"]}>
      <ResourcesContent />
    </RouteGuard>
  );
}
