import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Session } from "../session.ts";

function paginate(content: string, offset: number, maxLength: number): string {
  const total = content.length;
  const slice = content.slice(offset, offset + maxLength);
  const end = offset + slice.length;
  if (end < total) {
    return slice + `\n\n... truncated at ${end} of ${total} chars`;
  }
  return slice;
}

export function registerContentTools(server: McpServer, session: Session) {
  server.registerTool("get_html", {
    title: "Get HTML Content",
    description:
      "Get the HTML content of the page or a specific element. Returns outerHTML for elements, or full page HTML when no selector is given. Use outer=false for innerHTML. Supports offset/maxLength pagination for large documents.",
    inputSchema: {
      selector: z
        .string()
        .optional()
        .describe("CSS selector. Omit for full page."),
      outer: z
        .boolean()
        .optional()
        .describe(
          "If true (default), returns outerHTML. If false, returns innerHTML.",
        ),
      offset: z
        .number()
        .optional()
        .describe("Character offset to start from (default: 0)"),
      maxLength: z
        .number()
        .optional()
        .describe("Max characters to return (default: 50000)"),
      pageId: z.number().optional(),
    },
  }, async ({ selector, outer, offset, maxLength, pageId }) => {
    try {
      const tracked = await session.getPage(pageId);
      const useOuter = outer !== false;
      let html: string;

      if (selector) {
        const el = await tracked.page.$(selector);
        if (!el) {
          return {
            content: [{
              type: "text" as const,
              text: `No element found: ${selector}`,
            }],
            isError: true,
          };
        }
        if (useOuter) {
          html = await el.evaluate(
            // deno-lint-ignore no-explicit-any
            (e: any) => e.outerHTML,
          );
        } else {
          html = await el.innerHTML();
        }
      } else {
        html = await tracked.page.content();
      }

      return {
        content: [{
          type: "text" as const,
          text: paginate(html, offset ?? 0, maxLength ?? 50000),
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

  server.registerTool("get_text", {
    title: "Get Text Content",
    description:
      "Get the visible text content (innerText) of the page body or a specific element. This is what a human would see, without HTML tags. Supports offset/maxLength pagination.",
    inputSchema: {
      selector: z
        .string()
        .optional()
        .describe("CSS selector. Omit for document.body."),
      offset: z
        .number()
        .optional()
        .describe("Character offset to start from (default: 0)"),
      maxLength: z
        .number()
        .optional()
        .describe("Max characters to return (default: 20000)"),
      pageId: z.number().optional(),
    },
  }, async ({ selector, offset, maxLength, pageId }) => {
    try {
      const tracked = await session.getPage(pageId);
      let text: string;

      if (selector) {
        const el = await tracked.page.$(selector);
        if (!el) {
          return {
            content: [{
              type: "text" as const,
              text: `No element found: ${selector}`,
            }],
            isError: true,
          };
        }
        text = await el.innerText();
      } else {
        text = (await tracked.page.evaluate(
          "document.body?.innerText ?? ''",
        )) as string;
      }

      return {
        content: [{
          type: "text" as const,
          text: paginate(text, offset ?? 0, maxLength ?? 20000),
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
