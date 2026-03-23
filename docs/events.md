# Pi Extension Events Documentation

A comprehensive guide to all events available through `pi.on()` in Pi extensions.

## Table of Contents
- [Session Lifecycle Events](#session-lifecycle-events)
- [Message Events](#message-events)
- [Tool Events](#tool-events)
- [Model Events](#model-events)
- [UI Events](#ui-events)
- [File System Events](#file-system-events)
- [Extension Events](#extension-events)
- [Best Practices](#best-practices)

## Session Lifecycle Events

### `session_start`
Triggered when a new session begins or an existing session is resumed.

```typescript
pi.on("session_start", async (event, ctx) => {
  console.log("Session started");
  // Initialize extension state, create TUI components, etc.
});
```

**Event Object:**
```typescript
{
  sessionId: string;     // Unique session identifier
  isNew: boolean;        // True if this is a new session
  reason: string;        // Reason for session start ("new", "resume", etc.)
}
```

### `session_end`
Triggered when a session ends.

```typescript
pi.on("session_end", async (event, ctx) => {
  console.log("Session ended");
  // Clean up resources, save state, remove TUI components, etc.
});
```

**Event Object:**
```typescript
{
  sessionId: string;     // Session that ended
  reason: string;        // Reason for ending ("exit", "switch", etc.)
}
```

### `session_before_switch`
Triggered before switching sessions. Can cancel the switch operation.

```typescript
pi.on("session_before_switch", async (event, ctx) => {
  // Cancel operation by returning { cancel: true }
  if (hasUnsavedChanges) {
    const confirmed = await ctx.ui.confirm("Discard changes?", "You have unsaved changes");
    if (!confirmed) {
      return { cancel: true };
    }
  }
});
```

**Event Object:**
```typescript
{
  fromSessionId: string; // Current session ID
  toSessionId: string;   // Target session ID (may be new)
  reason: string;        // "new", "resume", "branch", etc.
}
```

### `session_before_fork`
Triggered before forking a session. Can cancel the fork operation.

```typescript
pi.on("session_before_fork", async (event, ctx) => {
  // Cancel fork by returning { cancel: true }
  const confirmed = await ctx.ui.confirm("Create fork?", "Create a new branch from this point");
  if (!confirmed) {
    return { cancel: true };
  }
});
```

**Event Object:**
```typescript
{
  sessionId: string;     // Session being forked
  entryId: string;       // Entry point for fork
  reason: string;        // Reason for fork
}
```

## Message Events

### `message`
Triggered when any message is added to the session (user, assistant, system, or custom).

```typescript
pi.on("message", async (event, ctx) => {
  console.log("New message:", event.message);
  // Process messages, update statistics, etc.
});
```

**Event Object:**
```typescript
{
  message: {
    id: string;          // Unique message ID
    role: "user" | "assistant" | "system" | "custom";
    content: Array<{
      type: string;      // "text", "tool_call", "tool_response", etc.
      text?: string;
      // ... other content-specific properties
    }>;
    timestamp: number;   // Unix timestamp
    customType?: string; // For custom messages
  };
  sessionId: string;
}
```

### `message_update`
Triggered when a message is being streamed/updated (typically for assistant responses).

```typescript
pi.on("message_update", async (event, ctx) => {
  // Handle streaming updates
  if (event.type === "text_delta") {
    console.log("Text update:", event.delta);
  }
});
```

**Event Object:**
```typescript
{
  messageId: string;
  type: string;          // "text_delta", "tool_call_start", etc.
  delta?: string;        // Text delta for streaming
  toolCall?: any;        // Tool call information
  // ... type-specific properties
}
```

### `user_message`
Triggered specifically when a user sends a message.

```typescript
pi.on("user_message", async (event, ctx) => {
  console.log("User said:", event.content);
  // Pre-process user input, log commands, etc.
});
```

**Event Object:**
```typescript
{
  content: string | Array<any>; // User message content
  messageId: string;
  sessionId: string;
}
```

### `assistant_message`
Triggered when the assistant sends a complete message.

```typescript
pi.on("assistant_message", async (event, ctx) => {
  console.log("Assistant responded:", event.content);
  // Post-process assistant responses, extract patterns, etc.
});
```

**Event Object:**
```typescript
{
  content: Array<any>;   // Assistant message content
  messageId: string;
  sessionId: string;
  model: string;         // Model that generated the response
  tokens: {
    input: number;
    output: number;
  };
}
```

## Tool Events

### `tool_call`
Triggered when a tool is called (either by the assistant or user).

```typescript
pi.on("tool_call", async (event, ctx) => {
  console.log("Tool called:", event.toolName);
  // Log tool usage, track analytics, etc.
});
```

**Event Object:**
```typescript
{
  toolCallId: string;
  toolName: string;
  parameters: any;       // Tool parameters
  caller: "assistant" | "user";
  sessionId: string;
}
```

### `tool_execution_start`
Triggered when tool execution begins.

```typescript
pi.on("tool_execution_start", async (event, ctx) => {
  console.log(`Starting execution of ${event.toolName}`);
  // Show progress indicators, start timers, etc.
});
```

**Event Object:**
```typescript
{
  toolCallId: string;
  toolName: string;
  parameters: any;
}
```

### `tool_execution_end`
Triggered when tool execution completes (successfully or with error).

```typescript
pi.on("tool_execution_end", async (event, ctx) => {
  if (event.success) {
    console.log(`Tool ${event.toolName} completed successfully`);
  } else {
    console.log(`Tool ${event.toolName} failed:`, event.error);
  }
});
```

**Event Object:**
```typescript
{
  toolCallId: string;
  toolName: string;
  success: boolean;
  result?: any;          // Tool result (if successful)
  error?: {
    message: string;
    stack?: string;
  };                     // Error details (if failed)
  duration: number;      // Execution time in milliseconds
}
```

### `tool_filter`
Triggered when deciding whether to allow a tool call. Can filter/block tool calls.

```typescript
pi.on("tool_filter", async (event, ctx) => {
  // Block dangerous tools in production
  if (process.env.NODE_ENV === "production" && DANGEROUS_TOOLS.includes(event.toolName)) {
    return { allow: false, reason: "Tool blocked in production" };
  }
  
  // Allow by default
  return { allow: true };
});
```

**Event Object:**
```typescript
{
  toolCallId: string;
  toolName: string;
  parameters: any;
  caller: "assistant" | "user";
}
```

## Model Events

### `model_change`
Triggered when the active model changes.

```typescript
pi.on("model_change", async (event, ctx) => {
  console.log(`Model changed to: ${event.newModel}`);
  // Update UI, adjust expectations, etc.
});
```

**Event Object:**
```typescript
{
  oldModel: string | null;
  newModel: string;
  reason: string;        // "user_request", "auto_switch", etc.
}
```

### `model_request`
Triggered before making a request to a model. Can modify the request.

```typescript
pi.on("model_request", async (event, ctx) => {
  // Modify request parameters
  event.request.temperature = 0.7;
  event.request.max_tokens = 2000;
});
```

**Event Object:**
```typescript
{
  model: string;
  request: {
    messages: Array<any>;
    temperature?: number;
    max_tokens?: number;
    // ... other model-specific parameters
  };
}
```

## UI Events

### `ui_ready`
Triggered when the UI is ready and available.

```typescript
pi.on("ui_ready", async (event, ctx) => {
  console.log("UI is ready");
  // Create initial TUI components, show welcome message, etc.
});
```

**Event Object:**
```typescript
{
  // Generally empty, indicates UI availability
}
```

### `ui_resize`
Triggered when the terminal is resized.

```typescript
pi.on("ui_resize", async (event, ctx) => {
  console.log(`Terminal resized to ${event.width}x${event.height}`);
  // Adjust TUI components, reflow content, etc.
});
```

**Event Object:**
```typescript
{
  width: number;         // New terminal width
  height: number;        // New terminal height
}
```

### `ui_focus`
Triggered when the terminal application gains or loses focus.

```typescript
pi.on("ui_focus", async (event, ctx) => {
  if (event.focused) {
    console.log("Application gained focus");
  } else {
    console.log("Application lost focus");
  }
});
```

**Event Object:**
```typescript
{
  focused: boolean;      // True if gained focus, false if lost
}
```

## File System Events

### `file_watch`
Triggered when watched files change (requires explicit file watching setup).

```typescript
pi.on("file_watch", async (event, ctx) => {
  console.log(`File ${event.path} changed: ${event.eventType}`);
  // Reload configuration, refresh views, etc.
});
```

**Event Object:**
```typescript
{
  path: string;          // Path to changed file
  eventType: string;     // "change", "rename", "delete", etc.
  stats?: any;           // File statistics
}
```

Note: File watching must be explicitly set up using `ctx.fs.watch()` or similar mechanisms.

## Extension Events

### `extension_load`
Triggered when an extension is loaded.

```typescript
pi.on("extension_load", async (event, ctx) => {
  console.log(`Extension ${event.extensionPath} loaded`);
});
```

**Event Object:**
```typescript
{
  extensionPath: string; // Path to extension file
  extensionId: string;   // Unique extension identifier
}
```

### `extension_unload`
Triggered when an extension is unloaded.

```typescript
pi.on("extension_unload", async (event, ctx) => {
  console.log(`Extension ${event.extensionPath} unloaded`);
});
```

**Event Object:**
```typescript
{
  extensionPath: string;
  extensionId: string;
}
```

## Event Handler Return Values

Many events support returning values to influence Pi's behavior:

### Cancellation
Events like `session_before_switch` and `session_before_fork` can be cancelled:

```typescript
return { cancel: true, reason: "Custom reason" };
```

### Filtering
Events like `tool_filter` can allow or block operations:

```typescript
return { allow: false, reason: "Blocked by security policy" };
```

### Modification
Events like `model_request` allow modifying the event data directly.

## Best Practices

### 1. Keep Event Handlers Lightweight
Event handlers should execute quickly to avoid blocking the event loop:

```typescript
// ❌ Bad - Heavy synchronous operation
pi.on("message", async (event, ctx) => {
  const result = heavyComputation(event.message.content);
  // ...
});

// ✅ Good - Offload heavy work
pi.on("message", async (event, ctx) => {
  // Schedule heavy work for later
  setImmediate(() => {
    const result = heavyComputation(event.message.content);
    // ...
  });
});
```

### 2. Handle Async Operations Properly
Use async/await and handle errors appropriately:

```typescript
pi.on("session_start", async (event, ctx) => {
  try {
    await initializeExtensionState(ctx);
  } catch (error) {
    console.error("Failed to initialize:", error);
    ctx.ui.notify("Extension initialization failed", "error");
  }
});
```

### 3. Clean Up Resources
Always clean up resources when sessions end:

```typescript
const intervals = new Map<string, NodeJS.Timeout>();

pi.on("session_start", async (event, ctx) => {
  const interval = setInterval(() => {
    updateStatus(ctx);
  }, 5000);
  intervals.set(event.sessionId, interval);
});

pi.on("session_end", async (event, ctx) => {
  const interval = intervals.get(event.sessionId);
  if (interval) {
    clearInterval(interval);
    intervals.delete(event.sessionId);
  }
});
```

### 4. Use Appropriate Events
Choose the right event for your use case:

```typescript
// For tracking all messages
pi.on("message", handler);

// For specific user interactions
pi.on("user_message", handler);

// For session lifecycle
pi.on("session_start", handler);
pi.on("session_end", handler);
```

### 5. Consider Performance Impact
Be mindful of the performance impact of your event handlers:

```typescript
// ❌ Bad - Processing every character typed
pi.on("message_update", async (event, ctx) => {
  if (event.type === "text_delta") {
    // Expensive operation on every keystroke
    expensiveAnalysis(event.delta);
  }
});

// ✅ Good - Debounced processing
let debounceTimer: NodeJS.Timeout;
pi.on("message_update", async (event, ctx) => {
  if (event.type === "text_delta") {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      // Less frequent processing
      analyzeTextBuffer();
    }, 300);
  }
});
```

### 6. Provide User Feedback
Use UI notifications to inform users of extension activities:

```typescript
pi.on("tool_execution_start", async (event, ctx) => {
  if (event.toolName === "long_running_tool") {
    ctx.ui.notify("Starting long operation...", "info");
  }
});

pi.on("tool_execution_end", async (event, ctx) => {
  if (event.toolName === "long_running_tool") {
    if (event.success) {
      ctx.ui.notify("Operation completed successfully", "success");
    } else {
      ctx.ui.notify(`Operation failed: ${event.error.message}`, "error");
    }
  }
});
```

## Event Registration Order

Events are processed in the order they were registered. If multiple extensions register handlers for the same event, they'll execute in registration order unless modified by Pi's internal logic.

## Error Handling in Event Handlers

Unhandled errors in event handlers will be logged but won't crash Pi. However, it's good practice to handle errors explicitly:

```typescript
pi.on("some_event", async (event, ctx) => {
  try {
    await riskyOperation();
  } catch (error) {
    // Log error
    console.error("Event handler failed:", error);
    
    // Notify user if appropriate
    ctx.ui.notify("Extension encountered an error", "error");
    
    // Optionally re-throw to stop event propagation
    // throw error;
  }
});
```

This documentation provides a comprehensive overview of all available events in Pi extensions, helping developers understand when and how to use each event type effectively.

## Further Reading

- [Pi Coding Agent Documentation](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) - Official Pi coding agent documentation
- [TUI Components Guide](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/tui.md) - Detailed guide on TUI components and event handling
- [Model Context Protocol](https://modelcontextprotocol.io) - Specification for tool-based AI agent communication
- [Pi Extension Examples](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions) - Official extension examples demonstrating various event patterns