/** Development-only self-export of Atlas's framebuffer; no OS screen access. */
import { Plugin } from "@opencode/plugin/tui";
import { rgbToHex } from "@opentui/core";
import { writeFile } from "node:fs/promises";

export default Plugin.define({
  id: "context-atlas.dev-capture",
  setup(context) {
    let sequence = 0;
    return context.ui.slot({ append: "app", render() {
      context.keymap.layer(() => ({
        mode: "global", priority: 200,
        commands: [{ bind: "ctrl+g", title: "Export Atlas framebuffer", async run() {
          const lines = context.renderer.currentRenderBuffer.getSpanLines();
          const plain = lines.map((line) => line.spans.map((span) => span.text).join(""));
          const heading = plain.findIndex((line) => line.includes("◈ Context Atlas"));
          if (heading < 0) return;
          const footer = plain.findIndex((line, row) => row > heading && line.includes("r refresh"));
          if (footer < 0) return;
          const left = Math.max(0, plain[heading].indexOf("◈ Context Atlas") - 2);
          const top = Math.max(0, heading - 1);
          const width = Math.min(88, context.renderer.width - 2);
          const height = footer - top + 2;
          const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
          const shapes: string[] = [];
          for (let row = top; row < top + height; row++) {
            let column = 0;
            for (const span of lines[row].spans) {
              const start = Math.max(left, column);
              const end = Math.min(left + width, column + span.width);
              if (end > start) {
                // Fixture source text uses single-cell glyphs. Outside-dialog
                // content is discarded, not merely hidden with an SVG clip.
                const text = [...span.text].slice(start - column, end - column).join("");
                shapes.push(`<rect x="${(start - left) * 10}" y="${(row - top) * 22}" width="${(end - start) * 10}" height="22" fill="${rgbToHex(span.bg)}"/>`);
                shapes.push(`<text x="${(start - left) * 10}" y="${(row - top) * 22 + 17}" textLength="${(end - start) * 10}" lengthAdjust="spacingAndGlyphs" fill="${rgbToHex(span.fg)}">${escape(text)}</text>`);
              }
              column += span.width;
            }
          }
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 10}" height="${height * 22}" viewBox="0 0 ${width * 10} ${height * 22}"><g font-family="Menlo,Consolas,monospace" font-size="15" xml:space="preserve">${shapes.join("")}</g></svg>\n`;
          await writeFile(new URL(`../../.dev/capture-${++sequence}.svg`, import.meta.url), svg);
        } }],
      }));
      return null;
    } });
  },
});
