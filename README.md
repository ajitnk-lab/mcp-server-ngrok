# MCP Server for ngrok + Kiro Web

A local MCP (Model Context Protocol) server with SSE and Streamable HTTP transports, designed to be exposed via ngrok and used as a true MCP server in Kiro Web.

## Quick Start

```bash
# 1. Install
npm install

# 2. Run the server
npm run dev

# 3. In another terminal, expose via ngrok
ngrok http 3000
```

Copy the ngrok HTTPS URL (e.g., `https://abc123.ngrok-free.app`).

## Add to Kiro Web Config

```json
{
  "mcpServers": {
    "my-local-server": {
      "type": "sse",
      "url": "https://YOUR-NGROK-URL.ngrok-free.app/sse"
    }
  }
}
```

Then **start a new Kiro session** - the AI will have access to all your custom tools!

## Available Tools

| Tool | Description |
|------|-------------|
| `greet` | Generate a personalized greeting message |
| `get_current_time` | Get the current date/time (with optional timezone) |
| `calculate` | Perform arithmetic (add, subtract, multiply, divide) |
| `save_note` | Save a note with a key |
| `get_note` | Retrieve a saved note by key |
| `list_notes` | List all saved note keys |
| `system_info` | Get server system information |

## Endpoints

| Endpoint | Method | Transport | Description |
|----------|--------|-----------|-------------|
| `/health` | GET | - | Health check |
| `/sse` | GET | SSE | SSE connection (legacy transport) |
| `/messages` | POST | SSE | SSE message handler |
| `/mcp` | POST | Streamable HTTP | Modern transport |

## Adding Your Own Tools

Edit `src/server.ts` and add tools inside the `createMcpServer()` function:

```typescript
server.registerTool(
  "my_tool_name",
  {
    title: "My Tool",
    description: "What this tool does",
    inputSchema: {
      param1: z.string().describe("Description of param1"),
      param2: z.number().optional().describe("Optional param"),
    },
  },
  async ({ param1, param2 }) => {
    const result = `Got: ${param1}, ${param2}`;
    return { content: [{ type: "text", text: result }] };
  }
);
```

## Architecture

```
┌─────────────────┐       ┌─────────────┐       ┌─────────────────────┐
│   Kiro Web      │◀─────▶│   ngrok     │◀─────▶│  Your Local Machine │
│   (AI Client)   │ HTTPS │   tunnel    │  HTTP  │  MCP Server :3000   │
└─────────────────┘       └─────────────┘       └─────────────────────┘
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PORT` | `3000` | Port the server listens on |

## Security Notes

- Your ngrok URL is publicly accessible - keep it private
- For production, add authentication (API keys, OAuth)
- ngrok paid plans offer IP restrictions and fixed subdomains

## License

MIT
