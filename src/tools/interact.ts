import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Session } from "../session.ts";

export function registerInteractTools(server: McpServer, session: Session) {
  server.registerTool("click", {
    title: "Click Element",
    description:
      "Click an element identified by CSS selector. The element is scrolled into view first. Returns JSON with the page URL after clicking (useful to detect navigation).",
    inputSchema: {
      selector: z
        .string()
        .describe("CSS selector of the element to click"),
      pageId: z.number().optional(),
    },
  }, async ({ selector, pageId }) => {
    try {
      const tracked = await session.getPage(pageId);
      const el = await tracked.page.waitForSelector(selector);
      await el.click();
      const data = { clicked: true, selector, url: tracked.page.url };
      const summary = `Clicked ${selector}, page at ${tracked.page.url}`;
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

  server.registerTool("type_text", {
    title: "Type Text",
    description:
      "Focus an element and type text into it. Use clear=true to select all existing text first (triple-click), so the typed text replaces it.",
    inputSchema: {
      selector: z
        .string()
        .describe("CSS selector of the input element"),
      text: z.string().describe("Text to type"),
      clear: z
        .boolean()
        .optional()
        .describe(
          "If true, select all existing text before typing to replace it (default: false)",
        ),
      delay: z
        .number()
        .optional()
        .describe("Delay between keystrokes in ms (default: 0)"),
      pageId: z.number().optional(),
    },
  }, async ({ selector, text, clear, delay, pageId }) => {
    try {
      const tracked = await session.getPage(pageId);
      const el = await tracked.page.waitForSelector(selector);
      if (clear) {
        await el.click({ count: 3 });
      }
      await el.type(text, { delay: delay ?? 0 });
      const data = { typed: true, selector };
      const summary = `Typed ${text.length} chars into ${selector}`;
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

  server.registerTool("drag", {
    title: "Drag",
    description:
      "Click and drag from one point to another. Useful for moving elements, resizing, drawing, or interacting with sliders and canvases.",
    inputSchema: {
      startX: z.number().describe("X coordinate to start drag"),
      startY: z.number().describe("Y coordinate to start drag"),
      endX: z.number().describe("X coordinate to end drag"),
      endY: z.number().describe("Y coordinate to end drag"),
      steps: z
        .number()
        .optional()
        .describe(
          "Interpolation steps for smooth drag (default: 10)",
        ),
      pageId: z.number().optional(),
    },
  }, async ({ startX, startY, endX, endY, steps, pageId }) => {
    try {
      const tracked = await session.getPage(pageId);
      const { mouse } = tracked.page;
      await mouse.move(startX, startY);
      await mouse.down();
      await mouse.move(endX, endY, { steps: steps ?? 10 });
      await mouse.up();
      const actualSteps = steps ?? 10;
      const data = {
        dragged: true,
        startX,
        startY,
        endX,
        endY,
        steps: actualSteps,
      };
      const summary =
        `Dragged (${startX}, ${startY}) → (${endX}, ${endY}) in ${actualSteps} steps`;
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
