import { z } from "zod";
import { JiraClient } from "../jira-client.js";

export const definition = {
  name: "search_issues",
  description:
    "Search for JIRA issues using JQL (JIRA Query Language). Returns key, summary, status, assignee, reporter, priority, type and URL.",
  inputSchema: {
    type: "object" as const,
    properties: {
      jql: {
        type: "string",
        description:
          "JQL query string (e.g. 'assignee = currentUser() AND status = Open')",
      },
      max_results: {
        type: "number",
        description: "Maximum number of results to return (default: 50)",
        default: 50,
      },
    },
    required: ["jql"],
  },
};

const Schema = z.object({
  jql: z.string().min(1, "JQL query is required"),
  max_results: z.number().int().min(1).max(500).default(50),
});

export async function handler(
  args: Record<string, unknown>,
  client: JiraClient
): Promise<string> {
  const { jql, max_results } = Schema.parse(args);
  const result = await client.searchIssues(jql, max_results);

  const issues = result.issues.map((issue) => {
    const f = issue.fields;
    return {
      key: issue.key,
      summary: (f.summary as string) || "",
      status: (f.status as { name: string } | undefined)?.name || "Unknown",
      assignee:
        (f.assignee as { displayName: string } | null)?.displayName ||
        "Unassigned",
      reporter:
        (f.reporter as { displayName: string } | undefined)?.displayName ||
        "Unknown",
      issue_type:
        (f.issuetype as { name: string } | undefined)?.name || "Unknown",
      priority:
        (f.priority as { name: string } | null)?.name || "None",
      created: f.created as string,
      updated: f.updated as string,
      url: `${client.jiraUrl}/browse/${issue.key}`,
    };
  });

  return JSON.stringify({ issues, total: result.total }, null, 2);
}
