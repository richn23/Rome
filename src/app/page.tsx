"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useScrollReveal } from "@/components/motion/useScrollReveal";
import MagneticButton from "@/components/motion/MagneticButton";
import LanguageMarquee from "@/components/motion/LanguageMarquee";

/**
 * Kicks off the older .reveal scroll animations used on the lower sections.
 * Hero uses .kin (kinetic reveal) which has its own observer via useScrollReveal.
 */
function useLegacyReveal() {
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

  useLegacyReveal();
  // Kinetic hero text — animates on mount, not on scroll.
  useScrollReveal(".kin", { immediate: true });
  // Flourish underline draws when the "perfect" word enters the viewport
  // (on mount it's already in the viewport, so this fires right away).
  useScrollReveal(".flourish", { threshold: 0.1 });

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
        {/* Hero area — use the full logo (mark + wordmark baked into the SVG). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.svg"
          alt="SpeakSpace"
          className="h-8 w-auto md:h-9"
        />
        <div className="flex items-center gap-2 md:gap-3">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-white/90 transition hover:text-white"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-gradient-to-r from-teal-300 to-cyan-300 px-5 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-teal-500/30 transition hover:shadow-teal-400/60"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* ============== HERO ============== */}
      <section className="grain relative min-h-screen overflow-hidden bg-slate-950 text-white">
        {/* Gradient mesh — replaces the three static blobs with one drifting
            multi-colour mesh. Adds a pink accent the palette was missing. */}
        <div className="mesh pointer-events-none absolute inset-0" />
        <div className="grid-dots pointer-events-none absolute inset-0 opacity-60" />

        <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 pt-24 pb-32 text-center">
          <p className="kin pill-label mb-6 text-sm font-medium uppercase tracking-[0.25em] text-teal-300">
            Language practice, reimagined
          </p>

          {/* Kinetic headline — stagger-reveals per word, Fraunces italic
              flourish on "perfect" with an SVG underline that draws in. */}
          <h1
            className="mb-6 font-display text-5xl font-[350] leading-[0.95] tracking-tight md:text-7xl"
            style={{ fontVariationSettings: "'opsz' 144" }}
          >
            <span className="kin" style={{ animationDelay: "0.05s" }}>Practice</span>{" "}
            <span className="kin" style={{ animationDelay: "0.18s" }}>makes</span>
            <br />
            {/* Italic Fraunces has a significant right-side overhang on the
                "t" — `pr-4` gives the glyph room inside the container so it
                isn't clipped, and widens the container so the SVG underline
                (w-full) reaches past the last letter. `overflow-visible`
                defends against any parent that clips descending/slanting
                glyphs. */}
            <span
              className="kin relative inline-block overflow-visible pr-4 italic"
              style={{ animationDelay: "0.34s", fontVariationSettings: "'opsz' 144, 'SOFT' 100" }}
            >
              <span className="bg-gradient-to-r from-teal-200 via-cyan-200 to-sky-200 bg-clip-text pr-1 text-transparent">
                perfect
              </span>
              <svg
                className="flourish pointer-events-none absolute -bottom-2 left-0 w-full"
                viewBox="0 0 300 20"
                fill="none"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d="M2 14 C 60 2, 120 20, 180 8 S 280 18, 298 6"
                  stroke="url(#flourish-gradient)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="flourish-gradient" x1="0" x2="1">
                    <stop offset="0" stopColor="#5eead4" />
                    <stop offset="1" stopColor="#7dd3fc" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
          </h1>

          <p
            className="kin mx-auto mb-10 max-w-2xl text-lg text-slate-300 md:text-xl"
            style={{ animationDelay: "0.5s" }}
          >
            Real conversations with native speakers, on demand. The missing half of language learning.
          </p>

          <div className="kin flex w-full max-w-sm flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row" style={{ animationDelay: "0.65s" }}>
            {/* Magnetic CTA — cursor offset nudges the button. */}
            <MagneticButton
              href="/signup"
              className="group block w-full rounded-full bg-gradient-to-r from-teal-300 to-cyan-300 px-8 py-3.5 text-center text-base font-semibold text-slate-900 shadow-[0_10px_40px_-10px_rgba(45,212,191,0.7)] transition-shadow hover:shadow-[0_20px_60px_-10px_rgba(45,212,191,0.85)] sm:w-auto"
            >
              Start practicing
              <span className="ml-1 inline-block transition-transform group-hover:translate-x-1">→</span>
            </MagneticButton>
            <Link
              href="/login"
              className="block w-full rounded-full border border-white/20 bg-white/5 px-8 py-3.5 text-center text-base font-medium text-white backdrop-blur-sm transition hover:bg-white/10 sm:w-auto"
            >
              I already have an account
            </Link>
          </div>

        </div>

        {/* Language marquee — breadth cue without another headline. */}
        <div className="absolute inset-x-0 bottom-20 z-10 opacity-60">
          <LanguageMarquee />
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

      {/* ============== SECTION 2 — THE TENNIS ANALOGY ==============
          This section is intentionally a light band in both light and dark
          mode (part of the landing's dark → light → dark rhythm). Text and
          surfaces inside MUST stay dark-on-light; no `dark:` variants here. */}
      <section className="relative bg-[#f8fffe] px-6 py-24 text-slate-900 md:py-32">
        <div className="mx-auto max-w-4xl">
          <p className="reveal mb-4 text-sm font-medium uppercase tracking-[0.25em] text-teal-700">
            A simple idea
          </p>
          <h2 className="reveal mb-10 font-display text-3xl font-[400] leading-tight tracking-tight text-slate-900 md:text-5xl">
            Think about learning <span className="italic text-teal-700">anything.</span>
          </h2>

          <div className="reveal space-y-6 text-lg leading-relaxed text-slate-700 md:text-xl">
            <p>
              Take tennis. Sometimes you need a lesson with a coach - to improve your skills and
              technique. Other times, you just need to <span className="font-semibold text-slate-900">practice</span>.
            </p>
            <p>
              Language learning is the same. We need teachers to guide and improve us - but we also
              need to practice away from class.
            </p>
          </div>

          {/* Two-card visual metaphor — stays light in both themes */}
          <div className="reveal mt-16 grid gap-6 md:grid-cols-2">
            <div className="group rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                📘
              </div>
              <h3 className="mb-2 font-display text-xl font-[500] text-slate-900">The lesson</h3>
              <p className="text-slate-600">
                A teacher explains, corrects, and builds structure. Essential for learning the rules.
              </p>
            </div>
            <div className="group rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50 p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-100 text-2xl">
                💬
              </div>
              <h3 className="mb-2 font-display text-xl font-[500] text-slate-900">The practice</h3>
              <p className="text-slate-700">
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
      <section className="grain relative overflow-hidden bg-slate-900 px-6 py-24 text-white md:py-32">
        {/* Gradient mesh for this section too — smaller, softer. */}
        <div className="mesh pointer-events-none absolute inset-0 opacity-70" />

        <div className="relative z-10 mx-auto max-w-4xl">
          <p className="reveal mb-4 text-sm font-medium uppercase tracking-[0.25em] text-teal-300">
            That&apos;s where we come in
          </p>
          <h2 className="reveal mb-10 font-display text-3xl font-[400] leading-tight tracking-tight md:text-5xl">
            Practice shouldn&apos;t be the{" "}
            <span className="bg-gradient-to-r from-teal-300 to-cyan-300 bg-clip-text italic text-transparent">
              hard part.
            </span>
          </h2>

          <div className="reveal space-y-6 text-lg leading-relaxed text-slate-300 md:text-xl">
            <p>
              It&apos;s not always easy to find practice - and it&apos;s harder to schedule it. We make this
              easy.
            </p>
            <p className="text-white">
              SpeakSpace pairs learners with native speakers to practice, so you can reach your goal
              - on your time, at your pace.
            </p>
          </div>

          {/* Three small feature points */}
          <div className="reveal mt-16 grid gap-4 md:grid-cols-3">
            {[
              { title: "Available now", desc: "Book live speakers when you want to practice." },
              { title: "Real conversations", desc: "Native speakers, not scripts." },
              { title: "Your level", desc: "Pick the level that feels right - challenge up when you're ready." },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition hover:border-teal-400/40 hover:bg-white/10"
              >
                <div className="mb-3 h-1 w-8 rounded-full bg-gradient-to-r from-teal-400 to-cyan-400" />
                <h3 className="mb-1 font-display text-lg font-[500] text-white">{f.title}</h3>
                <p className="text-sm text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Final CTA */}
          <div className="reveal mt-16 text-center">
            <MagneticButton
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-300 to-cyan-300 px-10 py-4 text-base font-semibold text-slate-900 shadow-[0_10px_40px_-10px_rgba(45,212,191,0.7)] transition-shadow hover:shadow-[0_20px_60px_-10px_rgba(45,212,191,0.85)]"
            >
              Start practicing today
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </MagneticButton>
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-mark.svg"
              alt=""
              width={24}
              height={24}
              className="h-6 w-6"
            />
            <span className="font-semibold text-slate-300">SpeakSpace</span>
          </div>
          <p>© {new Date().getFullYear()} SpeakSpace. Practice makes perfect.</p>
        </div>
      </footer>
    </main>
  );
}
