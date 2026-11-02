// OpenCode loads TUI plugins from node_modules without the Solid JSX transform,
// so JSX expressions would be evaluated once and never react. Ship dist/ built
// with the same universal transform the host's own TUI sources use at build time.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { transformAsync } from "@babel/core";
import solid from "babel-preset-solid";
import ts from "@babel/preset-typescript";

const files = [
  ["src/tui.tsx", "dist/tui.js"],
  ["src/view.tsx", "dist/view.js"],
];

export async function buildTui({ write = true } = {}) {
  const output = new Map();
  for (const [source, target] of files) {
    const code = await readFile(source, "utf8");
    const result = await transformAsync(code, {
      filename: source,
      configFile: false,
      babelrc: false,
      presets: [
        [solid, { moduleName: "@opentui/solid", generate: "universal" }],
        [ts, {}],
      ],
    });
    if (!result?.code) throw new Error(`No output for ${source}`);
    // Emit next to src so non-JSX modules are shared; only the JSX view is compiled.
    const compiled = `${result.code
      .replaceAll('"./view.tsx"', '"./view.js"')
      .replaceAll(/from "\.\/(?!view\.js)([^"]+\.ts)"/g, 'from "../src/$1"')}\n`;
    output.set(target, compiled);
    if (write) {
      await mkdir("dist", { recursive: true });
      await writeFile(target, compiled);
      console.log(`${source} -> ${target}`);
    }
  }
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await buildTui();
