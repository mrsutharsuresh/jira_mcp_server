import { JiraClient } from "../jira-client.js";
import { definition as searchDef, handler as searchHandler } from "./search.js";
import { definition as issueDef, handler as issueHandler } from "./issue.js";
import { definition as createDef, handler as createHandler } from "./create.js";
import { definition as commentDef, handler as commentHandler } from "./comment.js";
import { definition as statusDef, handler as statusHandler } from "./status.js";
import { definition as projectsDef, handler as projectsHandler } from "./projects.js";
import {
  getCurrentUserDefinition,
  getServerVersionDefinition,
  getCurrentUserHandler,
  getServerVersionHandler,
} from "./user.js";
import {
  getCustomFieldsDefinition,
  getCustomFieldValueDefinition,
  updateCustomFieldDefinition,
  getCustomFieldsHandler,
  getCustomFieldValueHandler,
  updateCustomFieldHandler,
} from "./custom-fields.js";
import {
  listAttachmentsDefinition,
  downloadAttachmentDefinition,
  uploadAttachmentDefinition,
  listAttachmentsHandler,
  downloadAttachmentHandler,
  uploadAttachmentHandler,
} from "./attachments.js";

// ─── Tool definition type (matches MCP SDK Tool shape) ───────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

type ToolHandler = (
  args: Record<string, unknown>,
  client: JiraClient
) => Promise<string>;

interface ToolEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const TOOLS: Map<string, ToolEntry> = new Map([
  [searchDef.name, { definition: searchDef, handler: searchHandler }],
  [issueDef.name, { definition: issueDef, handler: issueHandler }],
  [createDef.name, { definition: createDef, handler: createHandler }],
  [commentDef.name, { definition: commentDef, handler: commentHandler }],
  [statusDef.name, { definition: statusDef, handler: statusHandler }],
  [projectsDef.name, { definition: projectsDef, handler: projectsHandler }],
  [getCurrentUserDefinition.name, { definition: getCurrentUserDefinition, handler: getCurrentUserHandler }],
  [getServerVersionDefinition.name, { definition: getServerVersionDefinition, handler: getServerVersionHandler }],
  [getCustomFieldsDefinition.name, { definition: getCustomFieldsDefinition, handler: getCustomFieldsHandler }],
  [getCustomFieldValueDefinition.name, { definition: getCustomFieldValueDefinition, handler: getCustomFieldValueHandler }],
  [updateCustomFieldDefinition.name, { definition: updateCustomFieldDefinition, handler: updateCustomFieldHandler }],
  [listAttachmentsDefinition.name, { definition: listAttachmentsDefinition, handler: listAttachmentsHandler }],
  [downloadAttachmentDefinition.name, { definition: downloadAttachmentDefinition, handler: downloadAttachmentHandler }],
  [uploadAttachmentDefinition.name, { definition: uploadAttachmentDefinition, handler: uploadAttachmentHandler }],
]);

// ─── Exports ──────────────────────────────────────────────────────────────────

export function getAllDefinitions(): ToolDefinition[] {
  return Array.from(TOOLS.values()).map((t) => t.definition);
}

export async function dispatch(
  name: string,
  args: Record<string, unknown>,
  client: JiraClient
): Promise<string> {
  const tool = TOOLS.get(name);
  if (!tool) {
    throw new Error(
      `Unknown tool: '${name}'. Available tools: ${Array.from(TOOLS.keys()).join(", ")}`
    );
  }
  return tool.handler(args, client);
}
