import type { RedactionLog } from "./types";

export class AuditLogger {
  private logs: RedactionLog[] = [];
  private readonly maxLogs = 1000;

  logVarRedacted(varName: string, reason?: string): void {
    this.addLog({ type: "var_redacted", details: { varName, reason } });
  }

  logCommandBlocked(command: string, reason?: string): void {
    this.addLog({ type: "command_blocked", details: { command, reason } });
  }

  logFileBlocked(filePath: string, reason?: string): void {
    this.addLog({ type: "file_blocked", details: { filePath, reason } });
  }

  logVarAllowed(varName: string, reason?: string): void {
    this.addLog({ type: "var_allowed", details: { varName, reason } });
  }

  getLogs(): RedactionLog[] { return this.logs; }
  getLogsByType(type: RedactionLog["type"]): RedactionLog[] { return this.logs.filter(log => log.type === type); }
  getRecentLogs(count: number = 50): RedactionLog[] { return this.logs.slice(-count); }
  getLogsForVar(varName: string): RedactionLog[] { return this.logs.filter(log => log.details.varName === varName); }

  clearLogs(): void { this.logs = []; }

  getSummary(): { totalLogs: number; varsRedacted: number; commandsBlocked: number; filesBlocked: number; varsAllowed: number } {
    return {
      totalLogs: this.logs.length,
      varsRedacted: this.getLogsByType("var_redacted").length,
      commandsBlocked: this.getLogsByType("command_blocked").length,
      filesBlocked: this.getLogsByType("file_blocked").length,
      varsAllowed: this.getLogsByType("var_allowed").length,
    };
  }

  formatLogs(logs: RedactionLog[] = this.logs, limit: number = 20): string {
    const recent = logs.slice(-limit);
    if (recent.length === 0) return "No redaction events logged.";
    return recent.map(log => {
      const time = new Date(log.timestamp).toLocaleString();
      switch (log.type) {
        case "var_redacted": return `[${time}] Redacted: ${log.details.varName}${log.details.reason ? ` (${log.details.reason})` : ""}`;
        case "command_blocked": return `[${time}] Blocked: ${log.details.command}${log.details.reason ? ` (${log.details.reason})` : ""}`;
        case "file_blocked": return `[${time}] Blocked: ${log.details.filePath}${log.details.reason ? ` (${log.details.reason})` : ""}`;
        case "var_allowed": return `[${time}] Allowed: ${log.details.varName}${log.details.reason ? ` (${log.details.reason})` : ""}`;
      }
    }).join("\n");
  }

  restoreFromData(data: RedactionLog[]): void { this.logs = Array.isArray(data) ? data : []; }
  serialize(): RedactionLog[] { return this.logs; }

  private addLog(log: Omit<RedactionLog, "timestamp">): void {
    const entry: RedactionLog = { ...log, timestamp: Date.now() };
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) { this.logs = this.logs.slice(-this.maxLogs); }
  }
}
