import { effect as _$effect } from "@opentui/solid";
import { memo as _$memo } from "@opentui/solid";
import { insert as _$insert } from "@opentui/solid";
import { createTextNode as _$createTextNode } from "@opentui/solid";
import { insertNode as _$insertNode } from "@opentui/solid";
import { setProp as _$setProp } from "@opentui/solid";
import { createElement as _$createElement } from "@opentui/solid";
import { createComponent as _$createComponent } from "@opentui/solid";
/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui";
import { MouseButton } from "@opentui/core";
import { For, Show, createMemo, createResource, onCleanup } from "solid-js";
import { atlasRpc } from "../src/rpc.ts";
import { categories, reportSchema } from "../src/report.ts";
import { cellSymbol, windowMap } from "../src/map.ts";
import { AtlasView, formatTokens } from "./view.js";
import { useUsage, usageSummary } from "../src/usage.ts";
export default Plugin.define({
  id: "context-atlas.tui",
  setup(context) {
    const [appearance, saveAppearance] = context.storage.store("appearance", {
      initial: {
        symbols: null
      }
    });
    const symbols = () => {
      const value = appearance.symbols ?? context.options.symbols ?? "nerd-font";
      return value === "unicode" || value === "nerd-font" ? value : "blocks";
    };
    const cycleSymbols = () => {
      void saveAppearance(draft => {
        const value = draft.symbols ?? context.options.symbols ?? "nerd-font";
        draft.symbols = value === "unicode" ? "nerd-font" : value === "nerd-font" ? "blocks" : "unicode";
      }).catch(() => context.ui.toast.show({
        message: "Could not save the symbol preference. Try again.",
        variant: "error"
      }));
    };
    let opened = false;
    const open = sessionID => {
      if (opened) return;
      opened = true;
      context.ui.dialog.show(() => _$createComponent(Dialog, {
        context: context,
        sessionID: sessionID,
        get symbols() {
          return symbols();
        },
        onCycleSymbols: cycleSymbols
      }), () => {
        opened = false;
      });
      // show() replaces the host dialog and resets its presentation defaults.
      context.ui.dialog.set({
        size: "large",
        centered: true
      });
    };
    const stopSidebar = context.ui.slot({
      prepend: "sidebar.content",
      render: input => _$createComponent(Indicator, {
        context: context,
        get sessionID() {
          return input.sessionID;
        },
        get symbols() {
          return symbols();
        },
        onOpen: () => open(input.sessionID)
      })
    });
    const stopCommand = context.ui.slot({
      append: "app",
      render: () => {
        context.keymap.layer(() => ({
          mode: "global",
          commands: [{
            id: "context-atlas.open",
            title: "Inspect context · Atlas",
            group: "Context Atlas",
            description: "Show the context map and inspect skills, rules, tools and MCP",
            slash: {
              name: "context",
              aliases: ["atlas"]
            },
            palette: true,
            run: () => {
              const route = context.ui.router.current();
              if (route.type === "session") open(route.sessionID);else context.ui.toast.show({
                message: "Open a session to inspect its context.",
                variant: "info"
              });
            }
          }]
        }));
        return null;
      }
    });
    return () => {
      stopSidebar();
      stopCommand();
    };
  }
});
function useReport(context, sessionID) {
  const rpc = context.client.rpc(atlasRpc);
  let pending;
  onCleanup(() => pending?.abort());
  // Streaming updates replace the message object on every delta. Refetch only when
  // the request boundary moves, otherwise every delta aborts and restarts the RPC.
  const trigger = createMemo(() => {
    const messages = context.data.session.message.list(sessionID());
    const last = messages.at(-1);
    const location = context.data.session.get(sessionID())?.location;
    return {
      sessionID: sessionID(),
      location: location ? {
        ...location
      } : undefined,
      last: last?.id,
      completed: last?.type === "assistant" ? last.time.completed : undefined
    };
  }, undefined, {
    equals: (a, b) => a.sessionID === b.sessionID && a.last === b.last && a.completed === b.completed && a.location?.directory === b.location?.directory
  });
  const [report, {
    refetch
  }] = createResource(trigger, async input => {
    pending?.abort();
    const {
      sessionID,
      location
    } = input;
    if (!location) return null;
    pending = new AbortController();
    const signal = AbortSignal.any([pending.signal, AbortSignal.timeout(5000)]);
    // Plugin RPC calls default to the server's own location, which has a separate
    // snapshot cache. Scope the call to the session's location to read its captures.
    const result = reportSchema.parse(await rpc.report({
      sessionID
    }, {
      signal,
      location
    }));
    if (result.sessionID !== sessionID) throw new Error("Unexpected session");
    return {
      input,
      report: result
    };
  });
  return {
    report: () => {
      if (report.error) return null;
      const value = report.latest;
      const input = trigger();
      return value?.input.sessionID === input.sessionID && value.input.location?.directory === input.location?.directory ? value.report : null;
    },
    loading: () => report.loading,
    error: () => report.error ? "Context unavailable. Enable the Atlas server plugin and press r to retry." : null,
    refresh: () => {
      void refetch();
    }
  };
}
function Dialog(props) {
  const state = useReport(props.context, () => props.sessionID);
  const observed = useUsage(() => props.context.data, () => props.sessionID, () => props.context.data.session.get(props.sessionID)?.location ?? props.context.location);
  return _$createComponent(AtlasView, {
    get report() {
      return state.report();
    },
    get loading() {
      return state.loading();
    },
    get error() {
      return state.error();
    },
    get symbols() {
      return props.symbols;
    },
    get onCycleSymbols() {
      return props.onCycleSymbols;
    },
    get usage() {
      return observed.usage();
    },
    get foreground() {
      return props.context.theme.text.base;
    },
    get muted() {
      return props.context.theme.text.muted;
    },
    get background() {
      return props.context.theme.background.base;
    },
    registerBack: back => props.context.keymap.layer(() => ({
      mode: "modal",
      priority: 100,
      commands: [{
        bind: "escape",
        title: "Back in Context Atlas",
        run: back
      }]
    })),
    onClose: () => props.context.ui.dialog.clear(),
    onRefresh: () => {
      state.refresh();
      observed.refresh();
    }
  });
}
function Indicator(props) {
  const state = useReport(props.context, () => props.sessionID);
  const observed = useUsage(() => props.context.data, () => props.sessionID, () => props.context.data.session.get(props.sessionID)?.location ?? props.context.location);
  const cells = () => windowMap(state.report()?.snapshot ?? null, state.report()?.limit ?? null, 20);
  return (() => {
    var _el$ = _$createElement("box"),
      _el$2 = _$createElement("box"),
      _el$3 = _$createElement("text"),
      _el$4 = _$createElement("b"),
      _el$6 = _$createElement("text"),
      _el$8 = _$createElement("text"),
      _el$9 = _$createElement("text");
    _$insertNode(_el$, _el$2);
    _$insertNode(_el$, _el$8);
    _$insertNode(_el$, _el$9);
    _$setProp(_el$, "flexDirection", "column");
    _$setProp(_el$, "gap", 0);
    _$setProp(_el$, "marginBottom", 1);
    _$setProp(_el$, "onMouseUp", event => {
      if (event.button !== MouseButton.LEFT) return;
      event.stopPropagation();
      props.onOpen();
    });
    _$insertNode(_el$2, _el$3);
    _$insertNode(_el$2, _el$6);
    _$setProp(_el$2, "flexDirection", "row");
    _$setProp(_el$2, "justifyContent", "space-between");
    _$insertNode(_el$3, _el$4);
    _$insertNode(_el$4, _$createTextNode(`Context`));
    _$insertNode(_el$6, _$createTextNode(`Atlas ↗`));
    _$setProp(_el$6, "fg", "#e5b567");
    _$insert(_el$8, _$createComponent(For, {
      get each() {
        return cells();
      },
      children: cell => (() => {
        var _el$10 = _$createElement("span");
        _$insert(_el$10, () => cellSymbol(cell, props.symbols, "sidebar"));
        _$effect(_$p => _$setProp(_el$10, "style", {
          fg: cell === "free" || cell === "unknown" ? props.context.theme.text.muted : categories[cell].color
        }, _$p));
        return _el$10;
      })()
    }));
    _$insert(_el$9, () => indicatorLabel(state.report(), state.loading(), observed.usage()));
    _$insert(_el$, _$createComponent(Show, {
      get when() {
        return _$memo(() => !!observed.usage())() && state.report()?.snapshot;
      },
      get children() {
        var _el$0 = _$createElement("text");
        _$insertNode(_el$0, _$createTextNode(`Map: input estimate`));
        _$effect(_$p => _$setProp(_el$0, "fg", props.context.theme.text.muted, _$p));
        return _el$0;
      }
    }), null);
    _$effect(_p$ => {
      var _v$ = props.context.theme.text.base,
        _v$2 = props.context.theme.text.muted;
      _v$ !== _p$.e && (_p$.e = _$setProp(_el$3, "fg", _v$, _p$.e));
      _v$2 !== _p$.t && (_p$.t = _$setProp(_el$9, "fg", _v$2, _p$.t));
      return _p$;
    }, {
      e: undefined,
      t: undefined
    });
    return _el$;
  })();
}
function indicatorLabel(report, loading, reported) {
  const summary = usageSummary(report, reported);
  if (!summary) return loading ? "Loading context…" : "Click to inspect context";
  return `${summary.reported ? '' : '~'}${formatTokens(summary.total)} tokens${summary.percentage !== null ? ` · ${summary.percentage}%` : ''}${summary.reported ? '' : ' estimated'}`;
}
