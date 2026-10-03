import { Plugin } from "@opencode/plugin";
import { getEncoding } from "js-tiktoken";
import { analyze } from "./analyze.ts";
import { atlasRpc } from "./rpc.ts";
import type { Snapshot } from "./report.ts";

export default Plugin.define({
  id: "context-atlas.server",
  async setup(context) {
    const cache = new Map<string, Snapshot>();
    let encoder: ReturnType<typeof getEncoding> | undefined;
    const capture = await context.session.hook("context", async (event) => {
      try {
        const servers = await context.mcp.list().catch(() => ({ data: [] }));
        encoder ??= getEncoding("o200k_base");
        const snapshot = analyze(event, {
          model: `${event.model.providerID}/${event.model.id}`,
          capturedAt: Date.now(),
          mcpNames: servers.data.map((server) => server.name),
          count: (text) => encoder!.encode(text, [], []).length,
        });
        cache.delete(event.sessionID);
        cache.set(event.sessionID, snapshot);
        while (cache.size > 8) cache.delete(cache.keys().next().value!);
      } catch {
        // Introspection must not prevent a model call. Do not retain a stale
        // report, and never log the request or exception (it may contain text).
        cache.delete(event.sessionID);
      }
    });
    const rpc = await context.rpc.register(atlasRpc, {
      async report({ sessionID }) {
        const snapshot = cache.get(sessionID) ?? null;
        if (snapshot) {
          cache.delete(sessionID);
          cache.set(sessionID, snapshot);
        }
        const models = await context.model.list();
        const model = models.data.find((model) => `${model.providerID}/${model.id}` === snapshot?.model);
        return { sessionID, snapshot, limit: model?.limit.context ?? null };
      },
    });
    return async () => {
      cache.clear();
      await Promise.all([capture.dispose(), rpc.dispose()]);
    };
  },
});
