import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { AuditLogger } from "./logger";
import type { ConfigManager } from "./config";

export function registerCommands(pi: ExtensionAPI, configManager: ConfigManager, auditLogger: AuditLogger): void {
  pi.registerCommand("env-protect-status", {
    description: "Show environment variable protection status",
    handler: async (_args, ctx) => {
      const config = configManager.getConfig();
      const summary = auditLogger.getSummary();
      const status = `📋 Environment Variable Protection Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔒 Protection Mode: ${config.mode}
  Redaction Strategy: ${config.redactionStrategy}
  Require Confirmation: ${config.requireConfirmation ? "✓" : "✗"}
  Audit Logging: ${config.auditLog ? "✓" : "✗"}

📊 Redaction Statistics
  Total Events: ${summary.totalLogs}
  Variables Redacted: ${summary.varsRedacted}
  Commands Blocked: ${summary.commandsBlocked}
  Files Blocked: ${summary.filesBlocked}
  Variables Allowlisted: ${summary.varsAllowed}

🔓 Allowlisted Variables (${config.allowlistedVars.size})
${config.allowlistedVars.size === 0 ? "  (none)" : Array.from(config.allowlistedVars).map(v => `  • ${v}`).join("\n")}

📝 Protected Patterns
  Blocked Variables: ${config.patterns.blockedVars.length} patterns
  Blocked Files: ${config.patterns.blockedFiles.length} patterns
  Blocked Commands: ${config.patterns.blockedCommands.length} patterns`;
      ctx.ui.notify(status, "info");
    },
  });

  pi.registerCommand("env-protect-log", {
    description: "View recent redaction audit log",
    handler: async (args, ctx) => {
      const limit = parseInt(args || "20", 10) || 20;
      const logs = auditLogger.getRecentLogs(Math.min(limit, 100));
      if (logs.length === 0) {
        ctx.ui.notify("No redaction events logged.", "info");
        return;
      }
      const formatted = auditLogger.formatLogs(logs, limit);
      ctx.ui.notify(`📋 Recent Redaction Events (last ${limit})\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${formatted}`, "info");
    },
  });

  pi.registerCommand("env-protect-allow", {
    description: "Allowlist a variable for this session",
    handler: async (args, ctx) => {
      const varName = args?.trim();
      if (!varName) {
        ctx.ui.notify("Usage: /env-protect-allow VARIABLE_NAME", "error");
        return;
      }
      configManager.allowlistVar(varName);
      auditLogger.logVarAllowed(varName, "allowlisted via command");
      ctx.ui.notify(`✓ Allowlisted: ${varName}`, "success");
    },
  });

  pi.registerCommand("env-protect-deny", {
    description: "Remove a variable from the allowlist",
    handler: async (args, ctx) => {
      const varName = args?.trim();
      if (!varName) {
        ctx.ui.notify("Usage: /env-protect-deny VARIABLE_NAME", "error");
        return;
      }
      if (!configManager.isVarAllowlisted(varName)) {
        ctx.ui.notify(`${varName} is not allowlisted.`, "info");
        return;
      }
      configManager.removeFromAllowlist(varName);
      ctx.ui.notify(`✓ Removed from allowlist: ${varName}`, "success");
    },
  });

  pi.registerCommand("env-protect-clear-log", {
    description: "Clear the redaction audit log",
    handler: async (_args, ctx) => {
      const confirmed = await ctx.ui.confirm("Clear audit log?", "This cannot be undone.");
      if (!confirmed) {
        ctx.ui.notify("Cancelled.", "info");
        return;
      }
      auditLogger.clearLogs();
      ctx.ui.notify("✓ Audit log cleared.", "success");
    },
  });

  pi.registerCommand("env-protect-list-patterns", {
    description: "List all configured redaction patterns",
    handler: async (_args, ctx) => {
      const config = configManager.getConfig();
      const vars = config.patterns.blockedVars.map(p => `  • ${p.name}: ${p.description}`).join("\n");
      const message = `📋 Blocked Variable Name Patterns
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${vars}

Use /env-protect-allow VARIABLE_NAME to allowlist a specific variable.`;
      ctx.ui.notify(message, "info");
    },
  });
}
