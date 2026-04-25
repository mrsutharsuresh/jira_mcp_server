import { JiraClient } from "../jira-client.js";

export const definition = {
  name: "list_projects",
  description:
    "List all JIRA projects accessible to the authenticated user, with project key, name, type and lead.",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

export async function handler(
  _args: Record<string, unknown>,
  client: JiraClient
): Promise<string> {
  const projects = await client.listProjects();

  const result = projects.map((p) => ({
    key: p.key,
    name: p.name,
    type: p.projectTypeKey,
    lead: p.lead?.displayName || "Unknown",
    url: `${client.jiraUrl}/browse/${p.key}`,
  }));

  return JSON.stringify({ projects: result, total: result.length }, null, 2);
}
