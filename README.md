# Agentic Coding Environment

Isolated Docker environment for agentic coding with [Pi](https://github.com/badlogic/pi-mono), LazyVim, and essential dev tools.

**Base**: Arch Linux (rolling release)

## What's Included

- **Pi** - Minimal terminal AI coding agent by Mario Zechner
- **LazyVim** - Pre-configured Neovim with plugins
- **lazygit** - Terminal git UI
- **asdf** - Version manager for:
  - Node.js 22
  - Go 1.22
  - Python 3.12
- Docker + buildx + compose
- Essential tools: git, ripgrep, fd, jq, htop, tree, tmux, etc.

## Quick Start

```bash
export ANTHROPIC_API_KEY=sk-ant-...
make up
make shell
```

## Makefile Commands

| Target | Description |
|--------|-------------|
| `make build` | Build the Docker image |
| `make up` | Start the container |
| `make down` | Stop the container |
| `make shell` | Open shell in container |
| `make logs` | View container logs |
| `make clean` | Stop and remove image |

## Volumes

| Path | Description |
|------|-------------|
| `./data` | Persistent storage at `/home/agent/data` |
| `~/.ssh` | SSH keys for git access |
| `../` | Parent dir mounted as `/workspace` |

## Environment Variables

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=...
export GEMINI_API_KEY=...
```

## Inside the Container

```bash
pi       # Start Pi coding agent
nvim     # Open LazyVim
lazygit  # Git TUI
tmux     # Terminal multiplexer
```
