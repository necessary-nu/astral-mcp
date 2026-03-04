import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Session } from "../session.ts";

export function registerEvaluateTools(server: McpServer, session: Session) {
  server.registerTool("evaluate", {
    title: "Evaluate JavaScript",
    description:
      "Execute JavaScript code in the page context and return the result. Your code is wrapped in an async IIFE, so you can use multiple statements, await, and return. Examples: 'return document.title', 'const r = await fetch(\"/api\"); return await r.json()', 'return [...document.querySelectorAll(\"a\")].map(a => a.href)'. The result is JSON-serialized.",
    inputSchema: {
      expression: z
        .string()
        .describe(
          "JavaScript code to execute (can use multiple statements, await, and return)",
        ),
      pageId: z.number().optional(),
    },
  }, async ({ expression, pageId }) => {
    try {
      const tracked = await session.getPage(pageId);
      const wrapped = `(async () => { ${expression} })()`;
      const result = await tracked.page.evaluate(wrapped);
      let summary: string;
      if (result === null || result === undefined) {
        summary = `result: ${result}`;
      } else if (typeof result === "string") {
        summary = `result: string (${result.length} chars)`;
      } else if (Array.isArray(result)) {
        summary = `result: array (${result.length} items)`;
      } else if (typeof result === "object") {
        summary = `result: object (${
          Object.keys(result as Record<string, unknown>).length
        } keys)`;
      } else {
        summary = `result: ${typeof result}`;
      }
      return {
        content: [{
          type: "text" as const,
          text: `/* ${summary} */\n${JSON.stringify({ result }, null, 2)}`,
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
