import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ProtectionMode, RedactionConfig, RedactionStrategy, SensitivePattern } from "./types";
import { DEFAULT_BLOCKED_COMMANDS, DEFAULT_BLOCKED_FILES, DEFAULT_BLOCKED_VAR_PATTERNS } from "./patterns";

interface ConfigFile {
  mode?: ProtectionMode;
  patterns?: { blockedVars?: Array<{ name: string; pattern: string; description: string }>; blockedFiles?: string[]; blockedCommands?: string[] };
  redactionStrategy?: RedactionStrategy;
  requireConfirmation?: boolean;
  auditLog?: boolean;
  allowlistedVars?: string[];
}

export class ConfigManager {
  private config: RedactionConfig;
  private configPath: string;

  constructor(projectRoot?: string, globalConfigPath?: string) {
    if (projectRoot) {
      this.configPath = join(projectRoot, ".pi", "extensions", "env-protect", "config.json");
      if (existsSync(this.configPath)) {
        this.config = this.loadConfigFromFile(this.configPath);
        return;
      }
    }

    if (globalConfigPath) {
      const globalPath = join(globalConfigPath, "env-protect", "config.json");
      if (existsSync(globalPath)) {
        this.configPath = globalPath;
        this.config = this.loadConfigFromFile(globalPath);
        return;
      }
    }

    this.configPath = projectRoot ? join(projectRoot, ".pi", "extensions", "env-protect", "config.json") : "";
    this.config = this.createDefaultConfig();
  }

  private createDefaultConfig(): RedactionConfig {
    return {
      mode: "permissive",
      patterns: {
        blockedVars: DEFAULT_BLOCKED_VAR_PATTERNS,
        blockedFiles: DEFAULT_BLOCKED_FILES,
        blockedCommands: DEFAULT_BLOCKED_COMMANDS,
      },
      redactionStrategy: "masking",
      requireConfirmation: true,
      auditLog: true,
      allowlistedVars: new Set(),
    };
  }

  private loadConfigFromFile(configPath: string): RedactionConfig {
    try {
      const content = readFileSync(configPath, "utf-8");
      const parsed: ConfigFile = JSON.parse(content);
      return {
        mode: parsed.mode ?? "permissive",
        patterns: {
          blockedVars: parsed.patterns?.blockedVars ? parsed.patterns.blockedVars.map(p => ({ ...p, pattern: new RegExp(p.pattern, "i") })) : DEFAULT_BLOCKED_VAR_PATTERNS,
          blockedFiles: parsed.patterns?.blockedFiles ? parsed.patterns.blockedFiles.map(p => new RegExp(p, "i")) : DEFAULT_BLOCKED_FILES,
          blockedCommands: parsed.patterns?.blockedCommands ? parsed.patterns.blockedCommands.map(p => new RegExp(p, "i")) : DEFAULT_BLOCKED_COMMANDS,
        },
        redactionStrategy: parsed.redactionStrategy ?? "masking",
        requireConfirmation: parsed.requireConfirmation ?? true,
        auditLog: parsed.auditLog ?? true,
        allowlistedVars: new Set(parsed.allowlistedVars ?? []),
      };
    } catch (error) {
      return this.createDefaultConfig();
    }
  }

  getConfig(): RedactionConfig { return this.config; }
  getMode(): ProtectionMode { return this.config.mode; }
  getRedactionStrategy(): RedactionStrategy { return this.config.redactionStrategy; }
  isStrict(): boolean { return this.config.mode === "strict"; }
  isPermissive(): boolean { return this.config.mode === "permissive"; }
  requiresConfirmation(): boolean { return this.config.requireConfirmation; }
  hasAuditLog(): boolean { return this.config.auditLog; }
  isVarAllowlisted(varName: string): boolean { return this.config.allowlistedVars.has(varName); }
  allowlistVar(varName: string): void { this.config.allowlistedVars.add(varName); }
  removeFromAllowlist(varName: string): void { this.config.allowlistedVars.delete(varName); }
  getAllowlistedVars(): string[] { return Array.from(this.config.allowlistedVars); }
  isFileBocked(filePath: string): boolean { return this.config.patterns.blockedFiles.some(p => p.test(filePath)); }
  isCommandBlocked(command: string): boolean { return this.config.patterns.blockedCommands.some(p => p.test(command)); }
  getVarNamePatterns(): RegExp[] { return this.config.patterns.blockedVars.map(p => p.pattern); }
  getConfigPath(): string { return this.configPath; }
}
