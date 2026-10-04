import assert from "node:assert/strict";
import { test } from "node:test";
import { cellSymbol, windowMap } from "../src/map.ts";
import { categoryKeys, type Snapshot } from "../src/report.ts";

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

test("symbol modes distinguish every category consistently in the map and sidebar", () => {
  for (const mode of ["unicode", "nerd-font"]) {
    const symbols = categoryKeys.map((key) => cellSymbol(key, mode));
    assert.equal(new Set(symbols).size, categoryKeys.length, `${mode} must distinguish all categories`);
    assert.deepEqual(categoryKeys.map((key) => cellSymbol(key, mode, "sidebar")), symbols);
    assert.ok(symbols.every((symbol) => [...symbol].length === 1));
    assert.ok(!symbols.includes(cellSymbol("free", mode)));
    assert.ok(!symbols.includes(cellSymbol("unknown", mode)));
  }
  assert.equal(cellSymbol("rules", "unicode"), "≡");
  assert.equal(cellSymbol("tools", "unicode"), "⌘");
  assert.equal(cellSymbol("mcp", "nerd-font"), "\uf1e6");
});

test("Nerd Font is the default; explicit blocks and invalid options retain the fallback", () => {
  assert.equal(cellSymbol("tools"), "\uf0ad");
  assert.equal(cellSymbol("tools", undefined, "sidebar"), "\uf0ad");
  for (const mode of ["blocks", null, true, "unrecognized", {}]) {
    assert.equal(cellSymbol("tools", mode), "▪");
    assert.equal(cellSymbol("tools", mode, "sidebar"), "━");
    assert.equal(cellSymbol("free", mode), "▫");
    assert.equal(cellSymbol("free", mode, "sidebar"), "░");
    assert.equal(cellSymbol("unknown", mode), "·");
  }
});
