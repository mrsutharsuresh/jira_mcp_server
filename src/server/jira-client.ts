import axios, { AxiosInstance, AxiosResponse } from "axios";
import FormData from "form-data";
import * as fs from "fs";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: Record<string, unknown>;
}

export interface JiraSearchResult {
  total: number;
  issues: JiraIssue[];
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  lead?: { displayName: string };
  self: string;
}

export interface JiraUser {
  name: string;
  displayName: string;
  emailAddress: string;
  active: boolean;
}

export interface JiraTransition {
  id: string;
  name: string;
  to: { name: string };
}

export interface JiraComment {
  id: string;
  author: { displayName: string };
  body: string;
  created: string;
}

export interface JiraField {
  id: string;
  name: string;
  custom: boolean;
  orderable: boolean;
  searchable: boolean;
  clauseNames: string[];
  schema?: { type: string; system?: string; custom?: string };
}

export interface JiraAttachment {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  created: string;
  author: { displayName: string };
  content: string;
}

// ─── Error Handling ───────────────────────────────────────────────────────────

export class JiraApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "JiraApiError";
  }
}

function extractJiraError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (data) {
      // JIRA returns errors as { errorMessages: [], errors: {} }
      const messages: string[] = [];
      if (Array.isArray(data.errorMessages) && data.errorMessages.length > 0) {
        messages.push(...data.errorMessages);
      }
      if (data.errors && typeof data.errors === "object") {
        messages.push(
          ...Object.entries(data.errors).map(([k, v]) => `${k}: ${v}`)
        );
      }
      if (messages.length > 0) return messages.join("; ");
      if (typeof data === "string") return data;
    }
    if (err.response?.status === 401)
      return "Authentication failed — check your PAT";
    if (err.response?.status === 403)
      return "Permission denied — you don't have access to this resource";
    if (err.response?.status === 404)
      return "Resource not found — check the issue key or URL";
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class JiraClient {
  private readonly http: AxiosInstance;
  public readonly jiraUrl: string;
  public readonly username: string;

  constructor(jiraUrl: string, token: string, username: string) {
    this.jiraUrl = jiraUrl.replace(/\/$/, "");
    this.username = username;
    this.http = axios.create({
      baseURL: `${this.jiraUrl}/rest/api/2`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 30000,
    });
  }

  // ── Search ──────────────────────────────────────────────────────────────────

  async searchIssues(
    jql: string,
    maxResults = 50,
    fields?: string[]
  ): Promise<JiraSearchResult> {
    try {
      const params: Record<string, unknown> = { jql, maxResults };
      if (fields) params.fields = fields.join(",");
      const res: AxiosResponse<JiraSearchResult> = await this.http.get(
        "/search",
        { params }
      );
      return res.data;
    } catch (err) {
      throw new JiraApiError(
        axios.isAxiosError(err) ? (err.response?.status ?? 0) : 0,
        extractJiraError(err)
      );
    }
  }

  // ── Issue ───────────────────────────────────────────────────────────────────

  async getIssue(
    issueKey: string,
    fields?: string[]
  ): Promise<JiraIssue> {
    try {
      const params: Record<string, unknown> = {};
      if (fields) params.fields = fields.join(",");
      const res: AxiosResponse<JiraIssue> = await this.http.get(
        `/issue/${issueKey}`,
        { params }
      );
      return res.data;
    } catch (err) {
      throw new JiraApiError(
        axios.isAxiosError(err) ? (err.response?.status ?? 0) : 0,
        extractJiraError(err)
      );
    }
  }

  async createIssue(body: Record<string, unknown>): Promise<JiraIssue> {
    try {
      const res: AxiosResponse<JiraIssue> = await this.http.post(
        "/issue",
        body
      );
      return res.data;
    } catch (err) {
      throw new JiraApiError(
        axios.isAxiosError(err) ? (err.response?.status ?? 0) : 0,
        extractJiraError(err)
      );
    }
  }

  async updateIssue(
    issueKey: string,
    body: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.http.put(`/issue/${issueKey}`, body);
    } catch (err) {
      throw new JiraApiError(
        axios.isAxiosError(err) ? (err.response?.status ?? 0) : 0,
        extractJiraError(err)
      );
    }
  }

  // ── Comments ─────────────────────────────────────────────────────────────────

  async addComment(issueKey: string, body: string): Promise<JiraComment> {
    try {
      const res: AxiosResponse<JiraComment> = await this.http.post(
        `/issue/${issueKey}/comment`,
        { body }
      );
      return res.data;
    } catch (err) {
      throw new JiraApiError(
        axios.isAxiosError(err) ? (err.response?.status ?? 0) : 0,
        extractJiraError(err)
      );
    }
  }

  // ── Transitions ──────────────────────────────────────────────────────────────

  async getTransitions(
    issueKey: string
  ): Promise<{ transitions: JiraTransition[] }> {
    try {
      const res = await this.http.get(`/issue/${issueKey}/transitions`);
      return res.data as { transitions: JiraTransition[] };
    } catch (err) {
      throw new JiraApiError(
        axios.isAxiosError(err) ? (err.response?.status ?? 0) : 0,
        extractJiraError(err)
      );
    }
  }

  async doTransition(issueKey: string, transitionId: string): Promise<void> {
    try {
      await this.http.post(`/issue/${issueKey}/transitions`, {
        transition: { id: transitionId },
      });
    } catch (err) {
      throw new JiraApiError(
        axios.isAxiosError(err) ? (err.response?.status ?? 0) : 0,
        extractJiraError(err)
      );
    }
  }

  // ── Projects ─────────────────────────────────────────────────────────────────

  async listProjects(): Promise<JiraProject[]> {
    try {
      const res: AxiosResponse<JiraProject[]> = await this.http.get(
        "/project"
      );
      return res.data;
    } catch (err) {
      throw new JiraApiError(
        axios.isAxiosError(err) ? (err.response?.status ?? 0) : 0,
        extractJiraError(err)
      );
    }
  }

  // ── User ─────────────────────────────────────────────────────────────────────

  async getCurrentUser(): Promise<JiraUser> {
    try {
      const res: AxiosResponse<JiraUser> = await this.http.get("/myself");
      return res.data;
    } catch (err) {
      throw new JiraApiError(
        axios.isAxiosError(err) ? (err.response?.status ?? 0) : 0,
        extractJiraError(err)
      );
    }
  }

  // ── Fields ────────────────────────────────────────────────────────────────────

  async getFields(): Promise<JiraField[]> {
    try {
      const res: AxiosResponse<JiraField[]> = await this.http.get("/field");
      return res.data;
    } catch (err) {
      throw new JiraApiError(
        axios.isAxiosError(err) ? (err.response?.status ?? 0) : 0,
        extractJiraError(err)
      );
    }
  }

  // ── Attachments ───────────────────────────────────────────────────────────────

  async downloadAttachment(contentUrl: string): Promise<Buffer> {
    try {
      const res = await this.http.get(contentUrl, {
        baseURL: "",
        responseType: "arraybuffer",
        headers: { Accept: "*/*" },
      });
      return Buffer.from(res.data as ArrayBuffer);
    } catch (err) {
      throw new JiraApiError(
        axios.isAxiosError(err) ? (err.response?.status ?? 0) : 0,
        extractJiraError(err)
      );
    }
  }

  async uploadAttachment(issueKey: string, filePath: string): Promise<unknown> {
    try {
      const form = new FormData();
      form.append("file", fs.createReadStream(filePath));
      const res = await this.http.post(
        `/issue/${issueKey}/attachments`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            "X-Atlassian-Token": "no-check",
          },
        }
      );
      return res.data;
    } catch (err) {
      throw new JiraApiError(
        axios.isAxiosError(err) ? (err.response?.status ?? 0) : 0,
        extractJiraError(err)
      );
    }
  }
}
