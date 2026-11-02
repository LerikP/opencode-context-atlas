import assert from "node:assert/strict";
import { test } from "node:test";
import { testRender, type JSX } from "@opentui/solid";
import { createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type { Context, KeymapCommand, SlotClaim } from "@opencode/plugin/tui/context";
import tui from "../src/tui.tsx";
import compiledTui from "../dist/tui.js";

// The host owns durable storage. Preserve JSON between plugin instances while
// exercising real Solid reactivity rather than mocking the preference reader.
function storageFixture(persisted = new Map<string, object>()) {
  return {
    store<Value extends object>(key: string, options: { initial: Value }) {
      const [state, setState] = createStore((persisted.get(key) ?? options.initial) as Value);
      return [state, async (mutation: (draft: Value) => void) => {
        setState(produce(mutation));
        persisted.set(key, JSON.parse(JSON.stringify(state)));
      }] as const;
    },
  };
}

test("/context opens the current session overlay without sending a model prompt", async () => {
  const slots: SlotClaim[] = [];
  let commands: readonly KeymapCommand[] = [];
  let sessionRead: string | undefined;
  const [dialog, setDialog] = createSignal<(() => JSX.Element) | null>(null);
  const host = {
    storage: storageFixture(),
    options: {}, theme: { text: { base: "#eeeeee", muted: "#999999" }, background: { base: "#15151a" } },
    client: { rpc: () => ({ report: async ({ sessionID }: { sessionID: string }) => {
      sessionRead = sessionID;
      return { sessionID, limit: 200000, snapshot: null };
    } }) },
    data: { session: { message: { list: () => [] }, get: () => undefined } },
    keymap: { layer: (read: () => { commands: KeymapCommand[] }) => { commands = read().commands; } },
    ui: {
      slot: (slot: SlotClaim) => { slots.push(slot); return () => {}; },
      router: { current: () => ({ type: "session", sessionID: "current-session" }) },
      dialog: { set: () => {}, show: (render: () => JSX.Element) => setDialog(() => render), clear: () => setDialog(null) },
      toast: { show: () => {} },
    },
  } as unknown as Context;
  const cleanup = await tui.setup(host);
  const screen = await testRender(() => <box flexDirection="column">
    {slots.filter((slot) => slot.append === "app").map((slot) => slot.render({ sessionID: "current-session" } as never))}
    {dialog()?.()}
  </box>, { width: 100, height: 35 });
  try {
    await screen.renderOnce();
    const command = commands.find((command) => command.slash?.name === "context");
    assert.ok(command, "the /context command must be discoverable");
    await command.run();
    await screen.renderOnce();
    await screen.renderOnce();
    assert.equal(sessionRead, "current-session");
    assert.ok(screen.captureCharFrame().includes("Context Atlas"));
    assert.ok(screen.captureCharFrame().includes("No request captured"));
    assert.ok(screen.captureCharFrame().includes("Symbols: Nerd Font"), "a fresh install defaults to Nerd Font");
  } finally {
    screen.renderer.destroy();
    await cleanup?.();
  }
});

test("switching sessions never displays the previous session's snapshot while RPC is pending", async () => {
  const slots: SlotClaim[] = [];
  const [sessionID, switchSession] = createSignal("first");
  const host = {
    storage: storageFixture(),
    options: {}, theme: { text: { base: "#eeeeee", muted: "#999999" } },
    client: { rpc: () => ({ report: async ({ sessionID }: { sessionID: string }) => {
      if (sessionID === "second") return new Promise(() => {});
      return { sessionID, limit: 100000, snapshot: { model: "test/model", capturedAt: 0, total: 12345, notes: [], entries: [] } };
    } }) },
    data: { session: { message: { list: () => [] } } },
    ui: { slot: (slot: SlotClaim) => { slots.push(slot); return () => {}; } },
  } as unknown as Context;
  const cleanup = await tui.setup(host);
  const screen = await testRender(() => <box flexDirection="column">
    {slots.filter((slot) => slot.prepend === "sidebar.content").map((slot) => slot.render({ get sessionID() { return sessionID(); } } as never))}
  </box>, { width: 40, height: 10 });
  try {
    await screen.renderOnce();
    await screen.renderOnce();
    assert.ok(screen.captureCharFrame().includes("12.3k"));
    switchSession("second");
    await screen.renderOnce();
    assert.ok(!screen.captureCharFrame().includes("12.3k"), "old session usage must not leak into another sidebar");
  } finally { screen.renderer.destroy(); await cleanup?.(); }
});

test("Atlas opens on left-button release and remains open after a complete click", async () => {
  const slots: SlotClaim[] = [];
  const [dialog, setDialog] = createSignal<(() => JSX.Element) | null>(null);
  let onClose: (() => void) | undefined;
  const close = () => { onClose?.(); setDialog(null); };
  const host = {
    storage: storageFixture(),
    options: {}, theme: { text: { base: "#eeeeee", muted: "#999999" }, background: { base: "#15151a" } },
    client: { rpc: () => ({ report: async ({ sessionID }: { sessionID: string }) => ({ sessionID, limit: 200000, snapshot: null }) }) },
    data: { session: { message: { list: () => [] } } },
    keymap: { layer: () => {} },
    ui: {
      slot: (slot: SlotClaim) => { slots.push(slot); return () => {}; },
      dialog: { set: () => {}, show: (render: () => JSX.Element, callback: () => void) => {
        onClose = callback;
        setDialog(() => render);
      }, clear: close },
    },
  } as unknown as Context;
  const cleanup = await tui.setup(host);
  const screen = await testRender(() => <box width="100%" height="100%">
    <box width={25} flexDirection="column">
      {slots.filter((slot) => slot.prepend === "sidebar.content").map((slot) => slot.render({ sessionID: "current-session" } as never))}
    </box>
    {dialog() && <box position="absolute" width="100%" height="100%" onMouseUp={close}>
      <box position="absolute" left={28} top={2} width={70} onMouseUp={(event) => event.stopPropagation()}>
        {dialog()?.()}
      </box>
    </box>}
  </box>, { width: 100, height: 35 });
  try {
    await screen.renderOnce();
    const lines = screen.captureCharFrame().split("\n");
    const row = lines.findIndex((line) => line.includes("Atlas ↗"));
    assert.ok(row >= 0);
    const column = lines[row].indexOf("Atlas ↗");
    await screen.mockMouse.pressDown(column, row);
    await screen.renderOnce();
    assert.equal(dialog(), null, "holding the button must not open an overlay under the pointer");
    await screen.mockMouse.release(column, row);
    await screen.renderOnce();
    assert.ok(screen.captureCharFrame().includes("Context Atlas"), "releasing the button opens a persistent dialog");
    close();
    await screen.renderOnce();
    await screen.mockMouse.click(column, row, 2);
    await screen.renderOnce();
    assert.equal(dialog(), null, "right-click must not open Atlas");
  } finally { screen.renderer.destroy(); await cleanup?.(); }
});

for (const [mode, ruleSymbol, toolSymbol] of [
  ["unicode", "≡", "⌘"],
  ["nerd-font", "\uf0f6", "\uf0ad"],
]) {
  test(`the ${mode} option reaches the sidebar, map and legend without changing usage`, async () => {
    const slots: SlotClaim[] = [];
    let commands: readonly KeymapCommand[] = [];
    const [dialog, setDialog] = createSignal<(() => JSX.Element) | null>(null);
    const host = {
      storage: storageFixture(),
      options: { symbols: mode },
      theme: { text: { base: "#eeeeee", muted: "#999999" }, background: { base: "#15151a" } },
      client: { rpc: () => ({ report: async ({ sessionID }: { sessionID: string }) => ({
        sessionID, limit: 200000, snapshot: { model: "test/model", capturedAt: 0, total: 30000, notes: [], entries: [
          { id: "rules", category: "rules", name: "AGENTS.md", tokens: 10000, bytes: 10, preview: "Rule text", truncated: false },
          { id: "tools", category: "tools", name: "read", tokens: 20000, bytes: 10, preview: "Tool text", truncated: false },
        ] },
      }) }) },
      data: { session: { message: { list: () => [] } } },
      keymap: { layer: (read: () => { commands: KeymapCommand[] }) => { commands = read().commands; } },
      ui: {
        slot: (slot: SlotClaim) => { slots.push(slot); return () => {}; },
        router: { current: () => ({ type: "session", sessionID: "demo" }) },
        dialog: { set: () => {}, show: (render: () => JSX.Element) => setDialog(() => render), clear: () => setDialog(null) },
      },
    } as unknown as Context;
    const cleanup = await tui.setup(host);
    const screen = await testRender(() => <box flexDirection="column">
      <box width={25} flexDirection="column">
        {slots.map((slot) => slot.render({ sessionID: "demo" } as never))}
      </box>
      {dialog()?.()}
    </box>, { width: 100, height: 40 });
    try {
      await screen.renderOnce();
      await screen.renderOnce();
      const sidebar = screen.captureCharFrame();
      assert.ok(sidebar.includes(ruleSymbol), `${mode} rule symbol must be visible in the sidebar`);
      assert.ok(sidebar.includes(toolSymbol), "sidebar tool symbol");
      assert.ok(sidebar.includes("30.0k tokens"), "sidebar usage");
      await commands.find((command) => command.slash?.name === "context")!.run();
      await screen.renderOnce();
      await screen.renderOnce();
      const frame = screen.captureCharFrame();
      assert.ok(frame.includes(`${ruleSymbol} ${ruleSymbol}`), "the map uses category symbols");
      assert.ok(frame.includes(`${ruleSymbol} Rules & memory`), "the selected legend row retains its symbol");
      assert.ok(frame.includes(`${toolSymbol} Tool definitions`), "legend tool symbol");
      assert.ok(frame.includes("15.0% estimated"), "window usage");
      screen.resize(50, 30);
      await screen.flush();
      assert.ok(screen.captureCharFrame().includes("r refresh"), `narrow footer:\n${screen.captureCharFrame()}`);
      screen.mockInput.pressEnter();
      await screen.renderOnce();
      assert.ok(screen.captureCharFrame().includes("AGENTS.md"), "symbols do not break category navigation");
    } finally { screen.renderer.destroy(); await cleanup?.(); }
  });
}

test("Symbols button and s cycle the shared mode and restore the choice in a new plugin instance", async () => {
  const persisted = new Map<string, object>();
  const mount = async () => {
    const slots: SlotClaim[] = [];
    let commands: readonly KeymapCommand[] = [];
    const [dialog, setDialog] = createSignal<(() => JSX.Element) | null>(null);
    const host = {
      options: { symbols: "blocks" }, storage: storageFixture(persisted),
      theme: { text: { base: "#eeeeee", muted: "#999999" }, background: { base: "#15151a" } },
      client: { rpc: () => ({ report: async ({ sessionID }: { sessionID: string }) => ({
        sessionID, limit: 100000, snapshot: { model: "test/model", capturedAt: 0, total: 20000, notes: [], entries: [
          { id: "rules", category: "rules", name: "AGENTS.md", tokens: 20000, bytes: 10, preview: "Rules", truncated: false },
        ] },
      }) }) },
      data: { session: { message: { list: () => [] } } },
      keymap: { layer: (read: () => { commands: KeymapCommand[] }) => { commands = read().commands; } },
      ui: {
        slot: (slot: SlotClaim) => { slots.push(slot); return () => {}; },
        router: { current: () => ({ type: "session", sessionID: "demo" }) },
        dialog: { set: () => {}, show: (render: () => JSX.Element) => setDialog(() => render), clear: () => setDialog(null) },
      },
    } as unknown as Context;
    const cleanup = await tui.setup(host);
    const screen = await testRender(() => <box flexDirection="column">
      <box width={25} flexDirection="column">{slots.map((slot) => slot.render({ sessionID: "demo" } as never))}</box>
      {dialog()?.()}
    </box>, { width: 100, height: 40 });
    await screen.renderOnce();
    await commands.find((command) => command.slash?.name === "context")!.run();
    await screen.renderOnce();
    await screen.renderOnce();
    return { ...screen, close: async () => { screen.renderer.destroy(); await cleanup?.(); } };
  };
  const screen = await mount();
  try {
    const lines = screen.captureCharFrame().split("\n");
    const row = lines.findIndex((line) => line.includes("Symbols: Blocks"));
    assert.ok(row >= 0, "the current mode is shown on a discoverable button");
    const column = lines[row].indexOf("Symbols:");
    await screen.mockMouse.pressDown(column, row);
    await screen.renderOnce();
    assert.ok(screen.captureCharFrame().includes("Symbols: Blocks"));
    await screen.mockMouse.release(column, row);
    await screen.renderOnce();
    assert.ok(screen.captureCharFrame().includes("Symbols: Unicode"), `mouse switch:\n${screen.captureCharFrame()}`);
    assert.ok(screen.captureCharFrame().split("\n")[1].includes("≡"), "sidebar changes with the overlay");
    screen.mockInput.pressKey("s");
    await screen.renderOnce();
    assert.ok(screen.captureCharFrame().includes("Symbols: Nerd Font"), `keyboard switch:\n${screen.captureCharFrame()}`);
    assert.ok(screen.captureCharFrame().split("\n")[1].includes("\uf0f6"));
    screen.resize(50, 30);
    await screen.flush();
    assert.ok(screen.captureCharFrame().includes("Symbols: Nerd Font"), `narrow symbols:\n${screen.captureCharFrame()}`);
    assert.ok(screen.captureCharFrame().includes("r refresh"), `narrow refresh:\n${screen.captureCharFrame()}`);
    screen.mockInput.pressKey("s");
    await screen.renderOnce();
    assert.ok(screen.captureCharFrame().includes("Symbols: Blocks"));
    screen.mockInput.pressKey("s");
    await screen.renderOnce();
    assert.ok(screen.captureCharFrame().includes("Symbols: Unicode"));
  } finally { await screen.close(); }

  const reopened = await mount();
  try {
    assert.ok(reopened.captureCharFrame().includes("Symbols: Unicode"), "UI choice overrides the configured default after reopening");
    assert.ok(reopened.captureCharFrame().split("\n")[1].includes("≡"));
  } finally { await reopened.close(); }
});

test("report requests are scoped to the session location", async () => {
  const slots: SlotClaim[] = [];
  let seen: { signal?: AbortSignal; location?: unknown } | undefined;
  const host = {
    storage: storageFixture(), options: {},
    theme: { text: { base: "#eeeeee", muted: "#999999" }, background: { base: "#15151a" } },
    client: { rpc: () => ({ report: async ({ sessionID }: { sessionID: string }, options?: { signal?: AbortSignal; location?: unknown }) => {
      seen = options;
      return { sessionID, limit: 200000, snapshot: null };
    } }) },
    data: { session: {
      message: { list: () => [] },
      get: () => ({ location: { directory: "/workspace/other", workspaceID: "ws-1" } }),
    } },
    ui: { slot: (slot: SlotClaim) => { slots.push(slot); return () => {}; } },
  } as unknown as Context;
  const cleanup = await tui.setup(host);
  const screen = await testRender(() => <box flexDirection="column">
    {slots.filter((slot) => slot.prepend === "sidebar.content").map((slot) => slot.render({ sessionID: "demo" } as never))}
  </box>, { width: 40, height: 10 });
  try {
    await screen.renderOnce();
    await screen.renderOnce();
    assert.deepEqual(seen?.location, { directory: "/workspace/other", workspaceID: "ws-1" },
      "the RPC must not fall back to the server's default location");
  } finally { screen.renderer.destroy(); await cleanup?.(); }
});

test("streaming deltas do not restart the report request", async () => {
  const slots: SlotClaim[] = [];
  const [messages, setMessages] = createSignal<readonly { id: string; type: "assistant"; time: { completed?: number }; text: string }[]>([
    { id: "msg-1", type: "assistant", time: { completed: undefined }, text: "a" },
  ]);
  let calls = 0;
  const host = {
    storage: storageFixture(), options: {},
    theme: { text: { base: "#eeeeee", muted: "#999999" }, background: { base: "#15151a" } },
    client: { rpc: () => ({ report: async ({ sessionID }: { sessionID: string }) => {
      calls += 1;
      return { sessionID, limit: 200000, snapshot: null };
    } }) },
    data: { session: {
      message: { list: () => messages() },
      get: () => ({ location: { directory: "/workspace" } }),
    } },
    ui: { slot: (slot: SlotClaim) => { slots.push(slot); return () => {}; } },
  } as unknown as Context;
  const cleanup = await tui.setup(host);
  const screen = await testRender(() => <box flexDirection="column">
    {slots.filter((slot) => slot.prepend === "sidebar.content").map((slot) => slot.render({ sessionID: "demo" } as never))}
  </box>, { width: 40, height: 10 });
  try {
    await screen.renderOnce();
    await screen.renderOnce();
    assert.equal(calls, 1);
    for (const text of ["ab", "abc", "abcd"]) {
      setMessages([{ id: "msg-1", type: "assistant", time: { completed: undefined }, text }]);
      await screen.renderOnce();
    }
    assert.equal(calls, 1, "message object churn during streaming must not abort and refetch");
    setMessages([{ id: "msg-1", type: "assistant", time: { completed: 1000 }, text: "abcd" }]);
    await screen.renderOnce();
    await screen.renderOnce();
    assert.equal(calls, 2, "a completed message is a new request boundary");
  } finally { screen.renderer.destroy(); await cleanup?.(); }
});

test("the compiled sidebar reacts without the JSX transform", async () => {
  // OpenCode loads node_modules TUI sources without Solid's compiler. dist/ is
  // precompiled so accessors still exist; this guards the shipped artifact.
  const slots: SlotClaim[] = [];
  let resolve!: (value: unknown) => void;
  const pending = new Promise((done) => { resolve = done; });
  const host = {
    storage: storageFixture(), options: {},
    theme: { text: { base: "#eeeeee", muted: "#999999" }, background: { base: "#15151a" } },
    client: { rpc: () => ({ report: () => pending }) },
    data: { session: { message: { list: () => [] }, get: () => ({ location: { directory: "/workspace" } }) } },
    ui: { slot: (slot: SlotClaim) => { slots.push(slot); return () => {}; } },
  } as unknown as Context;
  const cleanup = await compiledTui.setup(host);
  const screen = await testRender(() => <box flexDirection="column">
    {slots.filter((slot) => slot.prepend === "sidebar.content").map((slot) => slot.render({ sessionID: "demo" } as never))}
  </box>, { width: 40, height: 10 });
  try {
    await screen.renderOnce();
    assert.ok(screen.captureCharFrame().includes("Loading context…"));
    resolve({ sessionID: "demo", limit: 100000, snapshot: { model: "m", capturedAt: 0, total: 12345, notes: [], entries: [] } });
    await Promise.resolve();
    await screen.renderOnce();
    assert.ok(screen.captureCharFrame().includes("~12.3k tokens"), "the compiled label must update after the report resolves");
  } finally { screen.renderer.destroy(); await cleanup?.(); }
});

test("the compiled overlay reacts to a resolved report", async () => {
  const slots: SlotClaim[] = [];
  let commands: readonly KeymapCommand[] = [];
  let resolve!: (value: unknown) => void;
  const pending = new Promise((done) => { resolve = done; });
  const [dialog, setDialog] = createSignal<(() => JSX.Element) | null>(null);
  const host = {
    storage: storageFixture(), options: {},
    theme: { text: { base: "#eeeeee", muted: "#999999" }, background: { base: "#15151a" } },
    client: { rpc: () => ({ report: () => pending }) },
    data: { session: { message: { list: () => [] }, get: () => ({ location: { directory: "/workspace" } }) } },
    keymap: { layer: (read: () => { commands: KeymapCommand[] }) => { commands = read().commands; } },
    ui: {
      slot: (slot: SlotClaim) => { slots.push(slot); return () => {}; },
      router: { current: () => ({ type: "session", sessionID: "current-session" }) },
      dialog: { set: () => {}, show: (render: () => JSX.Element) => setDialog(() => render), clear: () => setDialog(null) },
      toast: { show: () => {} },
    },
  } as unknown as Context;
  const cleanup = await compiledTui.setup(host);
  const screen = await testRender(() => <box flexDirection="column">
    {slots.filter((slot) => slot.append === "app").map((slot) => slot.render({ sessionID: "current-session" } as never))}
    {dialog()?.()}
  </box>, { width: 100, height: 35 });
  try {
    await screen.renderOnce();
    await commands.find((command) => command.slash?.name === "context")!.run();
    await screen.renderOnce();
    assert.ok(screen.captureCharFrame().includes("Context Atlas"));
    resolve({ sessionID: "current-session", limit: 100000, snapshot: {
      model: "test/model", capturedAt: 0, total: 12345, notes: [],
      entries: [{ id: "rules", category: "rules", name: "AGENTS.md", tokens: 12345, bytes: 10, preview: "Rules", truncated: false }],
    } });
    await Promise.resolve();
    await screen.renderOnce();
    const frame = screen.captureCharFrame();
    assert.ok(frame.includes("~12.3k / 100.0k tokens"), "the compiled overlay must show the resolved snapshot");
    assert.ok(frame.includes("Last captured request"));
  } finally { screen.renderer.destroy(); await cleanup?.(); }
});
