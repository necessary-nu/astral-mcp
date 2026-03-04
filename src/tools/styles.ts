import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Celestial, Session, TrackedPage } from "../session.ts";

const PRESETS: Record<string, string[]> = {
  layout: [
    "display",
    "position",
    "width",
    "height",
    "min-width",
    "max-width",
    "min-height",
    "max-height",
    "overflow",
    "overflow-x",
    "overflow-y",
    "visibility",
    "opacity",
    "z-index",
    "flex-direction",
    "flex-wrap",
    "align-items",
    "justify-content",
    "grid-template-columns",
    "grid-template-rows",
    "box-sizing",
    "float",
  ],
  typography: [
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "line-height",
    "letter-spacing",
    "text-align",
    "text-decoration",
    "text-transform",
    "color",
    "white-space",
    "word-break",
    "text-overflow",
  ],
  colors: [
    "color",
    "background-color",
    "border-color",
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
    "outline-color",
    "opacity",
  ],
  borders: [
    "border",
    "border-width",
    "border-top-width",
    "border-right-width",
    "border-bottom-width",
    "border-left-width",
    "border-style",
    "border-top-style",
    "border-right-style",
    "border-bottom-style",
    "border-left-style",
    "border-color",
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
    "border-radius",
    "border-top-left-radius",
    "border-top-right-radius",
    "border-bottom-right-radius",
    "border-bottom-left-radius",
    "border-collapse",
    "border-spacing",
    "outline",
    "outline-width",
    "outline-style",
    "outline-color",
    "outline-offset",
  ],
  spacing: [
    "margin",
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
    "padding",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "border-width",
    "gap",
    "row-gap",
    "column-gap",
  ],
};

function resolveProps(
  preset: string | undefined,
  properties: string[] | undefined,
): string[] {
  if (properties && properties.length > 0) return properties;
  if (preset === "all") return [];
  return PRESETS[preset ?? "layout"];
}

export function registerStyleTools(server: McpServer, session: Session) {
  server.registerTool("get_computed_styles", {
    title: "Get Computed Styles",
    description:
      "Get the computed CSS styles for an element. Use 'preset' for common groups (layout, typography, colors, borders, spacing) or 'properties' for specific props. Defaults to the 'layout' preset if neither is specified — pass preset='all' for every property.",
    inputSchema: {
      selector: z.string().describe("CSS selector of the element"),
      preset: z
        .enum(["layout", "typography", "colors", "borders", "spacing", "all"])
        .optional()
        .describe(
          "Preset group of properties to return (default: layout). Use 'all' for every computed property.",
        ),
      properties: z
        .array(z.string())
        .optional()
        .describe(
          "Specific CSS property names to return (e.g. ['color', 'font-size']). Overrides preset.",
        ),
      pageId: z.number().optional(),
    },
  }, async ({ selector, preset, properties, pageId }) => {
    try {
      const tracked = await session.getPage(pageId);
      const props = resolveProps(preset, properties);

      const styles = await tracked.page.evaluate(
        `(() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return null;
          const computed = getComputedStyle(el);
          const props = ${JSON.stringify(props)};
          if (props.length > 0) {
            const result = {};
            for (const p of props) {
              result[p] = computed.getPropertyValue(p);
            }
            return result;
          }
          const result = {};
          for (let i = 0; i < computed.length; i++) {
            const name = computed[i];
            result[name] = computed.getPropertyValue(name);
          }
          return result;
        })()`,
      );

      if (styles === null) {
        return {
          content: [{
            type: "text" as const,
            text: `No element found: ${selector}`,
          }],
          isError: true,
        };
      }

      const count = Object.keys(styles as Record<string, unknown>).length;
      const label = properties?.length
        ? `custom [${properties.join(", ")}]`
        : `${preset ?? "layout"} preset`;
      const summary = `${selector}: ${count} computed properties (${label})`;
      return {
        content: [{
          type: "text" as const,
          text: `/* ${summary} */\n${JSON.stringify(styles, null, 2)}`,
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

  server.registerTool("get_pseudo_styles", {
    title: "Get Pseudo-Element Styles",
    description:
      "Get the computed CSS styles of ::before and/or ::after pseudo-elements on an element. Only returns pseudos where content is not 'none' or empty. Uses the same preset/properties system as get_computed_styles; always includes 'content' in the output.",
    inputSchema: {
      selector: z.string().describe("CSS selector of the parent element"),
      pseudo: z
        .enum(["before", "after"])
        .optional()
        .describe(
          "Which pseudo-element to inspect. Omit to inspect both.",
        ),
      preset: z
        .enum(["layout", "typography", "colors", "borders", "spacing", "all"])
        .optional()
        .describe(
          "Preset group of properties to return (default: layout). Use 'all' for every computed property.",
        ),
      properties: z
        .array(z.string())
        .optional()
        .describe(
          "Specific CSS property names to return (e.g. ['color', 'font-size']). Overrides preset.",
        ),
      pageId: z.number().optional(),
    },
  }, async ({ selector, pseudo, preset, properties, pageId }) => {
    try {
      const tracked = await session.getPage(pageId);
      const props = resolveProps(preset, properties);
      const pseudos = pseudo ? [`::${pseudo}`] : ["::before", "::after"];

      const result = await tracked.page.evaluate(
        `(() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return null;
          const pseudos = ${JSON.stringify(pseudos)};
          const props = ${JSON.stringify(props)};
          const out = {};
          for (const pseudo of pseudos) {
            const computed = getComputedStyle(el, pseudo);
            const content = computed.getPropertyValue('content');
            if (content === 'none' || content === '') continue;
            const styles = { content };
            if (props.length > 0) {
              for (const p of props) {
                styles[p] = computed.getPropertyValue(p);
              }
            } else {
              for (let i = 0; i < computed.length; i++) {
                const name = computed[i];
                styles[name] = computed.getPropertyValue(name);
              }
            }
            out[pseudo] = styles;
          }
          return out;
        })()`,
      );

      if (result === null) {
        return {
          content: [{
            type: "text" as const,
            text: `No element found: ${selector}`,
          }],
          isError: true,
        };
      }

      if (Object.keys(result as Record<string, unknown>).length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: `No active pseudo-elements on: ${selector}`,
          }],
        };
      }

      const entries = Object.entries(
        result as Record<string, Record<string, unknown>>,
      );
      const parts = entries.map(
        ([name, styles]) => `${name} (${Object.keys(styles).length} props)`,
      );
      const summary = `${selector}: ${parts.join(", ")}`;
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
  });

  server.registerTool("get_matched_styles", {
    title: "Get Matched CSS Rules",
    description:
      "Get the CSS rules that match an element via the CSS cascade, showing which selectors, stylesheets, specificities, and properties apply. Unlike get_computed_styles (which only shows final resolved values), this reveals the full cascade chain.",
    inputSchema: {
      selector: z.string().describe("CSS selector of the element"),
      pseudo: z
        .enum(["before", "after"])
        .optional()
        .describe(
          "Optionally inspect a pseudo-element's matched styles instead of the element itself.",
        ),
      inherited: z
        .boolean()
        .optional()
        .describe(
          "Include inherited rules from ancestor elements (default: false).",
        ),
      pageId: z.number().optional(),
    },
  }, async ({ selector, pseudo, inherited, pageId }) => {
    try {
      const tracked = await session.getPage(pageId);
      const { celestial } = tracked;

      const nodeId = await resolveSelector(celestial, selector);
      if (!nodeId) {
        return {
          content: [{
            type: "text" as const,
            text: `No element found: ${selector}`,
          }],
          isError: true,
        };
      }

      // Re-enable CSS domain to ensure it's active after navigation
      await celestial.CSS.enable();

      const matched = await celestial.CSS.getMatchedStylesForNode({ nodeId });
      if (!matched) {
        return {
          content: [{
            type: "text" as const,
            text:
              `CSS.getMatchedStylesForNode failed for: ${selector} (nodeId: ${nodeId})`,
          }],
          isError: true,
        };
      }

      // deno-lint-ignore no-explicit-any
      const result: Record<string, any> = {};

      // Inline styles
      if (matched.inlineStyle) {
        const props = formatProperties(matched.inlineStyle.cssProperties);
        if (Object.keys(props).length > 0) {
          result.inline = props;
        }
      }

      // Directly matched rules
      if (matched.matchedCSSRules) {
        result.matched = matched.matchedCSSRules
          .map((rm) => formatRuleMatch(rm, tracked))
          .filter((r) => Object.keys(r.properties).length > 0);
      }

      // Inherited rules
      if (inherited && matched.inherited) {
        const inheritedRules: {
          selector: string;
          source: string;
          properties: Record<string, string>;
        }[] = [];
        for (const entry of matched.inherited) {
          for (const rm of entry.matchedCSSRules) {
            const formatted = formatRuleMatch(rm, tracked);
            if (Object.keys(formatted.properties).length > 0) {
              inheritedRules.push({
                selector: formatted.selector,
                source: formatted.source,
                properties: formatted.properties,
              });
            }
          }
        }
        if (inheritedRules.length > 0) {
          result.inherited = inheritedRules;
        }
      }

      // Pseudo-element rules
      if (matched.pseudoElements) {
        const pseudoEntries = matched.pseudoElements
          .filter((pe) => !pseudo || pe.pseudoType === pseudo)
          .map((pe) => ({
            pseudo: pe.pseudoType,
            rules: pe.matches
              .map((rm) => formatRuleMatch(rm, tracked))
              .filter((r) => Object.keys(r.properties).length > 0),
          }))
          .filter((pe) => pe.rules.length > 0);

        if (pseudo) {
          // When filtering to a single pseudo, return just its rules at the top level
          if (pseudoEntries.length > 0) {
            result.pseudoElements = pseudoEntries;
          }
        } else if (pseudoEntries.length > 0) {
          result.pseudoElements = pseudoEntries;
        }
      }

      const summary = summarizeMatchedStyles(selector, result);
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
  });
}

// deno-lint-ignore no-explicit-any
function summarizeMatchedStyles(
  selector: string,
  result: Record<string, any>,
): string {
  const parts: string[] = [];

  if (result.inline) {
    parts.push(`inline (${Object.keys(result.inline).length} props)`);
  }

  if (result.matched) {
    const regular = result.matched.filter(
      (r: { origin: string }) => r.origin !== "user-agent",
    );
    if (regular.length > 0) {
      const names = regular.slice(0, 3).map((r: { selector: string }) =>
        r.selector
      );
      const label = regular.length > 3
        ? `${names.join(", ")} +${regular.length - 3} more`
        : names.join(", ");
      parts.push(`${regular.length} rules (${label})`);
    }
    const ua = result.matched.length - regular.length;
    if (ua > 0) parts.push(`${ua} user-agent`);
  }

  if (result.pseudoElements) {
    const pseudos = result.pseudoElements.map(
      (pe: { pseudo: string }) => `::${pe.pseudo}`,
    );
    parts.push(`pseudo ${pseudos.join(", ")}`);
  }

  if (result.inherited) {
    parts.push(`${result.inherited.length} inherited`);
  }

  return `${selector}: ${parts.join(", ") || "no styles"}`;
}

export async function resolveSelector(
  celestial: Celestial,
  selector: string,
): Promise<number | null> {
  const { root } = await celestial.DOM.getDocument({ depth: 0 });
  const { nodeId } = await celestial.DOM.querySelector({
    nodeId: root.nodeId,
    selector,
  });
  return nodeId || null;
}

function formatProperties(
  cssProperties: {
    name: string;
    value: string;
    important?: boolean;
    implicit?: boolean;
  }[],
): Record<string, string> {
  const props: Record<string, string> = {};
  for (const p of cssProperties) {
    if (p.implicit) continue;
    if (!p.value || p.value === "") continue;
    props[p.name] = p.important ? `${p.value} !important` : p.value;
  }
  return props;
}

function formatRuleMatch(
  rm: {
    rule: {
      styleSheetId?: string;
      selectorList: {
        selectors: {
          text: string;
          specificity?: { a: number; b: number; c: number };
        }[];
        text: string;
      };
      origin: string;
      style: {
        cssProperties: {
          name: string;
          value: string;
          important?: boolean;
          implicit?: boolean;
        }[];
        range?: { startLine: number };
      };
    };
    matchingSelectors: number[];
  },
  tracked: TrackedPage,
): {
  selector: string;
  source: string;
  origin: string;
  specificity?: [number, number, number];
  properties: Record<string, string>;
} {
  const { rule, matchingSelectors } = rm;

  // Get the matching selector's specificity
  const matchIdx = matchingSelectors[0] ?? 0;
  const matchingSelector = rule.selectorList.selectors[matchIdx];
  const specificity = matchingSelector?.specificity
    ? [
      matchingSelector.specificity.a,
      matchingSelector.specificity.b,
      matchingSelector.specificity.c,
    ] as [number, number, number]
    : undefined;

  // Resolve source
  let source: string;
  if (rule.origin === "user-agent") {
    source = "user-agent";
  } else if (rule.styleSheetId) {
    const sheet = tracked.stylesheets.get(rule.styleSheetId);
    const url = sheet?.sourceURL || rule.styleSheetId;
    // Extract just the filename from the URL
    const filename = url.includes("/") ? url.split("/").pop()! : url;
    const line = rule.style.range?.startLine;
    source = line !== undefined ? `${filename}:${line + 1}` : filename;
  } else {
    source = rule.origin;
  }

  return {
    selector: rule.selectorList.text,
    source,
    origin: rule.origin,
    specificity,
    properties: formatProperties(rule.style.cssProperties),
  };
}
