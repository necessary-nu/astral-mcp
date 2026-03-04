import { z } from "zod";
import { encodeBase64 } from "@std/encoding/base64";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Session } from "../session.ts";

export function registerScreenshotTools(server: McpServer, session: Session) {
  server.registerTool("screenshot", {
    title: "Take Screenshot",
    description:
      "Capture a screenshot of the page or a specific element. Returns the image as PNG. When a selector is provided, only that element is captured. Use fullPage to capture the entire scrollable page.",
    inputSchema: {
      selector: z
        .string()
        .optional()
        .describe("CSS selector of element to screenshot. Omit for full page."),
      fullPage: z
        .boolean()
        .optional()
        .describe(
          "Capture the entire scrollable page, not just the viewport.",
        ),
      pageId: z.number().optional(),
    },
  }, async ({ selector, fullPage, pageId }) => {
    try {
      const tracked = await session.getPage(pageId);
      await tracked.page.bringToFront();
      let imageBytes: Uint8Array;

      if (selector) {
        const el = await tracked.page.$(selector);
        if (!el) {
          return {
            content: [{
              type: "text" as const,
              text: `No element found for selector: ${selector}`,
            }],
            isError: true,
          };
        }
        imageBytes = await el.screenshot();
      } else {
        imageBytes = await tracked.page.screenshot({ fullPage });
      }

      const base64 = encodeBase64(imageBytes);
      return {
        content: [{
          type: "image" as const,
          data: base64,
          mimeType: "image/png",
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
