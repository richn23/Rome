"use client";

import { useRef, useState } from "react";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "@/lib/firebase";
import Avatar from "@/components/Avatar";
import toast from "react-hot-toast";

/**
 * Avatar upload control.
 *
 * - Shows the current avatar (or a gradient initial fallback).
 * - Lets the user pick an image; uploads to `profile-photos/{uid}/{timestamp}-{name}`
 *   and calls `onChange` with the resulting download URL.
 * - `initial` is the single-character fallback shown when no photoURL is set.
 * - Storage rules require auth; if there's no signed-in user (dev bypass,
 *   misconfigured env) the upload will fail with a clear toast.
 */
export default function AvatarUpload({
  uid,
  photoURL,
  initial,
  onChange,
  disabled,
}: {
  uid: string;
  photoURL: string;
  initial: string;
  onChange: (newURL: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const pickFile = () => {
    if (disabled || uploading) return;
    inputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }

    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `profile-photos/${uid}/${Date.now()}-${safeName}`;
      const ref = storageRef(storage, path);
      await uploadBytes(ref, file, { contentType: file.type });
      const url = await getDownloadURL(ref);
      onChange(url);
      toast.success("Photo uploaded — hit Save to apply");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!photoURL) return;
    // Try to delete from Storage if the URL looks like one of ours.
    // If it's an external URL (e.g. Google profile photo) just clear the field.
    try {
      if (photoURL.includes("firebasestorage.googleapis.com")) {
        await deleteObject(storageRef(storage, photoURL));
      }
    } catch {
      // swallow — worst case is an orphaned file, not fatal
    }
    onChange("");
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={pickFile}
        disabled={disabled || uploading}
        aria-label="Change profile photo"
        className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full ring-2 ring-teal-100 transition hover:ring-teal-300 disabled:cursor-not-allowed disabled:opacity-60 dark:ring-teal-900/60"
      >
        <Avatar
          photoURL={photoURL}
          initial={initial}
          alt="avatar"
          className="h-full w-full rounded-full"
          textClassName="text-2xl"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-slate-900/60 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
          {uploading ? "Uploading…" : "Change"}
        </span>
      </button>

      <div className="flex-1">
        <p className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Profile photo
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={pickFile}
            disabled={disabled || uploading}
            className="rounded-lg border border-teal-500/40 bg-teal-500/10 px-3 py-1.5 text-sm font-medium text-teal-700 transition hover:bg-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:text-teal-300"
          >
            {uploading ? "Uploading…" : photoURL ? "Replace photo" : "Upload photo"}
          </button>
          {photoURL && !uploading && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Remove
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          JPG, PNG or GIF — up to 5 MB.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}
