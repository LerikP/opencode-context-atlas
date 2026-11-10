/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui";
import type { Context } from "@opencode/plugin/tui/context";
import { MouseButton } from "@opentui/core";
import { For, Show, createMemo, createResource, onCleanup } from "solid-js";
import { atlasRpc } from "./rpc.ts";
import { categories, reportSchema, type Report } from "./report.ts";
import { cellSymbol, windowMap, type SymbolMode } from "./map.ts";
import { AtlasView, formatTokens } from "./view.tsx";
import { useUsage, usageSummary, type ContextUsage } from "./usage.ts";

export default Plugin.define({
  id: "context-atlas.tui",
  setup(context) {
    const [appearance, saveAppearance] = context.storage.store<{ symbols: SymbolMode | null }>("appearance", {
      initial: { symbols: null },
    });
    const symbols = (): SymbolMode => {
      const value = appearance.symbols ?? context.options.symbols ?? "nerd-font";
      return value === "unicode" || value === "nerd-font" ? value : "blocks";
    };
    const cycleSymbols = () => {
      void saveAppearance((draft) => {
        const value = draft.symbols ?? context.options.symbols ?? "nerd-font";
        draft.symbols = value === "unicode" ? "nerd-font" : value === "nerd-font" ? "blocks" : "unicode";
      }).catch(() => context.ui.toast.show({ message: "Could not save the symbol preference. Try again.", variant: "error" }));
    };
    let opened = false;
    const open = (sessionID: string) => {
      if (opened) return;
      opened = true;
      context.ui.dialog.show(() => <Dialog context={context} sessionID={sessionID} symbols={symbols()} onCycleSymbols={cycleSymbols} />,
        () => { opened = false; });
      // show() replaces the host dialog and resets its presentation defaults.
      context.ui.dialog.set({ size: "large", centered: true });
    };
    const stopSidebar = context.ui.slot({
      prepend: "sidebar.content",
      render: (input) => <Indicator context={context} sessionID={input.sessionID} symbols={symbols()} onOpen={() => open(input.sessionID)} />,
    });
    const stopCommand = context.ui.slot({
      append: "app",
      render: () => {
        context.keymap.layer(() => ({
          mode: "global",
          commands: [{
            id: "context-atlas.open", title: "Inspect context · Atlas", group: "Context Atlas",
            description: "Show the context map and inspect skills, rules, tools and MCP",
            slash: { name: "context", aliases: ["atlas"] }, palette: true,
            run: () => {
              const route = context.ui.router.current();
              if (route.type === "session") open(route.sessionID);
              else context.ui.toast.show({ message: "Open a session to inspect its context.", variant: "info" });
            },
          }],
        }));
        return null;
      },
    });
    return () => { stopSidebar(); stopCommand(); };
  },
});

function useReport(context: Context, sessionID: () => string) {
  const rpc = context.client.rpc(atlasRpc);
  let pending: AbortController | undefined;
  onCleanup(() => pending?.abort());
  // Streaming updates replace the message object on every delta. Refetch only when
  // the request boundary moves, otherwise every delta aborts and restarts the RPC.
  const trigger = createMemo(() => {
    const messages = context.data.session.message.list(sessionID());
    const last = messages.at(-1);
    return { sessionID: sessionID(), last: last?.id, completed: last?.type === "assistant" ? last.time.completed : undefined };
  }, undefined, { equals: (a, b) => a.sessionID === b.sessionID && a.last === b.last && a.completed === b.completed });
  const [report, { refetch }] = createResource(trigger, async ({ sessionID }) => {
    pending?.abort();
    pending = new AbortController();
    const signal = AbortSignal.any([pending.signal, AbortSignal.timeout(5000)]);
    // Plugin RPC calls default to the server's own location, which has a separate
    // snapshot cache. Scope the call to the session's location to read its captures.
    const location = context.data.session.get?.(sessionID)?.location;
    const result = reportSchema.parse(await rpc.report({ sessionID }, { signal, location }));
    if (result.sessionID !== sessionID) throw new Error("Unexpected session");
    return result;
  });
  return { report: () => report.error || report.latest?.sessionID !== sessionID() ? null : report.latest ?? null,
    loading: () => report.loading, error: () => report.error ? "Context unavailable. Enable the Atlas server plugin and press r to retry." : null,
    refresh: () => { void refetch(); } };
}

function Dialog(props: { context: Context; sessionID: string; symbols: SymbolMode; onCycleSymbols: () => void }) {
  const state = useReport(props.context, () => props.sessionID);
  const observed = useUsage(() => props.context.data, () => props.sessionID,
    () => props.context.data.session.get(props.sessionID)?.location ?? props.context.location);
  return <AtlasView report={state.report()} loading={state.loading()} error={state.error()}
    symbols={props.symbols} onCycleSymbols={props.onCycleSymbols}
    usage={observed.usage()}
    foreground={props.context.theme.text.base} muted={props.context.theme.text.muted}
    background={props.context.theme.background.base}
    registerBack={(back) => props.context.keymap.layer(() => ({
      mode: "modal", priority: 100,
      commands: [{ bind: "escape", title: "Back in Context Atlas", run: back }],
    }))}
    onClose={() => props.context.ui.dialog.clear()} onRefresh={() => { state.refresh(); observed.refresh(); }} />;
}

function Indicator(props: { context: Context; sessionID: string; symbols: SymbolMode; onOpen: () => void }) {
  const state = useReport(props.context, () => props.sessionID);
  const observed = useUsage(() => props.context.data, () => props.sessionID,
    () => props.context.data.session.get(props.sessionID)?.location ?? props.context.location);
  const cells = () => windowMap(state.report()?.snapshot ?? null, state.report()?.limit ?? null, 20);
  return <box flexDirection="column" gap={0} marginBottom={1} onMouseUp={(event) => {
    if (event.button !== MouseButton.LEFT) return;
    event.stopPropagation();
    props.onOpen();
  }}>
    <box flexDirection="row" justifyContent="space-between">
      <text fg={props.context.theme.text.base}><b>Context</b></text>
      <text fg="#e5b567">Atlas ↗</text>
    </box>
    <text>
      <For each={cells()}>{(cell) => <span style={{ fg: cell === "free" || cell === "unknown"
        ? props.context.theme.text.muted : categories[cell].color }}>{cellSymbol(cell, props.symbols, "sidebar")}</span>}</For>
    </text>
    <text fg={props.context.theme.text.muted}>{indicatorLabel(state.report(), state.loading(), observed.usage())}</text>
    <Show when={observed.usage() && state.report()?.snapshot}><text fg={props.context.theme.text.muted}>Map: input estimate</text></Show>
  </box>;
}

function indicatorLabel(report: Report | null, loading: boolean, reported: ContextUsage | null): string {
  const summary = usageSummary(report, reported);
  if (!summary) return loading ? "Loading context…" : "Click to inspect context";
  return `${summary.reported ? '' : '~'}${formatTokens(summary.total)} tokens${summary.percentage !== null ? ` · ${summary.percentage}%` : ''}${summary.reported ? '' : ' estimated'}`;
}
