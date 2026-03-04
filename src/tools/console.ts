import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Session } from "../session.ts";

function relativeTime(timestamp: number, createdAt: number): string {
  const secs = (timestamp - createdAt) / 1000;
  return `+${secs.toFixed(1)}s`;
}

export function registerConsoleTools(server: McpServer, session: Session) {
  server.registerTool("get_console_logs", {
    title: "Get Console Logs",
    description:
      "Retrieve console messages (log, warn, error, info, debug) captured from the page. By default, messages are consumed (cleared) after retrieval. Use clear=false to peek without draining. Supports offset/limit pagination.",
    inputSchema: {
      level: z
        .enum(["all", "log", "warning", "error", "info", "debug"])
        .optional()
        .describe("Filter by log level (default: all)"),
      clear: z
        .boolean()
        .optional()
        .describe(
          "If true (default), consume logs after retrieval. If false, peek without clearing.",
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
  }, async ({ level, clear, offset, limit, pageId }) => {
    try {
      const tracked = await session.getPage(pageId);
      let logs = tracked.consoleLogs;
      if (level && level !== "all") {
        logs = logs.filter((e) => e.type === level);
      }

      const total = logs.length;
      const start = offset ?? 0;
      const max = limit ?? 100;
      const slice = logs.slice(start, start + max);

      // Drain unless clear=false
      if (clear !== false) {
        tracked.consoleLogs = [];
      }

      if (slice.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: "No console messages captured.",
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
          }] [${e.type.toUpperCase()}] ${e.text}`,
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

  server.registerTool("get_page_errors", {
    title: "Get Page Errors",
    description:
      "Retrieve uncaught JavaScript errors (exceptions) captured from the page. By default, errors are consumed after retrieval. Use clear=false to peek.",
    inputSchema: {
      clear: z
        .boolean()
        .optional()
        .describe(
          "If true (default), consume errors after retrieval. If false, peek.",
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
  }, async ({ clear, offset, limit, pageId }) => {
    try {
      const tracked = await session.getPage(pageId);
      const errors = tracked.pageErrors;

      const total = errors.length;
      const start = offset ?? 0;
      const max = limit ?? 100;
      const slice = errors.slice(start, start + max);

      if (clear !== false) {
        tracked.pageErrors = [];
      }

      if (slice.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: "No page errors captured.",
          }],
        };
      }

      const header = `Showing ${start + 1}-${
        start + slice.length
      } of ${total} errors`;
      const lines = slice.map(
        (e) =>
          `[${
            relativeTime(e.timestamp, tracked.createdAt)
          }] [ERROR] ${e.message}`,
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
