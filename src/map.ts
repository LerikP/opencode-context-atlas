import { categories, categoryKeys, type Category, type Snapshot } from "./report.ts";

export type Cell = Category | "free" | "unknown";
export type SymbolMode = "blocks" | "unicode" | "nerd-font";

// Font Awesome codepoints in Nerd Fonts Mono. Terminal font coverage is not
// exposed by OpenTUI; users without glyph coverage can select Unicode or blocks.
const nerdSymbols: Record<Category, string> = {
  system: "\uf2db", // microchip
  rules: "\uf0f6", // file-text
  skills: "\uf02d", // book
  loaded: "\uf02e", // bookmark
  tools: "\uf0ad", // wrench
  mcp: "\uf1e6", // plug
  messages: "\uf075", // comment
  results: "\uf1c9", // file-code
  reasoning: "\uf0eb", // lightbulb
  other: "\uf141", // ellipsis
};

export function cellSymbol(cell: Cell, mode: unknown = "nerd-font", surface: "map" | "sidebar" = "map"): string {
  if (cell === "unknown") return "·";
  if (cell === "free") return surface === "sidebar" ? "░" : "▫";
  if (mode === "unicode") return categories[cell].glyph;
  if (mode === "nerd-font") return nerdSymbols[cell];
  return surface === "sidebar" ? "━" : "▪";
}

export function windowMap(snapshot: Snapshot | null, limit: number | null, cells: number): Cell[] {
  const count = Math.max(0, Math.min(1000, Math.floor(cells)));
  if (!snapshot || !limit || limit <= 0) return Array<Cell>(count).fill("unknown");
  const total = snapshot.entries.reduce((sum, entry) => sum + entry.tokens, 0);
  const denominator = Math.max(limit, total);
  const weights = categoryKeys.map((key) => ({ key: key as Cell,
    weight: snapshot.entries.filter((entry) => entry.category === key).reduce((sum, entry) => sum + entry.tokens, 0) }));
  weights.push({ key: "free", weight: Math.max(0, limit - total) });
  const allocation = weights.map(({ key, weight }) => {
    const exact = weight / denominator * count;
    return { key, count: Math.floor(exact), remainder: exact % 1 };
  });
  let spare = count - allocation.reduce((sum, item) => sum + item.count, 0);
  for (const item of [...allocation].sort((left, right) => right.remainder - left.remainder)) {
    if (spare-- <= 0) break;
    item.count++;
  }
  return allocation.flatMap((item) => Array<Cell>(item.count).fill(item.key));
}
