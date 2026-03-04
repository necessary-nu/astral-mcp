import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Session } from "../session.ts";
import { cleanCache } from "@astral/astral";

export function registerBrowserTools(server: McpServer, session: Session) {
  server.registerTool("browser_reset", {
    title: "Reset Browser",
    description:
      "Kill the current browser and start a fresh instance. Use when the browser is unresponsive or in a bad state. All open pages are lost. Set clearCache to also delete the cached Chrome binary and re-download it.",
    inputSchema: {
      clearCache: z.boolean().optional().describe(
        "Delete the cached Chrome binary so it is re-downloaded on next launch (default: false)",
      ),
    },
  }, async ({ clearCache: wipeCache }) => {
    try {
      if (wipeCache) {
        await cleanCache();
      }
      const { pagesLost } = await session.restart();
      const parts = [`Browser reset. ${pagesLost} page(s) closed.`];
      if (wipeCache) {
        parts.push("Chrome cache cleared — binary will be re-downloaded.");
      }
      parts.push("A fresh browser instance is ready.");
      return { content: [{ type: "text" as const, text: parts.join(" ") }] };
    } catch (err) {
      return {
        content: [{
          type: "text" as const,
          text: `Error: ${err instanceof Error ? err.message : String(err)}`,
        }],
        isError: true,
      };
    }
  });
}
