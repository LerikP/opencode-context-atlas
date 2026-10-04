import { Plugin } from "@opencode/plugin/tui";
import type { Context } from "@opencode/plugin/tui/context";
import { MouseButton } from "@opentui/core";
import { For, createMemo, createResource, onCleanup } from "solid-js";
import { atlasRpc } from "./rpc.ts";
import { categories, reportSchema, type Report } from "./report.ts";
import { windowMap } from "./map.ts";
import { AtlasView, formatTokens } from "./view.tsx";

export default Plugin.define({
  id: "context-atlas.tui",
  setup(context) {
    let opened = false;
    const open = (sessionID: string) => {
      if (opened) return;
      opened = true;
      context.ui.dialog.show(() => <Dialog context={context} sessionID={sessionID} />, () => { opened = false; });
      // show() replaces the host dialog and resets its presentation defaults.
      context.ui.dialog.set({ size: "large", centered: true });
    };
    const stopSidebar = context.ui.slot({
      prepend: "sidebar.content",
      render: (input) => <Indicator context={context} sessionID={input.sessionID} onOpen={() => open(input.sessionID)} />,
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
  const trigger = createMemo(() => {
    const messages = context.data.session.message.list(sessionID());
    const last = messages.at(-1);
    return { sessionID: sessionID(), last: last?.id, completed: last?.type === "assistant" ? last.time.completed : undefined };
  });
  const [report, { refetch }] = createResource(trigger, async ({ sessionID }) => {
    pending?.abort();
    pending = new AbortController();
    const signal = AbortSignal.any([pending.signal, AbortSignal.timeout(5000)]);
    const result = reportSchema.parse(await rpc.report({ sessionID }, { signal }));
    if (result.sessionID !== sessionID) throw new Error("Unexpected session");
    return result;
  });
  return { report: () => report.error || report.latest?.sessionID !== sessionID() ? null : report.latest ?? null,
    loading: () => report.loading, error: () => report.error ? "Context unavailable. Enable the Atlas server plugin and press r to retry." : null,
    refresh: () => { void refetch(); } };
}

function Dialog(props: { context: Context; sessionID: string }) {
  const state = useReport(props.context, () => props.sessionID);
  return <AtlasView report={state.report()} loading={state.loading()} error={state.error()}
    providerTotal={providerInput(props.context, props.sessionID)}
    foreground={props.context.theme.text.base} muted={props.context.theme.text.muted}
    background={props.context.theme.background.base}
    registerBack={(back) => props.context.keymap.layer(() => ({
      mode: "modal", priority: 100,
      commands: [{ bind: "escape", title: "Back in Context Atlas", run: back }],
    }))}
    onClose={() => props.context.ui.dialog.clear()} onRefresh={state.refresh} />;
}

function Indicator(props: { context: Context; sessionID: string; onOpen: () => void }) {
  const state = useReport(props.context, () => props.sessionID);
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
        ? props.context.theme.text.muted : categories[cell].color }}>{cell === "free" ? "░" : cell === "unknown" ? "·" : "━"}</span>}</For>
    </text>
    <text fg={props.context.theme.text.muted}>{indicatorLabel(state.report(), state.loading())}</text>
  </box>;
}

function indicatorLabel(report: Report | null, loading: boolean): string {
  if (!report?.snapshot) return loading ? "Loading context…" : "Click to inspect context";
  return `~${formatTokens(report.snapshot.total)} tokens${report.limit ? ` · ${(report.snapshot.total / report.limit * 100).toFixed(0)}%` : ""}`;
}

function providerInput(context: Context, sessionID: string): number | undefined {
  const messages = context.data.session.message.list(sessionID);
  for (const message of [...messages].reverse()) {
    if (message.type !== "assistant" || !message.tokens) continue;
    return message.tokens.input + message.tokens.cache.read + message.tokens.cache.write;
  }
}
