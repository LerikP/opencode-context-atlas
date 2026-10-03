/** Isolated OpenCode + a loopback-only deterministic provider. No real credentials. */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const sandbox = resolve(root, ".dev/runtime");
const home = resolve(sandbox, "home");
const workspace = resolve(sandbox, "workspace");
const config = resolve(sandbox, "config/opencode");
await Promise.all([mkdir(home, { recursive: true }), mkdir(workspace, { recursive: true }), mkdir(config, { recursive: true })]);

const provider = createServer(async (request, response) => {
  if (request.url === "/v1/models") {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ data: [{ id: "atlas-demo", object: "model" }] }));
    return;
  }
  if (request.url !== "/v1/chat/completions") { response.writeHead(404).end(); return; }
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  // Only fixture traffic reaches this server. Never install it in a user's config.
  await writeFile(resolve(sandbox, "fixture-request.json"), JSON.stringify(body, null, 2));
  const text = "Atlas demo ready. Open /context or click Atlas in the sidebar to inspect this request.";
  const usage = { prompt_tokens: 14000, completion_tokens: 24, total_tokens: 14024 };
  if (!body.stream) {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ id: "demo", object: "chat.completion", model: "atlas-demo",
      choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }], usage }));
    return;
  }
  response.writeHead(200, { "Content-Type": "text/event-stream" });
  for (const chunk of [
    { choices: [{ index: 0, delta: { role: "assistant", content: text }, finish_reason: null }] },
    { choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage },
  ]) response.write(`data: ${JSON.stringify({ id: "demo", object: "chat.completion.chunk", model: "atlas-demo", created: 1, ...chunk })}\n\n`);
  response.end("data: [DONE]\n\n");
});
await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
const address = provider.address();
if (!address || typeof address === "string") throw new Error("Missing fixture provider port");

await writeFile(resolve(config, "opencode.json"), JSON.stringify({
  $schema: "https://opencode.ai/config.json",
  plugins: ["-opencode.config.compatibility", root], update: "disable", model: "atlas/atlas-demo",
  providers: { atlas: { name: "Atlas local fixture", env: ["ATLAS_TEST_KEY"],
    package: "@opencode/ai/providers/openai-compatible", settings: { baseURL: `http://127.0.0.1:${address.port}/v1` },
    models: { "atlas-demo": { name: "Atlas Demo", limit: { context: 32000, output: 4096 }, capabilities: { tools: true } } },
  } },
}, null, 2));
await writeFile(resolve(config, "cli.json"), JSON.stringify({
  $schema: "https://opencode.ai/v2/cli.json", plugins: ["-opencode.sidebar.context", resolve(root, "dev/capture")],
  theme: { name: "opencode", mode: "dark" },
}, null, 2));
await writeFile(resolve(workspace, "AGENTS.md"), "# Atlas fixture\n\nUse small, focused changes. Verify behavior with tests.\n");
const skill = resolve(workspace, ".opencode/skills/atlas-testing");
await mkdir(skill, { recursive: true });
await writeFile(resolve(skill, "SKILL.md"), "---\nname: atlas-testing\ndescription: Use for testing the Atlas demo.\n---\nCheck the context map.\n");

const binary = process.env.OPENCODE_V2_BINARY ?? resolve(root,
  "../opencode-v2-context-atlas/node_modules/@opencode/cli-darwin-arm64/bin/opencode");
const environment = {
    PATH: process.env.PATH, HOME: home, TERM: "xterm-256color", COLORTERM: "truecolor", LANG: "en_US.UTF-8",
    XDG_CONFIG_HOME: resolve(sandbox, "config"), XDG_DATA_HOME: resolve(sandbox, "data"),
    XDG_STATE_HOME: resolve(sandbox, "state"), XDG_CACHE_HOME: resolve(sandbox, "cache"),
    ATLAS_TEST_KEY: "local-fixture-not-a-credential",
};
let args = process.argv.slice(2);
if (!args.length) {
  // Explicit selection avoids the TUI's initial model-catalog loading race.
  const seed = spawn(binary, ["run", "--standalone", "--model", "atlas/atlas-demo", "--format", "json", "Hello Atlas"],
    { cwd: workspace, env: environment, stdio: ["ignore", "pipe", "inherit"] });
  let output = "";
  seed.stdout.on("data", (chunk) => { output += chunk; });
  const code = await new Promise<number | null>((done) => seed.on("exit", done));
  if (code !== 0) { provider.close(); throw new Error("Demo session could not be created"); }
  const sessionID = output.split("\n").filter(Boolean).map((line) => JSON.parse(line)).find((item) => item.sessionID)?.sessionID;
  if (!sessionID) { provider.close(); throw new Error("Demo session ID missing"); }
  args = ["--standalone", "--session", sessionID, "--prompt", "Inspect the local fixture"];
}
const child = spawn(binary, args, {
  cwd: workspace, stdio: "inherit", env: environment,
});
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => child.kill(signal));
child.on("error", (error) => { console.error(error.message); provider.close(); process.exitCode = 1; });
child.on("exit", (code) => { provider.close(); process.exitCode = code ?? 1; });
