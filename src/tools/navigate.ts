import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Session } from "../session.ts";

type WaitUntil = "load" | "networkidle0" | "networkidle2" | "none";

function waitOpts(w: WaitUntil) {
  if (w === "none" || w === "load") return { waitUntil: w } as const;
  return { waitUntil: w } as const;
}

function humanSize(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

async function pageResult(session: Session, pageId: number | undefined) {
  const tracked = await session.getPage(pageId);
  const { title, contentLength, textLength } = await tracked.page.evaluate(
    `({
      title: document.title,
      contentLength: document.documentElement.outerHTML.length,
      textLength: (document.body?.innerText || '').length
    })`,
  ) as { title: string; contentLength: number; textLength: number };
  const data = { url: tracked.page.url, title, contentLength, textLength };
  const summary = `"${title}" — ${tracked.page.url} (${
    humanSize(contentLength)
  }, ${humanSize(textLength)} text)`;
  return `/* ${summary} */\n${JSON.stringify(data, null, 2)}`;
}

export function registerNavigateTools(server: McpServer, session: Session) {
  server.registerTool("navigate", {
    title: "Navigate to URL",
    description:
      "Navigate the active page to a URL. Creates a new page if none exists. Returns JSON with the final URL and page title.",
    inputSchema: {
      url: z.string().describe("The URL to navigate to"),
      waitUntil: z
        .enum(["load", "networkidle0", "networkidle2", "none"])
        .optional()
        .describe(
          "When to consider navigation complete (default: networkidle2)",
        ),
      pageId: z
        .number()
        .optional()
        .describe("Page ID to navigate (default: active page)"),
    },
  }, async ({ url, waitUntil, pageId }) => {
    try {
      const tracked = pageId !== undefined
        ? await session.getPage(pageId)
        : await session.getActivePage();
      await tracked.page.goto(url, waitOpts(waitUntil ?? "networkidle2"));
      return {
        content: [{
          type: "text" as const,
          text: await pageResult(session, tracked.id),
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

  server.registerTool("reload", {
    title: "Reload Page",
    description: "Reload the current page. Returns JSON with URL and title.",
    inputSchema: {
      waitUntil: z
        .enum(["load", "networkidle0", "networkidle2", "none"])
        .optional()
        .describe("When to consider reload complete (default: networkidle2)"),
      pageId: z
        .number()
        .optional()
        .describe("Page ID to reload (default: active page)"),
    },
  }, async ({ waitUntil, pageId }) => {
    try {
      const tracked = await session.getPage(pageId);
      await tracked.page.reload(waitOpts(waitUntil ?? "networkidle2"));
      return {
        content: [{
          type: "text" as const,
          text: await pageResult(session, tracked.id),
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

  server.registerTool("go_back", {
    title: "Go Back",
    description:
      "Navigate to the previous page in browser history. Returns JSON with URL and title.",
    inputSchema: {
      pageId: z.number().optional(),
    },
  }, async ({ pageId }) => {
    try {
      const tracked = await session.getPage(pageId);
      await tracked.page.goBack({ waitUntil: "networkidle2" });
      return {
        content: [{
          type: "text" as const,
          text: await pageResult(session, tracked.id),
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

  server.registerTool("go_forward", {
    title: "Go Forward",
    description:
      "Navigate to the next page in browser history. Returns JSON with URL and title.",
    inputSchema: {
      pageId: z.number().optional(),
    },
  }, async ({ pageId }) => {
    try {
      const tracked = await session.getPage(pageId);
      await tracked.page.goForward({ waitUntil: "networkidle2" });
      return {
        content: [{
          type: "text" as const,
          text: await pageResult(session, tracked.id),
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
