import type { ExtensionAPI, ToolResultEvent } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";
import { ConfigManager } from "./config";
import { Redactor } from "./redactor";
import { AuditLogger } from "./logger";
import { registerCommands } from "./commands";
import type { RedactionLog } from "./types";

export default function (pi: ExtensionAPI) {
  const configManager = new ConfigManager(process.cwd());
  const redactor = new Redactor(configManager.getRedactionStrategy());
  const auditLogger = new AuditLogger();
  let sessionStarted = false;

  pi.on("session_start", async (_event, ctx) => {
    sessionStarted = true;
    const entries = ctx.sessionManager.getEntries();
    for (const entry of entries) {
      if (entry.type === "custom" && entry.customType === "env-protect-log") {
        const logs = entry.data as RedactionLog[];
        if (Array.isArray(logs)) auditLogger.restoreFromData(logs);
      }
    }
    if (configManager.hasAuditLog()) {
      ctx.ui.notify("🔒 Environment protection enabled. Use /env-protect-status for details.", "info");
    }
  });

  registerCommands(pi, configManager, auditLogger);

  pi.on("tool_call", async (event, ctx) => {
    if (isToolCallEventType("bash", event)) {
      const command = event.input.command;
      const config = configManager.getConfig();

      if (configManager.isCommandBlocked(command)) {
        const reason = "Command exposes environment variables";
        if (config.mode === "strict") {
          auditLogger.logCommandBlocked(command, "blocked in strict mode");
          return { block: true, reason: `${reason}. Use /env-protect-allow to allowlist specific variables.` };
        }
        if (config.requireConfirmation && ctx.hasUI) {
          const allowed = await ctx.ui.confirm(
            "⚠️ Dangerous Command",
            `This command may expose environment variables:\n\n${command.slice(0, 60)}${command.length > 60 ? "..." : ""}\n\nContinue?`,
          );
          if (!allowed) {
            auditLogger.logCommandBlocked(command, "blocked by user confirmation");
            return { block: true, reason };
          }
          auditLogger.logCommandBlocked(command, "allowed by user");
        }
      }

      const hasEnvVars = /\$[A-Z_][A-Z0-9_]*|\$\{[A-Z_][A-Z0-9_]*\}/.test(command);
      if (hasEnvVars && config.requireConfirmation && ctx.hasUI && config.mode === "strict") {
        const allowed = await ctx.ui.confirm(
          "⚠️ Environment Variables in Command",
          "This command references environment variables. Continue?",
        );
        if (!allowed) {
          auditLogger.logCommandBlocked(command, "contains env var references");
          return { block: true, reason: "Contains environment variable references" };
        }
      }
    }

    if (isToolCallEventType("read", event)) {
      const path = event.input.path;
      if (configManager.isFileBocked(path)) {
        const reason = "File is in protected paths (.env, secrets, credentials, etc.)";
        if (configManager.isStrict()) {
          auditLogger.logFileBlocked(path, "blocked in strict mode");
          return { block: true, reason };
        }
        if (configManager.requiresConfirmation() && ctx.hasUI) {
          const allowed = await ctx.ui.confirm(
            "⚠️ Protected File",
            `This file may contain sensitive information:\n${path}\n\nContinue?`,
          );
          if (!allowed) {
            auditLogger.logFileBlocked(path, "blocked by user");
            return { block: true, reason };
          }
          auditLogger.logFileBlocked(path, "allowed by user");
        }
      }
    }

    if (isToolCallEventType("grep", event)) {
      const pattern = event.input.pattern || "";
      if (/\$[A-Z_]|\benv\b|secret|password|token|key|credential/i.test(pattern)) {
        if (configManager.requiresConfirmation() && ctx.hasUI) {
          const allowed = await ctx.ui.confirm(
            "⚠️ Searching for Sensitive Patterns",
            "This grep pattern may expose sensitive information.\n\nContinue?",
          );
          if (!allowed) {
            auditLogger.logCommandBlocked(`grep: ${pattern}`, "blocked by user");
            return { block: true, reason: "Blocked by user" };
          }
        }
      }
    }
  });

  pi.on("tool_result", async (event: ToolResultEvent, _ctx) => {
    if (event.toolName !== "bash" && event.toolName !== "read" && event.toolName !== "grep") return;
    const content = event.content;
    if (!content || !Array.isArray(content) || content.length === 0) return;

    let shouldRedact = false;
    const redactedContent = content.map((item) => {
      if (item.type !== "text" || !item.text) return item;
      const varPatterns = configManager.getVarNamePatterns();
      const redactionResult = redactor.redactEnvVars(item.text, varPatterns);

      if (redactionResult.wasRedacted) {
        shouldRedact = true;
        for (const redactedItem of redactionResult.redactedItems) {
          if (redactedItem.varName && !configManager.isVarAllowlisted(redactedItem.varName)) {
            auditLogger.logVarRedacted(redactedItem.varName, `in ${event.toolName} output`);
          }
        }
      }

      return { ...item, text: redactionResult.redacted };
    });

    if (shouldRedact) return { content: redactedContent };
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    if (configManager.hasAuditLog() && sessionStarted) {
      const logs = auditLogger.serialize();
      if (logs.length > 0) pi.appendEntry("env-protect-log", logs);
    }
  });

  if (configManager.hasAuditLog()) {
    const config = configManager.getConfig();
    console.log(`[env-protect] Initialized in ${config.mode} mode (${config.redactionStrategy} redaction)`);
  }
}
