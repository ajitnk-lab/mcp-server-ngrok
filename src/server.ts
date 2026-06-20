import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

// ============================================================
// MCP Server Configuration
// ============================================================

const PORT = parseInt(process.env.PORT || "3000", 10);

// Store active SSE transports for cleanup
const sseTransports: Map<string, SSEServerTransport> = new Map();

// ============================================================
// Create MCP Server Instance
// ============================================================

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "my-local-mcp-server",
    version: "1.0.0",
  });

  // ----------------------------------------------------------
  // TOOL: greet
  // ----------------------------------------------------------
  server.registerTool(
    "greet",
    {
      title: "Greet",
      description: "Generate a personalized greeting message",
      inputSchema: {
        name: z.string().describe("The name of the person to greet"),
      },
    },
    async ({ name }) => {
      return {
        content: [
          {
            type: "text",
            text: `Hello, ${name}! Welcome to the MCP server running via ngrok.`,
          },
        ],
      };
    }
  );

  // ----------------------------------------------------------
  // TOOL: get_current_time
  // ----------------------------------------------------------
  server.registerTool(
    "get_current_time",
    {
      title: "Get Current Time",
      description: "Get the current date and time from the server",
      inputSchema: {
        timezone: z
          .string()
          .optional()
          .describe(
            "Optional timezone (e.g., 'America/New_York', 'Asia/Kolkata'). Defaults to UTC."
          ),
      },
    },
    async ({ timezone }) => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        dateStyle: "full",
        timeStyle: "long",
        timeZone: timezone || "UTC",
      };
      const formatted = new Intl.DateTimeFormat("en-US", options).format(now);
      return {
        content: [
          {
            type: "text",
            text: `Current time: ${formatted}`,
          },
        ],
      };
    }
  );

  // ----------------------------------------------------------
  // TOOL: calculate
  // ----------------------------------------------------------
  server.registerTool(
    "calculate",
    {
      title: "Calculate",
      description:
        "Perform basic arithmetic calculations (add, subtract, multiply, divide)",
      inputSchema: {
        operation: z
          .enum(["add", "subtract", "multiply", "divide"])
          .describe("The arithmetic operation to perform"),
        a: z.number().describe("First number"),
        b: z.number().describe("Second number"),
      },
    },
    async ({ operation, a, b }) => {
      let result: number;
      switch (operation) {
        case "add":
          result = a + b;
          break;
        case "subtract":
          result = a - b;
          break;
        case "multiply":
          result = a * b;
          break;
        case "divide":
          if (b === 0) {
            return {
              content: [{ type: "text", text: "Error: Division by zero" }],
              isError: true,
            };
          }
          result = a / b;
          break;
      }
      return {
        content: [
          {
            type: "text",
            text: `${a} ${operation} ${b} = ${result}`,
          },
        ],
      };
    }
  );

  // ----------------------------------------------------------
  // TOOL: notes (save, get, list)
  // ----------------------------------------------------------
  const notes: Map<string, string> = new Map();

  server.registerTool(
    "save_note",
    {
      title: "Save Note",
      description: "Save a note with a given key",
      inputSchema: {
        key: z.string().describe("Unique key/identifier for the note"),
        content: z.string().describe("The content of the note"),
      },
    },
    async ({ key, content }) => {
      notes.set(key, content);
      return {
        content: [
          {
            type: "text",
            text: `Note saved with key "${key}". Total notes stored: ${notes.size}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_note",
    {
      title: "Get Note",
      description: "Retrieve a previously saved note by key",
      inputSchema: {
        key: z.string().describe("The key of the note to retrieve"),
      },
    },
    async ({ key }) => {
      const content = notes.get(key);
      if (!content) {
        return {
          content: [
            {
              type: "text",
              text: `No note found with key "${key}". Available keys: ${[...notes.keys()].join(", ") || "(none)"}`,
            },
          ],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: content }],
      };
    }
  );

  server.registerTool(
    "list_notes",
    {
      title: "List Notes",
      description: "List all saved note keys",
      inputSchema: {},
    },
    async () => {
      const keys = [...notes.keys()];
      if (keys.length === 0) {
        return {
          content: [{ type: "text", text: "No notes stored yet." }],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `Stored notes (${keys.length}):\n${keys.map((k) => `  - ${k}`).join("\n")}`,
          },
        ],
      };
    }
  );

  // ----------------------------------------------------------
  // TOOL: system_info
  // ----------------------------------------------------------
  server.registerTool(
    "system_info",
    {
      title: "System Info",
      description: "Get information about the MCP server system",
      inputSchema: {},
    },
    async () => {
      const info = {
        server_name: "my-local-mcp-server",
        version: "1.0.0",
        node_version: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime_seconds: Math.floor(process.uptime()),
        memory_usage_mb: Math.floor(
          process.memoryUsage().heapUsed / 1024 / 1024
        ),
      };
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(info, null, 2),
          },
        ],
      };
    }
  );

  return server;
}

// ============================================================
// Express App Setup
// ============================================================

const app = express();

// Enable CORS for all origins (needed for remote access via ngrok)
app.use(cors());

// Parse JSON for all routes EXCEPT /mcp (StreamableHTTP handles its own parsing)
app.use((req, res, next) => {
  if (req.path === "/mcp") {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    server: "my-local-mcp-server",
    version: "1.0.0",
    transports: ["sse", "streamable-http"],
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// SSE Transport (Legacy - works with most current clients)
// ============================================================

app.get("/sse", async (req, res) => {
  console.log("[SSE] New client connection");

  const server = createMcpServer();
  const transport = new SSEServerTransport("/messages", res);

  sseTransports.set(transport.sessionId, transport);

  res.on("close", () => {
    console.log(`[SSE] Client disconnected: ${transport.sessionId}`);
    sseTransports.delete(transport.sessionId);
  });

  await server.connect(transport);
  console.log(`[SSE] Client connected: ${transport.sessionId}`);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = sseTransports.get(sessionId);

  if (!transport) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  await transport.handlePostMessage(req, res);
});

// ============================================================
// Streamable HTTP Transport (Modern - recommended)
// ============================================================

app.post("/mcp", async (req, res) => {
  console.log("[Streamable HTTP] New request");

  try {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless mode
    });

    res.on("close", () => {
      transport.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error("[Streamable HTTP] Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

app.get("/mcp", async (_req, res) => {
  res.writeHead(405).end(
    JSON.stringify({
      error: "Method not allowed. Use POST for Streamable HTTP requests.",
    })
  );
});

// ============================================================
// Start Server
// ============================================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║          MCP Server Running - Ready for ngrok!              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Local URL:    http://localhost:${PORT}                        ║
║                                                              ║
║  Endpoints:                                                  ║
║    Health:     GET  /health                                  ║
║    SSE:        GET  /sse        (legacy transport)           ║
║    Messages:   POST /messages   (SSE message handler)        ║
║    Streamable: POST /mcp        (modern transport)           ║
║                                                              ║
║  Next steps:                                                 ║
║    1. Run: ngrok http ${PORT}                                  ║
║    2. Copy the ngrok URL                                     ║
║    3. Add to Kiro/Claude config                              ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
});
