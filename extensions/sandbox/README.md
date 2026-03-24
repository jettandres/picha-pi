# Sandbox Extension for Pi Coding Agent

This extension provides OS-level sandboxing for bash commands with platform-specific implementations:
- **Linux**: Uses bubblewrap with socat for network filtering
- **macOS**: Uses Apple's native `sandbox-exec` for isolation

Designed for secure multi-agent orchestration.

## Quick Start

### macOS (No installation needed!)
```bash
pi -e ./sandbox
/sandbox          # View configuration
/sandbox-agents   # View active agents
```

### Linux
Install required tools first:
```bash
sudo apt install bubblewrap socat ripgrep  # Ubuntu/Debian
# or: sudo dnf install bubblewrap socat ripgrep  # Fedora/RHEL
# or: sudo pacman -S bubblewrap socat ripgrep  # Arch Linux
```

Then start Pi:
```bash
pi -e ./sandbox
```

## Features

- Filesystem isolation with configurable read/write permissions
- Network isolation with domain-based filtering
- Process isolation with namespaces (Linux) or sandbox profiles (macOS)
- Resource limiting (execution time)
- Agent-specific isolation for multi-agent scenarios
- Comprehensive logging and monitoring
- Multiple security levels (strict, moderate, permissive)
- Secure inter-agent communication channels
- Cross-platform support (Linux + macOS)

## Installation

### Linux
1. Ensure required tools are installed:
   ```bash
   # Ubuntu/Debian
   sudo apt install bubblewrap socat ripgrep
   
   # Fedora/RHEL
   sudo dnf install bubblewrap socat ripgrep
   
   # Arch Linux
   sudo pacman -S bubblewrap socat ripgrep
   ```

### macOS
The extension uses Apple's built-in `sandbox-exec` utility, so no additional installation is required.

### Extension Setup
The extension is automatically available in this project.

## Configuration

Create a `.pi/sandbox.json` file in your project root or `~/.pi/agent/sandbox.json` for global settings:

```json
{
  "enabled": true,
  "securityLevel": "moderate",
  "maxExecutionTime": 30,
  "maxMemoryMB": 512,
  "network": {
    "allowedDomains": ["github.com", "*.github.com"],
    "deniedDomains": []
  },
  "filesystem": {
    "denyRead": ["~/.ssh", "~/.aws"],
    "allowWrite": [".", "/tmp"],
    "denyWrite": [".env"]
  }
}
```

See [sample-config.json](sample-config.json) for a complete example configuration.

### Directory Structure

```
sandbox/
├── index.ts                    # Extension entry point
├── macos-operations.ts         # macOS-specific implementation
├── osx-profiles/               # macOS sandbox security profiles
│   ├── strict.sb              # Maximum isolation
│   ├── moderate.sb            # Balanced security (default)
│   └── permissive.sb          # Minimal restrictions
├── README.md                   # This file
└── default-config.json         # Default configuration
```

### Security Levels

- **strict**: Maximum isolation, no network access
- **moderate**: Limited network access with domain filtering
- **permissive**: Allow network with filtering (requires additional setup)

## Usage

Enable the extension when starting Pi:

```bash
pi -e ./sandbox
```

Disable sandboxing:

```bash
pi -e ./sandbox --no-sandbox
```

## Commands

- `/sandbox` - Show current sandbox configuration
- `/sandbox-level [level]` - Switch security level (strict, moderate, permissive)
  - Without argument: Interactive selection menu
  - With argument: Direct switch (e.g., `/sandbox-level strict`)
- `/sandbox-agents` - Show active sandboxed agents

### Examples

```
/sandbox                    # View current config
/sandbox-level              # Interactive level selector
/sandbox-level strict       # Switch directly to strict
/sandbox-level moderate     # Switch directly to moderate
/sandbox-level permissive   # Switch directly to permissive
/sandbox-agents             # List active agents
```

## Multi-Agent Orchestration

This extension is designed to support multi-agent scenarios where multiple AI agents need to run in isolated environments while coordinating with each other. Future enhancements will include:

- Per-agent filesystem quotas
- Inter-agent communication controls
- Resource allocation policies
- Enhanced monitoring and logging
- Advanced threat detection

## Security Considerations

While bubblewrap provides strong isolation, additional guard rails have been implemented:

1. Time-based execution limits
2. File access restrictions
3. Network domain filtering
4. Process isolation
5. User namespace separation
6. Capability dropping
7. Secure temporary file handling

## Platform Support

| Platform | Status | Requirements |
|----------|--------|--------------|
| **Linux** | ✅ Fully Supported | bubblewrap, socat, ripgrep |
| **macOS** | ✅ Fully Supported | None (built-in sandbox-exec) |
| **Windows** | ❌ Not Supported | Planned (Windows Sandbox API) |

## Limitations

### Linux
- Memory and CPU limiting requires cgroups integration (planned)
- Domain-based network filtering requires additional tools (planned)
- File access auditing is basic (planned enhancement)
- Inter-agent communication controls are minimal (planned)

### macOS
- Sandbox profiles use basic regex patterns (could be enhanced with more granular rules)
- Network filtering relies on HTTP_PROXY environment variable (advanced filtering planned)
- Memory limiting not yet implemented
- Resource quotas require additional integration

### Windows
- Windows support is not yet implemented
- Planned future enhancement using Windows Sandbox or AppContainer APIs

## Contributing

Feel free to contribute enhancements, particularly in the areas of:
- Advanced resource limiting
- Network traffic inspection
- File access monitoring
- Security hardening
- Multi-agent coordination features

## Platform-Specific Details

### Linux: Bubblewrap + Socat

This extension leverages bubblewrap for process isolation and socat for network controls:

#### Features
- **Domain-based filtering**: Only allow connections to approved domains  
- **Network traffic monitoring**: Log and monitor all HTTP/HTTPS requests
- **Agent-specific proxies**: Each agent gets its own network proxy
- **Secure inter-agent communication**: Controlled communication channels
- **Process-level isolation**: Complete namespace separation

#### Configuration
Enable socat integration in your sandbox configuration:
```json
{
  "network": {
    "useSocatProxy": true,
    "proxyPort": 8080,
    "allowedDomains": ["github.com", "*.github.com"]
  }
}
```

### macOS: Sandbox Exec

macOS uses Apple's native `sandbox-exec` with declarative security profiles:

#### Sandbox Profiles
The extension includes three security profiles (in `osx-profiles/` directory):

- **`strict.sb`** - Maximum isolation
  - No network access
  - Read-only access to system directories
  - Write access only to `/tmp` and working directory
  - Ideal for untrusted code

- **`moderate.sb`** - Balanced isolation (default)
  - Limited network access (no broadcast, filtered domains)
  - Read access to user documents
  - Write access to working directory and `/tmp`
  - Good for general use

- **`permissive.sb`** - Minimal restrictions
  - Full network access
  - Read/write access to most directories
  - Primarily for audit and monitoring

#### How It Works
The extension dynamically generates sandbox profiles by:
1. Loading the base profile for your security level
2. Adding your working directory to the allowed paths
3. Applying custom filesystem rules from configuration
4. Writing a temporary profile and passing it to `sandbox-exec`

Example generated profile snippet:
```scheme
(allow file-read* (regex #"^/path/to/project(/.*)?$"))
(allow file-write* (regex #"^/path/to/project(/.*)?$"))
(deny file-write* (regex #"^.*\.env.*"))
(deny file-write* (regex #"^.*\.pem$"))
```