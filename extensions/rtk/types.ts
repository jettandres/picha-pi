/**
 * Type definitions for RTK Extension
 */

export interface RtkConfig {
  enabled?: boolean;
  verbose?: boolean;
  dryRun?: boolean;
  maxCommandLength?: number;
}

export interface RtkStats {
  rewrites: number;
  estimatedTokensSaved: number;
  lastRewriteAt?: number;
}
