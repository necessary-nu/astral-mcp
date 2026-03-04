import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Session } from "../session.ts";

const SELECTOR_JS = `(x, y) => {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;

  function buildSelector(node) {
    if (node === document.body) return 'body';
    if (node === document.documentElement) return 'html';
    if (node.id) return '#' + CSS.escape(node.id);

    const tag = node.tagName.toLowerCase();
    const parent = node.parentElement;
    if (!parent) return tag;

    // Try unique class combo
    if (node.classList.length > 0) {
      const classSelector = tag + [...node.classList].map(c => '.' + CSS.escape(c)).join('');
      if (parent.querySelectorAll(classSelector).length === 1) {
        const parentSel = buildSelector(parent);
        if (document.querySelectorAll(classSelector).length === 1) return classSelector;
        return parentSel + ' > ' + classSelector;
      }
    }

    // nth-child fallback
    const siblings = [...parent.children];
    const idx = siblings.indexOf(node) + 1;
    const parentSel = buildSelector(parent);
    return parentSel + ' > ' + tag + ':nth-child(' + idx + ')';
  }

  const rect = el.getBoundingClientRect();
  const attrs = {};
  for (const a of el.attributes) attrs[a.name] = a.value;

  return {
    selector: buildSelector(el),
    tag: el.tagName.toLowerCase(),
    text: (el.innerText || '').slice(0, 500),
    attributes: attrs,
    boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
  };
}`;

export function registerQueryTools(server: McpServer, session: Session) {
  server.registerTool(
    "element_at_point",
    {
      title: "Element at Point",
      description:
        "Find the element at given x,y coordinates (relative to viewport). Returns the CSS selector, tag name, text, attributes, and bounding box. Useful after taking a screenshot to identify what's at a specific location.",
      inputSchema: {
        x: z.number().describe("X coordinate (pixels from left)"),
        y: z.number().describe("Y coordinate (pixels from top)"),
        pageId: z.number().optional(),
      },
    },
    async ({ x, y, pageId }) => {
      try {
        const tracked = await session.getPage(pageId);
        const result = await tracked.page.evaluate(
          `(${SELECTOR_JS})(${x}, ${y})`,
        );
        if (!result) {
          return {
            content: [{
              type: "text" as const,
              text: `No element found at (${x}, ${y})`,
            }],
            isError: true,
          };
        }
        const r = result as { selector: string; tag: string; text: string };
        const preview = r.text.length > 40
          ? r.text.slice(0, 40) + "..."
          : r.text;
        const summary =
          `<${r.tag}> ${r.selector} at (${x}, ${y}): "${preview}"`;
        return {
          content: [{
            type: "text" as const,
            text: `/* ${summary} */\n${JSON.stringify(result, null, 2)}`,
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
    },
  );
  server.registerTool(
    "query_selector",
    {
      title: "Query Selector",
      description:
        "Find elements matching a CSS selector. Returns an array of elements with their text content, HTML attributes, and bounding boxes. Use offset/limit for pagination, visibleOnly to skip hidden elements, textContent to filter by text, and attributes to return only specific attrs.",
      inputSchema: {
        selector: z.string().describe("CSS selector to query"),
        limit: z
          .number()
          .optional()
          .describe("Max results to return (default: 20, max: 50)"),
        offset: z
          .number()
          .optional()
          .describe(
            "Skip first N matching elements for pagination (default: 0)",
          ),
        visibleOnly: z
          .boolean()
          .optional()
          .describe(
            "Only return elements with a non-null bounding box (default: false)",
          ),
        attributes: z
          .array(z.string())
          .optional()
          .describe(
            "Only return these attribute names (e.g. ['href', 'class']). Omit for all attributes.",
          ),
        textContent: z
          .string()
          .optional()
          .describe(
            "Filter to elements whose innerText contains this substring (case-insensitive)",
          ),
        pageId: z.number().optional(),
      },
    },
    async (
      { selector, limit, offset, visibleOnly, attributes, textContent, pageId },
    ) => {
      try {
        const tracked = await session.getPage(pageId);
        const maxResults = Math.min(limit ?? 20, 50);
        const skip = offset ?? 0;
        const elements = await tracked.page.$$(selector);

        const results = [];
        let skipped = 0;
        let totalMatched = 0;

        for (const el of elements) {
          const [text, allAttrs, bbox] = await Promise.all([
            el.innerText().catch(() => ""),
            el.getAttributes(),
            el.boundingBox(),
          ]);

          // Apply filters
          if (visibleOnly && bbox === null) continue;
          if (
            textContent &&
            !text.toLowerCase().includes(textContent.toLowerCase())
          ) continue;

          totalMatched++;

          if (skipped < skip) {
            skipped++;
            continue;
          }

          if (results.length >= maxResults) continue;

          // Filter attributes if requested
          const attrs = attributes
            ? Object.fromEntries(
              attributes
                .filter((a) => a in allAttrs)
                .map((a) => [a, allAttrs[a]]),
            )
            : allAttrs;

          results.push({
            text: text.slice(0, 500),
            attributes: attrs,
            boundingBox: bbox,
          });
        }

        const data = {
          totalFound: elements.length,
          totalMatched,
          offset: skip,
          returned: results.length,
          elements: results,
        };
        const summary =
          `${totalMatched} of ${elements.length} match "${selector}", showing ${results.length} (offset ${skip})`;
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
    },
  );
}
