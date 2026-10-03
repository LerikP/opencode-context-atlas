import assert from "node:assert/strict";
import { test } from "node:test";
import { windowMap } from "../src/map.ts";
import type { Snapshot } from "../src/report.ts";

const snapshot: Snapshot = { capturedAt: 0, model: "test/model", total: 25, notes: [], entries: [
  { id: "rules", category: "rules", name: "AGENTS.md", tokens: 10, bytes: 10, preview: "", truncated: false },
  { id: "tools", category: "tools", name: "read", tokens: 15, bytes: 15, preview: "", truncated: false },
] };

test("a 25%-full window has 75 free cells, with each category owning its share", () => {
  const cells = windowMap(snapshot, 100, 100);
  assert.equal(cells.length, 100);
  assert.equal(cells.filter((cell) => cell === "free").length, 75);
  assert.equal(cells.filter((cell) => cell === "rules").length, 10);
  assert.equal(cells.filter((cell) => cell === "tools").length, 15);
});

test("rounding conserves grid size, overflow stays full, and missing data is not free space", () => {
  assert.equal(windowMap(snapshot, 99, 37).length, 37);
  assert.equal(windowMap(snapshot, 20, 100).filter((cell) => cell === "free").length, 0);
  assert.deepEqual(windowMap(snapshot, null, 3), ["unknown", "unknown", "unknown"]);
  assert.deepEqual(windowMap(null, 100, 3), ["unknown", "unknown", "unknown"]);
});
