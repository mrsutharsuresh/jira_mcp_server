import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { JiraClient } from "../jira-client.js";

// ─── list_attachments ─────────────────────────────────────────────────────────

export const listAttachmentsDefinition = {
  name: "list_attachments",
  description: "List all attachments on a JIRA issue.",
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

export async function listAttachmentsHandler(
  args: Record<string, unknown>,
  client: JiraClient
): Promise<string> {
  const { issue_key } = z.object({ issue_key: z.string().min(1) }).parse(args);

  const issue = await client.getIssue(issue_key, ["attachment"]);
  const attachments = (
    (issue.fields.attachment as Array<{
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

  return JSON.stringify(
    { attachments, total: attachments.length, issue_key },
    null,
    2
  );
}

// ─── download_attachment ──────────────────────────────────────────────────────

export const downloadAttachmentDefinition = {
  name: "download_attachment",
  description:
    "Download an attachment from a JIRA issue, save it to the workspace folder under jira-attachments/, and return the local file path. Use list_attachments first to get the attachment ID.",
  inputSchema: {
    type: "object" as const,
    properties: {
      issue_key: {
        type: "string",
        description: "JIRA issue key (e.g. 'PROJ-123')",
      },
      attachment_id: {
        type: "string",
        description: "Attachment ID from list_attachments",
      },
    },
    required: ["issue_key", "attachment_id"],
  },
};

export async function downloadAttachmentHandler(
  args: Record<string, unknown>,
  client: JiraClient
): Promise<string> {
  const { issue_key, attachment_id } = z
    .object({ issue_key: z.string().min(1), attachment_id: z.string().min(1) })
    .parse(args);

  // Get attachment metadata
  const issue = await client.getIssue(issue_key, ["attachment"]);
  const attachments = (issue.fields.attachment as Array<{
    id: string;
    filename: string;
    size: number;
    mimeType: string;
    content: string;
  }>) ?? [];

  const meta = attachments.find((a) => a.id === attachment_id);
  if (!meta) {
    return JSON.stringify(
      {
        success: false,
        error: `Attachment ${attachment_id} not found on ${issue_key}`,
      },
      null,
      2
    );
  }

  const buffer = await client.downloadAttachment(meta.content);

  // ── Save to workspace ──────────────────────────────────────────────────────
  // WORKSPACE_FOLDER is injected by VS Code via ${workspaceFolder} in
  // contributes.mcpServers env. Fall back to cwd() when running outside VS Code
  // (e.g. in tests or CLI usage).
  const workspaceFolder = process.env["WORKSPACE_FOLDER"] || process.cwd();
  const attachmentsDir = path.join(workspaceFolder, "jira-attachments");

  if (!fs.existsSync(attachmentsDir)) {
    fs.mkdirSync(attachmentsDir, { recursive: true });
  }

  // Use issue_key prefix to avoid collisions across issues
  const safeFilename = `${issue_key}_${meta.filename}`;
  const localPath = path.join(attachmentsDir, safeFilename);
  fs.writeFileSync(localPath, buffer);

  return JSON.stringify(
    {
      success: true,
      issue_key,
      attachment_id,
      filename: meta.filename,
      local_path: localPath,
      size: meta.size,
      size_human: formatBytes(meta.size),
      mime_type: meta.mimeType,
    },
    null,
    2
  );
}

// ─── upload_attachment ────────────────────────────────────────────────────────

export const uploadAttachmentDefinition = {
  name: "upload_attachment",
  description:
    "Upload a local file as an attachment to a JIRA issue. Provide the absolute path to the file.",
  inputSchema: {
    type: "object" as const,
    properties: {
      issue_key: {
        type: "string",
        description: "JIRA issue key (e.g. 'PROJ-123')",
      },
      file_path: {
        type: "string",
        description: "Absolute path to the file to upload",
      },
    },
    required: ["issue_key", "file_path"],
  },
};

export async function uploadAttachmentHandler(
  args: Record<string, unknown>,
  client: JiraClient
): Promise<string> {
  const { issue_key, file_path } = z
    .object({ issue_key: z.string().min(1), file_path: z.string().min(1) })
    .parse(args);

  // Validate file exists before attempting upload
  const fs = await import("fs");
  if (!fs.existsSync(file_path)) {
    return JSON.stringify(
      {
        success: false,
        error: `File not found: ${file_path}`,
      },
      null,
      2
    );
  }

  const result = await client.uploadAttachment(issue_key, file_path);

  const attachments = Array.isArray(result) ? result : [result];
  const first = attachments[0] as {
    id?: string;
    filename?: string;
    size?: number;
    content?: string;
  };

  return JSON.stringify(
    {
      success: true,
      issue_key,
      attachment_id: first?.id,
      filename: first?.filename,
      size: first?.size,
      size_human: formatBytes(first?.size ?? 0),
      url: first?.content,
      message: `File uploaded to ${issue_key}`,
    },
    null,
    2
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
