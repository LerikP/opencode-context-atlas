/** Generate a README image from the actual OpenTUI renderer, with labelled demo data. */
import { mkdir, writeFile } from "node:fs/promises";
import { testRender } from "@opentui/solid";
import { rgbToHex } from "@opentui/core";
import { AtlasView } from "../src/view.tsx";
import type { Category, Report } from "../src/report.ts";

const fixture: [Category, string, number][] = [
  ["system", "System prompt", 4300], ["rules", "AGENTS.md", 8200],
  ["skills", "Skill catalogue", 3800], ["loaded", "testing", 6500],
  ["tools", "Built-in tools", 11400], ["mcp", "github", 9700],
  ["messages", "Conversation", 22200], ["results", "Read results", 29300],
  ["reasoning", "Replayed reasoning", 5600],
];
const report: Report = { sessionID: "demo", limit: 200000, snapshot: {
  model: "claude-sonnet · illustrative demo", capturedAt: 0, notes: [],
  total: fixture.reduce((sum, [, , tokens]) => sum + tokens, 0),
  entries: fixture.map(([category, name, tokens]) => ({ id: category, category, name,
    tokens, bytes: tokens * 4, preview: "Illustrative demo source.", truncated: false })),
} };
const screen = await testRender(() => <AtlasView report={report} loading={false} error={null}
  foreground="#e7e7ee" muted="#9595a8" background="#191920" onClose={() => {}} onRefresh={() => {}} />,
  { width: 88, height: 30 });
try {
  await screen.renderOnce();
  const frame = screen.captureSpans();
  const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
  const rows: string[] = [];
  frame.lines.slice(0, 24).forEach((line, index) => {
    let column = 0;
    for (const span of line.spans) {
      rows.push(`<text x="${24 + column * 9}" y="${38 + index * 20}" textLength="${span.width * 9}" lengthAdjust="spacingAndGlyphs" fill="${rgbToHex(span.fg)}">${escape(span.text)}</text>`);
      column += span.width;
    }
  });
  await mkdir(new URL("../docs/", import.meta.url), { recursive: true });
  await writeFile(new URL("../docs/preview.svg", import.meta.url),
    `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="524" viewBox="0 0 840 524"><rect width="840" height="524" rx="14" fill="#191920"/><g font-family="Menlo,Consolas,monospace" font-size="14" xml:space="preserve">${rows.join("")}</g></svg>\n`);
  console.log(screen.captureCharFrame());
} finally { screen.renderer.destroy(); }
