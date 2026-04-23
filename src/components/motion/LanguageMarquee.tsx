"use client";

/**
 * Infinite slow-scrolling band of language names. Placed at the bottom of
 * the hero to hint at the breadth of the platform without another headline.
 *
 * Duplicates the list so `animation: marquee` can loop seamlessly at 50%
 * translate. Reduced-motion users see a static (unanimated) row.
 */
const LANGUAGES = [
  "Español",
  "日本語",
  "Français",
  "Deutsch",
  "한국어",
  "Italiano",
  "Português",
  "العربية",
  "Nederlands",
  "中文",
];

export default function LanguageMarquee({
  className = "",
}: {
  className?: string;
}) {
  const items = [...LANGUAGES, ...LANGUAGES];
  return (
    <div className={`marquee ${className}`}>
      <div className="marquee-track font-display text-3xl italic text-slate-500 md:text-4xl">
        {items.map((lang, i) => (
          <span key={`${lang}-${i}`} className="flex items-center gap-12">
            <span>{lang}</span>
            <span className="text-slate-700">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
