# Agentic Coding Environment

Isolated Docker environment for agentic coding with [Pi](https://github.com/badlogic/pi-mono), Neovim, and essential dev tools.

**Base**: Arch Linux (rolling release)

## What's Included

- **Pi** - Minimal terminal AI coding agent by Mario Zechner
- Neovim - Bare minimum installation
- **lazygit** - Terminal git UI
- **asdf** - Version manager for:
  - Node.js 22
  - Go 1.22
  - Python 3.12
- Docker + buildx + compose
- Essential tools: git, ripgrep, fd, jq, htop, tree, tmux, etc.

## Quick Start

```bash
# Edit secrets file with your API keys
nano secrets/env

# Build and run
make build
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

## Secrets

API keys are stored in `secrets/env` (gitignored):

```bash
OPENCODE_API_KEY=your_opencode_api_key_here
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=...
```

## Inside the Container

```bash
pi       # Start Pi coding agent
nvim     # Open Neovim
lazygit  # Git TUI
tmux     # Terminal multiplexer
```
