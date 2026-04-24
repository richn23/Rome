"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import toast from "react-hot-toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const { login, loginWithGoogle } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleSubmitting(true);
    try {
      await loginWithGoogle();
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-mark.svg"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9"
          />
          <span className="text-lg font-bold tracking-tight">SpeakSpace</span>
        </Link>

        <div className="max-w-md">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-teal-300">
            Welcome back
          </p>
          <h2 className="text-4xl font-bold leading-tight tracking-tight">
            Practice makes{" "}
            <span className="bg-gradient-to-r from-teal-300 via-cyan-300 to-sky-300 bg-clip-text italic text-transparent">
              perfect
            </span>
          </h2>
          <p className="mt-4 text-slate-300">
            Jump back into real conversations with native speakers.
          </p>
        </div>

        <p className="text-xs text-slate-500">
          © {new Date().getFullYear()} SpeakSpace
        </p>
      </aside>

      {/* Right — auth card */}
      <section className="relative z-10 flex flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:px-12">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <Link
            href="/"
            className="mb-8 flex items-center justify-center gap-2 text-white lg:hidden"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-mark.svg"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9"
            />
            <span className="text-lg font-bold tracking-tight">SpeakSpace</span>
          </Link>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight text-white">Sign in</h1>
              <p className="mt-1.5 text-sm text-slate-400">
                Welcome back. Let&apos;s keep the conversation going.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-slate-200"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 transition focus:border-teal-400/60 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium text-slate-200"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 transition focus:border-teal-400/60 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
                  placeholder="Your password"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="group w-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 px-4 py-3 font-semibold text-slate-900 shadow-lg shadow-teal-500/30 transition hover:shadow-teal-400/60 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  "Signing in..."
                ) : (
                  <>
                    Sign in
                    <span className="ml-1 inline-block transition-transform group-hover:translate-x-0.5">
                      →
                    </span>
                  </>
                )}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs uppercase tracking-wide text-slate-500">
                or
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleSubmitting}
              className="flex w-full items-center justify-center gap-3 rounded-full border border-white/15 bg-white/5 px-4 py-3 font-medium text-white backdrop-blur-sm transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18A10.98 10.98 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.83z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
                />
              </svg>
              {googleSubmitting ? "Signing in..." : "Continue with Google"}
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-slate-400">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-semibold text-teal-300 transition hover:text-teal-200"
            >
              Sign up
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
