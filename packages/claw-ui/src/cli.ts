#!/usr/bin/env bun
/**
 * Interactive UI (global command is often `clawde`; on-screen branding is **Claw**).
 * Each turn shells to the **Rust** `claw` binary — not this script.
 *
 * - Default engine: `claw` / `claw.exe` on PATH, excluding shims named `clawde*`.
 * - Dev fallback: `claw-code/rust/target/debug/claw(.exe)` next to this repo.
 * - Override: `CLAW_BINARY` = full path or name of the Rust CLI.
 * - Optional: `CLAW_DEV_ROOT` = path to `claw-code` (uses `rust/target/debug/claw(.exe)`).
 * - If global Bun sets cwd to `.../node_modules/clawde`, set `CLAW_CWD` to your project
 *   or rely on `PWD` / `INIT_CWD` when your shell exports them.
 *
 * First message starts a new session; later turns use `--continue` against `.claw/sessions/`.
 */
import * as p from "@clack/prompts";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const thisCliPath = resolve(fileURLToPath(import.meta.url));

/** Bun global installs often leave `process.cwd()` at `.../node_modules/clawde` instead of the shell cwd. */
function isGlobalClawdeInstallCwd(cwd: string): boolean {
  const parts = cwd.split(/[/\\]/).filter(Boolean);
  const base = parts.at(-1) ?? "";
  const parentBase = parts.at(-2) ?? "";
  return parentBase === "node_modules" && base === "clawde";
}

function isExistingDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** Prefer explicit project dir when Bun’s cwd is the global package folder. */
function tryEnvWorkspaceDir(): string | null {
  const keys = [
    "CLAW_CWD",
    "INIT_CWD",
    "PWD",
    "OLDPWD",
    "CD",
    "VSCODE_CWD",
    "WORKSPACE_ROOT",
  ] as const;
  for (const k of keys) {
    const raw = process.env[k]?.trim();
    if (!raw) {
      continue;
    }
    const abs = resolve(raw);
    if (isExistingDir(abs)) {
      return abs;
    }
  }
  return null;
}

let workspaceCwdAdjustedFromGlobalInstall = false;

function resolveWorkspaceCwdAndChdir(): void {
  const cwd = process.cwd();
  if (!isGlobalClawdeInstallCwd(cwd)) {
    return;
  }
  const fallback = tryEnvWorkspaceDir();
  if (fallback) {
    try {
      process.chdir(fallback);
      workspaceCwdAdjustedFromGlobalInstall = true;
    } catch (err) {
      console.error(`clawde: could not chdir to ${fallback}:`, err);
    }
    return;
  }
  console.warn(
    "clawde: current directory looks like the global install folder (…/node_modules/clawde).\n" +
      "  Tools and sessions use the process cwd. From PowerShell run:\n" +
      "    $env:CLAW_CWD = \"C:\\path\\to\\your\\project\"\n" +
      "  Or use Git Bash / a shell that sets PWD, then run clawde again.",
  );
}

/** Minimal `.env` loader (no `dotenv` dep — global `bun install -g` may omit nested deps). */
function parseEnvLine(line: string): { key: string; value: string } | null {
  let s = line.trim();
  if (!s || s.startsWith("#")) {
    return null;
  }
  if (s.startsWith("export ")) {
    s = s.slice(7).trim();
  }
  const eq = s.indexOf("=");
  if (eq <= 0) {
    return null;
  }
  const key = s.slice(0, eq).trim();
  if (!key || /[#\s]/.test(key)) {
    return null;
  }
  let value = s.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

function mergeEnvFile(path: string): void {
  if (!existsSync(path)) {
    return;
  }
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      continue;
    }
    if (process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  }
}

/**
 * Bun does not always load `.env` for globally installed CLIs. Walk up from cwd
 * and merge the nearest `.env` / `.env.local` into `process.env` (without
 * overriding vars already set in the shell).
 */
function loadNearestDotenv(): void {
  let dir = process.cwd();
  for (let i = 0; i < 12; i++) {
    const envPath = resolve(dir, ".env");
    if (existsSync(envPath)) {
      mergeEnvFile(envPath);
      mergeEnvFile(resolve(dir, ".env.local"));
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
}

/** Rust `claw` uses `HOME` for config; Windows often only sets `USERPROFILE`. */
function ensureHomeFromUserProfile(): void {
  if (process.env.HOME?.trim()) {
    return;
  }
  const up = process.env.USERPROFILE?.trim();
  if (up) {
    process.env.HOME = up;
    return;
  }
  const drive = process.env.HOMEDRIVE?.trim();
  const pathPart = process.env.HOMEPATH?.trim();
  if (drive && pathPart) {
    process.env.HOME = drive + pathPart;
  }
}

ensureHomeFromUserProfile();
resolveWorkspaceCwdAndChdir();
loadNearestDotenv();
ensureHomeFromUserProfile();

/**
 * Bun.spawn must receive `HOME` explicitly on Windows — inheritance sometimes omits it,
 * and Rust `std::env::var("HOME")` fails for `claw` (oauth/config paths).
 */
function envForClawSpawn(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  let home = out.HOME?.trim();
  if (!home) {
    home = out.USERPROFILE?.trim();
  }
  if (!home && out.HOMEDRIVE && out.HOMEPATH) {
    home = out.HOMEDRIVE + out.HOMEPATH;
  }
  if (home) {
    out.HOME = home;
  }
  return out;
}

/**
 * When using NVIDIA NIM (see repo `run-nim.ps1`), `NIM_MODEL` + OpenAI-compat
 * env vars must win over any stray Anthropic keys and the default Claude model.
 */
function applyNimOpenAiSessionEnv(): void {
  if (!process.env.NIM_MODEL?.trim()) {
    return;
  }
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_AUTH_TOKEN;
}

applyNimOpenAiSessionEnv();

/** PATH entries named clawde* / bun are not the Rust engine. */
function isRustClawPath(candidate: string): boolean {
  const base = candidate.split(/[/\\]/).pop()!.toLowerCase();
  if (base.startsWith("clawde")) {
    return false;
  }
  if (base === "bun" || base === "bun.exe") {
    return false;
  }
  if (base === "node" || base === "node.exe") {
    return false;
  }
  return true;
}

function devRustClawGuess(): string | null {
  const exe = process.platform === "win32" ? "claw.exe" : "claw";
  const guess = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "..",
    "rust",
    "target",
    "debug",
    exe,
  );
  return existsSync(guess) ? guess : null;
}

/** Walk up from `startDir` looking for `rust/target/{debug,release}/claw(.exe)` (checkout layout). */
function findRustClawInAncestorTree(startDir: string): string | null {
  const exe = process.platform === "win32" ? "claw.exe" : "claw";
  const rels = [
    ["rust", "target", "debug", exe],
    ["rust", "target", "release", exe],
  ];
  let dir = startDir;
  for (let i = 0; i < 20; i++) {
    for (const rel of rels) {
      const p = resolve(dir, ...rel);
      if (existsSync(p)) {
        return p;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return null;
}

function resolveEngine(): string {
  const fromEnv = process.env.CLAW_BINARY?.trim();
  if (fromEnv) {
    if (fromEnv.toLowerCase().includes("cli.ts")) {
      const abs = resolve(fromEnv);
      if (abs === thisCliPath) {
        throw new Error(
          "CLAW_BINARY points at this Bun UI (cli.ts). Set it to the Rust `claw` executable, e.g. ..\\rust\\target\\debug\\claw.exe",
        );
      }
    }
    return fromEnv;
  }
  const fromPath =
    Bun.which("claw") ??
    (process.platform === "win32" ? Bun.which("claw.exe") : null);
  if (fromPath && isRustClawPath(fromPath)) {
    return fromPath;
  }
  const devRoot = process.env.CLAW_DEV_ROOT?.trim();
  if (devRoot) {
    const exe = process.platform === "win32" ? "claw.exe" : "claw";
    const debugPath = resolve(devRoot, "rust", "target", "debug", exe);
    if (existsSync(debugPath)) {
      return debugPath;
    }
    const releasePath = resolve(devRoot, "rust", "target", "release", exe);
    if (existsSync(releasePath)) {
      return releasePath;
    }
  }
  const fromWalk = findRustClawInAncestorTree(process.cwd());
  if (fromWalk) {
    return fromWalk;
  }
  const dev = devRustClawGuess();
  if (dev) {
    return dev;
  }
  return "claw";
}

function engineBasename(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

let engine: string;

function engineExecutableOk(cmd: string): boolean {
  if (/[\\/]/.test(cmd)) {
    return existsSync(cmd);
  }
  return Bun.which(cmd) !== null;
}

function buildArgs(line: string, useContinue: boolean): string[] {
  const trimmed = line.trim();
  const args = ["--output-format", "json"];
  if (useContinue) {
    args.push("--continue");
  }
  const nimModel = process.env.NIM_MODEL?.trim();
  if (nimModel) {
    const tools =
      process.env.NIM_USE_TOOLS === "1" || process.env.NIM_USE_TOOLS === "true";
    if (!tools) {
      args.push("--no-tools");
    }
    args.push("--model", nimModel);
  }
  if (trimmed.startsWith("/")) {
    args.push(trimmed);
  } else {
    args.push("-p", trimmed);
  }
  return args;
}

/** Rust `claw --output-format json` prints one serde object; other code may log stray `{…}` lines. */
function isClawEngineJson(obj: Record<string, unknown>): boolean {
  return (
    typeof obj.message === "string" ||
    typeof obj.iterations === "number" ||
    Array.isArray(obj.tool_uses) ||
    typeof obj.model === "string" ||
    (typeof obj.usage === "object" && obj.usage !== null)
  );
}

/**
 * Prefer the **Claw** JSON line (schema above), not the last arbitrary `{` line (logs / noise).
 */
function parseJsonFromStdout(text: string): Record<string, unknown> {
  const raw = text.trim();
  if (raw.startsWith("{")) {
    try {
      const obj = JSON.parse(raw) as Record<string, unknown>;
      if (isClawEngineJson(obj)) {
        return obj;
      }
    } catch {
      // whole buffer is not one JSON value — fall through to per-line scan
    }
  }
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line.startsWith("{")) {
      continue;
    }
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;
      if (isClawEngineJson(obj)) {
        return obj;
      }
    } catch {
      continue;
    }
  }
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line.startsWith("{")) {
      continue;
    }
    try {
      return JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { message: raw, parseError: true };
  }
}

/** Drop single-line agent-protocol JSON the model sometimes echoes (not real Claw tool I/O). */
function stripAssistantDisplayNoise(text: string): string {
  const out = text
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      if (!t.startsWith("{") || !t.endsWith("}")) {
        return true;
      }
      try {
        const o = JSON.parse(t) as Record<string, unknown>;
        if (typeof o.action === "string") {
          return false;
        }
      } catch {
        return true;
      }
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return out.length > 0 ? out : text.trim();
}

async function runEngine(line: string, useContinue: boolean): Promise<Record<string, unknown>> {
  const args = buildArgs(line, useContinue);
  const proc = Bun.spawn([engine, ...args], {
    cwd: process.cwd(),
    env: envForClawSpawn(),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(stderr.trim() || `${engine} exited with code ${code}`);
  }
  const text = stdout.trim();
  if (!text) {
    return {};
  }
  return parseJsonFromStdout(text);
}

function formatAssistantMessage(json: Record<string, unknown>): string {
  if (typeof json.message === "string" && json.message.length > 0) {
    return stripAssistantDisplayNoise(json.message);
  }
  return JSON.stringify(json, null, 2);
}

async function main(): Promise<void> {
  try {
    engine = resolveEngine();
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }

  if (!engineExecutableOk(engine)) {
    const exe = process.platform === "win32" ? "claw.exe" : "claw";
    const example = `C:\\Users\\YOU\\CleanDevEnvironment\\Passion\\ClawCode\\claw-code\\rust\\target\\debug\\${exe}`;
    p.log.error(
      `Rust CLI not found: "${engine}"\n` +
        `  Build once:  cd claw-code\\rust  &&  cargo build -p rusty-claude-cli\n` +
        `  Then either:\n` +
        `    • cd into your claw-code checkout (clawde finds rust\\target\\debug\\${exe} automatically), or\n` +
        `    • $env:CLAW_BINARY = "${example}"\n` +
        `    • $env:CLAW_DEV_ROOT = "C:\\path\\to\\claw-code"\n` +
        `  Update the global clawde UI from repo root:  bun run install-global`,
    );
    process.exit(1);
  }

  p.intro("Claw — interactive shell");
  p.log.info(`Rust CLI: ${engine}`);
  if (workspaceCwdAdjustedFromGlobalInstall) {
    p.log.info(
      `Working directory: ${process.cwd()} (corrected from global install folder via CLAW_CWD / PWD / IDE env)`,
    );
  }

  let useContinue = false;

  for (;;) {
    const line = await p.text({
      message: useContinue ? "Message (continuing session)" : "Message",
      placeholder: "Ask a question, or try /help",
    });

    if (p.isCancel(line)) {
      p.cancel("Goodbye");
      break;
    }

    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    if (trimmed === "/exit" || trimmed === "/quit") {
      p.outro("Goodbye");
      break;
    }

    const spin = p.spinner();
    spin.start(`${engineBasename(engine)}…`);
    try {
      const json = await runEngine(trimmed, useContinue);
      spin.stop("Done");
      p.note(formatAssistantMessage(json), "Assistant");
      const iterations = json.iterations;
      if (typeof iterations === "number") {
        p.log.info(`Model iterations this turn: ${iterations}`);
      }
      const tools = json.tool_uses;
      if (Array.isArray(tools) && tools.length > 0) {
        p.log.info(`Tools used: ${tools.length}`);
      }
      useContinue = true;
    } catch (err) {
      spin.stop("Failed");
      const msg = err instanceof Error ? err.message : String(err);
      p.log.error(msg);
      if (msg.includes("ENOENT") || msg.includes("uv_spawn")) {
        p.log.error(
          `Could not run "${engine}". Set CLAW_BINARY to the full path of your Rust claw.exe (from cargo build).`,
        );
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
