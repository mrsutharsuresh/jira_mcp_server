# Jira MCP Server — Release Notes

## 🆕 What's New in v1.0.4 (Latest)

### ☁️ Jira Cloud (Basic Auth / API Token) Support
- **Dual-Authentication Core**: Expanded support to full **Jira Cloud** in addition to Jira Server/Data Center. The server now dynamically detects the connection URL. If it detects a Cloud instance (`.atlassian.net`), it automatically handles Basic Authentication (`email:API_token`), while self-hosted instances continue using secure Personal Access Tokens (`Bearer ${pat}`).
- **Atlassian Token Creation Tutorials**: Added guides and links to official Atlassian documentations in the README to help users generate both Cloud API Tokens and Server PATs seamlessly.

### 🚀 Auto-Sync to VS Code Forks & Clients
- **Alternative IDE Support**: Implemented automatic configuration synchronization for popular VS Code forks and external clients:
  - **Antigravity**
  - **KIRO**
  - **Cursor**
  - **Claude Desktop**
  Credentials and server executable paths are now automatically added to `mcp_config.json` upon activation or credential saving.

### 🐛 Linux / Remote Environment Startup Fixes
- **Robust Dynamic Execution Path**: Spawns the MCP server using `process.execPath` (the modern Node.js runtime running VS Code Server) when in remote hosts (WSL, SSH, Dev Containers), eliminating remote startup syntax crashes (e.g. `SyntaxError: Unexpected token ...` from old legacy system node installations). On local hosts, it cleanly falls back to standard system `"node"`, allowing local clients like Claude Desktop/Antigravity to run smoothly.

---

## 🎉 Feature Milestones in v1.0.3

### 🐛 Attachment Download Stability
- **Workspace Resolution**: Fixed a critical attachment download bug where `WORKSPACE_FOLDER` was not passed to the server, causing downloads to write to protected system directories. It now automatically and securely targets your active VS Code workspace folder.
- **Improved Log Reporting**: Handled Node.js `ErrnoException` (like directory write failures) at the server level, providing actionable human-readable hints and logging errors directly to the VS Code Output panel.

---

## 🚀 Key Features from v1.0.0

- 🔑 **Secure Credentials**: Credentials stored securely inside your OS-level secure Keychain via VS Code SecretStorage API.
- 📁 **Attachment Handling**: Bi-directional attachment upload and download between Jira issues and local workspaces.
- ⚙️ **Custom Fields**: Full dynamic capability to inspect, read, and edit Jira custom fields.
- 🔍 **Full JQL Support**: Query issues using natural language processed into rich Jira Query Language.
