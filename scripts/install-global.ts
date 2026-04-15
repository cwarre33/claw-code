#!/usr/bin/env bun
/**
 * Cross-platform global install for the `clawde` CLI.
 *
 * Uses `bun pm pack` + `bun install -g <absolute-path.tgz>` so we avoid:
 * - `bun link --global` breaking when a bad package.json exists in the user home directory
 * - `bun install -g .` dependency-loop issues inside a Bun workspace
 */
import { rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, "..", "packages", "claw-ui");

const run = async (cwd: string, cmd: string, args: string[]) => {
  const exitCode = await Bun.spawn([cmd, ...args], {
    cwd,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  }).exited;
  if (exitCode !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} exited with ${exitCode}`);
  }
};

await run(pkgRoot, "bun", ["install"]);
await run(pkgRoot, "bun", ["pm", "pack"]);

const pkgJson = JSON.parse(await Bun.file(join(pkgRoot, "package.json")).text()) as {
  version: string;
};
const tgzName = `clawde-${pkgJson.version}.tgz`;
const tgzPath = join(pkgRoot, tgzName);

// `--no-save` avoids Bun appending duplicate keys to ~/package.json on Windows
// when installing a global from a file path (each run re-added "clawde").
await run(process.cwd(), "bun", ["install", "-g", "--no-save", tgzPath]);

try {
  await rm(tgzPath);
} catch {
  // ignore cleanup failure
}

console.log(
  "\nDone. Open a new terminal and run: clawde\n" +
    "If the command is not found, ensure Bun's bin is on PATH, e.g.:\n" +
    "  Windows: %USERPROFILE%\\.bun\\bin\n" +
    "  macOS/Linux: $HOME/.bun/bin\n" +
    "\nIf `bun link --global` failed before: check for a stray package.json in your user\n" +
    "home folder with no \"name\" field or invalid dependencies (it can break Bun).\n",
);
