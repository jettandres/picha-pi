import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type, type TSchema } from "typebox";
import {
  callTool,
  textFrom,
  checkServer,
  initialize,
  listTools,
  isInitialized,
  getSessionId,
  verifyConnection,
  type MCPToolSchema,
} from "./mcp-client";

export default async function (pi: ExtensionAPI) {
  let registered = false;
  let toolCount = 0;
  let registerError: string | undefined;

  // ── eager connect ─────────────────────────────────────────────────

  try {
    const ok = await checkServer();
    if (ok) {
      await initialize();
      const tools = await listTools();
      for (const tool of tools) {
        registerToolFromSchema(pi, tool);
      }
      const verified = await verifyConnection();
      if (verified.ok) {
        registered = true;
        toolCount = tools.length;
      } else {
        registerError = verified.error ?? "Plugin not connected — check your MCP key and Penpot plugin";
      }
    } else {
      registerError = "Penpot is not running";
    }
  } catch (err) {
    registerError = err instanceof Error ? err.message : String(err);
  }

  // ── reload tool (LLM-callable) ───────────────────────────────────

  pi.registerTool({
    name: "penpot_reload",
    label: "Penpot Reload",
    description:
      "Re-discover Penpot MCP tools and verify the connection. " +
      "Use this if tools are returning errors or after reconnecting the Penpot plugin.",
    parameters: Type.Object({}),
    async execute() {
      try {
        const tools = await listTools();
        for (const tool of tools) {
          registerToolFromSchema(pi, tool);
        }
        const verified = await verifyConnection();
        if (verified.ok) {
          registered = true;
          toolCount = tools.length;
          registerError = undefined;
          return {
            content: [
              {
                type: "text",
                text: `Penpot MCP: re-discovered ${tools.length} tools, connection verified.`,
              },
            ],
            details: { toolCount: tools.length },
          };
        } else {
          registerError = verified.error ?? "Plugin not connected";
          return {
            content: [
              {
                type: "text",
                text: `Penpot MCP reload failed: ${registerError}`,
              },
            ],
            isError: true,
            details: {},
          };
        }
      } catch (err) {
        registerError = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text",
              text: `Penpot MCP reload failed: ${registerError}`,
            },
          ],
          isError: true,
          details: {},
        };
      }
    },
  });

  // ── commands ──────────────────────────────────────────────────────

  pi.registerCommand("penpot-status", {
    description: "Show Penpot MCP connection status",
    handler: async (_args, ctx) => {
      const lines: string[] = [];
      lines.push(`Connected: ${isInitialized() ? "yes" : "no"}`);
      lines.push(`Tools registered: ${registered ? toolCount : 0}`);
      if (registerError) {
        lines.push(`Last error: ${registerError}`);
      }
      if (isInitialized()) {
        lines.push(`Session: ${getSessionId() ?? "unknown"}`);
      }
      ctx.ui.notify(
        lines.join(" | "),
        isInitialized() ? "info" : "warning",
      );
    },
  });

  pi.registerCommand("penpot-reload", {
    description: "Re-discover Penpot MCP tools",
    handler: async (_args, ctx) => {
      try {
        const tools = await listTools();
        for (const tool of tools) {
          registerToolFromSchema(pi, tool);
        }
        const verified = await verifyConnection();
        if (verified.ok) {
          registered = true;
          toolCount = tools.length;
          registerError = undefined;
          ctx.ui.setStatus("penpot-mcp", "Penpot MCP: connected");
          ctx.ui.notify(
            `Penpot MCP: re-discovered ${tools.length} tools`,
            "info",
          );
        } else {
          registerError = verified.error ?? "Plugin not connected";
          ctx.ui.setStatus("penpot-mcp", "Penpot MCP: key/plugin error");
          ctx.ui.notify(`Penpot MCP: ${registerError}`, "error");
        }
      } catch (err) {
        registerError = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`Penpot MCP reload failed: ${registerError}`, "error");
      }
    },
  });

  // ── session_start ─────────────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.setStatus(
      "penpot-mcp",
      registered
        ? `Penpot MCP: ${toolCount} tools`
        : "Penpot MCP: not connected",
    );

    if (registered) {
      ctx.ui.notify(`Penpot MCP: ${toolCount} tools ready`, "info");
      return;
    }

    // Retry if server wasn't available at load time
    try {
      const ok = await checkServer();
      if (ok) {
        await initialize();
        const tools = await listTools();
        for (const tool of tools) {
          registerToolFromSchema(pi, tool);
        }
        registered = true;
        toolCount = tools.length;
        registerError = undefined;
        ctx.ui.setStatus("penpot-mcp", `Penpot MCP: ${toolCount} tools`);
        ctx.ui.notify(
          `Penpot MCP: registered ${tools.length} tools`,
          "info",
        );
      } else {
        ctx.ui.notify(
          "Penpot MCP not reachable. Is docker compose running?",
          "warning",
        );
      }
    } catch (err) {
      registerError = err instanceof Error ? err.message : String(err);
      ctx.ui.notify(`Penpot MCP: ${registerError}`, "error");
    }
  });
}

// ── tool registration ───────────────────────────────────────────────

function registerToolFromSchema(pi: ExtensionAPI, schema: MCPToolSchema) {
  const description = schema.description ?? `Penpot MCP tool: ${schema.name}`;
  const annotations = schema.annotations ?? {};

  pi.registerTool({
    name: schema.name,
    label: `Penpot: ${schema.name}`,
    description: buildDescription(description, annotations),
    parameters: convertSchema(schema.inputSchema),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      try {
        const result = await callTool(
          schema.name,
          params as Record<string, unknown>,
        );
        return {
          content: [{ type: "text", text: textFrom(result) }],
          details: result,
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: err instanceof Error ? err.message : String(err),
            },
          ],
          isError: true,
          details: {},
        };
      }
    },
  });
}

function buildDescription(
  description: string,
  annotations: Record<string, unknown>,
): string {
  const parts = [description];
  if (annotations.readOnlyHint) parts.push("(Read-only)");
  if (annotations.destructiveHint) parts.push("(Modifies the design)");
  return parts.join(" ");
}

// ── JSON Schema → TypeBox ───────────────────────────────────────────

function convertSchema(inputSchema?: Record<string, unknown>): TSchema {
  if (
    !inputSchema ||
    inputSchema.type !== "object" ||
    !inputSchema.properties
  ) {
    return Type.Record(Type.String(), Type.Unknown());
  }

  const properties = inputSchema.properties as Record<string, unknown>;
  const required = (inputSchema.required as string[]) ?? [];
  const result: Record<string, TSchema> = {};

  for (const [key, prop] of Object.entries(properties)) {
    const ts = propToTypeBox(prop as Record<string, unknown>);
    result[key] = required.includes(key) ? ts : Type.Optional(ts);
  }

  try {
    return Type.Object(result, { additionalProperties: false });
  } catch {
    return Type.Record(Type.String(), Type.Unknown());
  }
}

function propToTypeBox(prop: Record<string, unknown>): TSchema {
  const type = prop.type as string | undefined;
  const description = prop.description as string | undefined;
  const enumValues = prop.enum as string[] | undefined;
  const constValue = prop.const as string | undefined;

  if (constValue !== undefined) {
    return Type.Literal(
      constValue,
      description ? { description } : undefined,
    );
  }

  if (enumValues && enumValues.length > 0) {
    try {
      const literalTypes = enumValues.map((v) => Type.Literal(v));
      // @ts-expect-error Type.Union accepts TS types
      return Type.Union(
        literalTypes,
        description ? { description } : undefined,
      );
    } catch {
      // fall through
    }
  }

  const variants = (prop.anyOf ?? prop.oneOf) as
    | Record<string, unknown>[]
    | undefined;
  if (variants) {
    try {
      const unionTypes = variants
        .filter((v) => v.type !== "null")
        .map((v) => propToTypeBox(v));
      if (unionTypes.length === 1) return unionTypes[0];
      if (unionTypes.length > 1) {
        // @ts-expect-error Type.Union accepts TS types
        return Type.Union(
          unionTypes,
          description ? { description } : undefined,
        );
      }
    } catch {
      // fall through
    }
  }

  switch (type) {
    case "string":
      return Type.String(description ? { description } : undefined);
    case "number":
    case "integer":
      return Type.Number(description ? { description } : undefined);
    case "boolean":
      return Type.Boolean(description ? { description } : undefined);
    case "array": {
      const items = prop.items as Record<string, unknown> | undefined;
      if (items) {
        return Type.Array(
          propToTypeBox(items),
          description ? { description } : undefined,
        );
      }
      return Type.Array(
        Type.Unknown(),
        description ? { description } : undefined,
      );
    }
    case "object": {
      const subProps = prop.properties as
        | Record<string, unknown>
        | undefined;
      if (subProps) {
        const subRequired = (prop.required as string[]) ?? [];
        const subResult: Record<string, TSchema> = {};
        for (const [k, v] of Object.entries(subProps)) {
          const ts = propToTypeBox(v as Record<string, unknown>);
          subResult[k] = subRequired.includes(k) ? ts : Type.Optional(ts);
        }
        try {
          return Type.Object(
            subResult,
            description ? { description } : undefined,
          );
        } catch {
          return Type.Record(Type.String(), Type.Unknown());
        }
      }
      return Type.Record(Type.String(), Type.Unknown());
    }
    default:
      return Type.Unknown();
  }
}
