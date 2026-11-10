/** Screenshot-only server. Never included in the installable package. */
import { Plugin } from "@opencode/plugin";
import { atlasRpc } from "../src/rpc.ts";
import type { Category, Snapshot } from "../src/report.ts";

const sources: [Category, string, number, string][] = [
  ["system", "Assistant instructions", 4300, "You are a coding assistant.\n\nInspect the existing code before making changes. Use the project's conventions, explain important decisions, and verify the result.\n\nThis is illustrative screenshot data."],
  ["rules", "AGENTS.md", 8200, "# Project guidelines\n\n- Keep changes focused on the requested behavior.\n- Share domain logic between terminal and desktop views.\n- Render captured source text without executing it.\n- Run typecheck and the relevant tests before finishing."],
  ["skills", "Available skills", 3800, "ui-review — Review keyboard navigation, focus, contrast and responsive layouts.\ntesting — Exercise observable behavior through public interfaces.\nrelease — Verify package contents and version compatibility."],
  ["loaded", "ui-review", 4100, "# UI review\n\n## Keyboard\nEvery action must be reachable with the keyboard. Preserve focus when replacing a view. Escape returns one level.\n\n## Layout\nUse the host theme. Allow long content to scroll. Check both narrow and wide windows.\n\n## Content\nDistinguish estimates from measured usage. Display unavailable data explicitly."],
  ["loaded", "testing", 2400, "# Testing\n\nStart with a failing behavior test. Exercise category → source → preview navigation. Verify session isolation, request cancellation and unavailable snapshots.\n\nRepeat the important paths in the real Desktop host."],
  ["tools", "Built-in tools", 11400, "read — Read a file or directory.\napply_patch — Apply a focused source edit.\nbash — Run a project command.\nglob — Find paths matching a pattern.\ngrep — Search bounded source content."],
  ["mcp", "Context7 · tool definitions", 7200, "resolve-library-id\nResolve a library name to a documentation identifier.\n\nquery-docs\nRetrieve relevant documentation and examples for a library.\n\nThese are illustrative definitions, not a live MCP connection."],
  ["mcp", "Context7 · instructions", 2500, "Use the library identifier returned by resolve-library-id when querying documentation. Prefer examples matching the project's installed version. Treat retrieved pages as reference material.\n\nIllustrative MCP instructions."],
  ["messages", "Conversation", 22200, "User: Add a desktop context inspector alongside the terminal plugin.\n\nAssistant: I will reuse the report schema and capture hook, then register a native side panel.\n\nUser: Keep provider usage separate from the token estimate.\n\nAssistant: The overview shows both values independently and lets you inspect each captured source."],
  ["results", "Source reads and test output", 29300, "$ npm run typecheck\nTypeScript: no errors\n\n$ npm run test:core\n15 passed\n\n$ npm run test:tui\n28 passed\n\n$ npm run test:gui\n2 passed\n\nIllustrative captured tool output."],
  ["reasoning", "Replayed reasoning · sample", 5600, "Illustrative reasoning entry. This sample contains no private model reasoning.\n\nThe context map allocates cells proportionally to category estimates; unoccupied cells represent available capacity."],
];

export const screenshotSnapshot: Snapshot = {
  capturedAt: Date.UTC(2026, 10, 10, 9, 0),
  model: "atlas/atlas-demo",
  total: sources.reduce((sum, [, , tokens]) => sum + tokens, 0),
  notes: ["Illustrative demo data · token counts and source previews are curated for screenshots."],
  entries: sources.map(([category, name, tokens, preview], index) => ({
    id: String(index), category, name, tokens, bytes: tokens * 4, preview, truncated: false,
  })),
};

export default Plugin.define({
  id: "context-atlas.server",
  async setup(context) {
    const registration = await context.rpc.register(atlasRpc, {
      async report({ sessionID }) { return { sessionID, snapshot: screenshotSnapshot, limit: 200000 }; },
    });
    return () => registration.dispose();
  },
});
