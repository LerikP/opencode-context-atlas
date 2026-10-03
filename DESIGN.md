# Context Atlas

## Experience

A Claude Code-inspired context map, native to OpenCode 2.0.22. `/context`
(alias `/atlas`) and a clickable sidebar indicator open the same centered
dialog. A colored cell map and category legend sit above a scrollable inspector.
Select a category to see individual sources; select a source to read its captured
text. Keyboard navigation and mouse interaction are equivalent. Escape goes back
from a source, then closes the dialog. Small terminals use a stacked layout.

Categories: system, rules, skill catalogue, loaded skills, tool definitions,
MCP definitions/instructions, messages, tool results, reasoning, and other.
Tools in the Code Mode catalogue are counted only when actually advertised.
An installed skill or connected MCP server alone is not evidence of context use.

## Accounting contract

- Capture the assembled `session.context` event, without editing it. It works
  for HTTP and WebSocket providers and already reflects compaction.
- Only the latest primary request snapshot per session is represented.
- Estimate text tokens with `o200k_base`. Explicitly label every category and
  the map as estimates, including for OpenAI (provider framing is not captured).
- Show provider usage separately from this estimate. Never rescale category
  numbers to pretend their sum is the provider's measured count.
- Unknown segments remain visible. Images and opaque provider state cannot be
  counted as ordinary text and produce a visible incomplete-coverage note.
- Skills advertised in the catalogue and loaded skill bodies are separate.
- No request snapshot means unavailable, not zero. Errors, stale snapshots,
  model switches and missing server plugins have explicit states.

## Modules and test seams

`analyze(request, options) -> Snapshot` owns attribution, counting and bounded
text previews. Without this module that logic would leak into the capture hook
and UI. It is a pure function, not a gateway interface; it accepts a tokenizer
function (real BPE in production, independent deterministic counts in tests).
Tests cross this seam with real prompt shapes and assert conservation and source
attribution, including Code Mode, MCP identity, skills and compaction snapshots.

`windowMap(snapshot, limit, cells) -> MapCell[]` owns visual allocation. Both the
dialog and sidebar consume it. Tests assert fixed grid size, free capacity,
unknown limits, rounding and overflow. It has no interchangeable adapters.

The server adapter owns OpenCode hooks, model/MCP metadata and a bounded in-memory
LRU. The TUI adapter owns lifecycle, RPC, focus, themes and commands. RPC is the
actual cross-process boundary; one shared, validated schema describes its report.
There is no filesystem cache and no provider proxy in production.

## Limits

Keep at most 8 sessions and 2 MiB of preview text across the cache. Individual
previews are capped at 8 KiB and each snapshot at 128 KiB. Counts cover the full
text; previews disclose truncation. Report generation performs no model calls.
Prompt text is held in process memory only and never logged or persisted.

Disable `opencode.sidebar.context` explicitly in `cli.json` and add Atlas to
`sidebar.content`. The documented slot API has no target for wrapping just the
built-in context contribution. Do not replace the entire sidebar.

## Verification

Pure behavioral tests; TypeScript against pinned SDK; isolated OpenCode 2.0.22
with a local deterministic test provider; slash command, sidebar click, source
drill-down, Escape and resize checks. Development runtime and credentials are
isolated from the user's normal OpenCode installation.
