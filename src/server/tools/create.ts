import { z } from "zod";
import { JiraClient } from "../jira-client.js";

export const definition = {
  name: "create_issue",
  description: "Create a new JIRA issue in a specified project.",
  inputSchema: {
    type: "object" as const,
    properties: {
      project_key: {
        type: "string",
        description: "Project key where the issue should be created (e.g. 'PROJ')",
      },
      summary: {
        type: "string",
        description: "Brief summary/title of the issue",
      },
      issue_type: {
        type: "string",
        description: "Type of issue (e.g. 'Bug', 'Story', 'Task')",
        default: "Task",
      },
      description: {
        type: "string",
        description: "Detailed description of the issue",
      },
      assignee: {
        type: "string",
        description: "Username to assign the issue to (optional)",
      },
    },
    required: ["project_key", "summary"],
  },
};

const Schema = z.object({
  project_key: z.string().min(1),
  summary: z.string().min(1, "Summary is required"),
  issue_type: z.string().default("Task"),
  description: z.string().default(""),
  assignee: z.string().optional(),
});

export async function handler(
  args: Record<string, unknown>,
  client: JiraClient
): Promise<string> {
  const { project_key, summary, issue_type, description, assignee } =
    Schema.parse(args);

  const body: Record<string, unknown> = {
    fields: {
      project: { key: project_key },
      summary,
      issuetype: { name: issue_type },
      description,
    },
  };

  if (assignee) {
    (body.fields as Record<string, unknown>).assignee = { name: assignee };
  }

  const issue = await client.createIssue(body);

  return JSON.stringify(
    {
      success: true,
      issue_key: issue.key,
      url: `${client.jiraUrl}/browse/${issue.key}`,
      message: `Issue ${issue.key} created successfully`,
    },
    null,
    2
  );
}
