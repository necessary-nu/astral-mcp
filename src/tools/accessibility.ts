import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Celestial, Session } from "../session.ts";

type AXNode = Awaited<
  ReturnType<Celestial["Accessibility"]["getFullAXTree"]>
>["nodes"][number];

function getNodeRole(node: AXNode): string {
  return (node.role?.value as string) ?? "unknown";
}

function getNodeName(node: AXNode): string | undefined {
  return node.name?.value as string | undefined;
}

function getNodeProps(node: AXNode): string[] {
  const props: string[] = [];
  if (!node.properties) return props;
  for (const prop of node.properties) {
    if (prop.name === "focused" && prop.value?.value === true) {
      props.push("focused");
    }
    if (prop.name === "disabled" && prop.value?.value === true) {
      props.push("disabled");
    }
    if (prop.name === "checked" && prop.value?.value !== "false") {
      props.push(`checked=${prop.value?.value}`);
    }
    if (prop.name === "level") {
      props.push(`level=${prop.value?.value}`);
    }
    if (prop.name === "required" && prop.value?.value === true) {
      props.push("required");
    }
    if (prop.name === "expanded") {
      props.push(`expanded=${prop.value?.value}`);
    }
  }
  return props;
}

function formatNodeLine(node: AXNode, indent: string): string {
  const role = getNodeRole(node);
  const name = getNodeName(node);
  const props = getNodeProps(node);
  const propsStr = props.length > 0 ? ` (${props.join(", ")})` : "";
  const nameStr = name ? ` "${name}"` : "";
  return `${indent}[${role}]${nameStr}${propsStr}`;
}

interface TreeIndex {
  childrenMap: Map<string, string[]>;
  nodeMap: Map<string, AXNode>;
  rootId: string | undefined;
}

function buildIndex(nodes: AXNode[]): TreeIndex {
  const childrenMap = new Map<string, string[]>();
  const nodeMap = new Map<string, AXNode>();
  let rootId: string | undefined;

  for (const node of nodes) {
    nodeMap.set(node.nodeId, node);
    if (node.parentId) {
      const siblings = childrenMap.get(node.parentId) ?? [];
      siblings.push(node.nodeId);
      childrenMap.set(node.parentId, siblings);
    } else {
      rootId = node.nodeId;
    }
  }
  if (!rootId && nodes.length > 0) rootId = nodes[0].nodeId;

  return { childrenMap, nodeMap, rootId };
}

function formatFullTree(nodes: AXNode[]): string {
  const { childrenMap, nodeMap, rootId } = buildIndex(nodes);
  const lines: string[] = [];

  function walk(nodeId: string, depth: number) {
    const node = nodeMap.get(nodeId);
    if (!node) return;
    if (node.ignored) {
      const children = childrenMap.get(nodeId) ?? [];
      for (const childId of children) walk(childId, depth);
      return;
    }
    lines.push(formatNodeLine(node, "  ".repeat(depth)));
    const children = childrenMap.get(nodeId) ?? [];
    for (const childId of children) walk(childId, depth + 1);
  }

  if (rootId) walk(rootId, 0);
  return lines.length > 0 ? lines.join("\n") : "Empty accessibility tree";
}

function filterByRole(nodes: AXNode[], role: string): string {
  const matches = nodes.filter(
    (n) => !n.ignored && getNodeRole(n) === role,
  );
  if (matches.length === 0) return `No nodes found with role "${role}"`;
  const lines = matches.map((n) => formatNodeLine(n, ""));
  return `Found ${matches.length} [${role}] nodes:\n${lines.join("\n")}`;
}

function filterByName(
  nodes: AXNode[],
  nameFilter: string,
): string {
  const { childrenMap, nodeMap, rootId } = buildIndex(nodes);
  const lowerFilter = nameFilter.toLowerCase();

  // Find all matching node IDs
  const matchingIds = new Set<string>();
  for (const node of nodes) {
    if (node.ignored) continue;
    const name = getNodeName(node);
    if (name && name.toLowerCase().includes(lowerFilter)) {
      matchingIds.add(node.nodeId);
    }
  }

  if (matchingIds.size === 0) {
    return `No nodes found with name containing "${nameFilter}"`;
  }

  // Include ancestors of matches
  const visibleIds = new Set<string>(matchingIds);
  for (const id of matchingIds) {
    let current = nodeMap.get(id);
    while (current?.parentId) {
      visibleIds.add(current.parentId);
      current = nodeMap.get(current.parentId);
    }
  }

  const lines: string[] = [];
  function walk(nodeId: string, depth: number) {
    if (!visibleIds.has(nodeId)) return;
    const node = nodeMap.get(nodeId);
    if (!node || node.ignored) return;
    const prefix = matchingIds.has(nodeId) ? ">>> " : "    ";
    lines.push(prefix + formatNodeLine(node, "  ".repeat(depth)));
    const children = childrenMap.get(nodeId) ?? [];
    for (const childId of children) walk(childId, depth + 1);
  }

  if (rootId) walk(rootId, 0);
  return `Found ${matchingIds.size} matches:\n${lines.join("\n")}`;
}

export function registerAccessibilityTools(
  server: McpServer,
  session: Session,
) {
  server.registerTool("get_accessibility_tree", {
    title: "Get Accessibility Tree",
    description:
      "Get the accessibility tree for the page. Returns roles, names, and properties in an indented text format. Use 'role' to filter to specific element types (e.g. 'button', 'link', 'heading'). Use 'nameFilter' to search by accessible name. Default depth is 5.",
    inputSchema: {
      depth: z
        .number()
        .optional()
        .describe("Max depth to traverse (default: 5). Use -1 for unlimited."),
      role: z
        .string()
        .optional()
        .describe(
          "Filter to nodes with this role (e.g. 'button', 'link', 'heading', 'textbox'). Returns a flat list.",
        ),
      nameFilter: z
        .string()
        .optional()
        .describe(
          "Filter to nodes whose accessible name contains this substring. Shows matching nodes with their ancestor path.",
        ),
      pageId: z.number().optional(),
    },
  }, async ({ depth, role, nameFilter, pageId }) => {
    try {
      const tracked = await session.getPage(pageId);
      const effectiveDepth = depth === -1 ? undefined : (depth ?? 5);
      const { nodes } = await tracked.celestial.Accessibility.getFullAXTree({
        depth: effectiveDepth,
      });

      let formatted: string;
      if (role) {
        formatted = filterByRole(nodes, role);
      } else if (nameFilter) {
        formatted = filterByName(nodes, nameFilter);
      } else {
        formatted = formatFullTree(nodes);
      }

      return { content: [{ type: "text" as const, text: formatted }] };
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
