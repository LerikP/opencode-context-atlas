import { z } from "zod";

export const categoryKeys = [
  "system", "rules", "skills", "loaded", "tools", "mcp", "messages", "results", "reasoning", "other",
] as const;
export type Category = (typeof categoryKeys)[number];

export const categories: Record<Category, { label: string; color: string; glyph: string }> = {
  system: { label: "System prompt", color: "#b49aff", glyph: "▪" },
  rules: { label: "Rules & memory", color: "#7aa2f7", glyph: "▪" },
  skills: { label: "Skill catalogue", color: "#e3a2e8", glyph: "▪" },
  loaded: { label: "Loaded skills", color: "#bb78c9", glyph: "▪" },
  tools: { label: "Tool definitions", color: "#e5b567", glyph: "▪" },
  mcp: { label: "MCP servers", color: "#ef9273", glyph: "▪" },
  messages: { label: "Messages", color: "#8fbc8f", glyph: "▪" },
  results: { label: "Tool results", color: "#6fc3c0", glyph: "▪" },
  reasoning: { label: "Reasoning", color: "#cf8e9d", glyph: "▪" },
  other: { label: "Other", color: "#a9a9b8", glyph: "▪" },
};

const size = z.number().finite().nonnegative();
export const entrySchema = z.object({
  id: z.string(),
  category: z.enum(categoryKeys),
  name: z.string(),
  tokens: size,
  bytes: size,
  preview: z.string(),
  truncated: z.boolean(),
});
export type Entry = z.infer<typeof entrySchema>;

export const snapshotSchema = z.object({
  capturedAt: size,
  model: z.string(),
  entries: z.array(entrySchema),
  total: size,
  notes: z.array(z.string()),
});
export type Snapshot = z.infer<typeof snapshotSchema>;

export const reportSchema = z.object({
  sessionID: z.string(),
  snapshot: snapshotSchema.nullable(),
  limit: size.nullable(),
});
export type Report = z.infer<typeof reportSchema>;
