import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Session } from "./src/session.ts";

import { registerNavigateTools } from "./src/tools/navigate.ts";
import { registerScreenshotTools } from "./src/tools/screenshot.ts";
import { registerContentTools } from "./src/tools/content.ts";
import { registerQueryTools } from "./src/tools/query.ts";
import { registerStyleTools } from "./src/tools/styles.ts";
import { registerAccessibilityTools } from "./src/tools/accessibility.ts";
import { registerEvaluateTools } from "./src/tools/evaluate.ts";
import { registerConsoleTools } from "./src/tools/console.ts";
import { registerNetworkTools } from "./src/tools/network.ts";
import { registerInteractTools } from "./src/tools/interact.ts";
import { registerPageInfoTools } from "./src/tools/page_info.ts";
import { registerConfigureTools } from "./src/tools/configure.ts";
import { registerBrowserTools } from "./src/tools/browser.ts";

const server = new McpServer({
  name: "astral-browser",
  version: "0.1.0",
});

const session = new Session();

registerNavigateTools(server, session);
registerScreenshotTools(server, session);
registerContentTools(server, session);
registerQueryTools(server, session);
registerStyleTools(server, session);
registerAccessibilityTools(server, session);
registerEvaluateTools(server, session);
registerConsoleTools(server, session);
registerNetworkTools(server, session);
registerInteractTools(server, session);
registerPageInfoTools(server, session);
registerConfigureTools(server, session);
registerBrowserTools(server, session);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("astral-browser MCP server running on stdio");
