#!/usr/bin/env bun
/**
 * Cross-platform global install for the `clawde` CLI.
 *
 * Uses `bun pm pack` + `bun install -g <absolute-path.tgz>` so we avoid:
 * - `bun link --global` breaking when a bad package.json exists in the user home directory
 * - `bun install -g .` dependency-loop issues inside a Bun workspace
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function persistedInstallJsonPath(): string | null {
  if (process.platform === "win32") {
    const base = process.env.LOCALAPPDATA?.trim();
    if (!base) {
      return null;
    }
    return join(base, "clawde", "install.json");
  }
  const xdg = process.env.XDG_CONFIG_HOME?.trim();
  const configHome = xdg && xdg.length > 0 ? xdg : join(homedir(), ".config");
  return join(configHome, "clawde", "install.json");
}

async function writePersistedDevRoot(devRoot: string): Promise<void> {
  const jsonPath = persistedInstallJsonPath();
  if (!jsonPath) {
    console.warn("Could not determine config path to save claw-code root (LOCALAPPDATA unset on Windows?).");
    return;
  }
  const body = `${JSON.stringify({ devRoot: resolve(devRoot) }, null, 2)}\n`;
  try {
    await mkdir(dirname(jsonPath), { recursive: true });
    await writeFile(jsonPath, body, "utf8");
  } catch (err) {
    console.warn("Could not write persisted dev root for global clawde:", err);
  }
}
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

const clawCodeRoot = resolve(join(__dirname, ".."));
await writePersistedDevRoot(clawCodeRoot);

console.log(
  "\nDone. Open a new terminal and run: clawde\n" +
    `Saved this checkout for Rust engine lookup: ${clawCodeRoot}\n` +
    "  (If you move the repo, run install-global again from the new path, or set CLAW_DEV_ROOT.)\n" +
    "If the command is not found, ensure Bun's bin is on PATH, e.g.:\n" +
    "  Windows: %USERPROFILE%\\.bun\\bin\n" +
    "  macOS/Linux: $HOME/.bun/bin\n" +
    "\nIf `bun link --global` failed before: check for a stray package.json in your user\n" +
    "home folder with no \"name\" field or invalid dependencies (it can break Bun).\n",
);
