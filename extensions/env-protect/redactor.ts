import { createHash } from "node:crypto";
import type { RedactionResult, RedactionStrategy } from "./types";

export class Redactor {
  constructor(private strategy: RedactionStrategy = "masking") {}

  redactEnvVars(text: string, envVarPatterns: RegExp[]): RedactionResult {
    if (!text || text.length === 0) {
      return { original: text, redacted: text, wasRedacted: false, redactedItems: [] };
    }

    let redacted = text;
    const redactedItems: RedactionResult["redactedItems"] = [];

    for (const pattern of envVarPatterns) {
      const varNameRegex = new RegExp(
        `(^|[\\s;|&]|export\\s+)(${pattern.source})\\s*[=:]\\s*([^\\s\\n;|&]+)`,
        "gim",
      );

      let match;
      while ((match = varNameRegex.exec(text)) !== null) {
        const varName = match[2];
        const value = match[3];
        const fullMatch = match[0];
        const replacement = this.redactValue(value, varName);
        redacted = redacted.replace(fullMatch, match[1] + varName + (match[2].match(/[=:]/) ? match[2].match(/[=:]/)![0] : "=") + replacement);
        redactedItems.push({ pattern: pattern.source, varName, positions: [{ start: match.index, end: match.index + fullMatch.length }] });
      }
    }

    return { original: text, redacted, wasRedacted: redactedItems.length > 0, redactedItems };
  }

  private redactValue(value: string, varName?: string): string {
    switch (this.strategy) {
      case "masking": return varName ? `[REDACTED: ${varName}]` : `[REDACTED: ${this.detectValueType(value)}]`;
      case "hashing": return `[HASH: ${createHash("sha256").update(value).digest("hex").slice(0, 8)}]`;
      case "partial": return value.length <= 6 ? `${value.slice(0, 2)}...` : `${value.slice(0, 3)}...${value.slice(-4)}`;
      case "full": return "[REDACTED]";
      default: return "[REDACTED]";
    }
  }

  private detectValueType(value: string): string {
    if (/^AKIA[0-9A-Z]{16}$/.test(value)) return "AWS_ACCESS_KEY";
    if (/^gh[pousr]_/.test(value)) return "GITHUB_TOKEN";
    if (/^sk-/.test(value)) return "OPENAI_API_KEY";
    if (/^Bearer\s+/.test(value)) return "BEARER_TOKEN";
    if (/^mongodb:\/\//.test(value)) return "MONGODB_URL";
    if (/^postgres:\/\//.test(value)) return "POSTGRES_URL";
    if (/^mysql:\/\//.test(value)) return "MYSQL_URL";
    if (/^eyJ/.test(value)) return "JWT";
    if (value.length > 100) return "LONG_SECRET";
    if (value.length > 40) return "API_KEY";
    return "SECRET";
  }
}
