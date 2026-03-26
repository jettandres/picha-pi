/**
 * Default sensitive environment variable patterns
 */

import type { SensitivePattern } from "./types";

export const DEFAULT_BLOCKED_VAR_PATTERNS: SensitivePattern[] = [
  { name: "api_keys", pattern: /\b[A-Z_]*API[_]?KEY[S]?\b/i, description: "API keys" },
  { name: "api_tokens", pattern: /\b[A-Z_]*API[_]?TOKEN[S]?\b/i, description: "API tokens" },
  { name: "secret", pattern: /\b[A-Z_]*SECRET[S]?\b/i, description: "Secrets" },
  { name: "password", pattern: /\b[A-Z_]*PASS(?:WORD)?\b/i, description: "Passwords" },
  { name: "tokens", pattern: /\b[A-Z_]*TOKEN[S]?\b/i, description: "Tokens" },
  { name: "private_key", pattern: /\b[A-Z_]*PRIVATE[_]?KEY[S]?\b/i, description: "Private keys" },
  { name: "ssh_key", pattern: /\b[A-Z_]*SSH[_]?(?:KEY|PRIVATE)\b/i, description: "SSH keys" },
  { name: "oauth_secret", pattern: /\b[A-Z_]*OAUTH[_]?SECRET[S]?\b/i, description: "OAuth secrets" },
  { name: "refresh_token", pattern: /\b[A-Z_]*REFRESH[_]?TOKEN[S]?\b/i, description: "Refresh tokens" },
  { name: "access_token", pattern: /\b[A-Z_]*ACCESS[_]?TOKEN[S]?\b/i, description: "Access tokens" },
  { name: "aws_access_key", pattern: /\bAWS_ACCESS_KEY_ID\b/i, description: "AWS access key" },
  { name: "aws_secret_key", pattern: /\bAWS_SECRET_ACCESS_KEY\b/i, description: "AWS secret key" },
  { name: "aws_session_token", pattern: /\bAWS_SESSION_TOKEN\b/i, description: "AWS session token" },
  { name: "gcp_key", pattern: /\bGCP[_]?(?:API[_])?KEY\b/i, description: "GCP API key" },
  { name: "gcp_service_account", pattern: /\bGOOGLE_APPLICATION_CREDENTIALS\b/i, description: "GCP service account" },
  { name: "azure_key", pattern: /\bAZURE[_]?(?:STORAGE[_])?(?:ACCOUNT[_])?KEY\b/i, description: "Azure key" },
  { name: "azure_connection_string", pattern: /\bAZURE_CONNECTION_STRING\b/i, description: "Azure connection string" },
  { name: "github_token", pattern: /\bGITHUB[_]?TOKEN\b/i, description: "GitHub token" },
  { name: "github_secret", pattern: /\bGITHUB[_]?SECRET\b/i, description: "GitHub secret" },
  { name: "database_url", pattern: /\bDATABASE[_]?URL\b/i, description: "Database URL" },
  { name: "db_password", pattern: /\bDB[_]?(?:PASSWORD|PASSWD|PWD)\b/i, description: "DB password" },
  { name: "db_host_password", pattern: /\b[A-Z_]*_DB[_]?PASSWORD\b/i, description: "DB password vars" },
  { name: "stripe_key", pattern: /\bSTRIPE[_]?(?:SECRET|PUBLIC)[_]?KEY\b/i, description: "Stripe key" },
  { name: "sendgrid_key", pattern: /\bSENDGRID[_]?API[_]?KEY\b/i, description: "SendGrid API key" },
  { name: "slack_webhook", pattern: /\bSLACK[_]?(?:WEBHOOK|TOKEN|BOT[_]?TOKEN)\b/i, description: "Slack webhook" },
  { name: "auth_header", pattern: /\bAUTHORIZATION[_]?(?:HEADER|TOKEN)\b/i, description: "Authorization headers" },
  { name: "npm_token", pattern: /\bNPM[_]?TOKEN\b/i, description: "NPM token" },
  { name: "registry_token", pattern: /\b[A-Z_]*REGISTRY[_]?TOKEN\b/i, description: "Registry tokens" },
  { name: "rsa_private_key", pattern: /\bRSA[_]?PRIVATE[_]?KEY\b/i, description: "RSA private key" },
  { name: "cert_password", pattern: /\b(?:CERT|CERTIFICATE)[_]?(?:PASSWORD|PASSPHRASE)\b/i, description: "Certificate password" },
  { name: "service_account_key", pattern: /\b(?:SERVICE[_]?)?ACCOUNT[_]?(?:KEY|ID)\b/i, description: "Service account key" },
];

export const DEFAULT_BLOCKED_FILES: RegExp[] = [
  /\.env$/, /\.env\..+$/, /\.envrc$/, /secrets?\.(json|yaml|yml|toml)$/i,
  /credentials?\.(json|yaml|yml|toml)$/i, /\/\.ssh\//, /\/\.aws\//, /\/\.azure\//,
  /\/\.gcp\//, /\/\.gnupg\//, /\/\.kube\//, /\.netrc$/, /\.docker\/config\.json$/,
  /\.npmrc$/, /\.pypirc$/, /id_rsa$/, /id_ed25519$/, /github_rsa$/, /config\.json$/i,
];

export const DEFAULT_BLOCKED_COMMANDS: RegExp[] = [
  /^env\s*$/, /^printenv\b/, /^echo\s+\$[A-Z_]/i, /^set\s*$/, /\b(?:env|printenv)\s*\|/,
];
