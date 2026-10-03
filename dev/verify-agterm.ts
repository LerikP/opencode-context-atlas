/** Drive only an explicitly addressed Atlas demo session. Never targets `active`. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";

const [session, window] = process.argv.slice(2);
if (!session || !window) throw new Error("Usage: verify-agterm.ts <session-id> <window-id>");
const exec = promisify(execFile);
const target = ["--target", session, "--window", window];
async function text(): Promise<string> {
  const { stdout } = await exec("agtermctl", ["session", "text", ...target, "--json"]);
  return JSON.parse(stdout).result.text;
}
async function type(value: string): Promise<void> {
  await exec("agtermctl", ["session", "type", value, ...target]);
  await delay(200);
}
async function expect(needle: string): Promise<string> {
  for (let attempt = 0; attempt < 25; attempt++) {
    const frame = await text();
    if (frame.includes(needle)) return frame;
    await delay(200);
  }
  throw new Error(`Expected visible text: ${needle}`);
}

for (let attempt = 0; attempt < 3 && (await text()).includes("◈ Context Atlas"); attempt++) await type("\x1b");
await type("/context");
await type("\r");
if (!(await text()).includes("◈ Context Atlas")) await type("\r");
await expect("o200k_base estimate");
await type("\r");
await expect("sources");
await type("\r");
await expect("bytes");
await type("\x1b");
await expect("sources");
assert.ok((await text()).includes("◈ Context Atlas"), "Escape must go back, not dismiss the source inspector");
await type("\x1b");
await expect("o200k_base estimate");
await type("\x1b");
assert.ok(!(await text()).includes("◈ Context Atlas"), "Escape from overview must close");

const lines = (await text()).split("\n");
const row = lines.findIndex((line) => line.includes("Atlas ↗"));
assert.ok(row >= 0, "sidebar indicator is visible");
const column = lines[row].indexOf("Atlas ↗");
await type(`\x1b[<0;${column + 1};${row + 1}M\x1b[<0;${column + 1};${row + 1}m`);
await expect("o200k_base estimate");
console.log(JSON.stringify({ slash: "pass", sourceInspector: "pass", escapeBackAndClose: "pass", sidebarClick: "pass" }));
