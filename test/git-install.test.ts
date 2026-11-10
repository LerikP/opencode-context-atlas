import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const pacote = require("pacote");
const Arborist = require("@npmcli/arborist");
const root = fileURLToPath(new URL("../", import.meta.url));

test("Git installation ships every entry without spawning npm to prepare the package", async () => {
  const directory = await mkdtemp(join(tmpdir(), "context-atlas-git-install-"));
  try {
    const repo = join(directory, "repo");
    await mkdir(repo);
    const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    await cp(join(root, "package.json"), join(repo, "package.json"));
    for (const file of manifest.files) {
      await cp(join(root, file), join(repo, file), { recursive: true });
    }
    for (const args of [
      ["init", "-q"], ["add", "."],
      ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "fixture"],
    ]) execFileSync("git", args, { cwd: repo, stdio: "pipe" });

    // OpenCode's bundled installer cannot run npm's CLI. Exercise its real Git
    // fetcher with a rejecting CLI so accidental preparation fails without
    // downloading devDependencies or requiring OpenCode to be installed in CI.
    const cli = join(directory, "opencode.js");
    await writeFile(cli, `console.error("Unrecognized flag: --force in command opencode"); process.exit(1);\n`);
    const installed = join(directory, "installed");
    await pacote.extract(`git+file://${repo}`, installed, {
      cache: join(directory, "cache"), npmBin: cli, Arborist,
    });
    for (const entry of Object.values(manifest.exports) as string[]) {
      await access(join(installed, entry));
    }
    assert.equal(JSON.parse(await readFile(join(installed, "package.json"), "utf8")).version, manifest.version);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
