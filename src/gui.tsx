/** @jsxImportSource solid-js */
import { Command, MenuItem, Panel, Plugin, Slot, Store, Style, type Context, type MountedSession } from "@opencode/plugin/gui";
import { Schema } from "effect";
import { For, Show, createEffect, createMemo, createResource, createSignal, onCleanup } from "solid-js";
import { atlasRpc } from "./rpc.ts";
import { categories, categoryKeys, reportSchema, type Category } from "./report.ts";
import { cellSymbol, windowMap, type SymbolMode } from "./map.ts";
import { usageSummary, useUsage } from "./usage.ts";
import css from "./gui.css?inline";

export default Plugin.define({
  stores: {
    appearance: Store.global(Schema.Struct({
      symbols: Schema.Literals(['blocks', 'unicode', 'nerd-font']), headerIndicator: Schema.Boolean,
    }), { symbols: 'nerd-font', headerIndicator: false }),
  },
  setup(context) {
    const symbols = () => context.stores.appearance.value.symbols;
    const cycleSymbols = () => context.stores.appearance.update((draft) => {
      draft.symbols = draft.symbols === 'blocks' ? 'unicode' : draft.symbols === 'unicode' ? 'nerd-font' : 'blocks';
    });
    const headerIndicator = () => context.stores.appearance.value.headerIndicator;
    const toggleHeaderIndicator = () => context.stores.appearance.update((draft) => {
      draft.headerIndicator = !draft.headerIndicator;
    });
    const open = () => {
      const session = context.sessions.current();
      if (session) context.layout.open(`${context.id}:atlas`, session);
    };
    for (const name of ["context", "atlas"]) context.add(Command, {
      id: `open-${name}`, title: "Inspect context · Atlas", group: "Context Atlas",
      slash: { name }, hidden: name === "atlas" ? true : undefined,
      get enabled() { return !!context.sessions.current(); }, run: open,
    });
    context.add(MenuItem, { id: "atlas", menu: "session.panel", title: "Context Atlas", run: open });
    const tab = { id: "atlas", title: "Context Atlas" };
    context.add(Panel, {
      id: "atlas", region: "side",
      mobile: { title: "Context Atlas", order: 50, kind: "menu" },
      list: (input) => input.open.includes("atlas") ? [tab] : [],
      render: (props) => <Atlas context={context} session={props.session} symbols={symbols()} onCycleSymbols={cycleSymbols}
        headerIndicator={headerIndicator()} onToggleHeaderIndicator={toggleHeaderIndicator} />,
    });
    context.add(Slot, {
      at: 'session.header', order: 11,
      render: (input) => <Show when={headerIndicator() && input.active}>
        <HeaderIndicator context={context} session={input.session} />
      </Show>,
    });
    context.add(Style, css);
  },
});

function Atlas(props: { context: Context; session: MountedSession; symbols: SymbolMode; onCycleSymbols: () => void;
  headerIndicator: boolean; onToggleHeaderIndicator: () => void }) {
  let panel!: HTMLElement;
  const [category, setCategory] = createSignal<Category | null>(null);
  const [entryID, setEntryID] = createSignal<string | null>(null);
  const { result, refetch, report } = useReport(props.context, () => props.session);
  const observed = useUsage(() => props.session.server.data, () => props.session.id, () => props.session.location);
  const summary = () => usageSummary(report(), observed.usage());
  const snapshot = () => report()?.snapshot;
  const entries = () => snapshot()?.entries.filter((entry) => entry.category === category()) ?? [];
  const selected = () => entries().find((entry) => entry.id === entryID());
  const cells = () => windowMap(snapshot() ?? null, report()?.limit ?? null, 100);
  createEffect(() => { props.session.key; props.session.location; setCategory(null); setEntryID(null); });
  // Navigation removes the clicked button. Keep keyboard events inside the panel
  // instead of letting focus fall back to the host's composer or document body.
  createEffect(() => { category(); entryID(); panel.focus({ preventScroll: true }); });
  const back = () => { if (entryID()) setEntryID(null); else setCategory(null); };
  return <section ref={panel} tabIndex={-1} class="context-atlas" data-symbols={props.symbols}
    style={{ '--atlas-symbol-font': props.context.appearance.font('mono') }} aria-label="Context Atlas" onKeyDown={(event) => {
    if (event.key === "Escape" && category()) { event.preventDefault(); event.stopPropagation(); back(); }
    if (event.key.toLowerCase() === 's' && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault(); event.stopPropagation(); props.onCycleSymbols();
    }
  }}>
    <header><h2>Context Atlas</h2><div class="atlas-actions">
      <button onClick={props.onToggleHeaderIndicator} aria-pressed={props.headerIndicator}
        title="Show Atlas context usage beside the built-in context indicator">
        Header indicator: {props.headerIndicator ? 'On' : 'Off'}
      </button>
      <button onClick={props.onCycleSymbols} title="Cycle symbols (s). Nerd Font requires an installed Nerd Font Mono.">
        Symbols: {props.symbols === 'nerd-font' ? 'Nerd Font' : props.symbols === 'unicode' ? 'Unicode' : 'Blocks'}
      </button><button onClick={() => { void refetch(); observed.refresh(); }}>Refresh</button>
    </div></header>
    <Show when={summary()}>{(value) => <>
      <p><strong>{value().total.toLocaleString()} tokens · {value().reported ? 'OpenCode usage' : 'estimated'}</strong>
        {value().limit ? ` / ${value().limit!.toLocaleString()} context window · ${value().percentage}%` : ' · Context limit unknown'}</p>
      <p class="atlas-muted">{value().model}</p>
      <Show when={value().reported}><p class="atlas-muted">Includes input, output, reasoning and cache usage, as reported by OpenCode.</p></Show>
    </>}</Show>
    <Show when={result.loading}><p role="status">Loading context…</p></Show>
    <Show when={result.error}><p role="alert">Context unavailable. Enable the Atlas server plugin and refresh to retry.</p></Show>
    <Show when={!props.session.location || !props.session.server.connected}><p>Waiting for the session connection…</p></Show>
    <Show when={snapshot()} fallback={<Show when={!result.loading && !result.error && props.session.location && props.session.server.connected}>
      <p>No captured request. Send a message in this session, then refresh. Snapshots are cleared on server restart or eviction.</p>
    </Show>}>{(snapshot) => <>
      <p><strong>Captured input: {snapshot().total.toLocaleString()} estimated tokens</strong>
        {report()?.limit ? ` / ${report()!.limit!.toLocaleString()} context window` : " · Context limit unknown"}</p>
      <p class="atlas-muted">{snapshot().model} · Captured {new Date(snapshot().capturedAt).toLocaleString()}</p>
      <Show when={summary()?.difference !== null && summary()?.difference !== undefined}>
        <p>Difference to captured-input estimate: {summary()!.difference! >= 0 ? '+' : ''}{summary()!.difference!.toLocaleString()} tokens</p>
      </Show>
      <Show when={summary()?.modelMismatch}><p>Different models for OpenCode usage and captured input; estimates are not directly comparable.</p></Show>
      <Show when={report()?.limit && snapshot().total > report()!.limit!}><p>Estimate exceeds the context window.</p></Show>
      <p class="atlas-muted">Map and categories estimate the last captured input using o200k_base. They are not rescaled to OpenCode usage; differences are not necessarily overhead.</p>
      <For each={snapshot().notes}>{(note) => <p class="atlas-muted">{note}</p>}</For>
      <div class="atlas-map" aria-label="Estimated context allocation">
        <For each={cells()}>{(cell) => <button disabled={cell === "free" || cell === "unknown"}
          title={cell === "free" ? "Free capacity" : cell === "unknown" ? "Unknown capacity" : categories[cell].label}
          aria-label={cell === "free" || cell === "unknown" ? cell : categories[cell].label}
          style={{ "background-color": props.symbols !== 'blocks' || cell === "free" || cell === "unknown" ? "transparent" : categories[cell].color,
            color: cell === 'free' || cell === 'unknown' ? 'inherit' : categories[cell].color }}
          onClick={() => { if (cell !== "free" && cell !== "unknown") { setCategory(cell); setEntryID(null); } }}>
          {props.symbols === 'blocks' ? '' : cellSymbol(cell, props.symbols)}
        </button>}</For>
      </div>
      <Show when={category()} fallback={<div class="atlas-categories"><For each={categoryKeys}>{(key) =>
        <button onClick={() => setCategory(key)}><span class="atlas-symbol" style={{ color: categories[key].color }}>{cellSymbol(key, props.symbols)}</span>
          {categories[key].label}<span>~{snapshot().entries.filter((entry) => entry.category === key)
            .reduce((sum, entry) => sum + entry.tokens, 0).toLocaleString()}</span></button>
      }</For></div>}>
        <nav><button onClick={back}>‹ Back</button><button onClick={() => setEntryID(null)}>{categories[category()!].label}</button></nav>
        <Show when={selected()} fallback={<div class="atlas-sources"><For each={entries()} fallback={<p>No sources in this category.</p>}>
          {(entry) => <button onClick={() => setEntryID(entry.id)}>{entry.name}<span>~{entry.tokens.toLocaleString()}</span></button>}
        </For></div>}>{(entry) => <article><h3>{entry().name}</h3><p>~{entry().tokens.toLocaleString()} estimated tokens · {entry().bytes.toLocaleString()} bytes</p>
          <Show when={entry().truncated}><p>Preview truncated; token count covers the full source.</p></Show>
          <pre>{entry().preview}</pre>
        </article>}</Show>
      </Show>
    </>}</Show>
  </section>;
}

function HeaderIndicator(props: { context: Context; session: MountedSession }) {
  const { result, report } = useReport(props.context, () => props.session);
  const observed = useUsage(() => props.session.server.data, () => props.session.id, () => props.session.location);
  const summary = () => usageSummary(report(), observed.usage());
  const percentage = () => summary()?.percentage ?? null;
  const label = () => {
    const value = percentage();
    return value !== null ? `Atlas · ${summary()?.reported ? '' : '~'}${value}%` : result.loading && !summary() ? 'Atlas …' : 'Atlas · —';
  };
  return <button class="atlas-header-indicator"
    aria-label="Open Context Atlas"
    title={summary() ? `${summary()!.total.toLocaleString()} tokens · ${summary()!.reported ? 'OpenCode usage' : 'estimated'}${percentage() === null ? ' · Context limit unknown' : ` / ${summary()!.limit!.toLocaleString()} context window`} · Open Context Atlas`
      : 'Context unavailable · Open Context Atlas to refresh or inspect details'}
    onClick={() => props.context.layout.open(`${props.context.id}:atlas`, props.session)}>
    <Show when={percentage() !== null}>
      <svg class="atlas-header-ring" viewBox="0 0 20 20" aria-hidden="true">
        <circle class="atlas-header-track" cx="10" cy="10" r="8" />
        <circle class="atlas-header-progress" cx="10" cy="10" r="8" pathLength="100"
          stroke-dasharray={`${Math.min(100, percentage()!)} 100`} transform="rotate(-90 10 10)" />
      </svg>
    </Show>
    <span>{label()}</span>
  </button>;
}

function useReport(context: Context, session: () => MountedSession) {
  let pending: AbortController | undefined;
  onCleanup(() => pending?.abort());
  const trigger = createMemo(() => {
    const current = session();
    const last = current.server.data.session.message.list(current.id).at(-1);
    return { key: current.key, id: current.id, client: current.server.client, location: current.location,
      connected: current.server.connected, last: last?.id,
      completed: last?.type === 'assistant' ? last.time.completed : undefined };
  }, undefined, { equals: (a, b) => a.key === b.key && a.client === b.client && a.location === b.location
    && a.connected === b.connected && a.last === b.last && a.completed === b.completed });
  const [result, { refetch }] = createResource(trigger, async (input) => {
    pending?.abort();
    pending = new AbortController();
    if (!input.location || !input.connected) return null;
    const signal = AbortSignal.any([context.signal, pending.signal, AbortSignal.timeout(5000)]);
    const report = reportSchema.parse(await input.client.rpc(atlasRpc).report({ sessionID: input.id }, {
      location: input.location, signal,
    }));
    if (report.sessionID !== input.id) throw new Error('Unexpected session');
    return { input, report };
  });
  const report = () => {
    if (result.error) return null;
    const value = result.latest;
    const input = trigger();
    return value?.input.key === input.key && value.input.client === input.client
      && value.input.location === input.location && input.connected ? value.report : null;
  };
  return { result, refetch, report };
}
