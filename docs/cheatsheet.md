# Pi Extensions Development Cheatsheet

A quick reference guide for developing extensions for the Pi coding agent.

## Extension Types

Pi supports several types of extensions that serve different purposes:

### 1. Tool Extensions
Provide callable tools for the LLM to use during conversations. These are registered with `pi.registerTool()`.

### 2. Event Listener Extensions
Listen to Pi events and react to them. These use `pi.on()` to subscribe to events like session changes.

### 3. Command Extensions
Add slash commands (`/_`) that users can trigger manually. These are registered with `pi.registerCommand()`.

### 4. TUI Component Extensions
Create interactive TUI components that display live information. These use `ctx.ui.setWidget()` to render custom UI elements.

### 5. Hybrid Extensions
Combine multiple approaches, providing tools, listening to events, registering commands, and creating TUI components all in one extension.

## Table of Contents
- [Extension Types](#extension-types)
- [Extension Structure](#extension-structure)
- [Basic Extension Template](#basic-extension-template)
- [Registering Tools](#registering-tools)
- [Registering Commands](#registering-commands)
- [Working with Events](#working-with-events)
- [TUI Component APIs: Low-Level vs High-Level](#tui-component-apis-low-level-vs-high-level)
- [Executing Shell Commands](#executing-shell-commands)
- [Common Patterns](#common-patterns)
- [TypeBox Schema Examples](#typebox-schema-examples)
- [API Reference](#api-reference)

## Extension Structure

Extensions are TypeScript files that export a default function accepting the `ExtensionAPI`.

```typescript
import { Type } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function(pi: ExtensionAPI) {
  // Register your tools, commands, event listeners, etc.
}
```

Extensions can combine multiple approaches:
- Tool extensions provide LLM-callable functionality with `pi.registerTool()`
- Event listener extensions respond to Pi events with `pi.on()`
- Command extensions add user-triggerable commands with `pi.registerCommand()`
- TUI component extensions create interactive UI components with `ctx.ui.setWidget()`
- Many extensions use a combination of these approaches

## How LLM-Callable Tools Work

Once you register a tool with `pi.registerTool()`, Pi automatically makes it available to the LLM. The LLM will decide when to use your tools based on:

1. **User requests** - What the user is asking for
2. **Tool descriptions** - How you describe what the tool does
3. **Tool parameters** - What inputs the tool accepts

### Example Tool Usage Flow

```typescript
// 1. Tool is registered when extension loads
pi.registerTool({
  name: "calculator",
  label: "Calculator",
  description: "Performs mathematical calculations",
  parameters: Type.Object({
    expression: Type.String({ description: "Math expression to evaluate" }),
  }),
  async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
    // 3. This executes when LLM decides to use the tool
    const { expression } = params as { expression: string };
    const result = eval(expression); // Simplified
    return {
      content: [{ type: "text", text: `Result: ${result}` }],
      details: { expression, result }
    };
  },
});

// User: "What's 15 times 23?"
// LLM: (automatically calls calculator tool with { expression: "15 * 23" })
// Tool returns: "Result: 345"
// LLM: "15 times 23 equals 345."
```

### Making Tools Discoverable

Write clear descriptions to help the LLM understand when to use your tools:

```typescript
pi.registerTool({
  name: "database_query",
  label: "Database Query",
  description: "Query customer database for customer info, orders, and account details. Use when users ask about specific customers or need account information.",
  parameters: Type.Object({
    query_type: Type.String({
      description: "Type: 'customer_lookup', 'order_history', or 'account_status'"
    }),
    customer_id: Type.Optional(Type.String({
      description: "Customer ID when known"
    })),
  }),
  // ... execute function
});
```

The LLM will automatically discover and use well-described tools when appropriate, similar to Model Context Protocol (MCP).

## Basic Extension Template

```typescript
import { Type } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function(pi: ExtensionAPI) {
  // Example of a hybrid extension combining multiple approaches

  // 1. Register LLM-callable tools
  pi.registerTool({
    name: "my-tool",
    label: "My Tool",
    description: "Description of what my tool does",
    parameters: Type.Object({
      param1: Type.String({ description: "First parameter" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      // Implementation here
      return {
        content: [{ type: "text", text: "Result" }],
        details: {},
      };
    },
  });

  // 2. Listen to events
  pi.on("session-start", () => {
    console.log("Session started");
  });

  // 3. Register user commands
  pi.registerCommand("my-command", {
    description: "Runs my custom command",
    async execute() {
      await pi.sendMessage("Custom command executed!");
    }
  });
}
```

## Registering Tools

### Simple Tool

```typescript
pi.registerTool({
  name: "simple-tool",
  label: "Simple Tool",
  description: "A simple tool example",
  parameters: Type.Object({}),
  async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
    return {
      content: [{ type: "text", text: "Hello from simple tool!" }],
      details: {},
    };
  },
});
```

### Tool with Parameters

```typescript
pi.registerTool({
  name: "param-tool",
  label: "Parameterized Tool",
  description: "Tool with parameters",
  parameters: Type.Object({
    name: Type.String({ description: "Person's name" }),
    age: Type.Integer({ description: "Person's age", minimum: 0 }),
    active: Type.Boolean({ description: "Whether person is active" }),
  }),
  async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
    const { name, age, active } = params as {
      name: string;
      age: number;
      active: boolean;
    };

    return {
      content: [{
        type: "text",
        text: `${name} is ${age} years old and is ${active ? 'active' : 'inactive'}`
      }],
      details: { name, age, active },
    };
  },
});
```

## Registering Commands

Commands appear in the slash command menu (`/_`).

```typescript
pi.registerCommand("my-command", {
  description: "Description of my command",
  category: "Custom",
  async execute() {
    // Command implementation
    await pi.sendMessage("Command executed!");
  }
});
```

## Working with Events

Listen to various events in the Pi session:

```typescript
// Listen for messages
pi.on("message", (msg) => {
  console.log("New message:", msg);
});

// Listen for tool calls
pi.on("tool-call", (toolCall) => {
  console.log("Tool called:", toolCall);
});

// Listen for session start
pi.on("session-start", () => {
  console.log("Session started");
});
```

## TUI Component APIs: Low-Level vs High-Level

Pi provides two levels of APIs for creating TUI components, each with different complexities and use cases.

### Low-Level Component API (Full Control)

The low-level API directly implements the Component interface from `@mariozechner/pi-tui`. This gives you complete control over rendering, input handling, and lifecycle management.

#### Component Interface

All components must implement:

```typescript
interface Component {
  render(width: number): string[];
  handleInput?(data: string): void;
  wantsKeyRelease?: boolean;
  invalidate(): void;
}
```

#### Example: Custom Progress Bar Component

```typescript
import type { Component } from "@mariozechner/pi-tui";
import { truncateToWidth } from "@mariozbekner/pi-tui";

class ProgressBar implements Component {
  private progress: number;
  private message: string;
  private cachedWidth?: number;
  private cachedLines?: string[];
  
  constructor(progress: number, message: string) {
    this.progress = progress;
    this.message = message;
  }
  
  setProgress(progress: number, message?: string): void {
    this.progress = progress;
    if (message) this.message = message;
    this.invalidate();
  }
  
  render(width: number): string[] {
    // Return cached result if width hasn't changed
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }
    
    const barWidth = Math.max(0, width - 10);
    const filled = Math.floor(barWidth * (this.progress / 100));
    const bar = "█".repeat(filled) + "░".repeat(barWidth - filled);
    const progressText = `${this.progress}%`.padStart(4);
    
    this.cachedLines = [
      truncateToWidth(this.message, width),
      `[${bar}]${progressText}`
    ];
    this.cachedWidth = width;
    return this.cachedLines;
  }
  
  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}
```

### High-Level Extension API (Simplified Usage)

The high-level API provided through `ctx.ui.setWidget()` in extensions simplifies component creation by handling much of the boilerplate for you.

#### Basic String Array (Simplest Form)

```typescript
pi.on("session-start", async (_event, ctx) => {
  // Simple static content
  ctx.ui.setWidget("simple-status", [
    "Status: Active",
    "Tasks: 5/10 completed"
  ]);
});
```

#### Function-Based Components (Most Common)

```typescript
pi.on("session-start", async (_event, ctx) => {
  ctx.ui.setWidget("dynamic-content", (_tui, theme) => {
    // Return object with required Component methods
    return {
      render(width: number): string[] {
        return [
          theme.fg("accent", "Dynamic Content"),
          theme.fg("dim", `Terminal width: ${width}`)
        ];
      },
      invalidate() {
        // Clear any cached state if needed
      }
    };
  });
});
```

#### Integrating Low-Level Components with High-Level API

You can use your custom low-level components within the high-level extension API:

```typescript
pi.on("session-start", async (_event, ctx) => {
  let progress = 0;
  
  // Update progress periodically
  const interval = setInterval(() => {
    progress = (progress + 10) % 110;
    ctx.ui.requestRender(); // Trigger re-render
  }, 1000);
  
  ctx.ui.setWidget("progress-bar", (_tui, theme) => {
    // Create instance of low-level component
    const progressBar = new ProgressBar(progress, "Processing files...");
    
    return {
      render(width: number): string[] {
        return progressBar.render(width);
      },
      invalidate() {
        progressBar.invalidate();
      }
    };
  });
  
  // Clean up
  pi.on("session-end", () => {
    clearInterval(interval);
  });
});
```

### Key Differences and When to Use Each

| Aspect | Low-Level API | High-Level API |
|--------|---------------|----------------|
| **Complexity** | More complex, full implementation required | Simpler, abstracted interface |
| **Control** | Complete control over all aspects | Limited to what extension API provides |
| **Use Case** | Reusable components, libraries | Quick extension-specific UI |
| **Performance** | Manual optimization possible | Handled by extension system |
| **Input Handling** | Full keyboard input support | Limited input handling |
| **Lifecycle** | Manual management | Managed by extension system |

#### When to Use Low-Level API:
- Building reusable component libraries
- Need complex input handling (keyboard navigation, IME support)
- Creating sophisticated interactive UIs
- Building components for distribution

#### When to Use High-Level API:
- Simple status displays in extensions
- Quick proof-of-concepts
- Extension-specific UI elements
- When you want Pi to manage component lifecycle

### Built-in Components with High-Level API

You can also use Pi's built-in components within the high-level API:

```typescript
import { Container, Text, DynamicBorder } from "@mariozechner/pi-tui";

pi.on("session-start", async (_event, ctx) => {
  ctx.ui.setWidget("built-in-example", (_tui, theme) => {
    const container = new Container();
    
    // Add decorative border
    container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
    
    // Add content
    container.addChild(new Text(theme.fg("accent", "System Status"), 1, 0));
    container.addChild(new Text(theme.fg("dim", "All systems operational"), 1, 0));
    
    // Add closing border
    container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
    
    return {
      render(width: number): string[] {
        return container.render(width);
      },
      invalidate() {
        container.invalidate();
      }
    };
  });
});
```

### Organizing Components in Subdirectories

You can organize your components in subdirectories for better maintainability:

```
extensions/
├── my-extension/
│   ├── index.ts                 # Main extension file
│   ├── components/              # Custom components
│   │   ├── ProgressBar.ts      # Low-level component
│   │   ├── TaskList.ts         # Another low-level component
│   │   └── index.ts            # Export components
│   └── tools/
│       └── task-tools.ts       # LLM tools
```

This structure allows you to mix both low-level reusable components and high-level extension integration as needed.

### Advanced TUI Component with State

```typescript
// Track component state
let componentData = {
  counter: 0,
  status: "active",
  messages: [] as string[]
};

// Update component periodically
setInterval(() => {
  componentData.counter++;
  updateTUIComponents();
}, 1000);

function updateTUIComponents() {
  pi.on("session-start", async (_event, ctx) => {
    ctx.ui.setWidget("dynamic-component", (_tui, theme) => {
      return {
        render(width: number): string[] {
          const lines = [
            theme.fg("accent", `Counter Component`),
            theme.fg("dim", `Count: ${componentData.counter}`),
            theme.fg("dim", `Status: ${componentData.status}`),
            "",
            ...componentData.messages.map(msg => theme.fg("muted", `• ${msg}`))
          ];
          return lines;
        },
        invalidate() {}
      };
    });
  });
}
```

### Removing TUI Components

```typescript
// Remove a specific TUI component
ctx.ui.setWidget("my-component", undefined);

// Remove all TUI components (iterate and remove each one)
for (const key of componentKeys) {
  ctx.ui.setWidget(key, undefined);
}
```

TUI components provide a powerful way to display real-time information, progress indicators, system status, or any other dynamic content directly in the Pi interface.

## Executing Shell Commands

Run shell commands with proper error handling:

```typescript
try {
  const result = await pi.exec("ls", ["-la"], {
    cwd: "/home/agent",
    timeout: 5000
  });

  if (result.code === 0) {
    console.log("Command output:", result.stdout);
  } else {
    console.error("Command failed:", result.stderr);
  }
} catch (error) {
  console.error("Execution error:", error);
}
```

## Common Patterns

### Sending Messages to User

```typescript
// Send a simple message
await pi.sendMessage("Hello!");

// Send with options
await pi.sendMessage("Processing...", { thinking: true });

// Send user message (appears as if typed by user)
await pi.sendUserMessage("Let's try this approach");
```

### Working with Session Data

```typescript
// Set/get session name
pi.setSessionName("My Project");
const name = pi.getSessionName();

// Add custom entries to the session log
pi.appendEntry("custom-tool-result", {
  tool: "my-tool",
  result: "success",
  timestamp: Date.now()
});
```

### Managing Tools

```typescript
// Get currently active tools
const activeTools = pi.getActiveTools();

// Get all available tools
const allTools = pi.getAllTools();

// Enable/disable specific tools
pi.setActiveTools(["bash", "read", "my-custom-tool"]);
```

## TypeBox Schema Examples

### Basic Types

```typescript
import { Type } from "@mariozechner/pi-ai";

// String with constraints
const stringWithMinLength = Type.String({
  minLength: 3,
  maxLength: 50,
  description: "A string between 3 and 50 characters"
});

// Number with range
const positiveInteger = Type.Integer({
  minimum: 1,
  description: "Positive integer"
});

// Boolean
const isActive = Type.Boolean({ description: "Activation status" });

// Optional property
const optionalString = Type.Optional(Type.String());
```

### Object Schemas

```typescript
// Simple object
const personSchema = Type.Object({
  name: Type.String(),
  age: Type.Integer({ minimum: 0 }),
  email: Type.String({ format: "email" })
});

// Nested objects
const complexSchema = Type.Object({
  id: Type.String(),
  profile: Type.Object({
    displayName: Type.String(),
    preferences: Type.Object({
      theme: Type.String(),
      notifications: Type.Boolean()
    })
  }),
  tags: Type.Array(Type.String())
});
```

### Union Types

```typescript
// Enum-like union
const status = Type.Union([
  Type.Literal("pending"),
  Type.Literal("active"),
  Type.Literal("inactive")
]);

// Mixed type union
const idOrName = Type.Union([
  Type.Integer(),
  Type.String()
]);
```

## API Reference

### ExtensionAPI Methods

#### Registration Methods
- `pi.registerTool(tool)`: Register a new tool
- `pi.registerCommand(name, options)`: Register a slash command
- `pi.registerShortcut(shortcut, options)`: Register a keyboard shortcut
- `pi.registerFlag(name, options)`: Register a feature flag
- `pi.registerMessageRenderer(type, renderer)`: Register a custom message renderer

#### Event Handling
- `pi.on(event, handler)`: Subscribe to events
- `pi.events`: EventEmitter instance for custom events

#### Communication
- `pi.sendMessage(message, options?)`: Send a message to the conversation
- `pi.sendUserMessage(content, options?)`: Send a message as if from the user
- `pi.appendEntry(type, data)`: Add a custom entry to the session log

#### Session Management
- `pi.setSessionName(name)`: Set the session name
- `pi.getSessionName()`: Get the current session name
- `pi.setLabel(entryId, label)`: Add a label to a session entry

#### TUI Component Management
- `ctx.ui.setWidget(key, renderer)`: Create or update a TUI component
- `ctx.ui.setWidget(key, undefined)`: Remove a specific TUI component
- `ctx.ui.notify(message, type)`: Show notification to user

#### Tool Execution Context
- `pi.exec(command, args?, options?)`: Execute shell commands
- `pi.getActiveTools()`: Get currently enabled tools
- `pi.getAllTools()`: Get all available tools
- `pi.setActiveTools(toolNames)`: Enable/disable specific tools
- `pi.getCommands()`: Get available slash commands
- `pi.setModel(model)`: Change the active model
- `pi.getThinkingLevel()`: Get current thinking level
- `pi.setThinkingLevel(level)`: Set thinking level
- `pi.registerProvider(name, config)`: Register a custom model provider
- `pi.unregisterProvider(name)`: Unregister a model provider

#### Feature Flags
- `pi.getFlag(name)`: Get the value of a registered flag

### Tool Definition Properties

```typescript
{
  name: string,              // Unique tool identifier
  label?: string,            // Human-readable name
  description: string,       // Tool description for LLM
  parameters: TObject,       // TypeBox schema for parameters
  filter?: boolean,          // Whether to filter tool calls (default: true)
  async execute(
    toolCallId: string,      // ID of this tool call
    params: any,             // Parsed parameters
    signal: AbortSignal,     // For cancellation
    onUpdate: Function,      // Progress updates
    ctx: ToolContext         // Execution context
  ): Promise<{
    content: Array<Content>, // Response content
    details?: any,           // Additional structured data
    model?: string,          // Override model for this call
    temperature?: number     // Override temperature
  }>
}
```

### Command Options

```typescript
{
  description: string,       // Command description
  category?: string,         // Category for grouping
  async execute(): Promise<void> // Command implementation
}
```

## Tips & Best Practices

1. **Error Handling**: Always wrap tool execution logic in try/catch blocks
2. **Descriptions Matter**: Write clear, concise descriptions for tools and parameters - the LLM relies on these
3. **Validation**: Use TypeBox schemas to validate input parameters
4. **Progress Updates**: Use the `onUpdate` callback for long-running operations
5. **Cancellation**: Respect the AbortSignal in long-running operations
6. **Session Context**: Store important data using `appendEntry()` for persistence
7. **Testing**: Test tools with various input combinations to ensure robustness

## Debugging Extensions

Add logging to debug extension behavior:

```typescript
export default function(pi: ExtensionAPI) {
  console.log("Extension loaded");

  pi.on("tool-call", (call) => {
    console.log("Tool called:", call.toolName, call.parameters);
  });

  pi.on("message", (msg) => {
    console.log("Message:", msg.content);
  });
}
```

Note: Logs appear in the Pi agent's output/terminal, not in the conversation.

## Simple TUI Component Extension Example

Here's a minimal example of an extension that creates a live clock TUI component:

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function(pi: ExtensionAPI) {
  pi.on("session-start", async (_event, ctx) => {
    // Create a clock TUI component
    ctx.ui.setWidget("clock", (_tui, theme) => {
      return {
        render(width: number): string[] {
          const now = new Date();
          const timeStr = now.toLocaleTimeString();
          const dateStr = now.toLocaleDateString();
          
          return [
            theme.fg("accent", "⏱️  Current Time"),
            theme.fg("dim", `${dateStr} ${timeStr}`)
          ];
        },
        invalidate() {
          // Component will be re-rendered automatically
        }
      };
    });
  });
  
  // Clean up component when session ends
  pi.on("session-end", async (_event, ctx) => {
    ctx.ui.setWidget("clock", undefined);
  });
}
```
