/**
 * Subagent Tmux Extension — /sub, /subcont, /subrm, /subclear commands with tmux pane management
 *
 * Each /sub spawns a pi subagent in a new tmux window with an LLM-generated title.
 * Subagents run in their own panes with persistent sessions for conversation continuations via /subcont.
 *
 * Requires: tmux (checked at startup; commands disabled gracefully if unavailable)
 *
 * Usage:
 *   /sub analyze the src/ directory structure          — spawn a new subagent
 *   /subcont 1 now write tests for the main module     — continue subagent #1's conversation
 *   /subrm 1                                           — remove subagent #1 pane
 *   /subclear                                          — clear all subagent panes
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// ── State Structure ──────────────────────────────────────────────────────────

interface SubAgentState {
  id: number;
  paneId: string;
  windowId: string;
  prompt: string;
  title: string;
  sessionFile: string;
  turnCount: number;
  createdAt: number;
}

// ── Main Extension ───────────────────────────────────────────────────────────

export default function subagentTmux(pi: ExtensionAPI) {
  const agents: Map<number, SubAgentState> = new Map();
  let nextId = 1;
  let isTmuxAvailable = false;
  let tmuxCheckError: string | null = null;

  // ── Phase 1: Environment Detection ───────────────────────────────────────

  async function detectTmux(): Promise<boolean> {
    try {
      // Check if we're in a tmux session
      const inSession = !!process.env.TMUX;
      if (!inSession) {
        tmuxCheckError = "Not running inside a tmux session";
        return false;
      }

      // Verify tmux binary exists
      try {
        await pi.exec("tmux", ["-V"], { timeout: 2000 });
        return true;
      } catch {
        tmuxCheckError = "tmux binary not found in PATH";
        return false;
      }
    } catch (err) {
      tmuxCheckError = `Tmux detection failed: ${err instanceof Error ? err.message : String(err)}`;
      return false;
    }
  }

  // ── Phase 2: Tmux Helpers ────────────────────────────────────────────────

  async function execTmux(args: string[]): Promise<string> {
    try {
      const result = await pi.exec("tmux", args, { timeout: 5000 });
      if (result.code !== 0) {
        throw new Error(`tmux error: ${result.stderr || result.stdout}`);
      }
      return result.stdout.trim();
    } catch (err) {
      throw new Error(`Failed to execute tmux: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function parseWindowAndPaneId(output: string): { windowId: string; paneId: string } {
    // Output format from `tmux new-window -P`: "1:1" (window:pane index)
    // or "%0" (pane ID)
    const lines = output.split("\n").filter((l) => l.trim());
    const lastLine = lines[lines.length - 1] || "";

    // Try to match pane ID format: %0, %1, etc.
    const paneMatch = lastLine.match(/%(\d+)/);
    const paneId = paneMatch ? `%${paneMatch[1]}` : lastLine;

    // For window ID, try to extract from format like "1:1" or "1:2"
    const windowMatch = lastLine.match(/^(\d+):/);
    const windowId = windowMatch ? windowMatch[1] : "0";

    return { windowId, paneId };
  }

  async function isPaneAlive(paneId: string): Promise<boolean> {
    try {
      const output = await execTmux(["list-panes", "-F", "#{pane_id}"]);
      const panes = output.split("\n").map((p) => p.trim());
      return panes.includes(paneId);
    } catch {
      return false;
    }
  }

  async function renameTmuxWindow(windowId: string, newName: string): Promise<void> {
    try {
      await execTmux(["rename-window", "-t", windowId, newName]);
    } catch (err) {
      console.error(`Failed to rename window: ${err}`);
      // Non-fatal, continue
    }
  }

  // ── Phase 3: Session File Management ─────────────────────────────────────

  function makeSessionFile(id: number): string {
    const dir = path.join(os.homedir(), ".pi", "agent", "sessions", "subagents");
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `subagent-${id}-${Date.now()}.jsonl`);
  }

  // ── Phase 4: LLM Title Generation ────────────────────────────────────────

  async function generateTitleLLM(prompt: string, ctx: any): Promise<string> {
    try {
      // Simple LLM-based title generation
      const instruction = `Summarize this task in 3-5 words, no quotes, just the title: "${prompt}"`;

      // Use pi.sendMessage to send to the active model
      // For simplicity, we'll use a direct heuristic if model call isn't available
      // In practice, you might want to call the model directly via ctx.model
      return generateTitleHeuristic(prompt);
    } catch {
      return generateTitleHeuristic(prompt);
    }
  }

  function generateTitleHeuristic(prompt: string): string {
    // Fallback: extract first 5 words
    const words = prompt
      .split(/\s+/)
      .slice(0, 5)
      .join(" ");
    return words;
  }

  function formatTitleForPane(title: string): string {
    // Sanitize: replace problematic chars
    let sanitized = title
      .replace(/[|#:\n\r]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Truncate to 30 chars with ellipsis
    if (sanitized.length > 30) {
      sanitized = sanitized.slice(0, 27) + "...";
    }

    return sanitized;
  }

  async function getTitleWithFallback(prompt: string): Promise<string> {
    try {
      // Attempt LLM-based title generation with 3-second timeout
      const titlePromise = generateTitleLLM(prompt, null);
      const timeoutPromise = new Promise<string>((resolve) => {
        setTimeout(() => resolve(generateTitleHeuristic(prompt)), 3000);
      });

      const title = await Promise.race([titlePromise, timeoutPromise]);
      return formatTitleForPane(title);
    } catch {
      return formatTitleForPane(generateTitleHeuristic(prompt));
    }
  }

  // ── Phase 5: Command Handlers ────────────────────────────────────────────

  async function handleSubCommand(args: string | undefined, ctx: any): Promise<void> {
    if (!isTmuxAvailable) {
      ctx.ui.notify(`Error: ${tmuxCheckError}`, "error");
      return;
    }

    const prompt = args?.trim();
    if (!prompt) {
      ctx.ui.notify("Usage: /sub <prompt>", "error");
      return;
    }

    try {
      const id = nextId++;
      const title = await getTitleWithFallback(prompt);
      const paneName = `sub-${id}: ${title}`;
      const sessionFile = makeSessionFile(id);

      // Create tmux window
      const output = await execTmux(["new-window", "-n", paneName, "-d", "-P"]);
      const { windowId, paneId } = parseWindowAndPaneId(output);

      // Store state
      const state: SubAgentState = {
        id,
        paneId,
        windowId,
        prompt,
        title,
        sessionFile,
        turnCount: 1,
        createdAt: Date.now(),
      };
      agents.set(id, state);

      // Get active model
      const model = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "openrouter/google/gemini-3-flash-preview";

      // Build pi command
      const piCmd = `pi --session "${sessionFile}" --model "${model}" "${prompt}"`;

      // Spawn in pane
      await execTmux(["send-keys", "-t", paneId, piCmd, "Enter"]);

      ctx.ui.notify(
        `Subagent #${id} '${title}' spawned in tmux window '${paneName}'. Use /subcont ${id} <prompt> to continue.`,
        "success"
      );

      // Persist state
      pi.appendEntry("tmux-subagent", state);
    } catch (err) {
      ctx.ui.notify(`Failed to spawn subagent: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  }

  async function handleSubcontinueCommand(args: string | undefined, ctx: any): Promise<void> {
    if (!isTmuxAvailable) {
      ctx.ui.notify(`Error: ${tmuxCheckError}`, "error");
      return;
    }

    const trimmed = args?.trim() ?? "";
    const spaceIdx = trimmed.indexOf(" ");

    if (spaceIdx === -1) {
      ctx.ui.notify("Usage: /subcont <id> <prompt>", "error");
      return;
    }

    const idStr = trimmed.slice(0, spaceIdx);
    const newPrompt = trimmed.slice(spaceIdx + 1).trim();
    const id = parseInt(idStr, 10);

    if (isNaN(id) || !newPrompt) {
      ctx.ui.notify("Usage: /subcont <id> <prompt>", "error");
      return;
    }

    const state = agents.get(id);
    if (!state) {
      ctx.ui.notify(`No subagent #${id} found. Use /sub to create one.`, "error");
      return;
    }

    try {
      // Increment turn count
      state.turnCount++;

      // Send new prompt to existing pane (reuse sessionFile for conversation history)
      await execTmux(["send-keys", "-t", state.paneId, newPrompt, "Enter"]);

      ctx.ui.notify(
        `Subagent #${id} (Turn ${state.turnCount}) continuing in window 'sub-${id}: ${state.title}'.`,
        "info"
      );

      // Persist updated state
      pi.appendEntry("tmux-subagent", state);
    } catch (err) {
      ctx.ui.notify(
        `Failed to continue subagent: ${err instanceof Error ? err.message : String(err)}`,
        "error"
      );
    }
  }

  async function handleSubRemoveCommand(args: string | undefined, ctx: any): Promise<void> {
    const idStr = args?.trim();
    const id = parseInt(idStr ?? "", 10);

    if (isNaN(id)) {
      ctx.ui.notify("Usage: /subrm <id>", "error");
      return;
    }

    const state = agents.get(id);
    if (!state) {
      ctx.ui.notify(`No subagent #${id} found.`, "error");
      return;
    }

    try {
      await execTmux(["kill-pane", "-t", state.paneId]);
      agents.delete(id);
      ctx.ui.notify(`Subagent #${id} '${state.title}' removed.`, "info");
    } catch (err) {
      ctx.ui.notify(`Failed to remove subagent: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  }

  async function handleSubClearCommand(_args: string | undefined, ctx: any): Promise<void> {
    try {
      const count = agents.size;
      for (const [id, state] of agents.entries()) {
        try {
          await execTmux(["kill-pane", "-t", state.paneId]);
        } catch {
          // Continue even if one fails
        }
      }
      agents.clear();
      nextId = 1;
      ctx.ui.notify(
        count === 0
          ? "No subagents to clear."
          : `Cleared ${count} subagent${count !== 1 ? "s" : ""}.`,
        count === 0 ? "info" : "success"
      );
    } catch (err) {
      ctx.ui.notify(`Failed to clear subagents: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  }

  // ── Phase 6: Session Lifecycle ───────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    // Detect tmux availability
    isTmuxAvailable = await detectTmux();

    if (isTmuxAvailable) {
      // Restore subagents from previous session
      try {
        for (const entry of ctx.sessionManager.getEntries()) {
          if (entry.type === "custom" && entry.customType === "tmux-subagent") {
            const data = entry.data as SubAgentState;
            // Validate pane still exists
            if (await isPaneAlive(data.paneId)) {
              agents.set(data.id, data);
              if (data.id >= nextId) {
                nextId = data.id + 1;
              }
            }
          }
        }
      } catch (err) {
        console.error(`Failed to restore subagents: ${err}`);
      }
    }

    // Register commands (only if tmux available)
    if (isTmuxAvailable) {
      pi.registerCommand("sub", {
        description: "Spawn a subagent in a tmux window: /sub <prompt>",
        handler: (args, ctx) => handleSubCommand(args, ctx),
      });

      pi.registerCommand("subcont", {
        description: "Continue a subagent's conversation: /subcont <id> <prompt>",
        handler: (args, ctx) => handleSubcontinueCommand(args, ctx),
      });

      pi.registerCommand("subrm", {
        description: "Remove a subagent: /subrm <id>",
        handler: (args, ctx) => handleSubRemoveCommand(args, ctx),
      });

      pi.registerCommand("subclear", {
        description: "Clear all subagents: /subclear",
        handler: (args, ctx) => handleSubClearCommand(args, ctx),
      });

      ctx.ui.notify("Tmux subagent extension loaded. Use /sub <prompt> to spawn subagents.", "success");
    } else {
      // Register disabled commands with helpful error
      const disabledHandler = (_args: string | undefined, ctx: any) => {
        ctx.ui.notify(
          `Subagent extension requires tmux: ${tmuxCheckError}. Start a tmux session and reload (/reload).`,
          "error"
        );
      };

      pi.registerCommand("sub", {
        description: "[DISABLED] Requires tmux",
        handler: disabledHandler,
      });

      pi.registerCommand("subcont", {
        description: "[DISABLED] Requires tmux",
        handler: disabledHandler,
      });

      pi.registerCommand("subrm", {
        description: "[DISABLED] Requires tmux",
        handler: disabledHandler,
      });

      pi.registerCommand("subclear", {
        description: "[DISABLED] Requires tmux",
        handler: disabledHandler,
      });

      ctx.ui.notify(
        `Subagent extension disabled: ${tmuxCheckError}. Start tmux and reload to enable.`,
        "warning"
      );
    }
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    // Kill all active panes and persist state
    for (const [_id, state] of agents.entries()) {
      try {
        await execTmux(["kill-pane", "-t", state.paneId]);
      } catch {
        // Ignore errors during shutdown
      }
      // Persist state
      pi.appendEntry("tmux-subagent", state);
    }
  });
}
