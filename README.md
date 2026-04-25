# Jira MCP for Copilot

Built by **Suresh Suthar** — `mr.sutharsuresh@gmail.com`

Seamlessly connect Jira Server and Data Center with GitHub Copilot using the Model Context Protocol (MCP).

---

## Table of Contents

1. [What it does](#what-it-does)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Configure JIRA](#configure-jira)
5. [Use with Copilot](#use-with-copilot)
6. [Features](#features)
7. [Commands](#commands)
8. [Copilot Tools](#copilot-tools)
9. [Usage Examples](#usage-examples)
10. [Security](#security)
11. [Troubleshooting](#troubleshooting)
12. [Author](#author)
13. [License](#license)

---

## What it does

Jira MCP for Copilot exposes Jira issue tracking and project operations to GitHub Copilot via a dedicated MCP server.

Use natural language from Copilot to search issues, create tickets, add comments, change status, manage attachments, and read custom field data.

---

## Prerequisites

| Requirement | Details |
|-------------|---------|
| **VS Code** | Version 1.99.0 or later |
| **GitHub Copilot** | Copilot Chat extension installed and signed in |
| **Jira** | Jira Server or Data Center with REST API access |
| **Authentication** | Jira Personal Access Token (PAT) |

---

## Quick Start

### Install the extension

1. Open VS Code.
2. Install the extension from a `.vsix` file.
3. Reload VS Code.

### Build from source

```bash
git clone <repo-url>
cd jira_mcp_server
npm install
node esbuild.mjs
npm run package
code --install-extension jira-mcp-1.0.0.vsix
```

### Connect to Jira

1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
2. Run **JIRA MCP: Configure JIRA Connection**.
3. Enter your Jira URL, username/email, and PAT.
4. Run **JIRA MCP: Test JIRA Connection** to verify.

---

## Configure JIRA

The extension stores your PAT securely in VS Code SecretStorage. Jira URL and username are stored in settings.

1. Open Command Palette.
2. Select **JIRA MCP: Configure JIRA Connection**.
3. Enter the requested values:
   - Jira Server URL
   - Username or email
   - Personal Access Token

If the connection succeeds, the MCP server starts and Copilot can use the Jira tools.

---

## Use with Copilot

1. Open GitHub Copilot Chat.
2. Select **Agent mode**.
3. Ask Copilot about your Jira instance.

Example prompts:

- "Show me open bugs assigned to me in project MYPROJ"
- "Get the details of PROJ-123 including all comments"
- "Create a task in MYPROJ: \"Update API documentation\""
- "Add a comment to PROJ-456: \"Ready for QA\""
- "Move PROJ-789 to In Progress"

---

## Features

- 🔐 Secure PAT-based Jira authentication
- 🧠 Natural language access through GitHub Copilot
- 📝 Create issues, add comments, and update status
- 📁 Browse Jira projects and issue attachments
- 📥 Download attachments to `<workspace>/jira-attachments/`
- 📤 Upload local files as Jira attachments
- 🧩 Read and update Jira custom field values
- ⚡ Built for MCP-enabled Copilot workflows

---

## Commands

| Command | Description |
|-------------------------------|---------------------------------------------|
| `JIRA MCP: Configure JIRA Connection` | Enter or update Jira URL, username, and PAT |
| `JIRA MCP: Test JIRA Connection` | Verify stored Jira credentials |
| `JIRA MCP: Clear Saved Credentials` | Remove saved credentials and settings |

---

## Copilot Tools

The extension exposes these MCP tools:

| Tool | Description |
|----------------------------------|--------------------------------------------------------------------------|
| `search_issues` | Search Jira issues using JQL |
| `get_issue` | Get detailed issue information, comments, attachments, subtasks and custom fields |
| `create_issue` | Create a new Jira issue |
| `add_comment` | Add a comment to an issue |
| `update_issue_status` | Transition an issue through available workflow statuses |
| `list_projects` | List accessible Jira projects |
| `get_current_user` | Get current authenticated user info |
| `get_server_version` | Get the Jira MCP server version and active features |
| `list_attachments` | List attachments on an issue |
| `download_attachment` | Download an issue attachment to the workspace |
| `upload_attachment` | Upload a local file as an issue attachment |
| `get_custom_fields` | List Jira custom fields |
| `get_custom_field_value` | Read a custom field value from an issue |
| `update_custom_field` | Update a Jira custom field value |

---

## Usage Examples

### Search for issues

- "Find all bugs assigned to me in project MYPROJ"
- "Show me high priority issues updated this week"
- "What tickets are in the current sprint?"

### Manage issues

- "Create a task for implementing user authentication"
- "Move PROJ-123 to In Progress"
- "Add a comment to PROJ-456"

### Get information

- "What is the description of PROJ-123?"
- "Who is working on the authentication feature?"
- "What projects do I have access to?"

---

## Security

- **Secure Token Storage**: PAT is stored in VS Code SecretStorage using the OS keychain.
- **No Token Exposure**: Tokens are never logged or sent to third parties.
- **HTTPS Only**: Jira requests are sent over HTTPS.
- **No Telemetry**: This extension does not collect analytics.

---

## Troubleshooting

### Connection failed

- Confirm the Jira URL is correct and includes `https://`
- Verify your PAT has not expired
- Ensure Jira is reachable from your machine
- Try opening `https://<your-jira>/rest/api/2/myself`

### Copilot does not see Jira tools

- Use **Agent mode** in GitHub Copilot Chat
- Run **JIRA MCP: Test JIRA Connection**
- Reload VS Code (`Developer: Reload Window`)
- Check logs in the **JIRA MCP** output channel

### Downloads not appearing

- Attachments are saved to `<workspace>/jira-attachments/`
- Make sure a workspace folder is open in VS Code

---

## Author

Built by **Suresh Suthar** — `mr.sutharsuresh@gmail.com`

---

## License

MIT License — see `LICENSE` for details.
