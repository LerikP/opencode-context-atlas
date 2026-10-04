import assert from "node:assert/strict";
import { test } from "node:test";
import { testRender } from "@opentui/solid";
import type { TextRenderable } from "@opentui/core";
import { createSignal } from "solid-js";
import { AtlasView } from "../src/view.tsx";
import { cellSymbol } from "../src/map.ts";
import { categories, categoryKeys, type Report } from "../src/report.ts";

const report: Report = { sessionID: "demo", limit: 200000, snapshot: {
  model: "test/model", capturedAt: 1000, total: 30000, notes: [], entries: [
    { id: "rules:AGENTS.md", category: "rules", name: "AGENTS.md", tokens: 10000,
      bytes: 40, preview: "Prefer small changes.", truncated: false },
    { id: "tools:read", category: "tools", name: "read", tokens: 20000,
      bytes: 20, preview: "Read a local file.", truncated: false },
  ],
} };

test("renders a context map and supports keyboard drill-down, back and close", async () => {
  let closed = false;
  const screen = await testRender(() => <AtlasView report={report} loading={false} error={null}
    foreground="#eeeeee" muted="#999999" background="#1b1b23"
    onClose={() => { closed = true; }} onRefresh={() => {}} />, { width: 100, height: 40 });
  try {
    await screen.renderOnce();
    const frame = screen.captureCharFrame();
    assert.ok(frame.includes("Context Atlas"), "the dialog has a visible title");
    assert.ok(frame.includes("Rules & memory"));
    assert.ok(frame.includes("Free space"));
    assert.ok(frame.includes("15.0%"));
    screen.mockInput.pressEnter();
    await screen.renderOnce();
    assert.ok(screen.captureCharFrame().includes("AGENTS.md"));
    screen.mockInput.pressEnter();
    await screen.renderOnce();
    assert.ok(screen.captureCharFrame().includes("Prefer small changes."));
    await screen.mockInput.pressKeys(["ESCAPE"], 40);
    await screen.renderOnce();
    assert.equal(closed, false);
    await screen.mockInput.pressKeys(["ESCAPE"], 40);
    await screen.renderOnce();
    await screen.mockInput.pressKeys(["ESCAPE"], 40);
    assert.equal(closed, true);
  } finally {
    screen.renderer.destroy();
  }
});

test("mouse inspection survives resize and keeps the footer reachable in a short terminal", async () => {
  const screen = await testRender(() => <AtlasView report={report} loading={false} error={null}
    foreground="#eeeeee" muted="#999999" background="#1b1b23" onClose={() => {}} onRefresh={() => {}} />,
    { width: 88, height: 35 });
  try {
    await screen.renderOnce();
    const lines = screen.captureCharFrame().split("\n");
    const row = lines.findIndex((line) => line.includes("Rules & memory"));
    assert.ok(row >= 0);
    await screen.mockMouse.click(lines[row].indexOf("Rules"), row);
    await screen.renderOnce();
    assert.ok(screen.captureCharFrame().includes("AGENTS.md"));
    screen.resize(50, 20);
    await screen.renderOnce();
    const narrow = screen.captureCharFrame();
    assert.ok(narrow.includes("Context Atlas"));
    assert.ok(narrow.includes("r refresh"));
    assert.ok(narrow.includes("AGENTS.md"));
  } finally { screen.renderer.destroy(); }
});

test("missing capture and request failures are explicit, not zero usage", async () => {
  const screen = await testRender(() => <AtlasView report={null} loading={false}
    error="Context unavailable. Press r to retry." foreground="#eeeeee" muted="#999999" background="#1b1b23"
    onClose={() => {}} onRefresh={() => {}} />, { width: 50, height: 20 });
  try {
    await screen.renderOnce();
    assert.ok(screen.captureCharFrame().includes("Context unavailable"));
    assert.ok(!screen.captureCharFrame().includes("0 tokens"));
  } finally { screen.renderer.destroy(); }
});

test("refreshing a snapshot updates an open source preview", async () => {
  const [current, update] = createSignal(report);
  const screen = await testRender(() => <AtlasView report={current()} loading={false} error={null}
    foreground="#eeeeee" muted="#999999" background="#1b1b23" onClose={() => {}} onRefresh={() => {}} />,
    { width: 88, height: 35 });
  try {
    await screen.renderOnce();
    screen.mockInput.pressEnter();
    await screen.renderOnce();
    screen.mockInput.pressEnter();
    await screen.renderOnce();
    assert.ok(screen.captureCharFrame().includes("Prefer small changes."));
    const next = structuredClone(report);
    next.snapshot!.entries[0].preview = "Updated rule from the latest request.";
    update(next);
    await screen.renderOnce();
    assert.ok(screen.captureCharFrame().includes("Updated rule from the latest request."));
    assert.ok(!screen.captureCharFrame().includes("Prefer small changes."));
  } finally { screen.renderer.destroy(); }
});

test("tool definition previews show readable descriptions and a formatted input schema", async () => {
  const sample = structuredClone(report);
  sample.snapshot!.entries[1].preview = JSON.stringify({ name: "read", description: "Read a file.\nReturns its text.",
    input: { type: "object", properties: { path: { type: "string" } } } });
  const screen = await testRender(() => <AtlasView report={sample} loading={false} error={null}
    foreground="#eeeeee" muted="#999999" background="#1b1b23" onClose={() => {}} onRefresh={() => {}} />,
    { width: 88, height: 35 });
  try {
    await screen.renderOnce();
    screen.mockInput.pressArrow("down");
    screen.mockInput.pressEnter();
    await screen.renderOnce();
    screen.mockInput.pressEnter();
    await screen.renderOnce();
    const frame = screen.captureCharFrame();
    assert.ok(frame.includes("Input schema"));
    assert.ok(frame.includes("Returns its text."));
    assert.ok(!frame.includes("\\nReturns"));
  } finally { screen.renderer.destroy(); }
});

test("category glyphs occupy one terminal column in OpenTUI", async () => {
  const glyphs = ["unicode", "nerd-font"].flatMap((mode) => categoryKeys.map((key) => cellSymbol(key, mode)));
  const rendered: TextRenderable[] = [];
  const screen = await testRender(() => <box flexDirection="row">
    {glyphs.map((glyph) => <text ref={(node) => { rendered.push(node); }}>{glyph}</text>)}
  </box>, { width: 80, height: 3 });
  try {
    await screen.renderOnce();
    assert.equal(rendered.length, glyphs.length);
    for (const [index, node] of rendered.entries()) {
      assert.equal(node.width, 1, `${glyphs[index]} must not stretch the context grid`);
    }
  } finally { screen.renderer.destroy(); }
});

for (const category of categoryKeys) {
  test(`${category}: click the category to return to its list, then the arrow to return to the map`, async () => {
    let closed = false;
    const sample: Report = { sessionID: "demo", limit: 1000, snapshot: {
      capturedAt: 0, model: "test/model", total: 10, notes: [], entries: [
        { id: category, category, name: "Example source", tokens: 10, bytes: 20,
          preview: "Example source contents", truncated: false },
      ],
    } };
    const screen = await testRender(() => <AtlasView report={sample} loading={false} error={null}
      foreground="#eeeeee" muted="#999999" background="#1b1b23" onClose={() => { closed = true; }} onRefresh={() => {}} />,
      { width: 88, height: 35 });
    try {
      await screen.renderOnce();
      screen.mockInput.pressEnter();
      await screen.renderOnce();
      screen.mockInput.pressEnter();
      await screen.renderOnce();
      assert.ok(screen.captureCharFrame().includes("Example source contents"));
      const label = categories[category].label;
      let lines = screen.captureCharFrame().split("\n");
      let row = lines.findIndex((line) => line.includes(`‹ ${label}`));
      assert.ok(row >= 0);
      const column = lines[row].indexOf(label);
      await screen.mockMouse.pressDown(column, row);
      await screen.renderOnce();
      assert.ok(screen.captureCharFrame().includes("Example source contents"), "navigation waits for release");
      await screen.mockMouse.release(column, row);
      await screen.renderOnce();
      assert.ok(!screen.captureCharFrame().includes("Example source contents"), "category click returns to its source list");
      assert.ok(screen.captureCharFrame().includes("Example source"));
      assert.ok(screen.captureCharFrame().includes("1 sources"));
      lines = screen.captureCharFrame().split("\n");
      row = lines.findIndex((line) => line.includes(`‹ ${label}`));
      await screen.mockMouse.click(lines[row].indexOf("‹"), row);
      await screen.renderOnce();
      assert.ok(screen.captureCharFrame().includes("Free space"), "arrow returns to the context map");
      assert.equal(closed, false, "breadcrumb navigation does not close the inspector");
    } finally { screen.renderer.destroy(); }
  });
}
