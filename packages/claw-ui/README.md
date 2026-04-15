# clawde (Bun UI)

Interactive shell for the Claw agent: [@clack/prompts](https://github.com/natemoo-re/clack) for input; each turn runs the engine CLI with `--output-format json`.

## Global command: `clawde`

After a **one-time** global link, you can run **`clawde`** from any directory.

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

The UI shows **Claw** in the header (not `clawde`) and prints **`Rust CLI: …`** at startup with the full path to the engine. If you build with `cargo build` in `claw-code/rust`, that path is detected automatically even when `claw` is not on your PATH.

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
- Input starting with **`/`** is passed as a slash CLI argument (e.g. `/help`), not as `-p` text.

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
