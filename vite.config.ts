import { defineConfig } from "vite";
import { gui } from "@opencode/plugin/gui/vite";

export default defineConfig({
  plugins: [gui()],
  esbuild: {
    jsx: "automatic", jsxImportSource: "solid-js",
    // Escape vendor template literals so the shipped bundle has no trailing whitespace.
    supported: { "template-literal": false },
  },
});
