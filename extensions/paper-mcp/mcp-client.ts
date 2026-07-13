const MCP_URL = "http://127.0.0.1:29979/mcp";
const CHECK_TIMEOUT = 2000;

export interface MCPContent {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
}

export interface MCPResult {
  content?: MCPContent[];
  isError?: boolean;
  [key: string]: unknown;
}

export interface MCPToolSchema {
  name: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    [key: string]: unknown;
  };
}

export class MCPError extends Error {
  code?: number;

  constructor(message: string, code?: number) {
    super(message);
    this.name = "MCPError";
    this.code = code;
  }
}

/** Check if the Paper MCP server is reachable */
export async function checkServer(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT);
    const res = await fetch(MCP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/** List available tools from the MCP server */
export async function listTools(): Promise<MCPToolSchema[]> {
  const raw = await rawMCPCall("tools/list");
  return (raw as { tools: MCPToolSchema[] }).tools ?? [];
}

/** Call an MCP tool and return the parsed result */
export async function callTool(
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<MCPResult> {
  const raw = await rawMCPCall("tools/call", { name: toolName, arguments: args });
  return raw as MCPResult;
}

/** Send a JSON-RPC request and handle both JSON and SSE responses */
async function rawMCPCall(
  method: string,
  params?: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });

  if (!res.ok) {
    throw new MCPError(`MCP server returned HTTP ${res.status}: ${res.statusText}`);
  }

  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("text/event-stream")) {
    // SSE response — parse events, then extract .result
    const text = await res.text();
    const parsed = parseSSE(text);
    const withResult = parsed as { result?: unknown; error?: { message: string; code?: number } };
    if (withResult.error) {
      throw new MCPError(withResult.error.message, withResult.error.code);
    }
    return withResult.result;
  }

  // JSON response
  const json = (await res.json()) as {
    result?: unknown;
    error?: { message: string; code?: number };
  };

  if (json.error) {
    throw new MCPError(json.error.message, json.error.code);
  }

  return json.result;
}

/** Parse a simple SSE stream and return the last message event's data as JSON */
function parseSSE(text: string): unknown {
  let lastData: string | undefined;

  for (const line of text.split("\n")) {
    if (line.startsWith("data: ")) {
      lastData = line.slice(6);
    }
  }

  if (lastData) {
    return JSON.parse(lastData);
  }

  throw new MCPError("No data event found in SSE response");
}

/** Extract the primary text from an MCP result */
export function textFrom(result: MCPResult): string {
  if (!result.content || result.content.length === 0) {
    return JSON.stringify(result, null, 2);
  }
  const textParts = result.content
    .filter((c): c is MCPContent & { text: string } => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text);
  if (textParts.length > 0) {
    return textParts.join("\n");
  }
  return JSON.stringify(result, null, 2);
}
