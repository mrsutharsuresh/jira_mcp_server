# Jira MCP Server

Built by **Suresh Suthar** — `mr.sutharsuresh@gmail.com`

Website: [SutharLabs](https://sutharlabs.com)

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
| **VS Code** | Version 1.102 or newer for the stable MCP provider API |
| **Node.js** | Build with Node.js 20 or newer; the extension uses VS Code's runtime to launch its server |
| **Jira** | Jira Cloud, Server, or Data Center instance with active REST API access |
| **Authentication** | Personal Access Token (PAT) for Server/DC, or API Token for Cloud |
| **AI Client** | GitHub Copilot, Claude Desktop, Cursor, Antigravity, or KIRO |

---

## Quick Start

### Install the VS Code Extension

1. Open VS Code or any compatible VS Code fork (Antigravity, KIRO, Cursor).
2. Install the extension from the compiled `.vsix` bundle (**Install from VSIX...**).
3. Restart or reload your editor.

For Remote SSH, WSL, or Dev Containers, install the VSIX in the remote window's
extension host. Version 1.0.5 declares `extensionKind: ["workspace"]` so the server
uses that host's runtime and filesystem paths. Do not install a second copy only
on the desktop and expect it to execute a remote server path.

### Build from Source

```bash
git clone https://github.com/mrsutharsuresh/jira_mcp_server.git
cd jira_mcp_server
npm ci
npm run typecheck
npm test
npm run package
```

Packaging runs type-checking and rebuilds both bundles automatically. The output
is `jira-mcp-1.0.5.vsix`. Tests use dummy credentials and a loopback Jira fixture;
they do not contact your Jira instance.

### Connect to Jira

1. Open your editor's Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
2. Run **JIRA MCP: Configure JIRA Connection**.
3. Input your Jira URL, username, and authentication token (PAT or API Token).
4. Run **JIRA MCP: Test JIRA Connection** to verify the saved credentials against
   the Jira REST API. This is not a test of the MCP subprocess.
5. Run **JIRA MCP: Refresh MCP Registration**, then open a new chat and ask it to
   call the server's `get_current_user` tool. Check that the actual MCP tool call
   succeeds.

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
1. Configure and test the Jira connection in the same local or remote VS Code
   window where the extension is installed.
2. Open a new chat, select the desired harness, and enable the JIRA MCP tools in
   **Chat: Open Customizations > Tools** (Copilot) or **Configure Tools** (Local).
3. Ask: "Use JIRA MCP to call get_current_user. Do not modify any issues."
4. Inspect the actual tool result. A configured status bar or successful REST
   connection test does not prove that the MCP process initialized.

Version 1.0.5 supplies a complete launch definition, including the existing
SecretStorage token, during non-interactive discovery. Copilot/Agent Host
forwarding therefore does not depend on a later
`resolveMcpServerDefinition()` callback. The resolver is retained and reads the
latest saved token for editor-managed Local sessions.

The extension registers through `vscode.lm.registerMcpServerDefinitionProvider`.
An empty VS Code `mcp.json` is normal for this registration method. No new
Copilot configuration file or plaintext token export is needed for this fix.
The existing fork/client synchronization described below is unchanged.

Current VS Code also supports portable Copilot configuration in workspace-root
`.mcp.json` or `$COPILOT_HOME/mcp-config.json` (default
`~/.copilot/mcp-config.json`), with `mcpServers` as the top-level key.
VS Code-format workspace/profile `mcp.json` uses `servers`. These formats are not
interchangeable; portable files do not support VS Code input variables or
`envFile`. Do not migrate credentials into shared JSON just to use this extension.

**Refresh versus restart:** available controls depend on the selected harness.
If only Enable/Disable is offered, do not assume Disable is a restart action.
The new **JIRA MCP: Refresh MCP Registration** command signals that definitions
changed, but does not promise to restart an existing chat's process. Start a new
chat after refreshing; reload the window after replacing the VSIX to ensure the
new extension code is active.

Refresh is also available by clicking the JIRA status-bar item and selecting
**Refresh MCP Registration** in the configured-connection menu.

Credential updates automatically refresh definitions for future server launches.
They do not change the environment or Jira client inside an already-running MCP
process. Future calls in an existing chat can therefore still use the old token;
start a new chat after changing credentials. Refresh alone does not revoke a
token already held by a running process.

The extension manifest's `version` and `releaseDate` are the single source for
the MCP initialization version, `get_server_version` response, and registration
version. Update that metadata for future releases instead of editing constants.

References:
- [VS Code MCP server management](https://code.visualstudio.com/docs/agents/run/manage-mcp-servers)
- [VS Code MCP configuration formats](https://code.visualstudio.com/docs/agents/reference/mcp-configuration)
- [VS Code MCP provider API](https://code.visualstudio.com/api/references/vscode-api#McpServerDefinitionProvider)

### VS Code Forks & AI Agents (Antigravity, Kiro, Cursor, Claude)
The extension includes **Automatic Configuration Synchronization**!
- As soon as you save your connection details via **JIRA MCP: Configure JIRA Connection**, the extension automatically registers the `jira-mcp` server directly in your environment's configuration file:
  - **Antigravity**: Synced automatically to `~/.gemini/config/mcp_config.json` (canonical global root) and `~/.gemini/antigravity/mcp_config.json` with the required `$typeName` protobuf template. You can also configure workspace-level MCP servers in `<project-root>/.agents/mcp_config.json`.
  - **Kiro**: Synced automatically to `~/.kiro/settings/mcp.json` (user settings) and `~/.gemini/kiro/mcp_config.json`. You can also configure workspace-level MCP servers in `<project-root>/.kiro/settings/mcp.json`.
  - **Cursor**: Synced automatically to `~/.cursor/mcp.json` (modern global config) and the legacy Cursor globalStorage path. You can also configure workspace-level MCP servers in `<project-root>/.cursor/mcp.json`.
  - **Claude Desktop**: Synced automatically to `%APPDATA%\Claude\claude_desktop_config.json` (Windows), `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS), or `~/.config/Claude/claude_desktop_config.json` (Linux).
  - **Claude Code (CLI)**: Synced automatically to `~/.claude.json` under `"mcpServers"` if Claude Code is installed.
- Or install the `.vsix` bundle directly in VS Code / Antigravity / Cursor as a standard extension.
- Open your agent's Chat pane (e.g., Antigravity Chat/Agent, Composer, Kiro, or Claude), and the 14 Jira tools will be active and ready to use immediately!

### Manual MCP Server Configuration
If configuring any MCP client manually, add `jira-mcp` to your client's `mcpServers` object:

```json
{
  "mcpServers": {
    "jira-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/jira-mcp-server/dist/server.js"],
      "env": {
        "JIRA_URL": "https://your-jira-instance.com",
        "JIRA_USERNAME": "your-username",
        "JIRA_TOKEN": "your-pat-or-api-token",
        "WORKSPACE_FOLDER": "/absolute/path/to/your-workspace"
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
| `JIRA MCP: Refresh MCP Registration` | Publishes updated launch definitions; use a new chat to verify startup |

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

- **VS Code credentials**: The provider retrieves credentials from VS Code SecretStorage and includes them in the in-memory server launch definition. Never log or share populated definitions.
- **Other clients**: Existing fork/client synchronization writes credentials into those clients' configuration files. Protect those files and do not commit them to source control.
- **Process credentials**: The MCP subprocess receives its token through its environment. A running process can retain the previous token after credentials are updated.
- **Network access**: Requests originate on the host running the extension/server. The extension's connection test honors configured proxy settings; network and proxy requirements must also be satisfied by the subprocess.

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

### Remote installation still shows old commands

- Installing a custom VSIX on Windows and then selecting the gallery extension's
  **Install in SSH** action can install the published gallery version remotely
  instead of copying the custom build.
- In the remote workspace window, use **Extensions: Install from VSIX...** and
  select the rebuilt VSIX directly. Confirm the remote extension version and run
  **Developer: Reload Window**.
- Earlier and revised custom packages both use version 1.0.5. Use the latest
  package, not an older copy with the same filename. The revised build includes
  **JIRA MCP: Refresh MCP Registration** in the Command Palette and in the
  configured JIRA status-bar menu.

---

## Author & License

- **Author**: **Suresh Suthar** — `mr.sutharsuresh@gmail.com`
- **Website**: [SutharLabs](https://sutharlabs.com)
- **License**: Released under the **MIT License**.
