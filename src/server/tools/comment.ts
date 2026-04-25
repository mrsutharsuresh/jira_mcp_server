import { z } from "zod";
import { JiraClient } from "../jira-client.js";

export const definition = {
  name: "add_comment",
  description: "Add a comment to a JIRA issue.",
  inputSchema: {
    type: "object" as const,
    properties: {
      issue_key: {
        type: "string",
        description: "JIRA issue key (e.g. 'PROJ-123')",
      },
      comment: {
        type: "string",
        description: "Comment text to add",
      },
    },
    required: ["issue_key", "comment"],
  },
};

const Schema = z.object({
  issue_key: z.string().min(1),
  comment: z.string().min(1, "Comment text is required"),
});

export async function handler(
  args: Record<string, unknown>,
  client: JiraClient
): Promise<string> {
  const { issue_key, comment } = Schema.parse(args);

  const result = await client.addComment(issue_key, comment);

  return JSON.stringify(
    {
      success: true,
      comment_id: result.id,
      issue_key,
      author: result.author?.displayName || client.username,
      created: result.created,
      url: `${client.jiraUrl}/browse/${issue_key}`,
      message: `Comment added to ${issue_key}`,
    },
    null,
    2
  );
}
