"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SlotDuration, UserProfile } from "@/types";
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

/**
 * Modal for a learner to post an open session request ("I want a session at
 * this time, any speaker"). On submit, writes a doc to `requests` with
 * status="open" and denormalized learner fields so the speaker board can
 * render without extra fetches.
 */
export default function PostRequestDialog({
  open,
  onClose,
  learner,
}: {
  open: boolean;
  onClose: () => void;
  learner: UserProfile;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("18:00");
  const [durationMinutes, setDurationMinutes] = useState<SlotDuration>(30);
  const [language, setLanguage] = useState(learner.learningLanguage ?? "");
  const [topic, setTopic] = useState("");
  const [budgetMax, setBudgetMax] = useState<number>(0); // 0 = no cap
  const [submitting, setSubmitting] = useState(false);

  // Reset when re-opened
  useEffect(() => {
    if (open) {
      setDate("");
      setTime("18:00");
      setDurationMinutes(30);
      setLanguage(learner.learningLanguage ?? "");
      setTopic("");
      setBudgetMax(0);
    }
  }, [open, learner.learningLanguage]);

  // Close on escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !time) {
      toast.error("Pick a date and time");
      return;
    }
    if (!language) {
      toast.error("Pick a language to practise");
      return;
    }
    const [h, m] = time.split(":").map(Number);
    const when = new Date(date + "T00:00:00");
    when.setHours(h, m, 0, 0);
    if (when <= new Date()) {
      toast.error("Pick a future date/time");
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, "requests"), {
        learnerId: learner.uid,
        learnerName: learner.displayName,
        learnerPhotoURL: learner.photoURL ?? "",
        ...(learner.level ? { learnerLevel: learner.level } : {}),
        requestedFor: Timestamp.fromDate(when),
        durationMinutes,
        language,
        ...(topic.trim() ? { topic: topic.trim() } : {}),
        ...(budgetMax > 0 ? { budgetMax } : {}),
        status: "open",
        createdAt: serverTimestamp(),
      });
      toast.success("Request posted — speakers can claim it now");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not post");
    } finally {
      setSubmitting(false);
    }
  };

  // Min date = today (so date picker can't select past dates)
  const todayISO = new Date().toISOString().split("T")[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-600 dark:text-teal-400">
              Post a request
            </p>
            <h2 className="mt-1 font-display text-2xl font-[500] text-slate-900 dark:text-slate-100">
              Find a speaker
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Any speaker can claim this — you&apos;ll be notified when they do.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date + time */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Date
              </label>
              <input
                type="date"
                min={todayISO}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Time
              </label>
              <input
                type="time"
                step={1800}
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Duration + language */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Length
              </label>
              <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/60">
                {([30, 45] as SlotDuration[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDurationMinutes(d)}
                    className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      durationMinutes === d
                        ? "bg-white text-teal-700 shadow-sm dark:bg-slate-900 dark:text-teal-300"
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="" className="bg-white dark:bg-slate-900">Select...</option>
                {LANGUAGES.map((l) => (
                  <option key={l} value={l} className="bg-white dark:bg-slate-900">
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Topic */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Topic (optional)
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. ordering food, job interview practice"
              maxLength={120}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-600"
            />
          </div>

          {/* Budget */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Max $/hr (optional)
            </label>
            <select
              value={budgetMax}
              onChange={(e) => setBudgetMax(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value={0} className="bg-white dark:bg-slate-900">No cap</option>
              <option value={15} className="bg-white dark:bg-slate-900">Up to $15/hr</option>
              <option value={20} className="bg-white dark:bg-slate-900">Up to $20/hr</option>
              <option value={30} className="bg-white dark:bg-slate-900">Up to $30/hr</option>
              <option value={50} className="bg-white dark:bg-slate-900">Up to $50/hr</option>
            </select>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Speakers above your cap won&apos;t be suggested first.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 px-5 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-teal-500/30 transition hover:shadow-teal-400/60 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Posting…" : "Post request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
