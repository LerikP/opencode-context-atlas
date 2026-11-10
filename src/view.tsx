/** @jsxImportSource @opentui/solid */
import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import { useTerminalDimensions } from "@opentui/solid";
import { MouseButton, type BoxRenderable, type ScrollBoxRenderable } from "@opentui/core";
import { categories, categoryKeys, type Category, type Entry, type Report, type Snapshot } from "./report.ts";
import { cellSymbol, windowMap, type SymbolMode } from "./map.ts";
import { usageSummary, type ContextUsage } from "./usage.ts";

export interface AtlasViewProps {
  report: Report | null;
  loading: boolean;
  error: string | null;
  usage?: ContextUsage | null;
  symbols?: SymbolMode;
  foreground: string;
  muted: string;
  background: string;
  onClose: () => void;
  onRefresh: () => void;
  onCycleSymbols?: () => void;
  registerBack?: (back: () => void) => void;
}

export function AtlasView(props: AtlasViewProps) {
  const terminal = useTerminalDimensions();
  const [measuredWidth, setMeasuredWidth] = createSignal(0);
  const [category, setCategory] = createSignal<Category | null>(null);
  const [entryID, setEntryID] = createSignal<string | null>(null);
  const [selected, setSelected] = createSignal(0);
  let root: BoxRenderable | undefined;
  let scroll: ScrollBoxRenderable | undefined;
  const snapshot = (): Snapshot | null => props.report?.snapshot ?? null;
  const summary = () => usageSummary(props.report, props.usage);
  const entry = () => snapshot()?.entries.find((item) => item.id === entryID()) ?? null;
  const limit = () => props.report?.limit;
  const width = () => measuredWidth() || terminal().width - 8;
  const wide = () => width() >= 76;
  const symbolLabel = () => props.symbols === "unicode" ? "Unicode" : (props.symbols ?? "nerd-font") === "nerd-font" ? "Nerd Font" : "Blocks";
  const columns = () => wide() ? 18 : Math.max(8, Math.min(24, Math.floor((width() - 4) / 2)));
  const gridRows = () => wide() ? 10 : 4;
  const cells = createMemo(() => windowMap(snapshot() ?? null, limit() ?? null, columns() * gridRows()));
  const totals = createMemo(() => categoryKeys.map((key) => ({
    key, tokens: snapshot()?.entries.filter((item) => item.category === key).reduce((sum, item) => sum + item.tokens, 0) ?? 0,
  })).filter((row) => row.tokens > 0));
  const entries = createMemo(() => (snapshot()?.entries ?? []).filter((item) => item.category === category())
    .sort((left, right) => right.tokens - left.tokens));
  const legendMarker = (key: Category, index: number) => {
    const glyph = cellSymbol(key, props.symbols);
    if (glyph === "▪") return selected() === index ? "›" : glyph;
    return `${selected() === index ? "› " : "  "}${glyph}`;
  };
  const count = () => category() ? entries().length : totals().length;
  const resetSelection = () => { setSelected(0); scroll?.scrollTo(0); };
  const back = () => {
    if (entry()) setEntryID(null);
    else if (category()) setCategory(null);
    else { props.onClose(); return; }
    resetSelection();
  };
  props.registerBack?.(back);
  const chooseCategory = (key: Category) => { setCategory(key); setEntryID(null); resetSelection(); };
  const openSelected = () => {
    if (entry()) return;
    if (category()) setEntryID(entries()[selected()]?.id ?? null);
    else if (totals()[selected()]) chooseCategory(totals()[selected()].key);
    scroll?.scrollTo(0);
  };
  onMount(() => root?.focus());

  return <box
    ref={(value) => { root = value; value.onSizeChange = () => setMeasuredWidth(value.width); }}
    flexDirection="column" paddingX={2} paddingY={1} width="100%"
    height={Math.max(8, Math.min(terminal().height - 6, entry() ? 30 : category() ? 26 : wide() ? 24 : 30))}
    backgroundColor={props.background}
    focusable onKeyDown={(event) => {
      if (event.name === "escape" || event.name === "left" || event.name === "backspace") back();
      else if (event.name === "return" || event.name === "right") openSelected();
      else if (event.name === "r") props.onRefresh();
      else if (event.name === "s" && !event.ctrl && !event.meta && !event.option && !event.super && props.onCycleSymbols) props.onCycleSymbols();
      else if ((event.name === "down" || event.name === "j") && !entry()) {
        setSelected((value) => Math.min(Math.max(0, count() - 1), value + 1));
        if (category()) scroll?.scrollTo(Math.max(0, selected() - 3));
      } else if ((event.name === "up" || event.name === "k") && !entry()) {
        setSelected((value) => Math.max(0, value - 1));
        if (category()) scroll?.scrollTo(Math.max(0, selected() - 3));
      } else if (entry() && ["down", "j", "pagedown"].includes(event.name)) scroll?.scrollBy(event.name === "pagedown" ? 10 : 1);
      else if (entry() && ["up", "k", "pageup"].includes(event.name)) scroll?.scrollBy(event.name === "pageup" ? -10 : -1);
      else return;
      event.preventDefault();
      event.stopPropagation();
    }}>
    <box flexDirection="row" justifyContent="space-between" flexShrink={0}>
      <text fg="#e5b567"><b>◈ Context Atlas</b></text>
      <text fg={props.muted} onMouseDown={back}>{category() ? "esc back" : "esc close"}</text>
    </box>
    <text fg={props.muted} flexShrink={0} marginTop={1}>
      {summary()?.model ?? "Context window"}
    </text>
    <Show when={summary()}>
      {(value) => <text fg={props.foreground} flexShrink={0}>
        <b>{`${value().reported ? '' : '~'}${formatTokens(value().total)} / ${value().limit ? formatTokens(value().limit!) : "?"} tokens`}</b>
        <span style={{ fg: props.muted }}>{value().limit
          ? `  ·  ${value().reported ? value().percentage : (value().total / value().limit! * 100).toFixed(1)}% ${value().reported ? 'OpenCode usage' : 'estimated'}`
          : `  ·  limit unknown · ${value().reported ? 'OpenCode usage' : 'estimated'}`}</span>
      </text>}
    </Show>
    <Show when={props.loading}><text fg={props.muted}>Refreshing context…</text></Show>
    <Show when={props.error}><text fg="#ef9273">{props.error}</text></Show>
    <Show when={!snapshot() && !props.loading && !props.error}>
      <text fg={props.muted} marginTop={1}>No request captured yet. Send a message with Atlas enabled, then refresh.</text>
    </Show>
    <scrollbox ref={(value) => { scroll = value; }} scrollY flexGrow={1} flexShrink={1}
      marginTop={1} verticalScrollbarOptions={{ showArrows: false }}>
      <Show when={!category() && snapshot()}><text fg={props.muted}>{`Captured input: ~${formatTokens(snapshot()!.total)} tokens · ${snapshot()!.model}`}</text></Show>
      <Show when={!category() && summary()?.difference !== null && summary()?.difference !== undefined}>
        <text fg={props.muted}>{`Difference to captured-input estimate: ${summary()!.difference! >= 0 ? '+' : '-'}${formatTokens(Math.abs(summary()!.difference!))} tokens`}</text>
      </Show>
      <Show when={!category() && summary()?.modelMismatch}><text fg={props.muted}>Different models for usage and captured input; not directly comparable.</text></Show>
      <Show when={snapshot()} keyed>
        {(snap) => <Show when={!category()} fallback={
          <box flexDirection="column" gap={1}>
            <box flexDirection="row" flexShrink={0}>
              <text fg={categories[category()!]?.color} onMouseUp={(event) => {
                if (event.button !== MouseButton.LEFT) return;
                event.stopPropagation();
                back();
              }}>‹ </text>
              <text fg={categories[category()!]?.color} flexShrink={0} onMouseUp={(event) => {
                if (event.button !== MouseButton.LEFT) return;
                event.stopPropagation();
                setEntryID(null);
                resetSelection();
              }}>{categories[category()!]?.label}</text>
              <text fg={categories[category()!]?.color} flexShrink={1}>
                {entry() ? ` / ${safeText(entry()!.name)}` : `  ·  ${entries().length} sources`}
              </text>
            </box>
            <Show when={entry()} fallback={
              <box flexDirection="column">
                <For each={entries()}>{(item, index) =>
                  <box flexDirection="row" justifyContent="space-between" gap={1}
                    onMouseDown={() => { setSelected(index()); setEntryID(item.id); scroll?.scrollTo(0); }}>
                    <text fg={selected() === index() ? props.foreground : props.muted} flexGrow={1}>
                      {`${selected() === index() ? "›" : " "} ${shortName(safeText(item.name), Math.max(16, width() - 20))}`}
                    </text>
                    <text fg={categories[item.category].color}>{`~${formatTokens(item.tokens)}`}</text>
                  </box>
                }</For>
              </box>
            }>
              <text fg={props.muted}>{`~${formatTokens(entry()!.tokens)} tokens · ${formatTokens(entry()!.bytes)} bytes${entry()!.truncated ? " · preview truncated" : ""}`}</text>
              <text fg={props.foreground} wrapMode="word">{sourcePreview(entry()!) || "Preview budget exhausted; full source was counted."}</text>
            </Show>
          </box>
        }>
          <box flexDirection={wide() ? "row" : "column"} gap={wide() ? 3 : 1}>
            <box flexDirection="column" flexShrink={0}>
              <For each={Array.from({ length: gridRows() }, (_, index) => index)}>{(row) =>
                <box flexDirection="row" height={1}>
                  <For each={cells().slice(row * columns(), (row + 1) * columns())}>{(cell) =>
                    <text fg={cell === "free" || cell === "unknown" ? props.muted : categories[cell].color}
                      opacity={cell === "free" ? 0.35 : 1}
                      onMouseDown={() => { if (cell !== "free" && cell !== "unknown") chooseCategory(cell); }}>
                      {`${cellSymbol(cell, props.symbols)} `}
                    </text>
                  }</For>
                </box>
              }</For>
              <text fg={props.muted} marginTop={1}>{`1 cell ≈ ${limit() ? formatTokens(limit()! / cells().length) : "?"} tokens`}</text>
            </box>
            <box flexDirection="column" flexGrow={1} minWidth={28}>
              <For each={totals()}>{(row, index) =>
                <box flexDirection="row" justifyContent="space-between" gap={1}
                  onMouseDown={() => chooseCategory(row.key)}>
                  <text fg={categories[row.key].color}>{`${legendMarker(row.key, index())} ${categories[row.key].label}`}</text>
                  <text fg={props.foreground}>{`~${formatTokens(row.tokens)}${limit() ? `  ${(row.tokens / limit()! * 100).toFixed(1)}%`.padStart(8) : ""}`}</text>
                </box>
              }</For>
              <box flexDirection="row" justifyContent="space-between" gap={1} marginTop={1}>
                <text fg={props.muted}>▫ Free space (estimate)</text>
                <text fg={props.muted}>{limit() ? `~${formatTokens(Math.max(0, limit()! - snap.total))}` : "unknown"}</text>
              </box>
            </box>
          </box>
          <Show when={limit() && snap.total > limit()!}>
            <text fg="#ef9273" marginTop={1}>Estimate exceeds the model window; map is saturated.</text>
          </Show>
          <box flexDirection="column" marginTop={1}>
            <text fg={props.muted}>Last captured request · o200k_base estimate; categories are not rescaled.</text>
            <Show when={summary()?.reported}><text fg={props.muted}>OpenCode usage includes output and reasoning. Differences are not necessarily overhead.</text></Show>
            <For each={snap.notes}>{(note) => <text fg="#ef9273">{note}</text>}</For>
          </box>
        </Show>}
      </Show>
    </scrollbox>
    <box flexDirection={width() >= 72 ? "row" : "column"} justifyContent="space-between"
      gap={width() >= 72 ? 0 : 1} marginTop={1} flexShrink={0}>
      <text fg={props.muted}>{entry() ? "↑↓ scroll · esc back" : "↑↓ select · enter inspect"}</text>
      <box flexDirection="row" gap={2} justifyContent="space-between">
        <Show when={props.onCycleSymbols}>
          <text fg="#e5b567" onMouseUp={(event) => {
            if (event.button !== MouseButton.LEFT) return;
            event.stopPropagation();
            props.onCycleSymbols?.();
          }}>{`[s Symbols: ${symbolLabel()}]`}</text>
        </Show>
        <text fg="#e5b567" onMouseDown={props.onRefresh}>{props.loading ? "loading…" : "r refresh"}</text>
      </box>
    </box>
  </box>;
}

export function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return Math.round(value).toLocaleString("en-US");
}

function safeText(text: string): string {
  // Render literal text; control sequences from tool output must not reach a terminal.
  return text.replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, "");
}

function shortName(name: string, width: number): string {
  return name.length > width ? `…${name.slice(-(width - 1))}` : name;
}

function sourcePreview(entry: Entry): string {
  if (!entry.truncated && (entry.category === "tools" || entry.category === "mcp")) {
    try {
      const definition: unknown = JSON.parse(entry.preview);
      if (definition && typeof definition === "object" && "description" in definition &&
        typeof definition.description === "string" && "input" in definition) {
        return safeText(`${definition.description}\n\nInput schema\n${JSON.stringify(definition.input, null, 2)}`);
      }
    } catch { /* Code Mode signatures are already readable text. */ }
  }
  return safeText(entry.preview);
}
