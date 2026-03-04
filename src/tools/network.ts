import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Session } from "../session.ts";

function relativeTime(timestamp: number, createdAt: number): string {
  const secs = (timestamp - createdAt) / 1000;
  return `+${secs.toFixed(1)}s`;
}

export function registerNetworkTools(server: McpServer, session: Session) {
  server.registerTool("get_network_log", {
    title: "Get Network Log",
    description:
      "Retrieve network requests and responses captured from the page. By default, entries are consumed after retrieval. Use clear=false to peek. Filter by resource type or URL substring. Supports offset/limit pagination.",
    inputSchema: {
      resourceType: z
        .string()
        .optional()
        .describe(
          "Filter by resource type: Document, Stylesheet, Script, Image, XHR, Fetch, etc.",
        ),
      urlPattern: z
        .string()
        .optional()
        .describe("Filter to URLs containing this substring (e.g. '/api')"),
      clear: z
        .boolean()
        .optional()
        .describe(
          "If true (default), consume entries after retrieval. If false, peek.",
        ),
      offset: z
        .number()
        .optional()
        .describe("Skip first N entries (default: 0)"),
      limit: z
        .number()
        .optional()
        .describe("Max entries to return (default: 100)"),
      pageId: z.number().optional(),
    },
  }, async ({ resourceType, urlPattern, clear, offset, limit, pageId }) => {
    try {
      const tracked = await session.getPage(pageId);
      let entries = tracked.networkLog;

      if (resourceType) {
        entries = entries.filter((e) => e.resourceType === resourceType);
      }
      if (urlPattern) {
        entries = entries.filter((e) => e.url.includes(urlPattern));
      }

      const total = entries.length;
      const start = offset ?? 0;
      const max = limit ?? 100;
      const slice = entries.slice(start, start + max);

      if (clear !== false) {
        tracked.networkLog = [];
      }

      if (slice.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: "No network activity captured.",
          }],
        };
      }

      const header = `Showing ${start + 1}-${
        start + slice.length
      } of ${total} entries`;
      const lines = slice.map(
        (e) =>
          `[${
            relativeTime(e.timestamp, tracked.createdAt)
          }] ${e.method} ${e.url} -> ${e.status ?? "pending"} ${
            e.mimeType ?? ""
          } (${e.resourceType})`,
      );
      return {
        content: [{
          type: "text" as const,
          text: header + "\n" + lines.join("\n"),
        }],
      };
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
