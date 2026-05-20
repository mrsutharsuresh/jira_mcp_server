# Jira MCP Server

Built by **Suresh Suthar** — `mr.sutharsuresh@gmail.com`

Seamlessly connect Jira (Cloud, Server, and Data Center) with all your favorite AI agents and clients (including GitHub Copilot, Claude Desktop, Cursor, Antigravity, KIRO, and more) using the Model Context Protocol (MCP).

---

## Table of Contents

1. [What it does](#what-it-does)
2. [Prerequisites & Authentication](#prerequisites--authentication)
3. [Quick Start](#quick-start)
4. [Authentication Setup (PAT & API Tokens)](#authentication-setup-pat--api-tokens)
5. [Connecting to AI Agents](#connecting-to-ai-agents)
   - [GitHub Copilot](#github-copilot)
   - [VS Code Forks (Antigravity, KIRO, Cursor)](#vs-code-forks-antigravity-kiro-cursor)
   - [Claude Desktop](#claude-desktop)
6. [Features](#features)
7. [Commands](#commands)
8. [Available MCP Tools](#available-mcp-tools)
9. [Usage Examples](#usage-examples)
10. [Security](#security)
11. [Troubleshooting](#troubleshooting)
12. [Author & License](#author--license)

---

## What it does

Jira MCP Server exposes Jira issue tracking, custom fields, attachments, and project management operations as secure tools to your AI assistants. 

Use simple natural language to search issues, create tickets, add comments, change status, download or upload attachments, and read custom fields directly from your active AI chat.

---

## Prerequisites & Authentication

| Requirement | Details |
|-------------|---------|
| **Node.js** | Node.js (v18+) must be installed on your system |
| **Jira** | Jira Cloud, Server, or Data Center instance with active REST API access |
| **Authentication** | Personal Access Token (PAT) for Server/DC, or API Token for Cloud |
| **AI Client** | GitHub Copilot, Claude Desktop, Cursor, Antigravity, or KIRO |

---

## Quick Start

### Install the VS Code Extension

1. Open VS Code or any compatible VS Code fork (Antigravity, KIRO, Cursor).
2. Install the extension from the compiled `.vsix` bundle (**Install from VSIX...**).
3. Restart or reload your editor.

### Build from Source

```bash
git clone https://github.com/mrsutharsuresh/jira_mcp_server.git
cd jira_mcp_server
npm install
npm run build
npm run package
```

### Connect to Jira

1. Open your editor's Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
2. Run **JIRA MCP: Configure JIRA Connection**.
3. Input your Jira URL, username, and authentication token (PAT or API Token).
4. Run **JIRA MCP: Test JIRA Connection** to verify that everything works successfully.

---

## Authentication Setup (PAT & API Tokens)

Depending on your Jira hosting option, follow these official Atlassian tutorials to generate your credentials:

### 🏢 Jira Server / Data Center (PAT)
If your organization hosts Jira on-premises or in a private cloud, you need a **Personal Access Token (PAT)**:
- Follow the official [Atlassian PAT Creation Tutorial](https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html).
- **Summary**: In Jira, click your avatar at the top right > **Profile** > Select **Personal Access Tokens** from the sidebar > Click **Create Token**.

### ☁️ Jira Cloud (API Token)
If your Jira URL ends with `.atlassian.net`, you are using Jira Cloud and must generate an **API Token**:
- Follow the official [Atlassian API Token Creation Tutorial](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/).
- **Summary**: Log in to [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) and click **Create API Token**.

---

## Connecting to AI Agents

Jira MCP Server is fully compatible with any modern AI agent ecosystem.

### GitHub Copilot
1. Make sure your Jira credentials are configured in VS Code.
2. Open GitHub Copilot Chat.
3. Switch to **Agent Mode** or mention `@jira-mcp` to use the Jira tools.

### VS Code Forks (Antigravity, KIRO, Cursor)
The extension includes **Automatic Configuration Synchronization**!
- As soon as the extension activates or you save your connection details, the extension automatically registers the `jira-mcp` server directly in your fork's settings configuration file (`mcp_config.json`).
- Open your fork's AI Chat pane (e.g., Composer, Cascade, or Chat), and the Jira tools will be active and ready to use immediately!

### Claude Desktop
For Claude Desktop, the server can be registered automatically by the extension or configured manually in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "jira-mcp": {
      "command": "node",
      "args": ["D:\\Code\\SutharLabs\\jira-mcp-server\\dist\\server.js"],
      "env": {
        "ELECTRON_RUN_AS_NODE": "1",
        "JIRA_URL": "https://your-jira-instance.com",
        "JIRA_USERNAME": "your-username",
        "JIRA_TOKEN": "your-pat-or-api-token",
        "WORKSPACE_FOLDER": "D:\\your-workspace"
      }
    }
  }
}
```

---

## Features

- 🔐 **Secure Credential Storage**: Stored securely in your operating system's keychain (Windows Credential Manager, macOS Keychain, or GNOME Keyring) via VS Code SecretStorage.
- 📂 **Workspace-Aware Attachment Downloads**: Automatically downloads files into `<workspace>/jira-attachments/` avoiding permission limits.
- ⚡ **Bi-Directional Attachments**: Ask your AI agent to download files from Jira issues or upload active workspace files straight to a Jira ticket.
- ⚙️ **Custom Fields Support**: Read, query, and modify Jira custom field values dynamically.
- 🤖 **Multi-Agent Compatibility**: Runs flawlessly in all leading developer LLM workflows.

---

## Commands

Inside VS Code / VS Code Forks, use the following commands in the Command Palette:

| Command | Description |
|-------------------------------|---------------------------------------------|
| `JIRA MCP: Configure JIRA Connection` | guided wizard to set URL, username, and token |
| `JIRA MCP: Test JIRA Connection` | Validates active credentials with your server |
| `JIRA MCP: Clear Saved Credentials` | Removes secure secrets and configurations |

---

## Available MCP Tools

The server exposes the following MCP tools dynamically:

| Tool Name | Action | Description |
|---|---|---|
| `search_issues` | **Search** | Query Jira issues using JQL |
| `get_issue` | **Read** | Retrieve full ticket details, comments, and attachments |
| `create_issue` | **Write** | Create a brand new Jira issue |
| `add_comment` | **Comment** | Append a comment to any active issue |
| `update_issue_status` | **Transition** | Update issue status (e.g. In Progress, Done) |
| `list_projects` | **Browse** | List all accessible Jira projects |
| `get_current_user` | **Profile** | Inspect currently authenticated user details |
| `list_attachments` | **Browse** | Find attachments on an issue |
| `download_attachment` | **Download** | Save a Jira attachment into your workspace |
| `upload_attachment` | **Upload** | Upload a local workspace file to a Jira issue |
| `get_custom_fields` | **Inspect** | List all metadata for Jira custom fields |
| `get_custom_field_value` | **Read** | Retrieve custom field values on an issue |
| `update_custom_field` | **Update** | Update a custom field value on an issue |

---

## Usage Examples

- **Searching**: *"Find all high-priority bugs updated this week"* or *"What tickets are currently in the active sprint?"*
- **Issue Authoring**: *"Create a task in MYPROJ: 'Fix security vulnerability in auth controller'"*
- **Updates**: *"Transition PROJ-102 to 'In Progress' and add a comment saying 'Investigating now'"*
- **Assets**: *"Download all attachments from PROJ-456"* or *"Upload my current logs.txt as an attachment to PROJ-456"*

---

## Security

- **Secrets Isolation**: Secrets are never saved in plaintext settings, files, or repository trees. They are retrieved directly from the secure OS Keychain.
- **Process Protection**: Tokens are injected solely at launch time as temporary environment variables inside the isolated node subprocess.
- **Direct Communication**: All requests are dispatched directly from your local machine to your Jira instance over secure HTTPS; no proxy servers or third-party relays are involved.

---

## Troubleshooting

### Connection Failures
- Ensure your Jira URL includes `https://` (e.g. `https://jira.yourcompany.com`).
- Verify your Personal Access Token or API Token is active and has not expired.
- Open `https://<your-jira>/rest/api/2/myself` in a browser on the same network to ensure Jira is reachable.

### AI Agent cannot see tools
- Ensure you have run **JIRA MCP: Configure JIRA Connection** and the connection test passed successfully.
- Check the logs under the **JIRA MCP** output channel in your editor.
- Restart or reload your AI Client/VS Code Fork window.

---

## Author & License

- **Author**: **Suresh Suthar** — `mr.sutharsuresh@gmail.com`
- **License**: Released under the **MIT License**.
