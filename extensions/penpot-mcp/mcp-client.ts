// Penpot MCP client — connects to the Penpot MCP server via streamable HTTP.
//
// The Penpot MCP server runs as a docker-compose service (penpot-mcp) and
// is proxied through the Penpot frontend.  Auth is via a userToken query
// parameter, matching Penpot's "remote MCP" style.
//
// Protocol flow (MCP streamable HTTP):
//   1. initialize       → receive Mcp-Session-Id + server capabilities
//   2. initialized       → fire-and-forget notification
//   3. tools/list        → discover available tools
//   4. tools/call        → invoke a tool

const PENPOT_MCP_URL =
  "http://localhost:9001/mcp/stream?userToken=eyJhbGciOiJBMjU2S1ciLCJlbmMiOiJBMjU2R0NNIn0.69izHuwWsNHgOBiQeaNAJ9uI8jx5u92MPL2oqtBOuy72yZKfV8s6zQ.yYyXqSuXB9Bd8D9m.5vVCe8wBFmDtG2y6npwTcNnQJouvpX6AewgeJY0RXOSRWXVRFZyjUIt0EgChqRoQ9gcsT9OYmbQ4mMuHXl6t2FqajFMsam7MwgPMDTFUV8hG-gc9HUtx0SJVKRvfDzv3vTAsYoSungtJA9piCcGv2rlCj-fp2J3ntSPSIkh32JHjwPyVBc_tT0PSf018KKyipGHv7KPeCM_w.GjWdvO6hyhtfXGf74RQr9Q";

const CLIENT_INFO = { name: "pi-penpot-mcp", version: "1.0.0" };
const PROTOCOL_VERSION = "2024-11-05";

// ── types ────────────────────────────────────────────────────────────

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

// ── session state ────────────────────────────────────────────────────

let sessionId: string | undefined;
let initialized = false;

/** Return the current session ID, if any. */
export function getSessionId(): string | undefined {
  return sessionId;
}

/** Return whether the server has been successfully initialized. */
export function isInitialized(): boolean {
  return initialized;
}

// ── initialize ───────────────────────────────────────────────────────

/**
 * Perform the MCP initialize handshake and return server capabilities.
 * Must be called before `listTools` or `callTool`.
 */
export async function initialize(): Promise<Record<string, unknown>> {
  const result = await rawCall("initialize", {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: CLIENT_INFO,
  });

  // Send the initialized notification (fire-and-forget, no response)
  try {
    await fetch(PENPOT_MCP_URL, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    });
  } catch {
    // Best-effort; some servers don't require this
  }

  initialized = true;
  return result as Record<string, unknown>;
}

// ── tool discovery ───────────────────────────────────────────────────

/** Quick check: is the MCP server reachable? */
export async function checkServer(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(PENPOT_MCP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: CLIENT_INFO,
        },
        id: 1,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/** List available tools from the MCP server. Requires `initialize()` first. */
export async function listTools(): Promise<MCPToolSchema[]> {
  if (!initialized) await initialize();
  const raw = await rawCall("tools/list");
  return (raw as { tools: MCPToolSchema[] }).tools ?? [];
}

// ── tool invocation ──────────────────────────────────────────────────

/** Call an MCP tool and return the parsed result. Requires `initialize()` first. */
export async function callTool(
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<MCPResult> {
  if (!initialized) await initialize();
  const raw = await rawCall("tools/call", { name: toolName, arguments: args });
  return raw as MCPResult;
}

// ── low-level JSON-RPC ───────────────────────────────────────────────

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
  };
  if (sessionId) {
    headers["Mcp-Session-Id"] = sessionId;
  }
  return headers;
}

async function rawCall(
  method: string,
  params?: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(PENPOT_MCP_URL, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });

  if (!res.ok) {
    throw new MCPError(
      `MCP server returned HTTP ${res.status}: ${res.statusText}`,
      res.status,
    );
  }

  // Capture session ID from response headers
  const newSessionId = res.headers.get("mcp-session-id");
  if (newSessionId) {
    sessionId = newSessionId;
  }

  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("text/event-stream")) {
    const text = await res.text();
    const parsed = parseSSE(text);
    const withResult = parsed as {
      result?: unknown;
      error?: { message: string; code?: number };
    };
    if (withResult.error) {
      throw new MCPError(withResult.error.message, withResult.error.code);
    }
    return withResult.result;
  }

  // Plain JSON response
  const json = (await res.json()) as {
    result?: unknown;
    error?: { message: string; code?: number };
  };

  if (json.error) {
    throw new MCPError(json.error.message, json.error.code);
  }

  return json.result;
}

// ── SSE parsing ──────────────────────────────────────────────────────

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

// ── helpers ──────────────────────────────────────────────────────────

// ── connection verification ──────────────────────────────────────────

/**
 * Smoke-test the connection by executing a trivial code call.
 * Returns `true` if the plugin is connected and working, `false` otherwise.
 */
export async function verifyConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!initialized) await initialize();
    const result = await callTool("execute_code", { code: "return 1" });
    // A successful call returns content with a result, not an error text
    const text = textFrom(result);
    if (text.includes("Tool execution failed")) {
      return { ok: false, error: text };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Extract the primary text from an MCP result */
export function textFrom(result: MCPResult): string {
  if (!result.content || result.content.length === 0) {
    return JSON.stringify(result, null, 2);
  }
  const textParts = result.content
    .filter(
      (c): c is MCPContent & { text: string } =>
        c.type === "text" && typeof c.text === "string",
    )
    .map((c) => c.text);
  if (textParts.length > 0) {
    return textParts.join("\n");
  }
  return JSON.stringify(result, null, 2);
}
