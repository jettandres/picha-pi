/**
 * Types for the environment variable protection extension
 */

export type RedactionStrategy = "masking" | "hashing" | "partial" | "full";
export type ProtectionMode = "strict" | "permissive" | "custom";

export interface SensitivePattern {
  name: string;
  pattern: RegExp;
  description: string;
}

export interface RedactionConfig {
  mode: ProtectionMode;
  patterns: {
    blockedVars: SensitivePattern[];
    blockedFiles: RegExp[];
    blockedCommands: RegExp[];
  };
  redactionStrategy: RedactionStrategy;
  requireConfirmation: boolean;
  auditLog: boolean;
  allowlistedVars: Set<string>;
}

export interface RedactionLog {
  timestamp: number;
  type: "var_redacted" | "command_blocked" | "file_blocked" | "var_allowed";
  details: {
    varName?: string;
    command?: string;
    filePath?: string;
    reason?: string;
    value?: string;
  };
}

export interface RedactionResult {
  original: string;
  redacted: string;
  wasRedacted: boolean;
  redactedItems: Array<{
    pattern: string;
    varName?: string;
    positions: Array<{ start: number; end: number }>;
  }>;
}
