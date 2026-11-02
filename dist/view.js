import { effect as _$effect } from "@opentui/solid";
import { createComponent as _$createComponent } from "@opentui/solid";
import { insert as _$insert } from "@opentui/solid";
import { memo as _$memo } from "@opentui/solid";
import { createTextNode as _$createTextNode } from "@opentui/solid";
import { insertNode as _$insertNode } from "@opentui/solid";
import { setProp as _$setProp } from "@opentui/solid";
import { use as _$use } from "@opentui/solid";
import { createElement as _$createElement } from "@opentui/solid";
/** @jsxImportSource @opentui/solid */
import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import { useTerminalDimensions } from "@opentui/solid";
import { MouseButton } from "@opentui/core";
import { categories, categoryKeys } from "../src/report.ts";
import { cellSymbol, windowMap } from "../src/map.ts";
export function AtlasView(props) {
  const terminal = useTerminalDimensions();
  const [measuredWidth, setMeasuredWidth] = createSignal(0);
  const [category, setCategory] = createSignal(null);
  const [entryID, setEntryID] = createSignal(null);
  const [selected, setSelected] = createSignal(0);
  let root;
  let scroll;
  const snapshot = () => props.report?.snapshot ?? null;
  const entry = () => snapshot()?.entries.find(item => item.id === entryID()) ?? null;
  const limit = () => props.report?.limit;
  const width = () => measuredWidth() || terminal().width - 8;
  const wide = () => width() >= 76;
  const symbolLabel = () => props.symbols === "unicode" ? "Unicode" : (props.symbols ?? "nerd-font") === "nerd-font" ? "Nerd Font" : "Blocks";
  const columns = () => wide() ? 18 : Math.max(8, Math.min(24, Math.floor((width() - 4) / 2)));
  const gridRows = () => wide() ? 10 : 4;
  const cells = createMemo(() => windowMap(snapshot() ?? null, limit() ?? null, columns() * gridRows()));
  const totals = createMemo(() => categoryKeys.map(key => ({
    key,
    tokens: snapshot()?.entries.filter(item => item.category === key).reduce((sum, item) => sum + item.tokens, 0) ?? 0
  })).filter(row => row.tokens > 0));
  const entries = createMemo(() => (snapshot()?.entries ?? []).filter(item => item.category === category()).sort((left, right) => right.tokens - left.tokens));
  const legendMarker = (key, index) => {
    const glyph = cellSymbol(key, props.symbols);
    if (glyph === "▪") return selected() === index ? "›" : glyph;
    return `${selected() === index ? "› " : "  "}${glyph}`;
  };
  const count = () => category() ? entries().length : totals().length;
  const resetSelection = () => {
    setSelected(0);
    scroll?.scrollTo(0);
  };
  const back = () => {
    if (entry()) setEntryID(null);else if (category()) setCategory(null);else {
      props.onClose();
      return;
    }
    resetSelection();
  };
  props.registerBack?.(back);
  const chooseCategory = key => {
    setCategory(key);
    setEntryID(null);
    resetSelection();
  };
  const openSelected = () => {
    if (entry()) return;
    if (category()) setEntryID(entries()[selected()]?.id ?? null);else if (totals()[selected()]) chooseCategory(totals()[selected()].key);
    scroll?.scrollTo(0);
  };
  onMount(() => root?.focus());
  return (() => {
    var _el$ = _$createElement("box"),
      _el$2 = _$createElement("box"),
      _el$3 = _$createElement("text"),
      _el$4 = _$createElement("b"),
      _el$6 = _$createElement("text"),
      _el$7 = _$createElement("text"),
      _el$11 = _$createElement("scrollbox"),
      _el$12 = _$createElement("box"),
      _el$13 = _$createElement("text"),
      _el$14 = _$createElement("box"),
      _el$16 = _$createElement("text");
    _$insertNode(_el$, _el$2);
    _$insertNode(_el$, _el$7);
    _$insertNode(_el$, _el$11);
    _$insertNode(_el$, _el$12);
    _$use(value => {
      root = value;
      value.onSizeChange = () => setMeasuredWidth(value.width);
    }, _el$);
    _$setProp(_el$, "flexDirection", "column");
    _$setProp(_el$, "paddingX", 2);
    _$setProp(_el$, "paddingY", 1);
    _$setProp(_el$, "width", "100%");
    _$setProp(_el$, "focusable", true);
    _$setProp(_el$, "onKeyDown", event => {
      if (event.name === "escape" || event.name === "left" || event.name === "backspace") back();else if (event.name === "return" || event.name === "right") openSelected();else if (event.name === "r") props.onRefresh();else if (event.name === "s" && !event.ctrl && !event.meta && !event.option && !event.super && props.onCycleSymbols) props.onCycleSymbols();else if ((event.name === "down" || event.name === "j") && !entry()) {
        setSelected(value => Math.min(Math.max(0, count() - 1), value + 1));
        if (category()) scroll?.scrollTo(Math.max(0, selected() - 3));
      } else if ((event.name === "up" || event.name === "k") && !entry()) {
        setSelected(value => Math.max(0, value - 1));
        if (category()) scroll?.scrollTo(Math.max(0, selected() - 3));
      } else if (entry() && ["down", "j", "pagedown"].includes(event.name)) scroll?.scrollBy(event.name === "pagedown" ? 10 : 1);else if (entry() && ["up", "k", "pageup"].includes(event.name)) scroll?.scrollBy(event.name === "pageup" ? -10 : -1);else return;
      event.preventDefault();
      event.stopPropagation();
    });
    _$insertNode(_el$2, _el$3);
    _$insertNode(_el$2, _el$6);
    _$setProp(_el$2, "flexDirection", "row");
    _$setProp(_el$2, "justifyContent", "space-between");
    _$setProp(_el$2, "flexShrink", 0);
    _$insertNode(_el$3, _el$4);
    _$setProp(_el$3, "fg", "#e5b567");
    _$insertNode(_el$4, _$createTextNode(`◈ Context Atlas`));
    _$setProp(_el$6, "onMouseDown", back);
    _$insert(_el$6, () => category() ? "esc back" : "esc close");
    _$setProp(_el$7, "flexShrink", 0);
    _$setProp(_el$7, "marginTop", 1);
    _$insert(_el$7, () => snapshot()?.model ?? "Context window");
    _$insert(_el$, _$createComponent(Show, {
      get when() {
        return snapshot();
      },
      keyed: true,
      children: snap => (() => {
        var _el$17 = _$createElement("text"),
          _el$18 = _$createElement("b"),
          _el$19 = _$createElement("span");
        _$insertNode(_el$17, _el$18);
        _$insertNode(_el$17, _el$19);
        _$setProp(_el$17, "flexShrink", 0);
        _$insert(_el$18, () => `~${formatTokens(snap.total)} / ${limit() ? formatTokens(limit()) : "?"} tokens`);
        _$insert(_el$19, (() => {
          var _c$ = _$memo(() => !!limit());
          return () => _c$() ? `  ·  ${(snap.total / limit() * 100).toFixed(1)}% estimated` : "  ·  limit unknown";
        })());
        _$effect(_p$ => {
          var _v$9 = props.foreground,
            _v$0 = {
              fg: props.muted
            };
          _v$9 !== _p$.e && (_p$.e = _$setProp(_el$17, "fg", _v$9, _p$.e));
          _v$0 !== _p$.t && (_p$.t = _$setProp(_el$19, "style", _v$0, _p$.t));
          return _p$;
        }, {
          e: undefined,
          t: undefined
        });
        return _el$17;
      })()
    }), _el$11);
    _$insert(_el$, _$createComponent(Show, {
      get when() {
        return props.loading;
      },
      get children() {
        var _el$8 = _$createElement("text");
        _$insertNode(_el$8, _$createTextNode(`Refreshing context…`));
        _$effect(_$p => _$setProp(_el$8, "fg", props.muted, _$p));
        return _el$8;
      }
    }), _el$11);
    _$insert(_el$, _$createComponent(Show, {
      get when() {
        return props.error;
      },
      get children() {
        var _el$0 = _$createElement("text");
        _$setProp(_el$0, "fg", "#ef9273");
        _$insert(_el$0, () => props.error);
        return _el$0;
      }
    }), _el$11);
    _$insert(_el$, _$createComponent(Show, {
      get when() {
        return _$memo(() => !!(!snapshot() && !props.loading))() && !props.error;
      },
      get children() {
        var _el$1 = _$createElement("text");
        _$insertNode(_el$1, _$createTextNode(`No request captured yet. Send a message with Atlas enabled, then refresh.`));
        _$setProp(_el$1, "marginTop", 1);
        _$effect(_$p => _$setProp(_el$1, "fg", props.muted, _$p));
        return _el$1;
      }
    }), _el$11);
    _$use(value => {
      scroll = value;
    }, _el$11);
    _$setProp(_el$11, "scrollY", true);
    _$setProp(_el$11, "flexGrow", 1);
    _$setProp(_el$11, "flexShrink", 1);
    _$setProp(_el$11, "marginTop", 1);
    _$setProp(_el$11, "verticalScrollbarOptions", {
      showArrows: false
    });
    _$insert(_el$11, _$createComponent(Show, {
      get when() {
        return snapshot();
      },
      keyed: true,
      children: snap => _$createComponent(Show, {
        get when() {
          return !category();
        },
        get fallback() {
          return (() => {
            var _el$34 = _$createElement("box"),
              _el$35 = _$createElement("box"),
              _el$36 = _$createElement("text"),
              _el$38 = _$createElement("text"),
              _el$39 = _$createElement("text");
            _$insertNode(_el$34, _el$35);
            _$setProp(_el$34, "flexDirection", "column");
            _$setProp(_el$34, "gap", 1);
            _$insertNode(_el$35, _el$36);
            _$insertNode(_el$35, _el$38);
            _$insertNode(_el$35, _el$39);
            _$setProp(_el$35, "flexDirection", "row");
            _$setProp(_el$35, "flexShrink", 0);
            _$insertNode(_el$36, _$createTextNode(`‹ `));
            _$setProp(_el$36, "onMouseUp", event => {
              if (event.button !== MouseButton.LEFT) return;
              event.stopPropagation();
              back();
            });
            _$setProp(_el$38, "flexShrink", 0);
            _$setProp(_el$38, "onMouseUp", event => {
              if (event.button !== MouseButton.LEFT) return;
              event.stopPropagation();
              setEntryID(null);
              resetSelection();
            });
            _$insert(_el$38, () => categories[category()]?.label);
            _$setProp(_el$39, "flexShrink", 1);
            _$insert(_el$39, (() => {
              var _c$3 = _$memo(() => !!entry());
              return () => _c$3() ? ` / ${safeText(entry().name)}` : `  ·  ${entries().length} sources`;
            })());
            _$insert(_el$34, _$createComponent(Show, {
              get when() {
                return entry();
              },
              get fallback() {
                return (() => {
                  var _el$42 = _$createElement("box");
                  _$setProp(_el$42, "flexDirection", "column");
                  _$insert(_el$42, _$createComponent(For, {
                    get each() {
                      return entries();
                    },
                    children: (item, index) => (() => {
                      var _el$43 = _$createElement("box"),
                        _el$44 = _$createElement("text"),
                        _el$45 = _$createElement("text");
                      _$insertNode(_el$43, _el$44);
                      _$insertNode(_el$43, _el$45);
                      _$setProp(_el$43, "flexDirection", "row");
                      _$setProp(_el$43, "justifyContent", "space-between");
                      _$setProp(_el$43, "gap", 1);
                      _$setProp(_el$43, "onMouseDown", () => {
                        setSelected(index());
                        setEntryID(item.id);
                        scroll?.scrollTo(0);
                      });
                      _$setProp(_el$44, "flexGrow", 1);
                      _$insert(_el$44, () => `${selected() === index() ? "›" : " "} ${shortName(safeText(item.name), Math.max(16, width() - 20))}`);
                      _$insert(_el$45, () => `~${formatTokens(item.tokens)}`);
                      _$effect(_p$ => {
                        var _v$17 = selected() === index() ? props.foreground : props.muted,
                          _v$18 = categories[item.category].color;
                        _v$17 !== _p$.e && (_p$.e = _$setProp(_el$44, "fg", _v$17, _p$.e));
                        _v$18 !== _p$.t && (_p$.t = _$setProp(_el$45, "fg", _v$18, _p$.t));
                        return _p$;
                      }, {
                        e: undefined,
                        t: undefined
                      });
                      return _el$43;
                    })()
                  }));
                  return _el$42;
                })();
              },
              get children() {
                return [(() => {
                  var _el$40 = _$createElement("text");
                  _$insert(_el$40, () => `~${formatTokens(entry().tokens)} tokens · ${formatTokens(entry().bytes)} bytes${entry().truncated ? " · preview truncated" : ""}`);
                  _$effect(_$p => _$setProp(_el$40, "fg", props.muted, _$p));
                  return _el$40;
                })(), (() => {
                  var _el$41 = _$createElement("text");
                  _$setProp(_el$41, "wrapMode", "word");
                  _$insert(_el$41, () => sourcePreview(entry()) || "Preview budget exhausted; full source was counted.");
                  _$effect(_$p => _$setProp(_el$41, "fg", props.foreground, _$p));
                  return _el$41;
                })()];
              }
            }), null);
            _$effect(_p$ => {
              var _v$14 = categories[category()]?.color,
                _v$15 = categories[category()]?.color,
                _v$16 = categories[category()]?.color;
              _v$14 !== _p$.e && (_p$.e = _$setProp(_el$36, "fg", _v$14, _p$.e));
              _v$15 !== _p$.t && (_p$.t = _$setProp(_el$38, "fg", _v$15, _p$.t));
              _v$16 !== _p$.a && (_p$.a = _$setProp(_el$39, "fg", _v$16, _p$.a));
              return _p$;
            }, {
              e: undefined,
              t: undefined,
              a: undefined
            });
            return _el$34;
          })();
        },
        get children() {
          return [(() => {
            var _el$20 = _$createElement("box"),
              _el$21 = _$createElement("box"),
              _el$22 = _$createElement("text"),
              _el$23 = _$createElement("box"),
              _el$24 = _$createElement("box"),
              _el$25 = _$createElement("text"),
              _el$27 = _$createElement("text");
            _$insertNode(_el$20, _el$21);
            _$insertNode(_el$20, _el$23);
            _$insertNode(_el$21, _el$22);
            _$setProp(_el$21, "flexDirection", "column");
            _$setProp(_el$21, "flexShrink", 0);
            _$insert(_el$21, _$createComponent(For, {
              get each() {
                return Array.from({
                  length: gridRows()
                }, (_, index) => index);
              },
              children: row => (() => {
                var _el$46 = _$createElement("box");
                _$setProp(_el$46, "flexDirection", "row");
                _$setProp(_el$46, "height", 1);
                _$insert(_el$46, _$createComponent(For, {
                  get each() {
                    return cells().slice(row * columns(), (row + 1) * columns());
                  },
                  children: cell => (() => {
                    var _el$47 = _$createElement("text");
                    _$setProp(_el$47, "opacity", cell === "free" ? 0.35 : 1);
                    _$setProp(_el$47, "onMouseDown", () => {
                      if (cell !== "free" && cell !== "unknown") chooseCategory(cell);
                    });
                    _$insert(_el$47, () => `${cellSymbol(cell, props.symbols)} `);
                    _$effect(_$p => _$setProp(_el$47, "fg", cell === "free" || cell === "unknown" ? props.muted : categories[cell].color, _$p));
                    return _el$47;
                  })()
                }));
                return _el$46;
              })()
            }), _el$22);
            _$setProp(_el$22, "marginTop", 1);
            _$insert(_el$22, () => `1 cell ≈ ${limit() ? formatTokens(limit() / cells().length) : "?"} tokens`);
            _$insertNode(_el$23, _el$24);
            _$setProp(_el$23, "flexDirection", "column");
            _$setProp(_el$23, "flexGrow", 1);
            _$setProp(_el$23, "minWidth", 28);
            _$insert(_el$23, _$createComponent(For, {
              get each() {
                return totals();
              },
              children: (row, index) => (() => {
                var _el$48 = _$createElement("box"),
                  _el$49 = _$createElement("text"),
                  _el$50 = _$createElement("text");
                _$insertNode(_el$48, _el$49);
                _$insertNode(_el$48, _el$50);
                _$setProp(_el$48, "flexDirection", "row");
                _$setProp(_el$48, "justifyContent", "space-between");
                _$setProp(_el$48, "gap", 1);
                _$setProp(_el$48, "onMouseDown", () => chooseCategory(row.key));
                _$insert(_el$49, () => `${legendMarker(row.key, index())} ${categories[row.key].label}`);
                _$insert(_el$50, () => `~${formatTokens(row.tokens)}${limit() ? `  ${(row.tokens / limit() * 100).toFixed(1)}%`.padStart(8) : ""}`);
                _$effect(_p$ => {
                  var _v$19 = categories[row.key].color,
                    _v$20 = props.foreground;
                  _v$19 !== _p$.e && (_p$.e = _$setProp(_el$49, "fg", _v$19, _p$.e));
                  _v$20 !== _p$.t && (_p$.t = _$setProp(_el$50, "fg", _v$20, _p$.t));
                  return _p$;
                }, {
                  e: undefined,
                  t: undefined
                });
                return _el$48;
              })()
            }), _el$24);
            _$insertNode(_el$24, _el$25);
            _$insertNode(_el$24, _el$27);
            _$setProp(_el$24, "flexDirection", "row");
            _$setProp(_el$24, "justifyContent", "space-between");
            _$setProp(_el$24, "gap", 1);
            _$setProp(_el$24, "marginTop", 1);
            _$insertNode(_el$25, _$createTextNode(`▫ Free space`));
            _$insert(_el$27, (() => {
              var _c$2 = _$memo(() => !!limit());
              return () => _c$2() ? `~${formatTokens(Math.max(0, limit() - snap.total))}` : "unknown";
            })());
            _$effect(_p$ => {
              var _v$1 = wide() ? "row" : "column",
                _v$10 = wide() ? 3 : 1,
                _v$11 = props.muted,
                _v$12 = props.muted,
                _v$13 = props.muted;
              _v$1 !== _p$.e && (_p$.e = _$setProp(_el$20, "flexDirection", _v$1, _p$.e));
              _v$10 !== _p$.t && (_p$.t = _$setProp(_el$20, "gap", _v$10, _p$.t));
              _v$11 !== _p$.a && (_p$.a = _$setProp(_el$22, "fg", _v$11, _p$.a));
              _v$12 !== _p$.o && (_p$.o = _$setProp(_el$25, "fg", _v$12, _p$.o));
              _v$13 !== _p$.i && (_p$.i = _$setProp(_el$27, "fg", _v$13, _p$.i));
              return _p$;
            }, {
              e: undefined,
              t: undefined,
              a: undefined,
              o: undefined,
              i: undefined
            });
            return _el$20;
          })(), _$createComponent(Show, {
            get when() {
              return _$memo(() => !!limit())() && snap.total > limit();
            },
            get children() {
              var _el$28 = _$createElement("text");
              _$insertNode(_el$28, _$createTextNode(`Estimate exceeds the model window; map is saturated.`));
              _$setProp(_el$28, "fg", "#ef9273");
              _$setProp(_el$28, "marginTop", 1);
              return _el$28;
            }
          }), (() => {
            var _el$30 = _$createElement("box"),
              _el$31 = _$createElement("text");
            _$insertNode(_el$30, _el$31);
            _$setProp(_el$30, "flexDirection", "column");
            _$setProp(_el$30, "marginTop", 1);
            _$insertNode(_el$31, _$createTextNode(`Last captured request · o200k_base estimate, before provider framing.`));
            _$insert(_el$30, _$createComponent(Show, {
              get when() {
                return props.providerTotal !== undefined;
              },
              get children() {
                var _el$33 = _$createElement("text");
                _$insert(_el$33, () => `Provider's last completed input: ${formatTokens(props.providerTotal)} tokens (including cache).`);
                _$effect(_$p => _$setProp(_el$33, "fg", props.muted, _$p));
                return _el$33;
              }
            }), null);
            _$insert(_el$30, _$createComponent(For, {
              get each() {
                return snap.notes;
              },
              children: note => (() => {
                var _el$51 = _$createElement("text");
                _$setProp(_el$51, "fg", "#ef9273");
                _$insert(_el$51, note);
                return _el$51;
              })()
            }), null);
            _$effect(_$p => _$setProp(_el$31, "fg", props.muted, _$p));
            return _el$30;
          })()];
        }
      })
    }));
    _$insertNode(_el$12, _el$13);
    _$insertNode(_el$12, _el$14);
    _$setProp(_el$12, "justifyContent", "space-between");
    _$setProp(_el$12, "marginTop", 1);
    _$setProp(_el$12, "flexShrink", 0);
    _$insert(_el$13, () => entry() ? "↑↓ scroll · esc back" : "↑↓ select · enter inspect");
    _$insertNode(_el$14, _el$16);
    _$setProp(_el$14, "flexDirection", "row");
    _$setProp(_el$14, "gap", 2);
    _$setProp(_el$14, "justifyContent", "space-between");
    _$insert(_el$14, _$createComponent(Show, {
      get when() {
        return props.onCycleSymbols;
      },
      get children() {
        var _el$15 = _$createElement("text");
        _$setProp(_el$15, "fg", "#e5b567");
        _$setProp(_el$15, "onMouseUp", event => {
          if (event.button !== MouseButton.LEFT) return;
          event.stopPropagation();
          props.onCycleSymbols?.();
        });
        _$insert(_el$15, () => `[s Symbols: ${symbolLabel()}]`);
        return _el$15;
      }
    }), _el$16);
    _$setProp(_el$16, "fg", "#e5b567");
    _$insert(_el$16, () => props.loading ? "loading…" : "r refresh");
    _$effect(_p$ => {
      var _v$ = Math.max(8, Math.min(terminal().height - 6, entry() ? 30 : category() ? 26 : wide() ? 24 : 30)),
        _v$2 = props.background,
        _v$3 = props.muted,
        _v$4 = props.muted,
        _v$5 = width() >= 72 ? "row" : "column",
        _v$6 = width() >= 72 ? 0 : 1,
        _v$7 = props.muted,
        _v$8 = props.onRefresh;
      _v$ !== _p$.e && (_p$.e = _$setProp(_el$, "height", _v$, _p$.e));
      _v$2 !== _p$.t && (_p$.t = _$setProp(_el$, "backgroundColor", _v$2, _p$.t));
      _v$3 !== _p$.a && (_p$.a = _$setProp(_el$6, "fg", _v$3, _p$.a));
      _v$4 !== _p$.o && (_p$.o = _$setProp(_el$7, "fg", _v$4, _p$.o));
      _v$5 !== _p$.i && (_p$.i = _$setProp(_el$12, "flexDirection", _v$5, _p$.i));
      _v$6 !== _p$.n && (_p$.n = _$setProp(_el$12, "gap", _v$6, _p$.n));
      _v$7 !== _p$.s && (_p$.s = _$setProp(_el$13, "fg", _v$7, _p$.s));
      _v$8 !== _p$.h && (_p$.h = _$setProp(_el$16, "onMouseDown", _v$8, _p$.h));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined,
      o: undefined,
      i: undefined,
      n: undefined,
      s: undefined,
      h: undefined
    });
    return _el$;
  })();
}
export function formatTokens(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return Math.round(value).toLocaleString("en-US");
}
function safeText(text) {
  // Render literal text; control sequences from tool output must not reach a terminal.
  return text.replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, "");
}
function shortName(name, width) {
  return name.length > width ? `…${name.slice(-(width - 1))}` : name;
}
function sourcePreview(entry) {
  if (!entry.truncated && (entry.category === "tools" || entry.category === "mcp")) {
    try {
      const definition = JSON.parse(entry.preview);
      if (definition && typeof definition === "object" && "description" in definition && typeof definition.description === "string" && "input" in definition) {
        return safeText(`${definition.description}\n\nInput schema\n${JSON.stringify(definition.input, null, 2)}`);
      }
    } catch {/* Code Mode signatures are already readable text. */}
  }
  return safeText(entry.preview);
}
