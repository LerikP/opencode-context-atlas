import assert from "node:assert/strict";
import { test } from "node:test";
import { testRender, type JSX } from "@opentui/solid";
import { createSignal } from "solid-js";
import type { Context, KeymapCommand, SlotClaim } from "@opencode/plugin/tui/context";
import tui from "../src/tui.tsx";

test("/context opens the current session overlay without sending a model prompt", async () => {
  const slots: SlotClaim[] = [];
  let commands: readonly KeymapCommand[] = [];
  let sessionRead: string | undefined;
  const [dialog, setDialog] = createSignal<(() => JSX.Element) | null>(null);
  const host = {
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
  } finally {
    screen.renderer.destroy();
    await cleanup?.();
  }
});

test("switching sessions never displays the previous session's snapshot while RPC is pending", async () => {
  const slots: SlotClaim[] = [];
  const [sessionID, switchSession] = createSignal("first");
  const host = {
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
