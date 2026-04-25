# JIRA MCP Server

Connect GitHub Copilot and AI assistants to your JIRA instance via the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/).

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1 — Generate a JIRA Personal Access Token](#step-1--generate-a-jira-personal-access-token)
3. [Step 2 — Install the Extension](#step-2--install-the-extension)
4. [Step 3 — Configure JIRA Connection](#step-3--configure-jira-connection)
5. [Step 4 — Verify the Connection](#step-4--verify-the-connection)
6. [Step 5 — Use with GitHub Copilot Chat](#step-5--use-with-github-copilot-chat)
7. [Available Tools](#available-tools)
8. [Commands Reference](#commands-reference)
9. [Security](#security)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Requirement | Details |
|-------------|---------|
| **VS Code** | Version 1.99.0 or later |
| **GitHub Copilot** | Copilot Chat extension installed and signed in |
| **JIRA Server** | Self-hosted JIRA (Server/Data Center) with REST API v2 access |
| **Node.js** | Not required — Node.js runtime is bundled inside the extension |

---

## Step 1 — Generate a JIRA Personal Access Token

A Personal Access Token (PAT) lets the extension authenticate with your JIRA instance without storing your password.

1. Open your JIRA instance in a browser and log in.
2. Click your **profile avatar** (top-right corner) → **Profile**.
3. In the left sidebar click **Personal Access Tokens**.
4. Click **Create token**.
5. Fill in:
   - **Token name** — e.g. `VS Code Copilot`
   - **Expiry** — choose an appropriate duration
6. Click **Create** and **copy the token immediately** — it is shown only once.

> **Tip:** If your JIRA admin has disabled PATs, ask them to enable it under  
> *Administration → Security → Personal Access Tokens*.

---

## Step 2 — Install the Extension

### Option A — Install from VSIX file (recommended for private/internal use)

1. Obtain the `jira-mcp-1.0.0.vsix` file (built from this repository or shared by your team).
2. Open VS Code.
3. Open the **Extensions** panel (`Ctrl+Shift+X` / `Cmd+Shift+X`).
4. Click the **`···`** (three-dot) menu at the top-right of the Extensions panel.
5. Select **Install from VSIX…**
6. Browse to and select `jira-mcp-1.0.0.vsix`.
7. Click **Install** — VS Code will prompt to reload; click **Reload Now**.

### Option B — Install from command line

```bash
code --install-extension jira-mcp-1.0.0.vsix
```

After installation, reload VS Code.

### Option C — Build from source

```bash
git clone <repo-url>
cd vscode-jira-mcp
npm install
node esbuild.mjs
npx vsce package --no-dependencies
code --install-extension jira-mcp-1.0.0.vsix
```

---

## Step 3 — Configure JIRA Connection

1. Open the **Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`).
2. Type **JIRA MCP** and select **JIRA MCP: Configure JIRA Connection**.
3. A three-step input wizard opens — fill in each field and press **Enter**:

   | Step | Field | Example |
   |------|-------|---------|
   | 1 | **JIRA Server URL** | `https://jira.yourcompany.com` |
   | 2 | **Username / Email** | `user@yourcompany.com` |
   | 3 | **Personal Access Token** | *(paste the token from Step 1)* |

4. The extension validates the credentials against your JIRA server.  
   - ✅ **"JIRA connection configured successfully!"** — you are ready.  
   - ❌ If it fails, see [Troubleshooting](#troubleshooting).

> **Where are credentials stored?**  
> Your PAT is saved in VS Code's **SecretStorage**, which uses the OS keychain  
> (Windows Credential Manager / macOS Keychain / Linux libsecret).  
> The JIRA URL and username are stored in VS Code settings (non-sensitive).  
> Nothing is written to disk in plain text.

---

## Step 4 — Verify the Connection

1. Open the Command Palette (`Ctrl+Shift+P`).
2. Run **JIRA MCP: Test JIRA Connection**.
3. A notification confirms your credentials are valid and shows your JIRA user info.

You can also check the **status bar** at the bottom of VS Code — a `$(database) JIRA MCP` item appears when the extension is active.

---

## Step 5 — Use with GitHub Copilot Chat

Once configured, the JIRA MCP server is **automatically registered** and available to GitHub Copilot Chat.

1. Open Copilot Chat (`Ctrl+Alt+I` / `Cmd+Alt+I`, or click the chat icon in the sidebar).
2. Make sure you are in **Agent mode** (select `Agent` from the mode dropdown in the chat input).
3. Start asking questions about your JIRA instance:

### Example prompts

```
Show me all open bugs assigned to me in the CUBE project

Get the details of CUBE-9119 including all comments

Create a task in CUBE: "Update API documentation for v3.0"

Add a comment to CUBE-123: "Fix deployed to staging, ready for testing"

Move CUBE-456 to In Progress

List all JIRA projects I have access to

Search for issues with label "performance" created this week

Download the attachment on CUBE-8556 to my workspace

What custom fields are available on CUBE project issues?
```

> **Note:** Copilot will ask for your confirmation before performing write  
> operations (create, comment, status change, upload).

---

## Available Tools

The extension registers **14 MCP tools** that Copilot can call:

| Tool | Description |
|------|-------------|
| `search_issues` | Search JIRA using JQL queries |
| `get_issue` | Full issue details — description, all comments, attachments, subtasks, linked issues, custom fields |
| `create_issue` | Create a new issue in any project |
| `add_comment` | Add a comment to an issue |
| `update_issue_status` | Transition an issue to a new status |
| `list_projects` | List all accessible JIRA projects |
| `get_current_user` | Show your JIRA profile info |
| `get_server_version` | Show JIRA server version |
| `list_attachments` | List attachments on an issue |
| `download_attachment` | Download an attachment and save it to `<workspace>/jira-attachments/` |
| `upload_attachment` | Upload a file to an issue |
| `get_custom_fields` | List all custom field definitions |
| `get_custom_field_value` | Read the value of a custom field on an issue |
| `update_custom_field` | Update a custom field value on an issue |

---

## Commands Reference

| Command (Command Palette) | Description |
|---------------------------|-------------|
| `JIRA MCP: Configure JIRA Connection` | Enter/update JIRA URL, username, and PAT |
| `JIRA MCP: Test JIRA Connection` | Verify stored credentials are working |
| `JIRA MCP: Clear Saved Credentials` | Remove all stored credentials and settings |

---

## Security

- **PAT** stored in VS Code SecretStorage → OS keychain (never on disk in plain text)
- **JIRA URL + username** stored in VS Code `settings.json` (non-sensitive)
- All communication is over **HTTPS** directly to your JIRA server
- No credentials or issue data are sent to any third-party service
- No telemetry or analytics

---

## Troubleshooting

### "Connection failed" during Configure

- Check the JIRA URL — it should not have a trailing slash and should include the scheme: `https://jira.example.com`
- Confirm your PAT has not expired (JIRA → Profile → Personal Access Tokens)
- Ensure your JIRA instance is reachable from your machine: open `https://jira.example.com/rest/api/2/myself` in a browser

### Copilot does not see JIRA tools

- Make sure you are in **Agent mode** in Copilot Chat (not Ask or Edit mode)
- Run **JIRA MCP: Test JIRA Connection** to confirm the extension is active
- Reload VS Code (`Ctrl+Shift+P` → **Developer: Reload Window**)
- Check the **Output** panel (`Ctrl+Shift+U`) and select **JIRA MCP** from the dropdown for error logs

### Downloads not appearing

- Attachments are saved to `<your-workspace-folder>/jira-attachments/`
- Make sure a workspace folder is open in VS Code (not just a standalone file)
- Use the Explorer panel to browse to the `jira-attachments/` folder

### Clearing and reconfiguring credentials

Run **JIRA MCP: Clear Saved Credentials** from the Command Palette, then run **Configure JIRA Connection** again.
