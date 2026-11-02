import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { buildTui } from "../scripts/build-tui.mjs";

// The installed TUI entry is a build artifact: OpenCode loads node_modules
// sources without the Solid JSX transform, so dist must be committed and fresh.
test("committed TUI build matches the source", async () => {
  const expected = await buildTui({ write: false });
  for (const [target, output] of expected) {
    assert.equal(await readFile(target, "utf8"), output, `${target} is stale; run npm run build`);
  }
});
