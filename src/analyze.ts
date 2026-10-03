import type { SessionContext } from "@opencode/plugin/promise/session";
import type { Category, Entry, Snapshot } from "./report.ts";

export type RequestContext = Pick<SessionContext, "system" | "messages" | "tools">;
export interface AnalyzeOptions {
  model: string;
  capturedAt: number;
  mcpNames: readonly string[];
  count: (text: string) => number;
}

export function analyze(request: RequestContext, options: AnalyzeOptions): Snapshot {
  const grouped = new Map<string, Entry>();
  const notes = new Set<string>();
  let remainingPreview = 128 * 1024;
  const add = (category: Category, name: string, text: string) => {
    if (!text) return;
    if (grouped.size >= 512 && !grouped.has(`${category}:${name}`)) {
      category = "other";
      name = "Additional sources";
      notes.add("Source list capped at 512 entries; additional sources are grouped under Other.");
    }
    const id = `${category}:${name}`;
    const entry = grouped.get(id) ?? { id, category, name, tokens: 0, bytes: 0, preview: "", truncated: false };
    const bytes = Buffer.from(text);
    const budget = Math.max(0, Math.min(8192 - Buffer.byteLength(entry.preview), remainingPreview));
    const preview = new TextDecoder().decode(bytes.subarray(0, budget), { stream: bytes.length > budget });
    entry.tokens += options.count(text);
    entry.bytes += bytes.length;
    entry.preview += preview;
    entry.truncated ||= bytes.length > budget;
    remainingPreview -= Buffer.byteLength(preview);
    grouped.set(id, entry);
  };

  for (const part of request.system) {
    systemSegments(part.text, options.mcpNames, add);
  }

  for (const [name, tool] of Object.entries(request.tools)) {
    const server = options.mcpNames.find((server) => name.startsWith(`${server}_`) || name.startsWith(`${server}.`));
    add(server ? "mcp" : "tools", server ? `${server} / ${name}` : name, JSON.stringify({ name, ...tool }));
  }

  for (const message of request.messages) {
    for (const part of message.content) {
      switch (part.type) {
        case "text":
          if (message.role === "system") systemSegments(part.text, options.mcpNames, add);
          else add("messages", `${message.role} messages`, part.text);
          break;
        case "reasoning":
          add("reasoning", "Replayed reasoning", part.text);
          break;
        case "tool-call":
          add("messages", `Calls / ${part.name}`, JSON.stringify({ name: part.name, input: part.input }));
          break;
        case "tool-result": {
          const value = part.result.value;
          let text: string;
          if (part.result.type === "content") {
            text = part.result.value.flatMap((item) => {
              if (item.type === "text") return [item.text];
              notes.add("Media/file payloads are excluded from the text estimate.");
              return [];
            }).join("\n");
          } else text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
          const skill = text.match(/<skill_content\s+name=["']([^"']+)["']/);
          add(skill ? "loaded" : "results", skill?.[1] ?? part.name, text);
          break;
        }
        default:
          notes.add(`${part.type} payloads are excluded from the text estimate.`);
      }
    }
  }

  const entries = [...grouped.values()];
  return { capturedAt: options.capturedAt, model: options.model, entries,
    total: entries.reduce((sum, entry) => sum + entry.tokens, 0), notes: [...notes] };
}

type Add = (category: Category, name: string, text: string) => void;

function systemSegments(text: string, servers: readonly string[], add: Add): void {
  // Every boundary is an offset in this text, never an offset in a joined prompt.
  const markers = [...text.matchAll(/^(?:Instructions from: .+|# Code Mode|Skills provide specialized instructions[^\n]*|<available_skills>|<mcp_instructions>|Here is some useful information about the environment[^\n]*)/gm)];
  const boundaries = [0, ...markers.map((match) => match.index).filter((index) => index > 0), text.length];

  for (let index = 0; index < boundaries.length - 1; index++) {
    const chunk = text.slice(boundaries[index], boundaries[index + 1]);
    const rule = chunk.match(/^Instructions from: ([^\r\n]+)/);
    if (rule) {
      add("rules", rule[1], chunk);
    } else if (chunk.startsWith("<available_skills>")) {
      let end = 0;
      for (const skill of chunk.matchAll(/<skill>[\s\S]*?<\/skill>/g)) {
        add("skills", "Catalogue framing", chunk.slice(end, skill.index));
        add("skills", skill[0].match(/<name>([^<]+)<\/name>/)?.[1] ?? "Unnamed skill", skill[0]);
        end = skill.index + skill[0].length;
      }
      const close = chunk.indexOf("</available_skills>", end);
      const boundary = close < 0 ? chunk.length : close + "</available_skills>".length;
      add("skills", "Catalogue framing", chunk.slice(end, boundary));
      add("system", "System prompt", chunk.slice(boundary));
    } else if (chunk.startsWith("Skills provide")) {
      add("skills", "Catalogue framing", chunk);
    } else if (chunk.startsWith("# Code Mode")) {
      const namespaces = [...chunk.matchAll(/^- ([\w.-]+) \(\d+ tools?[^\n]*\)/gm)];
      add("tools", "Code Mode instructions", chunk.slice(0, namespaces[0]?.index ?? chunk.length));
      namespaces.forEach((namespace, position) => {
        const category = servers.includes(namespace[1]) ? "mcp" : "tools";
        const body = chunk.slice(namespace.index, namespaces[position + 1]?.index ?? chunk.length);
        const tools = [...body.matchAll(/^  - tools\.([\w.-]+)\(/gm)];
        add(category, `${namespace[1]} / namespace`, body.slice(0, tools[0]?.index ?? body.length));
        tools.forEach((tool, index) => add(category, tool[1], body.slice(tool.index, tools[index + 1]?.index ?? body.length)));
      });
    } else if (chunk.startsWith("<mcp_instructions>")) {
      const close = chunk.indexOf("</mcp_instructions>");
      const boundary = close < 0 ? chunk.length : close + "</mcp_instructions>".length;
      add("mcp", "MCP instructions", chunk.slice(0, boundary));
      add("system", "System prompt", chunk.slice(boundary));
    } else {
      add("system", chunk.startsWith("Here is") ? "Environment" : "System prompt", chunk);
    }
  }
}
