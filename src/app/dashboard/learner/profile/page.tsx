"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import RouteGuard from "@/components/RouteGuard";
import { LEVELS, LevelCode, UserProfile } from "@/types";
import toast from "react-hot-toast";

const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Japanese",
  "Chinese (Mandarin)",
  "Korean",
  "Arabic",
  "Russian",
  "Dutch",
  "Swedish",
  "Turkish",
  "Other",
];

function ProfileContent() {
  const { userProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [nativeLanguage, setNativeLanguage] = useState("");
  const [learningLanguage, setLearningLanguage] = useState("");
  const [level, setLevel] = useState<LevelCode>("1a");
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  /* Load latest profile */
  useEffect(() => {
    if (!userProfile) return;
    const load = async () => {
      const snap = await getDoc(doc(db, "users", userProfile.uid));
      if (snap.exists()) {
        const p = snap.data() as UserProfile;
        setDisplayName(p.displayName ?? "");
        setBio(p.bio ?? "");
        setPhotoURL(p.photoURL ?? "");
        setNativeLanguage(p.nativeLanguage ?? "");
        setLearningLanguage(p.learningLanguage ?? "");
        setLevel((p.level as LevelCode) ?? "1a");
      }
      setLoadingProfile(false);
    };
    load();
  }, [userProfile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    if (!displayName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", userProfile.uid), {
        displayName: displayName.trim(),
        bio: bio.trim(),
        photoURL: photoURL.trim(),
        nativeLanguage: nativeLanguage || "",
        learningLanguage: learningLanguage || "",
        level,
      });
      toast.success("Profile saved");
    } catch (err: any) {
      toast.error(err.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  if (loadingProfile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="animate-pulse text-teal-600 dark:text-teal-400">Loading your profile...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.15em] text-teal-600 dark:text-teal-400">Profile</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Your details</h1>
        </div>
        <Link href="/dashboard/learner" className="text-sm font-medium text-teal-700 dark:text-teal-300 hover:text-teal-800">
          Back to dashboard
        </Link>
      </div>

      <form onSubmit={handleSave} className="space-y-6 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-6">
        {/* Avatar preview */}
        <div className="flex items-center gap-4">
          {photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoURL}
              alt="avatar"
              className="h-20 w-20 rounded-full object-cover ring-2 ring-teal-100"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 text-2xl font-bold text-white shadow-sm">
              {displayName.charAt(0).toUpperCase() || "?"}
            </div>
          )}
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
              Photo URL
            </label>
            <input
              type="url"
              value={photoURL}
              onChange={(e) => setPhotoURL(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Paste a link to an image (upload comes later).</p>
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
            Display name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
          />
        </div>

        {/* Languages */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
              Native language
            </label>
            <select
              value={nativeLanguage}
              onChange={(e) => setNativeLanguage(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
            >
              <option value="">Select...</option>
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
              Learning
            </label>
            <select
              value={learningLanguage}
              onChange={(e) => setLearningLanguage(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
            >
              <option value="">Select...</option>
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Level */}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
            Current level
          </label>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as LevelCode)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
          >
            {(Object.entries(LEVELS) as [LevelCode, string][]).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Pick what feels right — after a few sessions, speakers&apos; feedback will suggest if you&apos;re ready to move.
          </p>
        </div>

        {/* Bio */}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
            About you
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Tell speakers a little about why you're learning and what you like to talk about..."
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
          />
          <p className="mt-1 text-right text-xs text-slate-400 dark:text-slate-500">{bio.length}/500</p>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
          <Link
            href="/dashboard/learner"
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function LearnerProfilePage() {
  return (
    <RouteGuard allowedRole="learner">
      <ProfileContent />
    </RouteGuard>
  );
}
