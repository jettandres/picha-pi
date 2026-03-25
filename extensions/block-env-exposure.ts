/**
 * Extension: Block Environment Variable Exposure
 * 
 * Prevents Pi from reading sensitive environment variables and related files.
 * Blocks:
 * - Reading .env, .env.local, .env.*.local files
 * - Reading shell config files (~/.bashrc, ~/.zshrc, ~/.profile, etc.)
 * - Reading SSH/AWS/GCP credential files
 * - Bash commands that expose environment variables (env, printenv, echo $VAR, etc.)
 * - Reading /proc/self/environ and similar system env sources
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// List of sensitive file patterns that should not be read
const SENSITIVE_FILE_PATTERNS = [
  // Environment files
  /\.env(\.local|\.development|\.production|\.test)?$/i,
  /\.env\.\w+$/i,
  
  // Shell config files (may contain exported env vars)
  /\/\.bashrc$/i,
  /\/\.zshrc$/i,
  /\/\.profile$/i,
  /\/\.bash_profile$/i,
  /\/\.zsh_profile$/i,
  /\/\.kshrc$/i,
  /\/\.config\/fish\/config\.fish$/i,
  
  // AWS/GCP/Azure credentials
  /\/\.aws\/credentials$/i,
  /\/\.aws\/config$/i,
  /\/\.gcp\/credentials\.json$/i,
  /\/\.azure\/credentials$/i,
  
  // SSH keys and configs
  /\/\.ssh\/config$/i,
  /\/\.ssh\/id_/i,
  /\/\.ssh\/known_hosts$/i,
  
  // API keys and tokens
  /\.apikey$/i,
  /\.token$/i,
  /\.secret$/i,
  
  // System environment sources
  /^\/proc\/self\/environ$/i,
  /^\/proc\/\d+\/environ$/i,
];

// Bash commands that expose environment variables
const DANGEROUS_ENV_COMMANDS = [
  /^\s*env\s*$/i,           // env - list all env vars
  /^\s*printenv\s*$/i,      // printenv - list all env vars
  /^\s*echo\s+\$[A-Z_]/i,   // echo $VAR
  /^\s*echo\s+\${[A-Z_]/i,  // echo ${VAR}
  /^\s*set\s*$/i,           // set - list all vars in bash
  /^\s*declare\s+-p/i,      // declare -p - list all vars
  /^\s*compgen\s+-v/i,      // compgen -v - list all vars
  /^\s*source\s+.*\/\.env/i,  // source .env file
  /^\s*\.\s+.*\/\.env/i,      // . .env file
];

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("🔒 Environment variable protection enabled", "info");
  });

  // Block reading sensitive files
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "read") {
      const path = (event.input as any).path;
      
      // Check if the path matches any sensitive pattern
      for (const pattern of SENSITIVE_FILE_PATTERNS) {
        if (pattern.test(path)) {
          return {
            block: true,
            reason: `🔒 Blocked: Cannot read sensitive file '${path}'. This file may contain environment variables or credentials.`,
          };
        }
      }
    }

    // Block bash commands that expose env vars
    if (event.toolName === "bash") {
      const command = (event.input as any).command;
      
      for (const pattern of DANGEROUS_ENV_COMMANDS) {
        if (pattern.test(command)) {
          return {
            block: true,
            reason: `🔒 Blocked: Command would expose environment variables. Command: '${command}'`,
          };
        }
      }
    }
  });

  // Also register a command to show what's being protected
  pi.registerCommand("env-protection", {
    description: "Show what environment variables and files are protected",
    handler: async (_args, ctx) => {
      const message = `
🔒 Environment Protection Active

Protected file patterns:
  • .env files (.env, .env.local, .env.*.local)
  • Shell configs (~/.bashrc, ~/.zshrc, ~/.profile, etc.)
  • AWS credentials (~/.aws/credentials, ~/.aws/config)
  • Azure credentials (~/.azure/credentials)
  • GCP credentials (~/.gcp/credentials.json)
  • SSH configs (~/.ssh/config, ~/.ssh/id_*, etc.)
  • API keys and tokens (*.apikey, *.token, *.secret)
  • System env sources (/proc/*/environ)

Protected bash commands:
  • env, printenv (list all env vars)
  • echo $VAR (print specific env var)
  • set, declare -p, compgen -v (list vars)
  • source .env, . .env (load env files)

To temporarily disable protection, reload without this extension:
  /reload --no-extensions
`;
      
      ctx.ui.notify(message, "info");
    },
  });
}
