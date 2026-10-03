import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze, type RequestContext } from "../src/analyze.ts";

// Character counts are deliberately independent of BPE: these tests establish
// ownership/conservation of text, rather than testing the tokenizer library.
const options = { model: "test/model", capturedAt: 1000, mcpNames: ["docs"], count: (text: string) => text.length };

test("attributes rules, advertised skills and Code Mode without charging a byte twice", () => {
  const text = [
    "You are a coding assistant.\n",
    "# Code Mode\nUse execute.\n## Available tools\n",
    "- docs (1 tools) // Documentation\n  - tools.docs.search({query: string}): string\n",
    "- filesystem (1 tools)\n  - tools.filesystem.read({path: string}): string\n",
    "Instructions from: /project/AGENTS.md\nPrefer small changes.\n",
    "<available_skills>\n<skill>\n<name>testing</name>\n<description>Test changes</description>\n</skill>\n</available_skills>\n",
  ].join("");
  const report = analyze({ system: [{ type: "text", text }], messages: [], tools: {} }, options);
  assert.equal(report.total, text.length);
  assert.equal(report.entries.reduce((sum, entry) => sum + entry.tokens, 0), text.length);
  assert.ok(report.entries.some((entry) => entry.category === "rules" && entry.name === "/project/AGENTS.md"));
  assert.ok(report.entries.some((entry) => entry.category === "skills" && entry.name === "testing"));
  assert.ok(report.entries.some((entry) => entry.category === "mcp" && entry.name.includes("docs")));
  assert.ok(report.entries.some((entry) => entry.category === "tools" && entry.name.includes("filesystem")));
  assert.ok(report.entries.some((entry) => entry.category === "tools" && entry.name === "filesystem.read"));
  assert.ok(report.entries.some((entry) => entry.category === "mcp" && entry.name === "docs.search"));
  assert.ok(report.entries.every((entry) => entry.category !== "tools" || !entry.preview.includes("Prefer small")));
});

test("counts replayed tool results, loaded skills and reasoning without mutating the request", () => {
  const request: RequestContext = {
    system: [], tools: { read: { description: "Read files", input: { type: "object" } } },
    messages: [
      { role: "user", content: [{ type: "text", text: "hello" }] },
      { role: "assistant", content: [{ type: "reasoning", text: "think" }] },
      { role: "tool", content: [
        { type: "tool-result", id: "a", name: "read", result: { type: "text", value: "abc" } },
        { type: "tool-result", id: "b", name: "skill", result: { type: "text", value: '<skill_content name="testing">Test first</skill_content>' } },
      ] },
    ],
  };
  const before = structuredClone(request);
  const report = analyze(request, options);
  assert.equal(report.entries.find((entry) => entry.category === "messages")?.tokens, 5);
  assert.equal(report.entries.find((entry) => entry.category === "reasoning")?.tokens, 5);
  assert.equal(report.entries.find((entry) => entry.category === "results")?.tokens, 3);
  assert.ok(report.entries.some((entry) => entry.category === "loaded" && entry.name === "testing"));
  assert.ok(report.entries.some((entry) => entry.category === "tools" && entry.name === "read"));
  assert.deepEqual(request, before);
});

test("bounds previews but counts the complete source and treats a new snapshot independently", () => {
  const report = analyze({ system: [{ type: "text", text: "界".repeat(12000) }], tools: {}, messages: [] }, options);
  assert.equal(report.total, 12000);
  assert.ok(Buffer.byteLength(report.entries[0].preview) <= 8192);
  assert.equal(report.entries[0].truncated, true);
  const compacted = analyze({ system: [], tools: {}, messages: [{ role: "user", content: [{ type: "text", text: "summary" }] }] }, options);
  assert.equal(compacted.total, 7);
});
