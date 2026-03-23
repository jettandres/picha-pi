# Bubblewrap Sandbox Extension for Pi Coding Agent

This extension provides OS-level sandboxing for bash commands using bubblewrap, designed for secure multi-agent orchestration.

## Features

- Filesystem isolation with configurable read/write permissions
- Network isolation with domain-based filtering via socat
- Process isolation with PID namespaces
- Resource limiting (execution time)
- Agent-specific isolation for multi-agent scenarios
- Comprehensive logging and monitoring
- Multiple security levels (strict, moderate, permissive)
- Secure inter-agent communication channels via socat

## Installation

1. Ensure required tools are installed on your system:
   ```bash
   # Ubuntu/Debian
   sudo apt install bubblewrap socat ripgrep
   
   # Fedora/RHEL
   sudo dnf install bubblewrap socat ripgrep
   
   # Arch Linux
   sudo pacman -S bubblewrap socat ripgrep
   ```

2. The extension is automatically available in this project.

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
- `/sandbox-agents` - Show active sandboxed agents (future feature)

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

## Limitations

- Memory and CPU limiting requires cgroups integration (planned)
- Domain-based network filtering requires additional tools (planned)
- File access auditing is basic (planned enhancement)
- Inter-agent communication controls are minimal (planned)

## Contributing

Feel free to contribute enhancements, particularly in the areas of:
- Advanced resource limiting
- Network traffic inspection
- File access monitoring
- Security hardening
- Multi-agent coordination features

## Socat Integration

This extension leverages socat to provide enhanced network controls:

### Features
- **Domain-based filtering**: Only allow connections to approved domains  
- **Network traffic monitoring**: Log and monitor all HTTP/HTTPS requests
- **Agent-specific proxies**: Each agent gets its own network proxy
- **Secure inter-agent communication**: Controlled communication channels
- **Bandwidth limiting potential**: Framework for per-agent network quotas

### Configuration
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

When enabled, network traffic from sandboxed agents is routed through 
socat-based proxies that can implement domain filtering and monitoring.