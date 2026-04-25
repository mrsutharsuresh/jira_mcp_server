import { z } from "zod";
import { JiraClient } from "../jira-client.js";

export const definition = {
  name: "update_issue_status",
  description:
    "Update the status of a JIRA issue using available workflow transitions. If the requested status is not available, returns the list of valid transitions.",
  inputSchema: {
    type: "object" as const,
    properties: {
      issue_key: {
        type: "string",
        description: "JIRA issue key (e.g. 'PROJ-123')",
      },
      status: {
        type: "string",
        description:
          "Target status name (e.g. 'In Progress', 'Done', 'Resolved')",
      },
    },
    required: ["issue_key", "status"],
  },
};

const Schema = z.object({
  issue_key: z.string().min(1),
  status: z.string().min(1, "Target status is required"),
});

export async function handler(
  args: Record<string, unknown>,
  client: JiraClient
): Promise<string> {
  const { issue_key, status } = Schema.parse(args);

  const { transitions } = await client.getTransitions(issue_key);

  const target = transitions.find(
    (t) => t.name.toLowerCase() === status.toLowerCase()
  );

  if (!target) {
    return JSON.stringify(
      {
        success: false,
        message: `Transition to '${status}' is not available for ${issue_key}`,
        available_transitions: transitions.map((t) => ({
          id: t.id,
          name: t.name,
          to: t.to?.name,
        })),
      },
      null,
      2
    );
  }

  await client.doTransition(issue_key, target.id);

  return JSON.stringify(
    {
      success: true,
      issue_key,
      new_status: status,
      url: `${client.jiraUrl}/browse/${issue_key}`,
      message: `${issue_key} transitioned to '${status}'`,
    },
    null,
    2
  );
}
