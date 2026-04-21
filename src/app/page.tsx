"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook: reveals any element with the `reveal` class as it scrolls into view.
 */
function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

export default function Home() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const redirected = useRef(false);
  useScrollReveal();

  // If already signed in, slip through to the right dashboard.
  useEffect(() => {
    if (loading || redirected.current) return;
    if (user && userProfile) {
      redirected.current = true;
      router.replace(`/dashboard/${userProfile.role}`);
    }
  }, [user, userProfile, loading, router]);

  return (
    <main className="flex flex-col">
      {/* ============== NAV ============== */}
      <nav className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-5 md:px-12">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-400 to-cyan-500 font-bold text-white shadow-lg shadow-teal-500/30">
            S
          </div>
          <span className="text-lg font-bold tracking-tight text-white">SpeakSpace</span>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-white/90 transition hover:text-white"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 px-5 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-teal-500/30 transition hover:shadow-teal-400/50"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* ============== HERO ============== */}
      <section className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 text-white">
        {/* Soft ambient blobs */}
        <div className="pointer-events-none absolute -top-20 -left-20 h-[32rem] w-[32rem] rounded-full bg-teal-500/20 blur-3xl drift" />
        <div className="pointer-events-none absolute -right-20 top-40 h-[28rem] w-[28rem] rounded-full bg-cyan-400/15 blur-3xl drift-delay" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-[24rem] w-[24rem] rounded-full bg-sky-500/10 blur-3xl drift" />

        {/* Dashed connector decoration */}
        <svg
          className="pointer-events-none absolute left-10 top-1/3 hidden opacity-40 md:block"
          width="180"
          height="220"
          viewBox="0 0 180 220"
          fill="none"
        >
          <path
            d="M10,10 C 80,40 60,120 140,110 S 120,210 170,210"
            stroke="#5eead4"
            strokeWidth="1.5"
            strokeDasharray="5 7"
            strokeLinecap="round"
          />
        </svg>
        <svg
          className="pointer-events-none absolute right-8 bottom-32 hidden opacity-40 md:block"
          width="220"
          height="120"
          viewBox="0 0 220 120"
          fill="none"
        >
          <path
            d="M10,60 C 60,10 120,110 210,40"
            stroke="#67e8f9"
            strokeWidth="1.5"
            strokeDasharray="5 7"
            strokeLinecap="round"
          />
        </svg>

        <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 pt-24 pb-32 text-center">
          <p className="reveal mb-5 text-sm font-medium uppercase tracking-[0.25em] text-teal-300">
            Language practice, reimagined
          </p>
          <h1 className="reveal mb-6 text-5xl font-bold leading-tight tracking-tight md:text-7xl">
            Practice makes
            <br />
            <span className="bg-gradient-to-r from-teal-300 via-cyan-300 to-sky-300 bg-clip-text italic text-transparent">
              perfect
            </span>
          </h1>
          <p className="reveal mx-auto mb-10 max-w-2xl text-lg text-slate-300 md:text-xl">
            Real conversations with native speakers, on demand. The missing half of language learning.
          </p>
          <div className="reveal flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="group rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 px-8 py-3.5 text-base font-semibold text-slate-900 shadow-xl shadow-teal-500/30 transition hover:shadow-teal-400/60"
            >
              Start practicing
              <span className="ml-1 inline-block transition-transform group-hover:translate-x-1">→</span>
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-white/20 bg-white/5 px-8 py-3.5 text-base font-medium text-white backdrop-blur-sm transition hover:bg-white/10"
            >
              I already have an account
            </Link>
          </div>
        </div>

        {/* Wave divider to light section */}
        <svg
          className="absolute bottom-0 left-0 right-0 w-full"
          viewBox="0 0 1440 100"
          preserveAspectRatio="none"
          style={{ height: "80px" }}
        >
          <path d="M0,60 C 240,100 480,0 720,40 C 960,80 1200,10 1440,50 L1440,100 L0,100 Z" fill="#f8fffe" />
        </svg>
      </section>

      {/* ============== SECTION 2 — THE TENNIS ANALOGY ============== */}
      <section className="relative bg-[#f8fffe] px-6 py-24 md:py-32">
        <div className="mx-auto max-w-4xl">
          <p className="reveal mb-4 text-sm font-medium uppercase tracking-[0.25em] text-teal-600 dark:text-teal-400">
            A simple idea
          </p>
          <h2 className="reveal mb-10 text-3xl font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-100 md:text-5xl">
            Think about learning <span className="italic text-teal-600 dark:text-teal-400">anything.</span>
          </h2>

          <div className="reveal space-y-6 text-lg leading-relaxed text-slate-700 dark:text-slate-200 md:text-xl">
            <p>
              Take tennis. Sometimes you need a lesson with a coach — to improve your skills and
              technique. Other times, you just need to <span className="font-semibold text-slate-900 dark:text-slate-100">practice</span>.
            </p>
            <p>
              Language learning is the same. We need teachers to guide and improve us — but we also
              need to practice away from class.
            </p>
          </div>

          {/* Two-card visual metaphor */}
          <div className="reveal mt-16 grid gap-6 md:grid-cols-2">
            <div className="group rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-2xl">
                📘
              </div>
              <h3 className="mb-2 text-xl font-bold text-slate-900 dark:text-slate-100">The lesson</h3>
              <p className="text-slate-600 dark:text-slate-300">
                A teacher explains, corrects, and builds structure. Essential for learning the rules.
              </p>
            </div>
            <div className="group rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50 p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-teal-900/60 dark:from-teal-950/60 dark:to-cyan-950/60">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-100 dark:bg-teal-900/40 text-2xl">
                💬
              </div>
              <h3 className="mb-2 text-xl font-bold text-slate-900 dark:text-teal-100">The practice</h3>
              <p className="text-slate-600 dark:text-slate-300">
                Real conversation, away from the classroom. Where learning actually sticks.
              </p>
            </div>
          </div>
        </div>

        {/* Wave divider down to navy */}
        <svg
          className="absolute bottom-0 left-0 right-0 w-full"
          viewBox="0 0 1440 100"
          preserveAspectRatio="none"
          style={{ height: "80px" }}
        >
          <path d="M0,40 C 240,0 480,100 720,60 C 960,20 1200,90 1440,50 L1440,100 L0,100 Z" fill="#0f172a" />
        </svg>
      </section>

      {/* ============== SECTION 3 — WHERE SPEAKSPACE COMES IN ============== */}
      <section className="relative overflow-hidden bg-slate-900 px-6 py-24 text-white md:py-32">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute -left-20 top-20 h-96 w-96 rounded-full bg-teal-500/15 blur-3xl drift" />
        <div className="pointer-events-none absolute -right-10 bottom-10 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl drift-delay" />

        <div className="relative z-10 mx-auto max-w-4xl">
          <p className="reveal mb-4 text-sm font-medium uppercase tracking-[0.25em] text-teal-300">
            That&apos;s where we come in
          </p>
          <h2 className="reveal mb-10 text-3xl font-bold leading-tight tracking-tight md:text-5xl">
            Practice shouldn&apos;t be the{" "}
            <span className="bg-gradient-to-r from-teal-300 to-cyan-300 bg-clip-text italic text-transparent">
              hard part.
            </span>
          </h2>

          <div className="reveal space-y-6 text-lg leading-relaxed text-slate-300 md:text-xl">
            <p>
              It&apos;s not always easy to find practice — and it&apos;s harder to schedule it. We make this
              easy.
            </p>
            <p className="text-white">
              SpeakSpace pairs learners with native speakers to practice, so you can reach your goal
              — on your time, at your pace.
            </p>
          </div>

          {/* Three small feature points */}
          <div className="reveal mt-16 grid gap-4 md:grid-cols-3">
            {[
              { title: "Available now", desc: "Book live speakers when you want to practice." },
              { title: "Real conversations", desc: "Native speakers, not scripts." },
              { title: "Your level", desc: "Pick the level that feels right — challenge up when you're ready." },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition hover:border-teal-400/40 hover:bg-white/10"
              >
                <div className="mb-3 h-1 w-8 rounded-full bg-gradient-to-r from-teal-400 to-cyan-400" />
                <h3 className="mb-1 font-semibold text-white">{f.title}</h3>
                <p className="text-sm text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Final CTA */}
          <div className="reveal mt-16 text-center">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 px-10 py-4 text-base font-semibold text-slate-900 shadow-xl shadow-teal-500/30 transition hover:shadow-teal-400/60"
            >
              Start practicing today
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
            <p className="mt-4 text-sm text-slate-400">
              Free to start. No card required.
            </p>
          </div>
        </div>
      </section>

      {/* ============== FOOTER ============== */}
      <footer className="bg-slate-950 px-6 py-10 text-center text-sm text-slate-500">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-teal-400 to-cyan-500 text-xs font-bold text-white">
              S
            </div>
            <span className="font-semibold text-slate-300">SpeakSpace</span>
          </div>
          <p>© {new Date().getFullYear()} SpeakSpace. Practice makes perfect.</p>
        </div>
      </footer>
    </main>
  );
}
