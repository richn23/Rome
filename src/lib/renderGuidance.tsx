import React from "react";

/**
 * Very small renderer for the guidance body format. Supported syntax:
 * - blank lines separate paragraphs
 * - lines starting with "## " become subheadings
 * - contiguous lines starting with "- " become a bulleted list
 */
export function renderGuidanceBody(body: string): React.ReactElement[] {
  const blocks: React.ReactElement[] = [];
  const paragraphs = body.replace(/\r\n/g, "\n").split(/\n\s*\n/);

  paragraphs.forEach((rawPara, idx) => {
    const para = rawPara.trim();
    if (!para) return;

    // Heading
    if (para.startsWith("## ")) {
      blocks.push(
        <h3
          key={idx}
          className="mt-6 text-lg font-semibold text-slate-900 dark:text-slate-100"
        >
          {para.slice(3).trim()}
        </h3>
      );
      return;
    }

    // Bulleted list
    const lines = para.split("\n").map((l) => l.trim());
    if (lines.every((l) => l.startsWith("- "))) {
      blocks.push(
        <ul
          key={idx}
          className="list-disc space-y-1 pl-5 text-slate-700 dark:text-slate-300"
        >
          {lines.map((l, i) => (
            <li key={i}>{l.slice(2)}</li>
          ))}
        </ul>
      );
      return;
    }

    // Regular paragraph — preserve newlines as <br/>
    blocks.push(
      <p
        key={idx}
        className="text-slate-700 dark:text-slate-300 leading-relaxed"
      >
        {lines.map((l, i) => (
          <React.Fragment key={i}>
            {l}
            {i < lines.length - 1 && <br />}
          </React.Fragment>
        ))}
      </p>
    );
  });

  return blocks;
}
