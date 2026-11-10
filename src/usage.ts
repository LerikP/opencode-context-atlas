import { lastAssistantWithUsage } from "@opencode/client/solid";
import type { LocationRef } from "@opencode/client";
import type { Data } from "@opencode/plugin/tui/context";
import { createMemo, createResource, type Accessor } from "solid-js";
import type { Report } from "./report.ts";

export interface ContextUsage {
  total: number;
  limit: number | null;
  model: string;
}

/** The same message selection, token sum and model catalog rules as OpenCode. */
export function useUsage(data: Accessor<Pick<Data, "session" | "location">>, sessionID: Accessor<string>,
  location: Accessor<LocationRef | undefined>) {
  const message = createMemo(() => lastAssistantWithUsage(
    data().session.message.list(sessionID()), data().session.get(sessionID())?.revert?.messageID,
  ));
  const target = createMemo(() => message() ? { data: data(), location: location() } : null,
    undefined, { equals: (a, b) => a?.data === b?.data && a?.location === b?.location });
  // Catalog sync is location-scoped. A late result only updates its own host cache;
  // the reader below always uses the currently selected message and location.
  const [, { refetch }] = createResource(target, async (input) => {
    await Promise.all([
      input.data.location.model.sync(input.location), input.data.location.provider.sync(input.location),
    ]);
  });
  const usage = createMemo((): ContextUsage | null => {
    const current = message();
    if (!current?.tokens) return null;
    const providers = data().location.provider.list(location());
    const models = data().location.model.list(location());
    const provider = providers?.findLast((item) => item.id === current.model.providerID);
    const model = provider ? models?.findLast((item) => item.providerID === current.model.providerID
      && item.id === current.model.id && item.status !== "deprecated") : undefined;
    const tokens = current.tokens;
    return {
      total: tokens.input + tokens.output + tokens.reasoning + tokens.cache.read + tokens.cache.write,
      limit: model?.limit.context || null,
      model: `${current.model.providerID}/${current.model.id}`,
    };
  });
  return { usage, refresh: () => { void refetch(); } };
}

/** Keep the observed total separate from the estimate; never scale source counts. */
export function usageSummary(report: Report | null, reported?: ContextUsage | null) {
  const snapshot = report?.snapshot;
  const value = reported ?? (snapshot ? { total: snapshot.total, model: snapshot.model, limit: report?.limit ?? null } : null);
  if (!value) return null;
  const modelMismatch = !!reported && !!snapshot && reported.model !== snapshot.model;
  return { ...value, reported: !!reported,
    percentage: value.limit ? Math.round(value.total / value.limit * 100) : null,
    difference: reported && snapshot && !modelMismatch ? reported.total - snapshot.total : null,
    modelMismatch,
  };
}
