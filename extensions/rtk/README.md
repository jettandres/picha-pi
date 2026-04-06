# RTK Extension for Pi

[RTK](https://github.com/rtk-ai/rtk) (Rust Token Killer) transparently rewrites shell commands to save 60-90% tokens. This extension integrates RTK with Pi to automatically optimize all bash commands.

## Install

**Enable extension:**

This extension is auto-discovered in `.pi/extensions/rtk/` (project) or `~/.pi/agent/extensions/rtk/` (global).

Or pass explicitly:
```bash
pi -e /path/to/picha-pi/extensions/rtk/
```

**RTK Binary:**

On startup, if RTK is not found in `$PATH`, the extension will prompt you to install it automatically using the official RTK install script. You can also use `/rtk-install` anytime to install manually.

## How It Works

The extension hooks `tool_call` and intercepts bash commands. For each command, it calls `rtk rewrite` to get the optimized version (e.g., `git status` → `rtk git status`). The compressed output saves tokens.

```
bash: "git status"
  ↓
rtk rewrite → "rtk git status"
  ↓
execute → compressed output → context window saved
```

All rewrite logic lives in RTK. This extension is just a thin delegate — when RTK adds filters, the extension picks them up automatically.

## Usage

Rewrites happen automatically:

```bash
git status              → rtk git status
cargo test              → rtk test cargo test
grep "pattern" .        → rtk grep "pattern" .
npm run build           → rtk err npm run build
```

**Commands in Pi:**
- `/rtk-stats` — Show rewrite count and estimated tokens saved
- `/rtk-toggle` — Enable/disable RTK for this session
- `/rtk-install` — Install RTK binary (Homebrew or quick install)

## Configuration

```bash
RTK_EXTENSION_ENABLED=true      # Enable/disable (default: true)
RTK_EXTENSION_VERBOSE=true      # Log rewrites (default: false)
RTK_EXTENSION_DRY_RUN=true      # Test mode, don't execute (default: false)
```

## What Gets Rewritten

RTK supports 100+ commands:

- **Git:** status, diff, log, add, commit, push, pull
- **Build/Test:** cargo, npm, pytest, go test, rspec, vitest
- **Files:** ls, find, grep, cat, docker, kubectl
- **Lint:** eslint, ruff, rubocop, tsc, prettier

See [RTK README](https://github.com/rtk-ai/rtk#commands) for full list.

## What's NOT Rewritten

- Commands already using `rtk`
- Piped/combined commands (`|`, `&&`, `;`)
- Heredocs (`<<`)
- No matching RTK filter

## Token Savings Examples

| Command | Std | RTK | Save |
|---------|-----|-----|------|
| git status | ~200 | ~50 | -75% |
| cargo test | ~10k | ~800 | -92% |
| ls -la | ~800 | ~150 | -81% |

**Session:** 30-min dev session: ~118k → ~24k tokens (-80%)

## Implementation

- **Rewrite latency:** <10ms per command (RTK's built-in speed)
- **Extension overhead:** <1ms
- **Concurrency:** Commands execute in parallel, no serialization
- **Error handling:** If RTK unavailable, commands pass through unchanged; very long commands (>10KB) skipped
- **Stats:** In-memory tracking of rewrites and estimated tokens saved

## Comparison to OpenClaw Plugin

| Aspect | OpenClaw | Pi Extension |
|--------|----------|--------------|
| Rewrite mechanism | `before_tool_call` | `tool_call` event |
| User feedback | None | `/rtk-stats`, `/rtk-toggle`, notifications |
| Extensibility | Limited | Full Pi API (future: compaction, etc.) |

## Future

- Session persistence (save stats across restarts)
- RTK gain dashboard integration
- Per-command-type toggles (e.g., disable for cargo, keep git)
- Compaction hook for long sessions

## See Also

- [RTK GitHub](https://github.com/rtk-ai/rtk)
- [OpenClaw Plugin](https://github.com/rtk-ai/rtk/tree/master/openclaw)
- [Pi Extensions Docs](../../../docs/extensions.md)
