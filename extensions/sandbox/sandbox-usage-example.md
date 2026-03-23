# Sandbox Extension Usage Examples

## Basic Usage

To enable the sandbox extension:

```bash
pi -e ./sandbox
```

To disable sandboxing:

```bash
pi -e ./sandbox --no-sandbox
```

## Configuration

Create a `.pi/sandbox.json` in your project with custom settings:

```json
{
  "enabled": true,
  "securityLevel": "moderate",
  "maxExecutionTime": 30,
  "network": {
    "allowedDomains": ["api.github.com", "github.com"],
    "deniedDomains": ["evil-site.com"]
  },
  "filesystem": {
    "denyRead": ["~/.ssh", "~/.aws"],
    "allowWrite": [".", "/tmp"],
    "denyWrite": [".env"]
  }
}
```

## Multi-Agent Orchestration

The sandbox extension supports agent-specific isolation for multi-agent scenarios:

### Agent-Specific Tool

Use the `agent_bash` tool to execute commands in agent-isolated environments:

Parameters:
- `command`: The bash command to execute
- `agentId`: Unique identifier for the agent
- `cwd` (optional): Working directory
- `timeout` (optional): Execution timeout in seconds

Example:
```json
{
  "name": "agent_bash",
  "arguments": {
    "agentId": "research-agent-1",
    "command": "curl -s https://api.github.com/repos/user/repo",
    "timeout": 10
  }
}
```

### Benefits for Multi-Agent Systems

1. **Isolation**: Each agent runs in its own sandboxed environment
2. **Resource Control**: Agent-specific resource limits
3. **Security**: Prevent agents from interfering with each other
4. **Monitoring**: Track agent activities separately
5. **Coordination**: Controlled communication channels between agents

## Security Levels

### Strict
- Complete network isolation
- Minimal filesystem access
- Maximum security, least functionality

### Moderate (Default)
- Limited network access with domain filtering
- Controlled filesystem access
- Good balance of security and functionality

### Permissive
- Full network access
- Relaxed filesystem restrictions
- Least secure, most functional

## Commands

- `/sandbox` - Show current configuration
- `/sandbox-agents` - List active sandboxed agents

## Best Practices

1. Always use the strictest security level that meets your needs
2. Regularly review allowed domains and filesystem permissions
3. Monitor sandboxed agent activities
4. Set appropriate timeouts to prevent resource exhaustion
5. Use agent-specific configurations for complex multi-agent systems