/** @jsxImportSource solid-js */
import { afterEach, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as solid from "solid-js";
import * as web from "solid-js/web";
import * as host from "@opencode/plugin/gui";
import * as rpc from "@opencode/plugin/rpc";
import * as effect from "effect";
import { render } from "solid-js/web";
import { createSignal } from "solid-js";
import type { Context, MountedSession, Panel as PanelType } from "@opencode/plugin/gui";
import plugin from "../../src/gui.tsx";

vi.mock("@opencode/plugin/gui", () => ({
  Plugin: { define: (value: unknown) => value },
  Command: "command", Panel: "panel", MenuItem: "menu", Style: "style", Slot: "slot",
  Store: { global: (schema: unknown, initial: unknown) => ({ scope: 'global', schema, initial }) },
}));

const snapshot = {
  capturedAt: 1, model: "test/model", total: 10, notes: ["Images are not counted."],
  entries: [{ id: "rule", category: "rules", name: "AGENTS.md", tokens: 10,
    bytes: 32, preview: '<script>alert("unsafe")</script>', truncated: true }],
};
let dispose: (() => void) | undefined;
afterEach(() => { dispose?.(); document.body.replaceChildren(); });

test.each(["source", "bundle"])("Desktop (%s) opens Atlas locally and inspects captured sources as text", async (entry) => {
  const modules: Record<string, unknown> = {
    "solid-js": solid, "solid-js/web": web, "@opencode/plugin/gui": host, "@opencode/plugin/rpc": rpc, effect,
  };
  const exports: { default?: typeof plugin } = {};
  if (entry === "bundle") runInNewContext(readFileSync("dist/gui-experimental.cjs", "utf8"), {
    exports, AbortController, AbortSignal,
    require: (name: string) => {
      if (!(name in modules)) throw new Error(`Unexpected bundled dependency: ${name}`);
      return modules[name];
    },
  });
  const definition = entry === "bundle" ? exports.default! : plugin;
  const contributions = new Map<string, any[]>();
  const report = vi.fn().mockResolvedValue({ sessionID: "a", snapshot, limit: 100 });
  const client = { rpc: () => ({ report }) };
  const location = { directory: "/project" };
  const session = { key: "server\na", id: "a", location, server: {
    client, connected: true, data: { session: { message: { list: () => [] } } },
  } } as unknown as MountedSession;
  const open = vi.fn();
  const [appearance, setAppearance] = createSignal({ symbols: 'nerd-font', headerIndicator: false });
  const context = {
    id: "context-atlas.server", signal: new AbortController().signal,
    add: (key: string, value: unknown) => contributions.set(key, [...contributions.get(key) ?? [], value]),
    sessions: { current: () => session }, layout: { open },
    appearance: { font: () => 'monospace' },
    stores: { appearance: { get value() { return appearance(); }, update: (mutate: (draft: { symbols: string; headerIndicator: boolean }) => void) => {
      const draft = { ...appearance() }; mutate(draft); setAppearance(draft);
    } } },
  } as unknown as Context;
  definition.setup!(context as any);
  const commands = contributions.get("command") ?? [];
  expect(commands.map((command) => command.slash?.name)).toEqual(["context", "atlas"]);
  commands[0].run();
  expect(open).toHaveBeenCalledWith("context-atlas.server:atlas", session);
  const panel = contributions.get("panel")![0] as PanelType;
  expect(panel.list({ open: ["atlas"], session } as any)[0].title).toBe("Context Atlas");
  const [current, setCurrent] = createSignal(session);
  const root = document.createElement("div");
  document.body.append(root);
  dispose = render(() => panel.render({ get session() { return current(); } } as any), root);
  await vi.waitFor(() => expect(root.textContent).toContain("10 estimated tokens"));
  expect(report.mock.calls[0][1].location).toEqual(location);
  const click = (text: string) => {
    const button = [...root.querySelectorAll("button")].find((button) => button.textContent?.includes(text));
    expect(button, text).toBeTruthy();
    button!.click();
  };
  expect(root.textContent).toContain('Symbols: Nerd Font');
  expect(root.querySelector('.atlas-map button:not([disabled])')?.textContent).toBe('\uf0f6');
  click('Symbols: Nerd Font');
  expect(root.textContent).toContain('Symbols: Blocks');
  expect(root.querySelector('.atlas-map button:not([disabled])')?.textContent).toBe('');
  click('Symbols: Blocks');
  expect(root.textContent).toContain('Symbols: Unicode');
  expect(root.querySelector('.atlas-map button:not([disabled])')?.textContent).toBe('≡');
  expect(root.querySelector('.atlas-categories button:nth-child(2) span')?.textContent).toBe('≡');
  root.querySelector('.context-atlas')!.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true }));
  expect(root.textContent).toContain('Symbols: Nerd Font');
  click('Symbols: Nerd Font');
  click('Symbols: Blocks');
  expect(appearance().symbols).toBe('unicode');
  expect(report).toHaveBeenCalledTimes(1);
  click("Rules & memory");
  click("AGENTS.md");
  expect(document.activeElement).toBe(root.querySelector('.context-atlas'));
  expect(root.querySelector("pre")?.textContent).toBe(snapshot.entries[0].preview);
  expect(root.querySelector("script")).toBeNull();
  expect(root.textContent).toContain("Preview truncated");
  expect(root.textContent).toContain("Images are not counted.");
  document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  expect(root.querySelector("pre")).toBeNull();
  expect(root.textContent).toContain("AGENTS.md");
  // A different server may reuse the same session id. Never show the old server's preview.
  let resolve!: (value: unknown) => void;
  const remoteReport = vi.fn(() => new Promise((done) => { resolve = done; }));
  setCurrent({ ...session, key: "remote\na", server: { ...session.server,
    client: { rpc: () => ({ report: remoteReport }) } as any } });
  await vi.waitFor(() => expect(remoteReport).toHaveBeenCalledOnce());
  expect(root.textContent).not.toContain("AGENTS.md");
  expect(report.mock.calls[0][1].signal.aborted).toBe(true);
  resolve({ sessionID: "a", snapshot: null, limit: null });
  await vi.waitFor(() => expect(root.textContent).toContain("No captured request"));
  report.mockResolvedValue({ sessionID: "b", snapshot: null, limit: null });
  setCurrent({ ...session, key: "server\nb", id: "b" });
  await vi.waitFor(() => expect(root.textContent).toContain("No captured request"));
  expect(root.textContent).not.toContain(snapshot.entries[0].preview);
  report.mockRejectedValue(new Error("private transport details"));
  click("Refresh");
  await vi.waitFor(() => expect(root.textContent).toContain("Context unavailable"));
  expect(root.textContent).not.toContain("private transport details");
  report.mockResolvedValue({ sessionID: "wrong-session", snapshot, limit: 100 });
  click("Refresh");
  await vi.waitFor(() => expect(report).toHaveBeenCalledTimes(4));
  await vi.waitFor(() => expect(root.textContent).toContain("Context unavailable"));
  expect(root.textContent).not.toContain("AGENTS.md");
  dispose();
  dispose = undefined;
  expect(report.mock.calls.at(-1)![1].signal.aborted).toBe(true);
  report.mockResolvedValue({ sessionID: 'a', snapshot, limit: 100 });
  dispose = render(() => panel.render({ session } as any), root);
  expect(root.textContent).toContain('Symbols: Unicode');
  await vi.waitFor(() => expect(root.textContent).toContain('10 estimated tokens'));
  expect(definition.stores?.appearance.initial.headerIndicator).toBe(false);
  const header = contributions.get('slot')?.find(slot => slot.at === 'session.header');
  expect(header).toBeTruthy();
  const headerRoot = document.createElement('div');
  document.body.append(headerRoot);
  const [active, setActive] = createSignal(true);
  const [headerSession, setHeaderSession] = createSignal(session);
  const panelDispose = dispose;
  const headerDispose = render(() => header.render({ get session() { return headerSession(); }, get active() { return active(); } }), headerRoot);
  dispose = () => { panelDispose(); headerDispose(); };
  const requests = report.mock.calls.length;
  expect(headerRoot.textContent).toBe('');
  expect(report).toHaveBeenCalledTimes(requests);
  click('Header indicator: Off');
  await vi.waitFor(() => expect(headerRoot.textContent).toBe('Atlas · 10%'));
  expect(appearance().headerIndicator).toBe(true);
  expect(headerRoot.querySelector('.atlas-header-map')).toBeNull();
  expect(headerRoot.querySelector('.atlas-header-progress')?.getAttribute('stroke-dasharray')).toBe('10 100');
  headerRoot.querySelector('button')!.click();
  expect(open).toHaveBeenLastCalledWith('context-atlas.server:atlas', session);
  click('Symbols: Unicode');
  expect(headerRoot.textContent).toBe('Atlas · 10%');
  setActive(false);
  expect(headerRoot.textContent).toBe('');
  expect(report.mock.calls.at(-1)![1].signal.aborted).toBe(true);
  report.mockResolvedValue({ sessionID: 'b', snapshot: null, limit: null });
  setHeaderSession({ ...session, key: 'server\nb', id: 'b' });
  setActive(true);
  await vi.waitFor(() => expect(headerRoot.textContent).toBe('Atlas · —'));
  expect(headerRoot.querySelector('svg')).toBeNull();
  setActive(false);
  report.mockResolvedValue({ sessionID: 'b', snapshot, limit: null });
  setActive(true);
  await vi.waitFor(() => expect(headerRoot.textContent).toBe('Atlas · —'));
  expect(headerRoot.querySelector('svg')).toBeNull();
  setActive(false);
  report.mockResolvedValue({ sessionID: 'b', snapshot, limit: 5 });
  setActive(true);
  await vi.waitFor(() => expect(headerRoot.textContent).toBe('Atlas · 200%'));
  expect(headerRoot.querySelector('.atlas-header-progress')?.getAttribute('stroke-dasharray')).toBe('100 100');
  click('Header indicator: On');
  expect(headerRoot.textContent).toBe('');
  expect(appearance().headerIndicator).toBe(false);
});
