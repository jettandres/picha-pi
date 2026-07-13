import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type, type TSchema } from "typebox";
import {
  callTool,
  textFrom,
  checkServer,
  listTools,
  MCPError,
  type MCPToolSchema,
} from "./mcp-client";

export default async function (pi: ExtensionAPI) {
  // Try to register tools from the server eagerly at load time.
  // If the server isn't running yet, we'll retry on session_start.
  let registered = false;
  let registerError: string | undefined;

  try {
    const ok = await checkServer();
    if (ok) {
      const tools = await listTools();
      for (const tool of tools) {
        registerToolFromSchema(pi, tool);
      }
      registered = true;
    } else {
      registerError = "Paper Desktop not running";
    }
  } catch (err) {
    registerError = err instanceof Error ? err.message : String(err);
  }

  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.setStatus(
      "paper-mcp",
      registered ? "Paper MCP: connected" : "Paper MCP: not running",
    );

    if (registered) {
      ctx.ui.notify("Paper MCP: ready", "info");
      return;
    }

    // Retry registration if server wasn't available at load time
    try {
      const ok = await checkServer();
      if (ok) {
        const tools = await listTools();
        for (const tool of tools) {
          registerToolFromSchema(pi, tool);
        }
        registered = true;
        ctx.ui.setStatus("paper-mcp", "Paper MCP: connected");
        ctx.ui.notify(
          `Paper MCP: registered ${tools.length} tools`,
          "info",
        );
      } else {
        ctx.ui.notify(
          "Paper Desktop MCP server not found. Open a file in Paper Desktop to start it.",
          "warning",
        );
      }
    } catch (err) {
      ctx.ui.notify(
        `Paper MCP: failed to fetch tools — ${err instanceof Error ? err.message : String(err)}`,
        "error",
      );
    }
  });
}

function registerToolFromSchema(pi: ExtensionAPI, schema: MCPToolSchema) {
  const description = schema.description ?? `Paper MCP tool: ${schema.name}`;
  const annotations = schema.annotations ?? {};

  pi.registerTool({
    name: schema.name,
    label: `Paper: ${schema.name}`,
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

/** Convert a JSON Schema object to a TypeBox schema */
function convertSchema(inputSchema?: Record<string, unknown>): TSchema {
  if (!inputSchema || inputSchema.type !== "object" || !inputSchema.properties) {
    return Type.Record(Type.String(), Type.Unknown());
  }

  const properties = inputSchema.properties as Record<string, unknown>;
  const required = (inputSchema.required as string[]) ?? [];
  const result: Record<string, TSchema> = {};

  for (const [key, prop] of Object.entries(properties)) {
    const propSchema = prop as Record<string, unknown>;
    const ts = propToTypeBox(propSchema);
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
      return Type.Union(literalTypes, description ? { description } : undefined);
    } catch {
      // fall through
    }
  }

  const variants = (prop.anyOf ?? prop.oneOf) as Record<string, unknown>[] | undefined;
  if (variants) {
    try {
      const unionTypes = variants
        .filter((v) => v.type !== "null")
        .map((v) => propToTypeBox(v));
      if (unionTypes.length === 1) return unionTypes[0];
      if (unionTypes.length > 1) {
        // @ts-expect-error Type.Union accepts TS types
        return Type.Union(unionTypes, description ? { description } : undefined);
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
      return Type.Array(Type.Unknown(), description ? { description } : undefined);
    }
    case "object": {
      const subProps = prop.properties as Record<string, unknown> | undefined;
      if (subProps) {
        const subRequired = (prop.required as string[]) ?? [];
        const subResult: Record<string, TSchema> = {};
        for (const [k, v] of Object.entries(subProps)) {
          const ts = propToTypeBox(v as Record<string, unknown>);
          subResult[k] = subRequired.includes(k) ? ts : Type.Optional(ts);
        }
        try {
          return Type.Object(subResult, description ? { description } : undefined);
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
