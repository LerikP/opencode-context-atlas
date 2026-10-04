import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const installer = fileURLToPath(new URL("../install.sh", import.meta.url));

async function fixture(versions: Record<string, string>) {
  const directory = await mkdtemp(join(tmpdir(), "context-atlas-install-"));
  const bin = join(directory, "bin");
  const log = join(directory, "calls");
  await mkdir(bin);
  for (const [name, version] of Object.entries(versions)) {
    await writeFile(join(bin, name), `#!/bin/sh
case "$1" in
  --version) printf '%s\\n' '${version}' ;;
  plugin) printf '%s\\n' "$@" >> "$INSTALL_LOG"; exit "${"${INSTALL_EXIT:-0}"}" ;;
  *) exit 64 ;;
esac
`, { mode: 0o755 });
  }
  return {
    bin,
    run: (environment: Record<string, string> = {}, args: string[] = []) => spawnSync("/bin/sh", [installer, ...args], {
      // Deliberately no node, npm, bun, or regular system PATH.
      env: { PATH: bin, INSTALL_LOG: log, ...environment }, encoding: "utf8",
    }),
    calls: () => readFile(log, "utf8").catch(() => ""),
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

test("shell installation delegates to OpenCode without node, npm or bun on PATH", async () => {
  const setup = await fixture({ opencode: "opencode v2.0.22" });
  try {
    const result = setup.run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(await setup.calls(), "plugin\nadd\ngithub:LerikP/opencode-context-atlas\n");
    assert.ok(result.stdout.includes("/context"));
  } finally { await setup.cleanup(); }
});

test("finds opencode2 when the default opencode is v1", async () => {
  const setup = await fixture({ opencode: "1.18.34", opencode2: "opencode v2.1.0" });
  try {
    const result = setup.run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(await setup.calls(), "plugin\nadd\ngithub:LerikP/opencode-context-atlas\n");
  } finally { await setup.cleanup(); }
});

test("accepts an explicit binary path containing spaces", async () => {
  const setup = await fixture({ "OpenCode v2": "opencode v2.0.22" });
  try {
    const result = setup.run({ OPENCODE_BIN: join(setup.bin, "OpenCode v2") });
    assert.equal(result.status, 0, result.stderr);
    assert.ok((await setup.calls()).includes("github:LerikP/opencode-context-atlas"));
  } finally { await setup.cleanup(); }
});

test("unsupported or missing runtimes cause no installation", async () => {
  for (const version of [undefined, "1.18.34", "opencode v2.0.21", "unexpected output"]) {
    const setup = await fixture(version ? { opencode: version } : {});
    try {
      const result = setup.run();
      assert.notEqual(result.status, 0);
      assert.ok(result.stderr.includes("2.0.22"));
      assert.equal(await setup.calls(), "");
    } finally { await setup.cleanup(); }
  }
});

test("installation failures propagate rather than printing success", async () => {
  const setup = await fixture({ opencode: "opencode v2.0.22" });
  try {
    const result = setup.run({ INSTALL_EXIT: "9" });
    assert.equal(result.status, 9);
    assert.ok(!result.stdout.includes("Installed"));
  } finally { await setup.cleanup(); }
});

test("help does not require OpenCode or mutate configuration", async () => {
  const setup = await fixture({});
  try {
    const result = setup.run({}, ["--help"]);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes("OPENCODE_BIN"));
    assert.equal(await setup.calls(), "");
  } finally { await setup.cleanup(); }
});
