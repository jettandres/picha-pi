# Environment Variable Protection Extension

Prevents sensitive host environment variables (API keys, passwords, tokens) from being accidentally exposed to Claude or stored in session history.

## Features

- 🔒 **Blocks dangerous commands** - `env`, `printenv`, variable references
- 📁 **Blocks sensitive files** - `.env`, secrets, credentials, SSH keys
- 🚫 **Redacts values** - Removes sensitive data from tool output before storage
- 📋 **Audit logging** - Complete event trail with timestamps
- 🔓 **Allowlisting** - Override protection for specific variables per session
- ⚙️ **Configurable modes** - Strict, permissive, or custom patterns
- 💾 **Session persistent** - Logs survive restarts and branches

## Quick Start

### Installation

The extension is auto-discovered from this directory. No additional setup needed.

Verify it's loaded:
```bash
pi
# Should show: [env-protect] Initialized in permissive mode (masking redaction)
```

### Commands

| Command | Purpose |
|---------|---------|
| `/env-protect-status` | Show protection status & statistics |
| `/env-protect-log [count]` | View redaction events (default: 20) |
| `/env-protect-allow VAR` | Allowlist a variable |
| `/env-protect-deny VAR` | Remove from allowlist |
| `/env-protect-clear-log` | Clear audit history |
| `/env-protect-list-patterns` | List all blocked patterns |

### Usage Example

```bash
# Try a dangerous command
env
# ⚠️ Dangerous Command
# This command may expose environment variables
# Continue? (y/n)
# → Type 'n' to block

# Check what was protected
/env-protect-log

# Allowlist a variable
/env-protect-allow DEBUG

# View status
/env-protect-status
```

## Configuration

Create `.pi/extensions/env-protect/config.json` for custom settings:

```json
{
  "mode": "permissive",
  "redactionStrategy": "masking",
  "requireConfirmation": true,
  "auditLog": true,
  "allowlistedVars": ["DEBUG", "NODE_ENV"],
  "patterns": {}
}
```

### Options

- **mode**: `"strict"` | `"permissive"` | `"custom"`
  - `strict` - Block all dangerous operations by default
  - `permissive` - Warn and ask for confirmation (default)
  - `custom` - Use custom patterns

- **redactionStrategy**: `"masking"` | `"hashing"` | `"partial"` | `"full"`
  - `masking` - `[REDACTED: VAR_NAME]` (default)
  - `hashing` - `[HASH: 12345abc]`
  - `partial` - `sk-...xyz` (first 3 + last 4 chars)
  - `full` - `[REDACTED]`

- **requireConfirmation**: `boolean` - Ask before allowing dangerous operations (default: `true`)

- **auditLog**: `boolean` - Log redaction events to session (default: `true`)

- **allowlistedVars**: `string[]` - Variables to never redact (default: `[]`)

- **patterns**: `object` - Custom patterns (empty to use defaults)

## What's Protected

### Variables (35+ patterns)
- API keys, tokens, secrets, passwords
- AWS, GCP, Azure, GitHub credentials
- Database URLs and passwords
- OAuth, Stripe, SendGrid, Slack tokens
- SSH keys, RSA keys, certificates

### Files (19 patterns)
- `.env`, `.env.*`, `.envrc`
- `secrets.*`, `credentials.*`
- `.ssh/`, `.aws/`, `.azure/`, `.gcp/`, `.gnupg/`, `.kube/`
- `.docker/config.json`, `.npmrc`, `.pypirc`

### Commands (5 patterns)
- `env` - Lists all environment variables
- `printenv` - Prints environment
- `set` - Shell built-in
- Commands with `$VARIABLE` references
- Piped env commands

## Security Design

- **Defense in Depth** - Multiple interception points catch different attack vectors
- **Transparency** - Complete audit trail of all protections
- **Non-Destructive** - Original values never stored, only redacted versions
- **User Control** - Users can allowlist or override when necessary
- **Graceful Failure** - Doesn't break functionality

## Performance

- **Startup**: ~1ms (regex compilation)
- **Per Tool Call**: <1ms (pattern matching)
- **Per Tool Result**: <5ms (redaction)
- **Memory**: ~500KB

## Architecture

The extension has 4 main components:

1. **ConfigManager** - Loads config, provides query methods
2. **Redactor** - Performs redaction with 4 strategies
3. **AuditLogger** - Records and retrieves events
4. **Extension Main** - Orchestrates components and hooks events

### Event Hooks

- `session_start` - Initialize and restore state
- `tool_call` - Block dangerous operations
- `tool_result` - Redact sensitive values
- `session_shutdown` - Persist audit logs

## Examples

### Protecting AWS Credentials
```bash
aws configure get aws_access_key_id
# Without: Exposes AKIA1234567890ABCDEF
# With: Stored as [REDACTED: AWS_ACCESS_KEY_ID]
```

### Protecting Database URLs
```bash
echo $DATABASE_URL
# Without: postgres://user:password@host/db
# With: [REDACTED: DATABASE_URL]
```

### Protecting .env Files
```bash
read .env
# Without: Exposes all secrets
# With: Blocked with confirmation
```

## Troubleshooting

### Extension not loading?
```bash
ls -la ~/.pi/agent/extensions/env-protect/ 2>/dev/null || \
ls -la extensions/env-protect/
# Should show all TypeScript files
```

### Too many prompts?
- Switch to `strict` mode in config.json
- Allowlist variables: `/env-protect-allow VAR`
- Set `requireConfirmation: false` in config.json

### Want to disable?
```bash
# Delete or rename the directory and run /reload
rm -rf extensions/env-protect
pi
/reload
```

### Clear logs?
```bash
/env-protect-clear-log
```

## Files

- `index.ts` - Main extension
- `types.ts` - TypeScript definitions
- `patterns.ts` - Sensitive patterns (35+ variables, 19 files, 5 commands)
- `redactor.ts` - Redaction engine (4 strategies)
- `config.ts` - Configuration management
- `logger.ts` - Audit logging
- `commands.ts` - User commands
- `config.json.example` - Example configuration

## Technology

- **Language**: TypeScript 5.0+
- **Runtime**: Node.js 18+
- **Framework**: Pi Extension API
- **Dependencies**: None (uses only Node.js built-ins)

## Future Enhancements

- [ ] ML-based secret detection
- [ ] Vault integration (HashiCorp, AWS Secrets Manager)
- [ ] Compliance reporting
- [ ] Real-time alerts
- [ ] SSH remote protection

## License

This extension is part of the picha-pi project.

## Support

For issues or questions, check the troubleshooting section above or review the source code in this directory.
