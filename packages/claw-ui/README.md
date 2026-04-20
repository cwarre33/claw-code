# clawde (Bun UI)

Interactive shell for the Claw agent: [@clack/prompts](https://github.com/natemoo-re/clack) for input; each turn runs the engine CLI with `--output-format json`.

## Global command: `clawde`

After a **one-time** global install from your checkout (`bun run install-global`), you can run **`clawde`** from any directory. That command records the checkout path so the Rust `claw` binary is found under `rust/target/...` even when your shell cwd is elsewhere. If you **move** the repo, run **`bun run install-global`** again from the new location (or set `CLAW_DEV_ROOT` / `CLAW_BINARY`).

### Install once (from this repo)

**Windows (PowerShell), from `claw-code`:**

```powershell
.\scripts\install-clawde-global.ps1
```

**macOS / Linux:**

```bash
chmod +x scripts/install-clawde-global.sh
./scripts/install-clawde-global.sh
```

**Or manually:**

```bash
cd packages/claw-ui
bun install
bun link --global
```

**Or from `claw-code` root:**

```bash
bun run install-global
```

**Alternative** (installs a global copy from this folder):

```bash
cd packages/claw-ui
bun install -g .
```

Then **open a new terminal** and ensure **`~/.bun/bin`** (macOS/Linux) or **`%USERPROFILE%\.bun\bin`** (Windows) is on your `PATH` (the Bun installer usually does this).

Verify:

```bash
clawde
```

### Engine binary (Rust `claw`)

The **command you type** is **`clawde`** (this Bun UI). The **process it spawns** is the Rust **`claw`** binary (`cargo build -p rusty-claude-cli` → `target/debug/claw` or `claw.exe`), **not** another copy of `clawde`.

Put `claw` on your `PATH`, or set the full path once:

```powershell
$env:CLAW_BINARY = "C:\Users\YOU\CleanDevEnvironment\Passion\ClawCode\claw-code\rust\target\debug\claw.exe"
clawde
```

The UI shows **Claw** in the header (not `clawde`) and prints **`Rust CLI: …`** at startup with the full path to the engine. If you build with `cargo build` in `claw-code/rust`, that path is detected automatically when you run **`bun run install-global`** once from `claw-code` (it saves the checkout in `%LOCALAPPDATA%\clawde\install.json` on Windows, or `$XDG_CONFIG_HOME/clawde/install.json` / `~/.config/clawde/install.json` on Unix), even if `claw` is not on your `PATH`.

When your shell is in **another** directory, `clawde` still merges **`claw-code/.env`** (and `.env.local`) for any variables not already set by your shell or by the nearest `.env` walking up from the current directory—so API keys and `ANTHROPIC_*` / proxy settings in the checkout apply without copying them into every project.

## Run without global install

From **`claw-code`** (parent of `packages/`):

```bash
bun run clawde
```

Or from **`claw-code/packages/claw-ui`**:

```bash
bun run src/cli.ts
```

## Behavior

- First message starts a **new** session under `.claw/sessions/`.
- Later messages use **`--continue`** against the latest managed session.
- Input starting with **`/`** is passed as a slash CLI argument (e.g. `/help`, `/ultraplan …`), not as `-p` text. Slash commands that the Rust CLI implements as a single model turn (including **`/ultraplan`**) work from `clawde` the same as `claw --output-format json …`.
- By default, `clawde` passes **`--dangerously-skip-permissions`** to `claw` (same effect as full danger mode: no stdin approval prompts) so multi-tool turns are not blocked headless. To use each repo’s configured permission mode instead, set **`CLAWDE_RESPECT_PROJECT_PERMISSIONS=1`** (tool prompts still cannot be answered from `clawde`).

## Troubleshooting

### `HOME is not set` (Windows)

The Rust CLI reads config via `HOME`. In PowerShell, **`HOME` is often unset** while **`USERPROFILE`** is set. The `clawde` UI now sets **`HOME` from `USERPROFILE`** for the `claw` subprocess. You can also set it yourself: `$env:HOME = $env:USERPROFILE`.

### Broken `C:\Users\<you>\package.json` (duplicate `clawde` keys)

If Bun warns about **duplicate key "clawde"** in your user **`package.json`**, that file is invalid JSON-style (duplicate keys). **Edit or remove** that file so it is a single valid object (or delete the file if you do not need it). Stray entries break `bun install` / `bun add`.

### `bun link --global` / `package.json missing "name"` in your user folder

`bun link --global` can look at a **`package.json` in your user home directory** (e.g. `C:\Users\<you>\package.json`). If that file is invalid JSON, has no `"name"`, or contains bad entries like `"dependencies": { "": "." }`, Bun may fail. **Fix or remove** that file, or install with **`bun run install-global`** from the repo (we use `bun pm pack` + `bun install -g` instead of `bun link --global`).

### Another `clawde` on PATH

This repo may ship **`claw-code/bin/clawde.cmd`** (unrelated scripts). If your PATH picks that up first, you may not get the Bun UI. Put **`%USERPROFILE%\.bun\bin`** earlier in PATH, or run the UI with the full path:

```powershell
bun "C:\path\to\claw-code\packages\claw-ui\src\cli.ts"
```

## See also

[`README.md`](../../README.md) and [`PARITY.md`](../../PARITY.md).
