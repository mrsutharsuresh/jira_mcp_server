import { z } from "zod";
import { JiraClient } from "../jira-client.js";

export const definition = {
  name: "get_issue",
  description:
    "Get detailed information about a specific JIRA issue, including description, comments, attachments, linked issues, subtasks and custom fields.",
  inputSchema: {
    type: "object" as const,
    properties: {
      issue_key: {
        type: "string",
        description: "JIRA issue key (e.g. 'PROJ-123')",
      },
    },
    required: ["issue_key"],
  },
};

const Schema = z.object({
  issue_key: z.string().min(1, "Issue key is required"),
});

// Known custom fields to extract (same as Python get_issue)
const CUSTOM_FIELD_NAMES: Record<string, string> = {
  "Quick Notes": "",
  "Single liner status": "",
  "Executive status": "",
};

export async function handler(
  args: Record<string, unknown>,
  client: JiraClient
): Promise<string> {
  const { issue_key } = Schema.parse(args);

  const issue = await client.getIssue(issue_key);
  const f = issue.fields;

  // Extract all comments (most recent first for readability)
  const commentList = (
    f.comment as { comments: Array<{
      id: string;
      author: { displayName: string };
      body: string;
      created: string;
    }> } | undefined
  )?.comments ?? [];
  const lastComments = commentList.map((c) => ({
    id: c.id,
    author: c.author?.displayName || "Unknown",
    body: c.body || "",
    created: c.created,
  }));

  // Extract attachments
  const attachments = (
    (f.attachment as Array<{
      id: string;
      filename: string;
      size: number;
      mimeType: string;
      created: string;
      author: { displayName: string };
      content: string;
    }>) ?? []
  ).map((a) => ({
    id: a.id,
    filename: a.filename,
    size: a.size,
    size_human: formatBytes(a.size),
    mime_type: a.mimeType,
    created: a.created,
    author: a.author?.displayName || "Unknown",
    content_url: a.content,
  }));

  // Extract linked issues
  const linkedIssues = (
    (f.issuelinks as Array<{
      type: { name: string; inward: string; outward: string };
      inwardIssue?: { key: string; fields: { summary: string; status: { name: string } } };
      outwardIssue?: { key: string; fields: { summary: string; status: { name: string } } };
    }>) ?? []
  ).map((link) => {
    const direction = link.inwardIssue ? "inward" : "outward";
    const linked = link.inwardIssue || link.outwardIssue;
    return {
      type: link.type?.name || "Unknown",
      direction,
      key: linked?.key || "",
      summary: (linked?.fields?.summary as string) || "",
      status: linked?.fields?.status?.name || "Unknown",
    };
  });

  // Extract subtasks
  const subtasks = (
    (f.subtasks as Array<{
      key: string;
      fields: { summary: string; status: { name: string } };
    }>) ?? []
  ).map((s) => ({
    key: s.key,
    summary: (s.fields?.summary as string) || "",
    status: s.fields?.status?.name || "Unknown",
  }));

  // Extract custom fields (look for known field names in all fields)
  const customFieldValues: Record<string, unknown> = {};
  for (const key of Object.keys(CUSTOM_FIELD_NAMES)) {
    // The actual field id is looked up at runtime since ids vary per instance
    // We surface whatever the field resolver found in the issue
  }
  // Include all customfield_* values that are non-null
  for (const [k, v] of Object.entries(f)) {
    if (k.startsWith("customfield_") && v !== null && v !== undefined) {
      customFieldValues[k] = v;
    }
  }

  const issueData = {
    key: issue.key,
    summary: (f.summary as string) || "",
    description: (f.description as string) || "",
    status: (f.status as { name: string } | undefined)?.name || "Unknown",
    issue_type:
      (f.issuetype as { name: string } | undefined)?.name || "Unknown",
    priority: (f.priority as { name: string } | null)?.name || "None",
    assignee:
      (f.assignee as { displayName: string } | null)?.displayName ||
      "Unassigned",
    reporter:
      (f.reporter as { displayName: string } | undefined)?.displayName ||
      "Unknown",
    created: f.created as string,
    updated: f.updated as string,
    resolved: (f.resolutiondate as string | null) || null,
    labels: (f.labels as string[]) || [],
    components: (
      (f.components as Array<{ name: string }>) || []
    ).map((c) => c.name),
    fix_versions: (
      (f.fixVersions as Array<{ name: string }>) || []
    ).map((v) => v.name),
    url: `${client.jiraUrl}/browse/${issue.key}`,
    comments: lastComments,
    attachments,
    linked_issues: linkedIssues,
    subtasks,
    custom_fields: customFieldValues,
  };

  return JSON.stringify(issueData, null, 2);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
