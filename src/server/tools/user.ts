import { JiraClient } from "../jira-client.js";

const SERVER_VERSION = "1.0.0";

export const getCurrentUserDefinition = {
  name: "get_current_user",
  description:
    "Get information about the currently authenticated JIRA user, including username, display name and email.",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

export const getServerVersionDefinition = {
  name: "get_server_version",
  description: "Get the JIRA MCP server version and available features.",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

export async function getCurrentUserHandler(
  _args: Record<string, unknown>,
  client: JiraClient
): Promise<string> {
  const user = await client.getCurrentUser();

  return JSON.stringify(
    {
      username: user.name,
      display_name: user.displayName,
      email: user.emailAddress,
      active: user.active,
      jira_url: client.jiraUrl,
    },
    null,
    2
  );
}

export async function getServerVersionHandler(
  _args: Record<string, unknown>,
  _client: JiraClient
): Promise<string> {
  return JSON.stringify(
    {
      version: SERVER_VERSION,
      release_date: "2026-04-24",
      features: [
        "search_issues",
        "get_issue",
        "create_issue",
        "add_comment",
        "update_issue_status",
        "list_projects",
        "get_current_user",
        "get_custom_fields",
        "get_custom_field_value",
        "update_custom_field",
        "list_attachments",
        "download_attachment",
        "upload_attachment",
      ],
    },
    null,
    2
  );
}
