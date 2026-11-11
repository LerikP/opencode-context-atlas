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
import { usageSummary } from "../src/usage.ts";
export function AtlasView(props) {
  const terminal = useTerminalDimensions();
  const [measuredWidth, setMeasuredWidth] = createSignal(0);
  const [category, setCategory] = createSignal(null);
  const [entryID, setEntryID] = createSignal(null);
  const [selected, setSelected] = createSignal(0);
  let root;
  let scroll;
  const snapshot = () => props.report?.snapshot ?? null;
  const summary = () => usageSummary(props.report, props.usage);
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
      _el$16 = _$createElement("box"),
      _el$17 = _$createElement("text"),
      _el$18 = _$createElement("box"),
      _el$20 = _$createElement("text");
    _$insertNode(_el$, _el$2);
    _$insertNode(_el$, _el$7);
    _$insertNode(_el$, _el$11);
    _$insertNode(_el$, _el$16);
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
    _$insert(_el$7, () => summary()?.model ?? "Context window");
    _$insert(_el$, _$createComponent(Show, {
      get when() {
        return summary();
      },
      children: value => (() => {
        var _el$21 = _$createElement("text"),
          _el$22 = _$createElement("b"),
          _el$23 = _$createElement("span");
        _$insertNode(_el$21, _el$22);
        _$insertNode(_el$21, _el$23);
        _$setProp(_el$21, "flexShrink", 0);
        _$insert(_el$22, () => `${value().reported ? '' : '~'}${formatTokens(value().total)} / ${value().limit ? formatTokens(value().limit) : "?"} tokens`);
        _$insert(_el$23, (() => {
          var _c$ = _$memo(() => !!value().limit);
          return () => _c$() ? `  ·  ${value().reported ? value().percentage : (value().total / value().limit * 100).toFixed(1)}% ${value().reported ? 'OpenCode usage' : 'estimated'}` : `  ·  limit unknown · ${value().reported ? 'OpenCode usage' : 'estimated'}`;
        })());
        _$effect(_p$ => {
          var _v$9 = props.foreground,
            _v$0 = {
              fg: props.muted
            };
          _v$9 !== _p$.e && (_p$.e = _$setProp(_el$21, "fg", _v$9, _p$.e));
          _v$0 !== _p$.t && (_p$.t = _$setProp(_el$23, "style", _v$0, _p$.t));
          return _p$;
        }, {
          e: undefined,
          t: undefined
        });
        return _el$21;
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
        return _$memo(() => !!!category())() && snapshot();
      },
      get children() {
        var _el$12 = _$createElement("text");
        _$insert(_el$12, () => `Captured input: ~${formatTokens(snapshot().total)} tokens · ${snapshot().model}`);
        _$effect(_$p => _$setProp(_el$12, "fg", props.muted, _$p));
        return _el$12;
      }
    }), null);
    _$insert(_el$11, _$createComponent(Show, {
      get when() {
        return _$memo(() => !!(!category() && summary()?.difference !== null))() && summary()?.difference !== undefined;
      },
      get children() {
        var _el$13 = _$createElement("text");
        _$insert(_el$13, () => `Difference to captured-input estimate: ${summary().difference >= 0 ? '+' : '-'}${formatTokens(Math.abs(summary().difference))} tokens`);
        _$effect(_$p => _$setProp(_el$13, "fg", props.muted, _$p));
        return _el$13;
      }
    }), null);
    _$insert(_el$11, _$createComponent(Show, {
      get when() {
        return _$memo(() => !!!category())() && summary()?.modelMismatch;
      },
      get children() {
        var _el$14 = _$createElement("text");
        _$insertNode(_el$14, _$createTextNode(`Different models for usage and captured input; not directly comparable.`));
        _$effect(_$p => _$setProp(_el$14, "fg", props.muted, _$p));
        return _el$14;
      }
    }), null);
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
            var _el$39 = _$createElement("box"),
              _el$40 = _$createElement("box"),
              _el$41 = _$createElement("text"),
              _el$43 = _$createElement("text"),
              _el$44 = _$createElement("text");
            _$insertNode(_el$39, _el$40);
            _$setProp(_el$39, "flexDirection", "column");
            _$setProp(_el$39, "gap", 1);
            _$insertNode(_el$40, _el$41);
            _$insertNode(_el$40, _el$43);
            _$insertNode(_el$40, _el$44);
            _$setProp(_el$40, "flexDirection", "row");
            _$setProp(_el$40, "flexShrink", 0);
            _$insertNode(_el$41, _$createTextNode(`‹ `));
            _$setProp(_el$41, "onMouseUp", event => {
              if (event.button !== MouseButton.LEFT) return;
              event.stopPropagation();
              back();
            });
            _$setProp(_el$43, "flexShrink", 0);
            _$setProp(_el$43, "onMouseUp", event => {
              if (event.button !== MouseButton.LEFT) return;
              event.stopPropagation();
              setEntryID(null);
              resetSelection();
            });
            _$insert(_el$43, () => categories[category()]?.label);
            _$setProp(_el$44, "flexShrink", 1);
            _$insert(_el$44, (() => {
              var _c$3 = _$memo(() => !!entry());
              return () => _c$3() ? ` / ${safeText(entry().name)}` : `  ·  ${entries().length} sources`;
            })());
            _$insert(_el$39, _$createComponent(Show, {
              get when() {
                return entry();
              },
              get fallback() {
                return (() => {
                  var _el$47 = _$createElement("box");
                  _$setProp(_el$47, "flexDirection", "column");
                  _$insert(_el$47, _$createComponent(For, {
                    get each() {
                      return entries();
                    },
                    children: (item, index) => (() => {
                      var _el$48 = _$createElement("box"),
                        _el$49 = _$createElement("text"),
                        _el$50 = _$createElement("text");
                      _$insertNode(_el$48, _el$49);
                      _$insertNode(_el$48, _el$50);
                      _$setProp(_el$48, "flexDirection", "row");
                      _$setProp(_el$48, "justifyContent", "space-between");
                      _$setProp(_el$48, "gap", 1);
                      _$setProp(_el$48, "onMouseDown", () => {
                        setSelected(index());
                        setEntryID(item.id);
                        scroll?.scrollTo(0);
                      });
                      _$setProp(_el$49, "flexGrow", 1);
                      _$insert(_el$49, () => `${selected() === index() ? "›" : " "} ${shortName(safeText(item.name), Math.max(16, width() - 20))}`);
                      _$insert(_el$50, () => `~${formatTokens(item.tokens)}`);
                      _$effect(_p$ => {
                        var _v$17 = selected() === index() ? props.foreground : props.muted,
                          _v$18 = categories[item.category].color;
                        _v$17 !== _p$.e && (_p$.e = _$setProp(_el$49, "fg", _v$17, _p$.e));
                        _v$18 !== _p$.t && (_p$.t = _$setProp(_el$50, "fg", _v$18, _p$.t));
                        return _p$;
                      }, {
                        e: undefined,
                        t: undefined
                      });
                      return _el$48;
                    })()
                  }));
                  return _el$47;
                })();
              },
              get children() {
                return [(() => {
                  var _el$45 = _$createElement("text");
                  _$insert(_el$45, () => `~${formatTokens(entry().tokens)} tokens · ${formatTokens(entry().bytes)} bytes${entry().truncated ? " · preview truncated" : ""}`);
                  _$effect(_$p => _$setProp(_el$45, "fg", props.muted, _$p));
                  return _el$45;
                })(), (() => {
                  var _el$46 = _$createElement("text");
                  _$setProp(_el$46, "wrapMode", "word");
                  _$insert(_el$46, () => sourcePreview(entry()) || "Preview budget exhausted; full source was counted.");
                  _$effect(_$p => _$setProp(_el$46, "fg", props.foreground, _$p));
                  return _el$46;
                })()];
              }
            }), null);
            _$effect(_p$ => {
              var _v$14 = categories[category()]?.color,
                _v$15 = categories[category()]?.color,
                _v$16 = categories[category()]?.color;
              _v$14 !== _p$.e && (_p$.e = _$setProp(_el$41, "fg", _v$14, _p$.e));
              _v$15 !== _p$.t && (_p$.t = _$setProp(_el$43, "fg", _v$15, _p$.t));
              _v$16 !== _p$.a && (_p$.a = _$setProp(_el$44, "fg", _v$16, _p$.a));
              return _p$;
            }, {
              e: undefined,
              t: undefined,
              a: undefined
            });
            return _el$39;
          })();
        },
        get children() {
          return [(() => {
            var _el$24 = _$createElement("box"),
              _el$25 = _$createElement("box"),
              _el$26 = _$createElement("text"),
              _el$27 = _$createElement("box"),
              _el$28 = _$createElement("box"),
              _el$29 = _$createElement("text"),
              _el$31 = _$createElement("text");
            _$insertNode(_el$24, _el$25);
            _$insertNode(_el$24, _el$27);
            _$insertNode(_el$25, _el$26);
            _$setProp(_el$25, "flexDirection", "column");
            _$setProp(_el$25, "flexShrink", 0);
            _$insert(_el$25, _$createComponent(For, {
              get each() {
                return Array.from({
                  length: gridRows()
                }, (_, index) => index);
              },
              children: row => (() => {
                var _el$51 = _$createElement("box");
                _$setProp(_el$51, "flexDirection", "row");
                _$setProp(_el$51, "height", 1);
                _$insert(_el$51, _$createComponent(For, {
                  get each() {
                    return cells().slice(row * columns(), (row + 1) * columns());
                  },
                  children: cell => (() => {
                    var _el$52 = _$createElement("text");
                    _$setProp(_el$52, "opacity", cell === "free" ? 0.35 : 1);
                    _$setProp(_el$52, "onMouseDown", () => {
                      if (cell !== "free" && cell !== "unknown") chooseCategory(cell);
                    });
                    _$insert(_el$52, () => `${cellSymbol(cell, props.symbols)} `);
                    _$effect(_$p => _$setProp(_el$52, "fg", cell === "free" || cell === "unknown" ? props.muted : categories[cell].color, _$p));
                    return _el$52;
                  })()
                }));
                return _el$51;
              })()
            }), _el$26);
            _$setProp(_el$26, "marginTop", 1);
            _$insert(_el$26, () => `1 cell ≈ ${limit() ? formatTokens(Math.max(limit(), snap.total) / cells().length) : "?"} tokens`);
            _$insertNode(_el$27, _el$28);
            _$setProp(_el$27, "flexDirection", "column");
            _$setProp(_el$27, "flexGrow", 1);
            _$setProp(_el$27, "minWidth", 28);
            _$insert(_el$27, _$createComponent(For, {
              get each() {
                return totals();
              },
              children: (row, index) => (() => {
                var _el$53 = _$createElement("box"),
                  _el$54 = _$createElement("text"),
                  _el$55 = _$createElement("text");
                _$insertNode(_el$53, _el$54);
                _$insertNode(_el$53, _el$55);
                _$setProp(_el$53, "flexDirection", "row");
                _$setProp(_el$53, "justifyContent", "space-between");
                _$setProp(_el$53, "gap", 1);
                _$setProp(_el$53, "onMouseDown", () => chooseCategory(row.key));
                _$insert(_el$54, () => `${legendMarker(row.key, index())} ${categories[row.key].label}`);
                _$insert(_el$55, () => `~${formatTokens(row.tokens)}${limit() ? `  ${(row.tokens / limit() * 100).toFixed(1)}%`.padStart(8) : ""}`);
                _$effect(_p$ => {
                  var _v$19 = categories[row.key].color,
                    _v$20 = props.foreground;
                  _v$19 !== _p$.e && (_p$.e = _$setProp(_el$54, "fg", _v$19, _p$.e));
                  _v$20 !== _p$.t && (_p$.t = _$setProp(_el$55, "fg", _v$20, _p$.t));
                  return _p$;
                }, {
                  e: undefined,
                  t: undefined
                });
                return _el$53;
              })()
            }), _el$28);
            _$insertNode(_el$28, _el$29);
            _$insertNode(_el$28, _el$31);
            _$setProp(_el$28, "flexDirection", "row");
            _$setProp(_el$28, "justifyContent", "space-between");
            _$setProp(_el$28, "gap", 1);
            _$setProp(_el$28, "marginTop", 1);
            _$insertNode(_el$29, _$createTextNode(`▫ Free space (estimate)`));
            _$insert(_el$31, (() => {
              var _c$2 = _$memo(() => !!limit());
              return () => _c$2() ? `~${formatTokens(Math.max(0, limit() - snap.total))}` : "unknown";
            })());
            _$effect(_p$ => {
              var _v$1 = wide() ? "row" : "column",
                _v$10 = wide() ? 3 : 1,
                _v$11 = props.muted,
                _v$12 = props.muted,
                _v$13 = props.muted;
              _v$1 !== _p$.e && (_p$.e = _$setProp(_el$24, "flexDirection", _v$1, _p$.e));
              _v$10 !== _p$.t && (_p$.t = _$setProp(_el$24, "gap", _v$10, _p$.t));
              _v$11 !== _p$.a && (_p$.a = _$setProp(_el$26, "fg", _v$11, _p$.a));
              _v$12 !== _p$.o && (_p$.o = _$setProp(_el$29, "fg", _v$12, _p$.o));
              _v$13 !== _p$.i && (_p$.i = _$setProp(_el$31, "fg", _v$13, _p$.i));
              return _p$;
            }, {
              e: undefined,
              t: undefined,
              a: undefined,
              o: undefined,
              i: undefined
            });
            return _el$24;
          })(), _$createComponent(Show, {
            get when() {
              return _$memo(() => !!limit())() && snap.total > limit();
            },
            get children() {
              var _el$32 = _$createElement("text");
              _$insertNode(_el$32, _$createTextNode(`Estimate exceeds the model window; map is saturated.`));
              _$setProp(_el$32, "fg", "#ef9273");
              _$setProp(_el$32, "marginTop", 1);
              return _el$32;
            }
          }), (() => {
            var _el$34 = _$createElement("box"),
              _el$35 = _$createElement("text");
            _$insertNode(_el$34, _el$35);
            _$setProp(_el$34, "flexDirection", "column");
            _$setProp(_el$34, "marginTop", 1);
            _$insertNode(_el$35, _$createTextNode(`Last captured request · o200k_base estimate; categories are not rescaled.`));
            _$insert(_el$34, _$createComponent(Show, {
              get when() {
                return summary()?.reported;
              },
              get children() {
                var _el$37 = _$createElement("text");
                _$insertNode(_el$37, _$createTextNode(`OpenCode usage includes output and reasoning. Differences are not necessarily overhead.`));
                _$effect(_$p => _$setProp(_el$37, "fg", props.muted, _$p));
                return _el$37;
              }
            }), null);
            _$insert(_el$34, _$createComponent(For, {
              get each() {
                return snap.notes;
              },
              children: note => (() => {
                var _el$56 = _$createElement("text");
                _$setProp(_el$56, "fg", "#ef9273");
                _$insert(_el$56, note);
                return _el$56;
              })()
            }), null);
            _$effect(_$p => _$setProp(_el$35, "fg", props.muted, _$p));
            return _el$34;
          })()];
        }
      })
    }), null);
    _$insertNode(_el$16, _el$17);
    _$insertNode(_el$16, _el$18);
    _$setProp(_el$16, "justifyContent", "space-between");
    _$setProp(_el$16, "marginTop", 1);
    _$setProp(_el$16, "flexShrink", 0);
    _$insert(_el$17, () => entry() ? "↑↓ scroll · esc back" : "↑↓ select · enter inspect");
    _$insertNode(_el$18, _el$20);
    _$setProp(_el$18, "flexDirection", "row");
    _$setProp(_el$18, "gap", 2);
    _$setProp(_el$18, "justifyContent", "space-between");
    _$insert(_el$18, _$createComponent(Show, {
      get when() {
        return props.onCycleSymbols;
      },
      get children() {
        var _el$19 = _$createElement("text");
        _$setProp(_el$19, "fg", "#e5b567");
        _$setProp(_el$19, "onMouseUp", event => {
          if (event.button !== MouseButton.LEFT) return;
          event.stopPropagation();
          props.onCycleSymbols?.();
        });
        _$insert(_el$19, () => `[s Symbols: ${symbolLabel()}]`);
        return _el$19;
      }
    }), _el$20);
    _$setProp(_el$20, "fg", "#e5b567");
    _$insert(_el$20, () => props.loading ? "loading…" : "r refresh");
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
      _v$5 !== _p$.i && (_p$.i = _$setProp(_el$16, "flexDirection", _v$5, _p$.i));
      _v$6 !== _p$.n && (_p$.n = _$setProp(_el$16, "gap", _v$6, _p$.n));
      _v$7 !== _p$.s && (_p$.s = _$setProp(_el$17, "fg", _v$7, _p$.s));
      _v$8 !== _p$.h && (_p$.h = _$setProp(_el$20, "onMouseDown", _v$8, _p$.h));
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
