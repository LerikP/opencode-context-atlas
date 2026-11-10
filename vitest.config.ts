import { defineConfig } from "vitest/config";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  esbuild: { jsx: "automatic", jsxImportSource: "solid-js" },
  test: { environment: "jsdom", include: ["test/gui/**/*.test.tsx"] },
});
