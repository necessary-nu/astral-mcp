import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Session } from "../session.ts";

export function registerPageInfoTools(server: McpServer, session: Session) {
  server.registerTool("get_page_info", {
    title: "Get Page Info",
    description:
      "Get metadata about the current page: URL, title, and viewport size.",
    inputSchema: {
      pageId: z.number().optional(),
    },
  }, async ({ pageId }) => {
    try {
      const tracked = await session.getPage(pageId);
      const url = tracked.page.url;
      const title = await tracked.page.evaluate("document.title") as string;
      const viewport = await tracked.page.evaluate(
        "({ width: window.innerWidth, height: window.innerHeight })",
      ) as { width: number; height: number };
      const data = { url, title, viewport };
      const summary =
        `"${title}" ${viewport.width}\u00d7${viewport.height} \u2014 ${url}`;
      return {
        content: [{
          type: "text" as const,
          text: `/* ${summary} */\n${JSON.stringify(data, null, 2)}`,
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

  server.registerTool("list_pages", {
    title: "List Open Pages",
    description:
      "List all open browser pages/tabs with their IDs, URLs, and which one is active. Returns JSON array.",
    inputSchema: {},
  }, async () => {
    const pages = session.listPages();
    const active = pages.find((p) => p.isActive);
    const summary = pages.length === 0
      ? "No pages open"
      : `${pages.length} page${pages.length > 1 ? "s" : ""}, active: #${
        active?.id ?? "none"
      }`;
    return {
      content: [{
        type: "text" as const,
        text: `/* ${summary} */\n${JSON.stringify(pages, null, 2)}`,
      }],
    };
  });

  server.registerTool("switch_page", {
    title: "Switch Active Page",
    description:
      "Set a different page as the active page for subsequent operations.",
    inputSchema: {
      pageId: z.number().describe("The page ID to switch to"),
    },
  }, async ({ pageId }) => {
    try {
      session.setActivePage(pageId);
      const tracked = await session.getPage(pageId);
      const data = { id: pageId, url: tracked.page.url };
      const summary = `Switched to page #${pageId}: ${tracked.page.url}`;
      return {
        content: [{
          type: "text" as const,
          text: `/* ${summary} */\n${JSON.stringify(data, null, 2)}`,
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

  server.registerTool("close_page", {
    title: "Close Page",
    description: "Close a browser page/tab.",
    inputSchema: {
      pageId: z.number().describe("The page ID to close"),
    },
  }, async ({ pageId }) => {
    try {
      await session.closePage(pageId);
      const data = { closed: true, id: pageId };
      const summary = `Closed page #${pageId}`;
      return {
        content: [{
          type: "text" as const,
          text: `/* ${summary} */\n${JSON.stringify(data, null, 2)}`,
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

  server.registerTool("new_page", {
    title: "New Page",
    description:
      "Open a new browser page/tab, optionally navigating to a URL. Returns JSON with the page ID and URL.",
    inputSchema: {
      url: z
        .string()
        .optional()
        .describe("URL to navigate to. Omit for about:blank."),
    },
  }, async ({ url }) => {
    try {
      const tracked = await session.newPage(url);
      const data = { id: tracked.id, url: tracked.page.url };
      const summary = `New page #${tracked.id}: ${tracked.page.url}`;
      return {
        content: [{
          type: "text" as const,
          text: `/* ${summary} */\n${JSON.stringify(data, null, 2)}`,
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
