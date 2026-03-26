# Pi Extension: Environment Variable Protection

## Overview

Create a Pi coding agent extension that prevents sensitive host environment variables from being accidentally exposed to the LLM or stored in session history. This protects secrets like API keys, database passwords, and other credentials from being inadvertently included in conversations.

## Problem Statement

When Claude (or any LLM) analyzes code or system output, it may encounter or be asked to process environment variables. Without protection, sensitive values like:
- API keys (`OPENAI_API_KEY`, `DATABASE_URL`, etc.)
- Secrets and credentials (`AWS_SECRET_ACCESS_KEY`, `GITHUB_TOKEN`)
- Private URLs and configurations
- Personal information (email, username, tokens)

...could be captured in:
1. Bash tool output when users run `env`, `printenv`, or scripts that echo env vars
2. File contents when `.env` files or config files are read
3. Tool result messages stored in session history
4. System prompt context or conversation context

## Solution Architecture

### Extension Components

#### 1. **Configuration System**
- Define a list of sensitive environment variable patterns (regex-based)
- Allow users to customize blocked patterns via config file
- Support both global patterns (default sensitive vars) and project-specific overrides
- Default patterns should include common sensitive variables:
  - `*API*KEY`, `*TOKEN`, `*SECRET`, `*PASSWORD`
  - `AWS_*`, `GCP_*`, `AZURE_*`, `GITHUB_*`
  - Database URLs: `DATABASE_URL`, `DB_*`
  - Private keys: `*_PRIVATE_KEY`, `*_SSH*`
  - And others

#### 2. **Interception Points**

**Tool Interception via `tool_call` event:**
- Hook the `bash` tool to detect and block potentially problematic commands
- Block commands like `env`, `printenv`, `echo $*`, variable substitution patterns
- Commands that would expose environment variables
- Option to allow with user confirmation

**Tool Result Filtering via `tool_result` event:**
- Scan bash tool output for environment variable patterns
- Sanitize detected values (redact/mask) before storing in session
- Log what was redacted for transparency
- Apply to file reads, grep results, and other output

**File Access via `tool_call` event:**
- Block reading of sensitive files (`.env`, `.env.*`, `secrets.*`, `credentials.*`)
- Similar to the example tool-override extension but for environment protection

#### 3. **Redaction Strategy**

When sensitive environment variables are detected in tool output:
- **Masking:** Replace with placeholder like `[REDACTED: VAR_NAME]`
- **Hashing:** Optional one-way hash to allow pattern matching without exposing value
- **Partial exposure:** Show first/last N chars (e.g., `sk-...xyz` for OpenAI keys)
- **Logging:** Store what was redacted (with timestamp) for audit trail

#### 4. **User Controls**

**Commands:**
- `/env-protect-status` - Show current protection settings and what was redacted
- `/env-protect-log` - View redaction audit log
- `/env-protect-allow VAR` - Temporarily allow a specific variable
- `/env-protect-config` - Edit redaction patterns

**Confirmation Prompts:**
- When bash command would expose env vars, ask user for confirmation
- Option to proceed anyway or use alternative command
- Option to mark variable as safe for this session

#### 5. **Session Integration**

- Use `pi.appendEntry()` to persist redaction logs for auditing
- Store allowed/denied decisions in session for consistency
- Use session events to reconstruct redaction state on reload
- Support branching (each branch can have different redaction decisions)

#### 6. **Multiple Operating Modes**

- **Strict Mode:** Block all potentially dangerous commands by default
- **Permissive Mode:** Allow with warnings and redaction
- **Custom Mode:** User-defined pattern matching and behavior

## Implementation Approach

### File Structure

```
~/.pi/agent/extensions/
└── env-protect/
    ├── index.ts                 # Main extension entry point
    ├── config.ts               # Configuration loading and management
    ├── patterns.ts             # Sensitive variable patterns (default & user)
    ├── redactor.ts            # Redaction logic
    ├── commands.ts            # Extension commands
    ├── logger.ts              # Audit logging
    └── types.ts               # TypeScript interfaces
```

### Key Events to Hook

1. **`session_start`** 
   - Load configuration
   - Restore redaction state from previous session
   - Initialize redaction logger

2. **`tool_call`** 
   - Intercept bash, read, and grep tool calls
   - Check for problematic commands or paths
   - Ask for confirmation if necessary
   - Block if unsafe

3. **`tool_result`**
   - Scan output for environment variable values
   - Redact sensitive data before storing
   - Log what was redacted

4. **`session_shutdown`**
   - Save redaction audit log
   - Clean up temporary state

### Dependencies

- **Built-in only** - No external npm dependencies (uses Node.js built-ins)
- TypeBox for schema definitions (already available)
- Pi's built-in types and utilities

## Configuration Schema

Users can create `.pi/extensions/env-protect/config.json`:

```json
{
  "mode": "strict",
  "patterns": {
    "blocked_vars": [
      ".*API.*KEY.*",
      ".*TOKEN.*",
      ".*SECRET.*",
      "DATABASE_URL",
      "AWS_SECRET_ACCESS_KEY"
    ],
    "blocked_files": [
      "\\.env$",
      "\\.env\\..+$",
      "secrets\\.(json|yaml|yml|toml)$",
      "credentials\\.(json|yaml|yml|toml)$"
    ],
    "blocked_commands": [
      "env",
      "printenv",
      "set"
    ]
  },
  "redaction_strategy": "masking",
  "require_confirmation": true,
  "audit_log": true
}
```

## Security Considerations

1. **Defense in Depth:** Multiple interception points catch different attack vectors
2. **Transparency:** Users see what was redacted via audit logs
3. **Audit Trail:** All redaction decisions logged for review
4. **Non-destructive:** Original values never logged to session, only redacted versions
5. **User Control:** Users can whitelist specific variables or commands
6. **Graceful Degradation:** If redaction fails, warn but don't crash

## Benefits

- **Prevents Accidental Exposure:** Blocks common ways secrets leak into LLM context
- **Audit Trail:** Know exactly what was redacted and when
- **Flexible:** Users can customize patterns for their organization
- **Zero Configuration:** Works out-of-the-box with sensible defaults
- **Per-Session Control:** Decisions can vary by branch/session

## Testing Strategy

1. **Unit Tests:** 
   - Pattern matching against sample env vars
   - Redaction logic with various strategies
   - Config parsing

2. **Integration Tests:**
   - Tool call interception
   - Session state persistence
   - Command execution

3. **Manual Testing:**
   - Run bash commands that would expose env vars
   - Verify redaction in tool results
   - Check session history for secrets
   - Test confirmation prompts
   - Test custom config loading

## Future Enhancements

1. **ML-based Detection:** Learn common secrets in repo (API keys in config files)
2. **Remote Integration:** Support SSH/remote bash with same protections
3. **Compliance Reporting:** Generate audit reports for compliance audits
4. **Variable Allowlisting:** Instead of blocklist, use allowlist mode
5. **Integration with External Vaults:** Check against HashiCorp Vault, AWS Secrets Manager
6. **Real-time Alerts:** Notify on sensitive variable exposure attempts
7. **Repository Scanning:** Scan for existing secrets before interception starts

## Related Examples

This extension combines concepts from:
- `tool-override.ts` - Overriding and wrapping tools with logging
- `confirm-destructive.ts` - User confirmation for sensitive actions
- `path-protection.ts` - Blocking access to sensitive paths
- Custom tool execution and result filtering

## Success Criteria

- ✅ Prevents common environment variable leakage patterns
- ✅ Provides clear audit trail of what was protected
- ✅ Zero false negatives on default sensitive patterns
- ✅ Minimal false positives (doesn't block non-sensitive vars)
- ✅ Easy to configure per project
- ✅ Works across session branching and fork operations
- ✅ Doesn't break existing tool functionality
