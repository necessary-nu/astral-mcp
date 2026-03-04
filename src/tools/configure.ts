import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Session } from "../session.ts";

export function registerConfigureTools(server: McpServer, session: Session) {
  server.registerTool("set_viewport", {
    title: "Set Viewport Size",
    description:
      "Set the viewport dimensions for the page. Should be called before navigating for best results, as many sites don't handle dynamic resizing well.",
    inputSchema: {
      width: z.number().describe("Viewport width in pixels"),
      height: z.number().describe("Viewport height in pixels"),
      pageId: z.number().optional(),
    },
  }, async ({ width, height, pageId }) => {
    try {
      const tracked = await session.getPage(pageId);
      await tracked.page.setViewportSize({ width, height });
      return {
        content: [{
          type: "text" as const,
          text: `Viewport set to ${width}\u00d7${height}`,
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

  server.registerTool("set_user_agent", {
    title: "Set User Agent",
    description: "Override the browser's User-Agent string for this page.",
    inputSchema: {
      userAgent: z.string().describe("The User-Agent string to use"),
      pageId: z.number().optional(),
    },
  }, async ({ userAgent, pageId }) => {
    try {
      const tracked = await session.getPage(pageId);
      await tracked.page.setUserAgent(userAgent);
      return {
        content: [{
          type: "text" as const,
          text: `User-Agent set to: ${userAgent}`,
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

  server.registerTool("emulate_media", {
    title: "Emulate Media Features",
    description:
      "Emulate CSS media features like prefers-color-scheme (light/dark) and prefers-reduced-motion. Provide one or both.",
    inputSchema: {
      colorScheme: z
        .enum(["light", "dark"])
        .optional()
        .describe("Emulate prefers-color-scheme"),
      reducedMotion: z
        .enum(["no-preference", "reduce"])
        .optional()
        .describe("Emulate prefers-reduced-motion"),
      pageId: z.number().optional(),
    },
  }, async ({ colorScheme, reducedMotion, pageId }) => {
    try {
      const tracked = await session.getPage(pageId);
      const features: { name: string; value: string }[] = [];
      if (colorScheme) {
        features.push({ name: "prefers-color-scheme", value: colorScheme });
      }
      if (reducedMotion) {
        features.push({
          name: "prefers-reduced-motion",
          value: reducedMotion,
        });
      }
      if (features.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text:
              "No media features specified. Provide colorScheme and/or reducedMotion.",
          }],
          isError: true,
        };
      }
      await tracked.page.emulateMediaFeatures(features);
      const summary = features.map((f) => `${f.name}: ${f.value}`).join(", ");
      return {
        content: [{
          type: "text" as const,
          text: `Media features set: ${summary}`,
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

  server.registerTool("get_cookies", {
    title: "Get Cookies",
    description:
      "Get cookies for the current page URL, or for specific URLs if provided.",
    inputSchema: {
      urls: z
        .array(z.string())
        .optional()
        .describe(
          "URLs to get cookies for. Omit for current page URL.",
        ),
      pageId: z.number().optional(),
    },
  }, async ({ urls, pageId }) => {
    try {
      const tracked = await session.getPage(pageId);
      const cookies = await tracked.page.cookies(...(urls ?? []));
      const summary = `${cookies.length} cookie${
        cookies.length !== 1 ? "s" : ""
      }`;
      return {
        content: [{
          type: "text" as const,
          text: `/* ${summary} */\n${JSON.stringify(cookies, null, 2)}`,
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

  server.registerTool("set_cookies", {
    title: "Set Cookies",
    description:
      "Set one or more cookies. At minimum each cookie needs a name and value. Provide domain or url to scope the cookie.",
    inputSchema: {
      cookies: z.array(z.object({
        name: z.string(),
        value: z.string(),
        url: z.string().optional(),
        domain: z.string().optional(),
        path: z.string().optional(),
        secure: z.boolean().optional(),
        httpOnly: z.boolean().optional(),
        sameSite: z.enum(["Strict", "Lax", "None"]).optional(),
        expires: z.number().optional().describe(
          "Expiration as seconds since UNIX epoch. Omit for session cookie.",
        ),
      })).describe("Cookies to set"),
      pageId: z.number().optional(),
    },
  }, async ({ cookies, pageId }) => {
    try {
      const tracked = await session.getPage(pageId);
      await tracked.celestial.Network.setCookies({ cookies });
      const names = cookies.map((c) => c.name).join(", ");
      return {
        content: [{
          type: "text" as const,
          text: `Set ${cookies.length} cookie${
            cookies.length !== 1 ? "s" : ""
          }: ${names}`,
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

  server.registerTool("delete_cookies", {
    title: "Delete Cookies",
    description:
      "Delete cookies by name. Optionally scope by url, domain, or path.",
    inputSchema: {
      name: z.string().describe("Cookie name to delete"),
      url: z
        .string()
        .optional()
        .describe("Delete cookies matching this URL's domain and path"),
      domain: z
        .string()
        .optional()
        .describe("Delete only cookies with this exact domain"),
      path: z
        .string()
        .optional()
        .describe("Delete only cookies with this exact path"),
      pageId: z.number().optional(),
    },
  }, async ({ name, url, domain, path, pageId }) => {
    try {
      const tracked = await session.getPage(pageId);
      await tracked.page.deleteCookies({ name, url, domain, path });
      return {
        content: [{
          type: "text" as const,
          text: `Deleted cookies named "${name}"`,
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
