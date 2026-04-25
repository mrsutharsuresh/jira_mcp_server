import { z } from "zod";
import { JiraClient } from "../jira-client.js";

// ─── get_custom_fields ────────────────────────────────────────────────────────

export const getCustomFieldsDefinition = {
  name: "get_custom_fields",
  description:
    "Get all custom fields available in JIRA, optionally filtered by name. Returns field id, name, and schema.",
  inputSchema: {
    type: "object" as const,
    properties: {
      field_name: {
        type: "string",
        description:
          "Optional partial name filter (case-insensitive, e.g. 'Quick Notes')",
      },
    },
    required: [],
  },
};

export async function getCustomFieldsHandler(
  args: Record<string, unknown>,
  client: JiraClient
): Promise<string> {
  const { field_name } = z.object({ field_name: z.string().optional() }).parse(args);

  const fields = await client.getFields();

  let results = fields.filter((f) => f.custom);
  if (field_name) {
    const lower = field_name.toLowerCase();
    results = results.filter((f) => f.name.toLowerCase().includes(lower));
  }

  return JSON.stringify(
    {
      fields: results.map((f) => ({
        id: f.id,
        name: f.name,
        custom: f.custom,
        searchable: f.searchable,
        orderable: f.orderable,
        clause_names: f.clauseNames,
        schema: f.schema,
      })),
      total: results.length,
    },
    null,
    2
  );
}

// ─── get_custom_field_value ───────────────────────────────────────────────────

export const getCustomFieldValueDefinition = {
  name: "get_custom_field_value",
  description:
    "Get the value of a specific custom field from a JIRA issue by field name.",
  inputSchema: {
    type: "object" as const,
    properties: {
      issue_key: {
        type: "string",
        description: "JIRA issue key (e.g. 'PROJ-123')",
      },
      field_name: {
        type: "string",
        description: "Name of the custom field (e.g. 'Quick Notes')",
      },
    },
    required: ["issue_key", "field_name"],
  },
};

const FieldValueSchema = z.object({
  issue_key: z.string().min(1),
  field_name: z.string().min(1),
});

export async function getCustomFieldValueHandler(
  args: Record<string, unknown>,
  client: JiraClient
): Promise<string> {
  const { issue_key, field_name } = FieldValueSchema.parse(args);

  // Find field ID by name
  const allFields = await client.getFields();
  const field = allFields.find(
    (f) => f.name.toLowerCase() === field_name.toLowerCase()
  );

  if (!field) {
    return JSON.stringify(
      {
        success: false,
        error: `Custom field '${field_name}' not found`,
        available_custom_fields: allFields
          .filter((f) => f.custom)
          .slice(0, 20)
          .map((f) => f.name),
      },
      null,
      2
    );
  }

  const issue = await client.getIssue(issue_key, [field.id]);
  const value = (issue.fields as Record<string, unknown>)[field.id];

  return JSON.stringify(
    {
      success: true,
      issue_key,
      field_name,
      field_id: field.id,
      value,
    },
    null,
    2
  );
}

// ─── update_custom_field ──────────────────────────────────────────────────────

export const updateCustomFieldDefinition = {
  name: "update_custom_field",
  description:
    "Update a custom field value on a JIRA issue by field name.",
  inputSchema: {
    type: "object" as const,
    properties: {
      issue_key: {
        type: "string",
        description: "JIRA issue key (e.g. 'PROJ-123')",
      },
      field_name: {
        type: "string",
        description: "Name of the custom field to update (e.g. 'Quick Notes')",
      },
      value: {
        description: "New value for the custom field (string, number, or object)",
      },
    },
    required: ["issue_key", "field_name", "value"],
  },
};

const UpdateFieldSchema = z.object({
  issue_key: z.string().min(1),
  field_name: z.string().min(1),
  value: z.unknown(),
});

export async function updateCustomFieldHandler(
  args: Record<string, unknown>,
  client: JiraClient
): Promise<string> {
  const { issue_key, field_name, value } = UpdateFieldSchema.parse(args);

  const allFields = await client.getFields();
  const field = allFields.find(
    (f) => f.name.toLowerCase() === field_name.toLowerCase()
  );

  if (!field) {
    return JSON.stringify(
      {
        success: false,
        error: `Custom field '${field_name}' not found`,
      },
      null,
      2
    );
  }

  await client.updateIssue(issue_key, {
    fields: { [field.id]: value },
  });

  return JSON.stringify(
    {
      success: true,
      issue_key,
      field_name,
      field_id: field.id,
      new_value: value,
      url: `${client.jiraUrl}/browse/${issue_key}`,
      message: `Custom field '${field_name}' updated on ${issue_key}`,
    },
    null,
    2
  );
}
