/**
 * RTK Extension for Pi Coding Agent
 * Transparently rewrites shell commands to RTK equivalents for token savings.
 */

import { execSync } from "node:child_process";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";
import type { RtkConfig, RtkStats } from "./types";

class RtkRewriter {
  private rtkAvailable: boolean | null = null;
  public config: RtkConfig;
  private rewriteCount = 0;
  private tokensSaved = 0;

  constructor(config: RtkConfig = {}) {
    this.config = {
      enabled: config.enabled !== false,
      verbose: config.verbose ?? false,
      dryRun: config.dryRun ?? false,
      maxCommandLength: config.maxCommandLength ?? 10000,
    };
  }

  private checkRtk(): boolean {
    if (this.rtkAvailable !== null) return this.rtkAvailable;
    try {
      execSync("which rtk", { stdio: "ignore", timeout: 2000 });
      this.rtkAvailable = true;
    } catch {
      this.rtkAvailable = false;
    }
    return this.rtkAvailable;
  }

  private tryRewrite(command: string): string | null {
    if (!this.config.enabled || !this.checkRtk()) {
      return null;
    }

    if (command.length > this.config.maxCommandLength!) {
      return null;
    }

    try {
      // RTK may exit with non-zero codes even on success, so we use spawnSync and check output
      const { spawnSync } = require("node:child_process");
      const result = spawnSync("rtk", ["rewrite", command], {
        encoding: "utf-8",
        timeout: 2000,
      });

      const output = (result.stdout || result.stderr || "").trim();
      return output && output !== command ? output : null;
    } catch (error) {
      if (this.config.verbose) {
        console.warn(`[rtk] rewrite failed for: ${command.substring(0, 50)}...`);
      }
      return null;
    }
  }

  rewrite(command: string): string | null {
    const rewritten = this.tryRewrite(command);
    if (!rewritten) return null;

    this.rewriteCount++;
    this.tokensSaved += Math.floor(command.length * 0.75);

    if (this.config.verbose) {
      console.log(`[rtk] ${command} -> ${rewritten}`);
    }

    return rewritten;
  }

  isEnabled(): boolean {
    return this.config.enabled && this.checkRtk();
  }

  getStats(): RtkStats {
    return {
      rewrites: this.rewriteCount,
      estimatedTokensSaved: this.tokensSaved,
    };
  }
}

async function installRtk(ctx: any): Promise<boolean> {
  ctx.ui.notify("Installing RTK...", "info");

  try {
    execSync(
      'curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh',
      { stdio: "inherit", timeout: 120000, shell: "/bin/bash" }
    );

    ctx.ui.notify(
      "[rtk] Installation complete! Run /reload to enable.",
      "success"
    );
    return true;
  } catch (error) {
    ctx.ui.notify(
      "[rtk] Installation failed. See docs: https://github.com/rtk-ai/rtk#installation",
      "error"
    );
    return false;
  }
}

export default function registerRtkExtension(pi: ExtensionAPI) {
  const enabled = process.env.RTK_EXTENSION_ENABLED !== "false";
  const verbose = process.env.RTK_EXTENSION_VERBOSE === "true";
  const dryRun = process.env.RTK_EXTENSION_DRY_RUN === "true";

  const rewriter = new RtkRewriter({ enabled, verbose, dryRun });

  pi.on("session_start", async (_event, ctx) => {
    if (rewriter.isEnabled()) {
      if (verbose) {
        ctx.ui.notify("[rtk] Extension ready", "info");
      }
      return;
    }

    // RTK not available - offer to install
    const shouldInstall = await ctx.ui.confirm(
      "[rtk] Not Installed",
      "RTK binary not found in PATH. Install now?"
    );

    if (shouldInstall) {
      await installRtk(ctx);
    } else {
      ctx.ui.notify(
        "[rtk] Disabled (RTK not installed). Use /rtk-install to enable.",
        "warning"
      );
    }
  });

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return;
    if (!isToolCallEventType<"bash">("bash", event)) return;

    const command = event.input.command;
    if (typeof command !== "string" || !command) return;

    const rewritten = rewriter.rewrite(command);
    if (!rewritten) return;

    if (!rewriter.config.dryRun) {
      event.input.command = rewritten;
    }
  });

  pi.registerCommand("rtk-stats", {
    description: "Show RTK token savings statistics",
    handler: async (_args, ctx) => {
      const stats = rewriter.getStats();
      const message =
        stats.rewrites === 0
          ? "No RTK rewrites yet in this session"
          : `RTK Stats:\n  Rewrites: ${stats.rewrites}\n  Est. tokens saved: ~${stats.estimatedTokensSaved}`;
      ctx.ui.notify(message, "info");
    },
  });

  pi.registerCommand("rtk-toggle", {
    description: "Toggle RTK optimization on/off",
    handler: async (_args, ctx) => {
      rewriter.config.enabled = !rewriter.config.enabled;
      ctx.ui.notify(`[rtk] ${rewriter.config.enabled ? "enabled" : "disabled"}`, "info");
    },
  });

  pi.registerCommand("rtk-install", {
    description: "Install RTK binary",
    handler: async (_args, ctx) => {
      const success = await installRtk(ctx);
      if (success) {
        // Reload extension to pick up newly installed RTK
        await ctx.reload();
      }
    },
  });
}
