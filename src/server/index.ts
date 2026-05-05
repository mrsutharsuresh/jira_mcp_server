import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { JiraClient } from "./jira-client.js";
import { getAllDefinitions, dispatch } from "./tools/index.js";

// ─── Environment validation ───────────────────────────────────────────────────

function getRequiredEnv(name: string): string {
  const val = process.env[name];
  if (!val || val.trim() === "") {
    process.stderr.write(
      `[jira-mcp] ERROR: Required environment variable '${name}' is not set.\n` +
        `Run 'JIRA MCP: Configure JIRA Connection' in VS Code to set up your credentials.\n`
    );
    process.exit(1);
  }
  return val.trim();
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const jiraUrl = getRequiredEnv("JIRA_URL");
  const jiraToken = getRequiredEnv("JIRA_TOKEN");
  const jiraUsername = process.env["JIRA_USERNAME"]?.trim() || "JIRA User";

  const client = new JiraClient(jiraUrl, jiraToken, jiraUsername);

  const server = new McpServer({
    name: "jira-mcp",
    version: "1.0.0",
  });

  // Register all tools dynamically from the registry
  const definitions = getAllDefinitions();

  for (const def of definitions) {
    // Build a Zod schema from the JSON Schema properties so McpServer
    // can validate inputs. We accept all tool args as a passthrough object
    // and perform per-tool Zod validation inside each handler.
    const rawShape: Record<string, z.ZodTypeAny> = {};
    const props = def.inputSchema.properties || {};
    const required = def.inputSchema.required || [];

    for (const [key, prop] of Object.entries(props)) {
      const p = prop as Record<string, unknown>;
      let zodType: z.ZodTypeAny;

      if (p.type === "string") {
        zodType = z.string();
      } else if (p.type === "number" || p.type === "integer") {
        zodType = z.number();
      } else if (p.type === "boolean") {
        zodType = z.boolean();
      } else {
        zodType = z.unknown();
      }

      // Apply default if present
      if (p.default !== undefined) {
        zodType = (zodType as z.ZodDefault<z.ZodTypeAny>).default
          ? zodType
          : zodType.default(p.default);
      }

      rawShape[key] = required.includes(key) ? zodType : zodType.optional();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    server.tool(
      def.name,
      def.description,
      rawShape as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (args: any) => {
        try {
          const text = await dispatch(
            def.name,
            args as Record<string, unknown>,
            client
          );
          return {
            content: [{ type: "text" as const, text }],
          };
        } catch (err: unknown) {
          // Build a rich error object that includes Node.js fs errno fields
          // (code, syscall, path) when present — these are exactly what gets
          // reported as 'UNKNOWN: unknown error, write' without this treatment.
          const isErrno = err instanceof Error && "code" in err;
          const e = err as NodeJS.ErrnoException;
          const errorPayload: Record<string, unknown> = {
            error: e.message ?? String(err),
          };
          if (isErrno) {
            if (e.code) errorPayload.code = e.code;
            if (e.syscall) errorPayload.syscall = e.syscall;
            if (e.path) errorPayload.path = e.path;
          }
          process.stderr.write(
            `[jira-mcp] Tool error (${def.name}): ${JSON.stringify(errorPayload)}\n`
          );
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(errorPayload, null, 2),
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  process.stderr.write(
    `[jira-mcp] Server started — ${definitions.length} tools registered — ${jiraUrl}\n`
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  const isErrno = err instanceof Error && "code" in err;
  const e = err as NodeJS.ErrnoException;
  const parts: string[] = [err instanceof Error ? err.message : String(err)];
  if (isErrno) {
    if (e.code) parts.push(`code=${e.code}`);
    if (e.syscall) parts.push(`syscall=${e.syscall}`);
    if (e.path) parts.push(`path=${e.path}`);
  }
  process.stderr.write(`[jira-mcp] Fatal error: ${parts.join(" ")}\n`);
  process.exit(1);
});
