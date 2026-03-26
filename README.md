# Pi Coding Agent Extensions

A personal collection of [Pi coding agent](https://github.com/badlogic/pi-mono) extensions I use to enhance and secure my agentic coding workflow.

## Extensions

### Safety & Security

- **block-env-exposure** - Prevents the agent from exposing environment variables in code or outputs
- **confirm-destructive** - Prompts for confirmation before running destructive commands (rm, etc.)
- **dirty-repo-guard** - Warns when making changes to a repository with uncommitted changes
- **permission-gate** - Requires explicit confirmation for sensitive operations
- **protected-paths** - Prevents modifications to critical files and directories
- **purpose-gate** - Ensures agent stays focused on the stated purpose of the task

### User Experience

- **question** - Enhanced question/prompt UI with better formatting
- **questionnaire** - Multi-question form system for gathering user input
- **status-line** - Custom status line for the Pi agent TUI
- **subagent-widget** - Widget for managing and displaying subagent information

### Advanced Features

- **plan-mode** - Adds planning capabilities to the agent workflow
- **sandbox** - Isolated execution environment for experimental code
- **confirm-install** - Requires confirmation before installing packages or dependencies

## Setup

```bash
# Build TypeScript extensions
npm run build

# Extensions are compiled to JavaScript in the extensions/ directory
```

## Usage

Load extensions on a per-session basis using the `-e` flag:

```bash
# Load a single extension
pi -e extensions/block-env-exposure

# Load multiple extensions
pi -e extensions/block-env-exposure -e extensions/confirm-destructive -e extensions/dirty-repo-guard
```

## Notes

This is a personal project. Extensions are tailored to my specific workflow and security requirements. Feel free to adapt them for your own use!
