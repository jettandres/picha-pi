# Agentic Coding Environment

Isolated Docker environment for agentic coding with [Pi](https://github.com/badlogic/pi-mono), LazyVim, and essential dev tools.

## What's Included

- **Pi** - Minimal terminal AI coding agent by Mario Zechner
- **LazyVim** - Pre-configured Neovim with plugins
- **lazygit** - Terminal git UI
- **asdf** - Version manager for:
  - Node.js 22
  - Go 1.22
  - Python 3.12
- Docker + buildx + compose
- Essential tools: git, ripgrep, fd-find, jq, htop, tree, tmux, etc.

## Build

```bash
docker build -t agentic-env .
```

## Run

```bash
docker run -it --privileged \
  -v $(pwd):/workspace \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  agentic-env
```

- `--privileged` - Required for Docker-in-Docker
- `-v $(pwd):/workspace` - Mount current directory as workspace
- Add `-v ~/.ssh:/home/agent/.ssh:ro` for git SSH access

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `OPENAI_API_KEY` | OpenAI API key |
| `GEMINI_API_KEY` | Google Gemini API key |

## Quick Start

After entering the container:

```bash
pi  # Start Pi coding agent
```

```bash
nvim  # Open LazyVim
```

```bash
lazygit  # Git TUI
```

## Default User

- Username: `agent`
- Password: `agent`
- Has sudo and docker group access
