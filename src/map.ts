import { categoryKeys, type Category, type Snapshot } from "./report.ts";

export type Cell = Category | "free" | "unknown";

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
