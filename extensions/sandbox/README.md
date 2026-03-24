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

### Termux (Android)
```bash
pkg install proot              # Install PRoot for sandboxing
pi -e ./sandbox                # Start Pi with sandbox
/sandbox                       # View configuration
/sandbox-agents                # View active agents
```

For detailed Termux setup, see [TERMUX_SETUP.md](TERMUX_SETUP.md)

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
| **Termux (Android)** | ✅ Fully Supported | proot, socat (optional) |
| **Windows** | ❌ Not Supported | Planned (Windows Sandbox API) |

## Limitations

### Linux
- Memory and CPU limiting requires cgroups integration (planned)
- Domain-based network filtering requires additional tools (planned)
- File access auditing is basic (planned enhancement)
- Inter-agent communication controls are minimal (planned)

### Termux
- PRoot has ~10-30% performance overhead due to syscall interception
- Memory limiting is soft (via ulimit, not strict kernel limits)
- Network filtering requires socat (optional but recommended)
- Cannot sandbox privileged operations (non-applicable in Termux's user-only model)
- Startup time ~50-200ms per command for isolated filesystem creation

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

### Termux: PRoot Containerization

Termux uses **PRoot** for lightweight containerization without requiring root:

#### Key Features
- **No root required** - Works on any Android device (rooted or not)
- **Filesystem isolation** - Per-agent isolated root filesystems using ptrace
- **Network filtering** - Optional socat proxy for domain-based filtering
- **Resource limits** - Execution time and memory limits via timeout and ulimit
- **Multi-agent support** - Each agent gets its own isolated environment

#### How PRoot Works
**PRoot** uses `ptrace` (system call tracing) to provide filesystem isolation **without requiring a rooted device**:
- Intercepts system calls
- Rewrites file paths to isolated roots
- No kernel modules needed
- No root/sudo required

Example:
```
Your Command
    ↓
PRoot (intercepts syscalls via ptrace)
    ↓
Rewrites paths → Isolated filesystem
    ↓
Safe execution
```

#### Installation

In Termux, run:

```bash
pkg install proot              # Required
pkg install socat              # Optional, for network filtering
```

Then verify:
```bash
proot --version
```

#### Quick Setup

```bash
# 1. Install PRoot
pkg install proot

# 2. Start Pi with sandbox
pi -e ./sandbox

# 3. View configuration
/sandbox

# 4. Switch security level
/sandbox-level moderate
```

#### Security Levels

**`strict` - Maximum Isolation**
- ✅ Completely isolated filesystem
- ✅ No access to your home directory
- ✅ No network access
- ❌ Very restrictive (scripts need to be self-contained)

**`moderate` - Balanced Security (Default)**
- ✅ Isolated home with workspace access
- ✅ Network via proxy (if socat configured)
- ✅ Good for most scripts
- ✅ Safe multi-agent isolation

**`permissive` - More Open**
- ✅ Full home directory access (still virtualized)
- ✅ Network access
- ✅ Less restrictive
- ⚠️ For trusted environments only

#### Configuration

**Basic Configuration**

Create `.pi/sandbox.json` in your project:

```json
{
  "enabled": true,
  "securityLevel": "moderate",
  "maxExecutionTime": 30,
  "maxMemoryMB": 512,
  "network": {
    "allowedDomains": ["github.com", "*.github.com"],
    "useSocatProxy": false
  },
  "filesystem": {
    "allowWrite": [".", "/data/local/tmp"]
  }
}
```

**With Network Filtering (socat)**

```json
{
  "enabled": true,
  "securityLevel": "moderate",
  "network": {
    "allowedDomains": ["github.com", "api.github.com", "*.githubusercontent.com"],
    "useSocatProxy": true,
    "proxyPort": 8080
  }
}
```

**Resource Limits**

```json
{
  "maxExecutionTime": 60,    // Timeout after 60 seconds
  "maxMemoryMB": 256         // Limit memory to 256MB (via ulimit)
}
```

#### Commands

```bash
/sandbox                      # View current configuration
/sandbox-level               # Interactive menu to switch level
/sandbox-level strict        # Direct switch to strict
/sandbox-level moderate      # Direct switch to moderate
/sandbox-level permissive    # Direct switch to permissive
/sandbox-agents             # List active sandboxed agents
```

#### Termux-Specific Features

**Storage Access**

Termux sandboxing respects Termux storage permissions:

```bash
# Request storage access in Termux
termux-setup-storage

# Then these paths are available:
$HOME/storage/shared    # External storage
$HOME/storage/downloads # Downloads folder
```

**Shared Temporary Directory**

Use `/data/local/tmp` for inter-process communication:

```json
{
  "filesystem": {
    "allowWrite": ["/data/local/tmp"]
  }
}
```

**Available Packages**

PRoot provides access to all Termux packages installed under `$PREFIX`:

```bash
# Using git inside sandbox
git clone https://github.com/user/repo

# Python script
python3 script.py

# Node.js
node app.js
```

**Performance Characteristics**

PRoot has some overhead due to system call interception:

- **Startup**: ~50-200ms per command
- **Execution**: ~10-30% slower than native
- **Memory**: ~5-15MB per sandbox

This is acceptable for CLI tools and typical scripts.

#### Multi-Agent Support

The sandbox extension supports coordinating multiple agents:

```typescript
// Agent 1: Data processor (isolated)
const result1 = await agent1.bash("process_data.sh");

// Agent 2: Analysis (isolated from agent1)
const result2 = await agent2.bash("analyze.sh");

// Agent 3: Reporting (isolated from both)
const result3 = await agent3.bash("generate_report.sh");
```

Each agent runs in its own sandboxed environment with isolated filesystems.

#### Troubleshooting

**"PRoot not found" Error**

Install PRoot:
```bash
pkg install proot
```

**Slow Execution**

PRoot adds overhead due to syscall tracing. For performance-critical tasks:

1. Use `permissive` mode to reduce isolation overhead
2. Batch commands together to amortize startup cost
3. Consider disabling sandbox: `pi -e ./sandbox --no-sandbox`

**Permission Denied in Sandbox**

This is expected for protected system directories. Ensure your command writes to:
- `.` (current directory)
- `/tmp` or `/data/local/tmp`
- Workspace directories in `$HOME`

**Network Issues**

If network isn't working:

1. Ensure socat is installed: `pkg install socat`
2. Check proxy configuration in `.pi/sandbox.json`
3. Verify allowed domains match your targets
4. Test directly: `curl https://github.com`

**Sandbox Takes Too Long to Clean Up**

PRoot creates isolated filesystems that are cleaned up after each command. On slow storage, this may take a few seconds. This is normal.

#### Advanced: Custom Mounts

The extension automatically mounts:

- `/system` (read-only) - System binaries
- `$PREFIX` - Termux packages
- `.` (current directory) - Your project
- `/tmp` - Temporary files

To add custom mounts, modify `termux-operations.ts`:

```typescript
// In createPRootCommand()
args.push("-b", "/custom/path:/custom/path");
```

#### Security Best Practices

1. **Use `strict` mode** for untrusted scripts
2. **Enable network filtering** for external data sources
3. **Set execution timeouts** to prevent runaway scripts
4. **Monitor active agents** with `/sandbox-agents`
5. **Isolate sensitive operations** in separate agents

#### Resources

- **Termux**: https://termux.dev
- **PRoot**: https://proot-me.github.io/
- **Termux Wiki**: https://wiki.termux.com

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