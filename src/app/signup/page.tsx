"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole, LevelCode, LEVELS } from "@/types";
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

const inputClass =
  "block w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 transition focus:border-teal-400/60 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-teal-400/30";

const selectClass = `${inputClass} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 20 20%22><path stroke=%22%2394a3b8%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22 stroke-width=%221.5%22 d=%22M6 8l4 4 4-4%22/></svg>')] bg-[length:20px_20px] bg-[right_0.875rem_center] bg-no-repeat pr-10`;

const labelClass = "mb-1.5 block text-sm font-medium text-slate-200";

export default function SignupPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("learner");
  const [level, setLevel] = useState<LevelCode>("1a");
  const [nativeLanguage, setNativeLanguage] = useState("");
  const [learningLanguage, setLearningLanguage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const { signup, loginWithGoogle } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signup(
        email,
        password,
        displayName,
        role,
        role === "learner" ? level : undefined,
        { nativeLanguage, learningLanguage: role === "learner" ? learningLanguage : undefined }
      );
      router.push("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleSubmitting(true);
    try {
      await loginWithGoogle(role, role === "learner" ? level : undefined);
      router.push("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setGoogleSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-slate-950">
      {/* Ambient glow — matches landing */}
      <div className="pointer-events-none absolute -top-20 -left-20 h-[32rem] w-[32rem] rounded-full bg-teal-500/20 blur-3xl drift" />
      <div className="pointer-events-none absolute -right-20 top-40 h-[28rem] w-[28rem] rounded-full bg-cyan-400/15 blur-3xl drift-delay" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-[24rem] w-[24rem] rounded-full bg-sky-500/10 blur-3xl drift" />

      {/* Left — brand panel (hidden on mobile) */}
      <aside className="relative z-10 hidden flex-1 flex-col justify-between px-12 py-10 text-white lg:flex">
        <Link href="/" className="flex items-center gap-2 text-white/90 transition hover:text-white">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-teal-400 to-cyan-500 font-bold text-white shadow-lg shadow-teal-500/30">
            S
          </div>
          <span className="text-lg font-bold tracking-tight">SpeakSpace</span>
        </Link>

        <div className="max-w-md">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-teal-300">
            Join SpeakSpace
          </p>
          <h2 className="text-4xl font-bold leading-tight tracking-tight">
            Start your{" "}
            <span className="bg-gradient-to-r from-teal-300 via-cyan-300 to-sky-300 bg-clip-text italic text-transparent">
              conversation
            </span>
          </h2>
          <p className="mt-4 text-slate-300">
            Pair with native speakers, practice at your pace, and make the leap from study to real talk.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-slate-300">
            {[
              "Book live speakers on demand",
              "Real conversations, not scripts",
              "Pick your level, level up when ready",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-teal-400/20 text-teal-300">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-slate-500">© {new Date().getFullYear()} SpeakSpace</p>
      </aside>

      {/* Right — signup card */}
      <section className="relative z-10 flex flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:px-12">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <Link
            href="/"
            className="mb-8 flex items-center justify-center gap-2 text-white lg:hidden"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-teal-400 to-cyan-500 font-bold text-white shadow-lg shadow-teal-500/30">
              S
            </div>
            <span className="text-lg font-bold tracking-tight">SpeakSpace</span>
          </Link>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
            <div className="mb-7">
              <h1 className="text-2xl font-bold tracking-tight text-white">Create your account</h1>
              <p className="mt-1.5 text-sm text-slate-400">
                Free to start. No card required.
              </p>
            </div>

            {/* Role toggle — segmented */}
            <div className="mb-6">
              <p className={labelClass}>I want to...</p>
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/5 p-1">
                {([
                  { value: "learner", label: "Learn", hint: "Practice a language" },
                  { value: "speaker", label: "Speak", hint: "Host as a native" },
                ] as const).map((opt) => {
                  const active = role === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRole(opt.value)}
                      className={`rounded-lg px-3 py-2 text-left transition ${
                        active
                          ? "bg-gradient-to-r from-teal-400/90 to-cyan-400/90 text-slate-900 shadow-md shadow-teal-500/20"
                          : "text-slate-300 hover:bg-white/5"
                      }`}
                    >
                      <p className="text-sm font-semibold">{opt.label}</p>
                      <p className={`text-[11px] ${active ? "text-slate-800" : "text-slate-500"}`}>
                        {opt.hint}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="displayName" className={labelClass}>
                  Display name
                </label>
                <input
                  id="displayName"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={inputClass}
                  placeholder="Your name"
                />
              </div>

              <div>
                <label htmlFor="email" className={labelClass}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className={labelClass}>
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="At least 6 characters"
                />
              </div>

              {role === "learner" && (
                <>
                  <div>
                    <label htmlFor="level" className={labelClass}>
                      Your speaking level
                    </label>
                    <select
                      id="level"
                      value={level}
                      onChange={(e) => setLevel(e.target.value as LevelCode)}
                      className={selectClass}
                    >
                      {Object.entries(LEVELS).map(([code, name]) => (
                        <option key={code} value={code} className="bg-slate-900">
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="learningLanguage" className={labelClass}>
                      I want to learn
                    </label>
                    <select
                      id="learningLanguage"
                      value={learningLanguage}
                      onChange={(e) => setLearningLanguage(e.target.value)}
                      className={selectClass}
                    >
                      <option value="" className="bg-slate-900">
                        Select a language...
                      </option>
                      {LANGUAGES.map((l) => (
                        <option key={l} value={l} className="bg-slate-900">
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div>
                <label htmlFor="nativeLanguage" className={labelClass}>
                  {role === "speaker" ? "I speak (native)" : "My native language"}
                </label>
                <select
                  id="nativeLanguage"
                  value={nativeLanguage}
                  onChange={(e) => setNativeLanguage(e.target.value)}
                  className={selectClass}
                >
                  <option value="" className="bg-slate-900">
                    Select a language...
                  </option>
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l} className="bg-slate-900">
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="group mt-2 w-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 px-4 py-3 font-semibold text-slate-900 shadow-lg shadow-teal-500/30 transition hover:shadow-teal-400/60 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  "Creating account..."
                ) : (
                  <>
                    Create account
                    <span className="ml-1 inline-block transition-transform group-hover:translate-x-0.5">
                      →
                    </span>
                  </>
                )}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs uppercase tracking-wide text-slate-500">or</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleSubmitting}
              className="flex w-full items-center justify-center gap-3 rounded-full border border-white/15 bg-white/5 px-4 py-3 font-medium text-white backdrop-blur-sm transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18A10.98 10.98 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.83z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
              </svg>
              {googleSubmitting ? "Signing in..." : "Continue with Google"}
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-teal-300 transition hover:text-teal-200"
            >
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
