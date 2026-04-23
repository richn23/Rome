"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import RouteGuard from "@/components/RouteGuard";
import AvatarUpload from "@/components/AvatarUpload";
import { UserProfile } from "@/types";
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

function SpeakerProfileContent() {
  const { userProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [nativeLanguage, setNativeLanguage] = useState("");
  const [hourlyRate, setHourlyRate] = useState(15);
  const [awayMode, setAwayMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

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
        setHourlyRate(p.hourlyRate ?? 15);
        setAwayMode(p.awayMode ?? false);
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
    if (hourlyRate < 1 || hourlyRate > 500) {
      toast.error("Hourly rate must be between $1 and $500");
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", userProfile.uid), {
        displayName: displayName.trim(),
        bio: bio.trim(),
        photoURL: photoURL.trim(),
        nativeLanguage: nativeLanguage || "",
        hourlyRate,
        awayMode,
      });
      toast.success("Profile saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
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
          <p className="text-sm font-medium uppercase tracking-[0.15em] text-teal-600 dark:text-teal-400">Speaker profile</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Your details</h1>
        </div>
        <Link href="/dashboard/speaker" className="text-sm font-medium text-teal-700 dark:text-teal-300 hover:text-teal-800">
          Back to dashboard
        </Link>
      </div>

      {awayMode && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>You&apos;re in Away mode.</strong> Learners can&apos;t see or book you until you turn this off.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        {/* Avatar upload */}
        <AvatarUpload
          uid={userProfile?.uid ?? ""}
          photoURL={photoURL}
          initial={displayName.charAt(0).toUpperCase() || "?"}
          onChange={setPhotoURL}
        />

        {/* Name */}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Display name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
          />
        </div>

        {/* Native language + rate */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              I speak (native)
            </label>
            <select
              value={nativeLanguage}
              onChange={(e) => setNativeLanguage(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
            >
              <option value="" className="bg-white dark:bg-slate-900">Select...</option>
              {LANGUAGES.map((l) => (
                <option key={l} value={l} className="bg-white dark:bg-slate-900">{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Hourly rate ($)
            </label>
            <input
              type="number"
              min={1}
              max={500}
              step={1}
              value={hourlyRate}
              onChange={(e) => setHourlyRate(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Platform takes a small cut on each session.</p>
          </div>
        </div>

        {/* Bio */}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            About you
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={5}
            maxLength={700}
            placeholder="Introduce yourself to learners. What do you enjoy talking about? What level of learner are you best with?"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
          />
          <p className="mt-1 text-right text-xs text-slate-400 dark:text-slate-500">{bio.length}/700</p>
        </div>

        {/* Away mode */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4">
          <label className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">Away mode</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Hide yourself from learners. Existing bookings stay, but no new ones can be made.
              </p>
            </div>
            <input
              type="checkbox"
              checked={awayMode}
              onChange={(e) => setAwayMode(e.target.checked)}
              className="h-5 w-5 rounded border-slate-300 dark:border-slate-700"
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
          <Link
            href="/dashboard/speaker"
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

export default function SpeakerProfilePage() {
  return (
    <RouteGuard allowedRole="speaker">
      <SpeakerProfileContent />
    </RouteGuard>
  );
}
