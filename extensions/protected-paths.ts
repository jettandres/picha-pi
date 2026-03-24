/**
 * Protected Paths Extension
 *
 * Blocks write and edit operations to protected paths.
 * Useful for preventing accidental modifications to sensitive files.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function(pi: ExtensionAPI) {
  const protectedPaths = [".env", ".git/", "node_modules/"];

  pi.on("tool_call", async (event, ctx) => {
    const path = event.input.path as string;

    // Block read access exclusively for .env file
    if (event.toolName === "read" && path.includes(".env")) {
      if (ctx.hasUI) {
        ctx.ui.notify(`Blocked read from protected path: ${path}`, "warning");
      }
      return { block: true, reason: `Path "${path}" is protected` };
    }

    // Block write and edit operations to all protected paths
    if (event.toolName !== "write" && event.toolName !== "edit") {
      return undefined;
    }

    const isProtected = protectedPaths.some((p) => path.includes(p));

    if (isProtected) {
      if (ctx.hasUI) {
        ctx.ui.notify(`Blocked write to protected path: ${path}`, "warning");
      }
      return { block: true, reason: `Path "${path}" is protected` };
    }

    return undefined;
  });
}
