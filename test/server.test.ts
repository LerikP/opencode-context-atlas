import assert from "node:assert/strict";
import { test } from "node:test";
import type { Plugin } from "@opencode/plugin";
import type { SessionContext } from "@opencode/plugin/promise/session";
import server from "../src/index.ts";
import { reportSchema, type Report } from "../src/report.ts";

test("server captures primary context, isolates sessions, evicts old snapshots and cleans up", async () => {
  let capture: ((event: SessionContext) => Promise<void>) | undefined;
  let report: ((input: { sessionID: string }) => Promise<Report>) | undefined;
  let disposed = 0;
  const registration = { dispose: async () => { disposed++; } };
  // This is the external OpenCode host boundary; analysis and tokenization are real.
  const host = {
    session: { hook: async (name: string, callback: typeof capture) => {
      assert.equal(name, "context"); capture = callback; return registration;
    } },
    mcp: { list: async () => ({ data: [] }) },
    model: { list: async () => ({ data: [{ providerID: "test", id: "model", limit: { context: 200000 } }] }) },
    rpc: { register: async (_definition: unknown, handlers: { report: typeof report }) => {
      report = handlers.report; return registration;
    } },
  } as unknown as Plugin.Context;
  const cleanup = await server.setup(host);
  assert.ok(capture, "the primary context hook must be registered");
  assert.ok(report, "the TUI report must be registered");
  assert.equal((await report({ sessionID: "missing" })).snapshot, null);
  const request = { sessionID: "session-0", agent: "build", model: { providerID: "test", id: "model" },
    system: [{ type: "text", text: "Hello world" }], messages: [], tools: {}, options: {} } as unknown as SessionContext;
  await capture(request);
  const result = reportSchema.parse(await report({ sessionID: "session-0" }));
  assert.equal(result.limit, 200000);
  assert.equal(result.snapshot?.total, 2);
  assert.equal(result.snapshot?.entries[0].preview, "Hello world");
  for (let index = 1; index <= 8; index++) {
    await capture({ ...request, sessionID: `session-${index}` } as SessionContext);
  }
  assert.equal((await report({ sessionID: "session-0" })).snapshot, null);
  assert.ok((await report({ sessionID: "session-8" })).snapshot);
  assert.equal(typeof cleanup, "function");
  await cleanup!();
  assert.equal(disposed, 2);
});
