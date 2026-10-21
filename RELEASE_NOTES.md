# Jira MCP Server — Release Notes

## What's New in v1.0.5 (Latest)

- Fix the observed Agent Host startup failure: forwarded server definitions now
  contain the saved token before launch, without relying on the resolver callback.
- Use package metadata for initialization and version-tool responses. Refresh is
  also available in the JIRA status-bar menu. Credential updates refresh future
  launch definitions; existing MCP processes may retain their old credentials.
- Preserve VS Code SecretStorage and the editor-managed Local resolver. This fix
  adds no credential files or automatic portable-configuration migration.
- Refresh registrations when credentials, Jira settings, or workspace folders
  change. Add **JIRA MCP: Refresh MCP Registration** for manual refresh.
- Run in the workspace extension host for Remote SSH, WSL, and containers.
- Distinguish "Configured" and "API verified" from a working MCP session.
- Validate with 12 tests, including actual MCP initialization, 14-tool discovery,
  and a read-only Jira call against a local fixture.
- Require VS Code 1.102 or newer; packaging rebuilds and type-checks automatically.

### Manual upgrade

1. Uninstall version 1.0.4 from the remote extension host. Do not run
   **Clear Saved Credentials** unless you intend to erase the saved token.
2. Install `jira-mcp-1.0.5.vsix` using **Extensions: Install from VSIX...** in the
   remote workspace window. Verify that the installed version is 1.0.5.
   Do not substitute the gallery extension's **Install in SSH** action: it can
   select the published version instead of your custom Windows VSIX. Use the
   latest rebuilt 1.0.5 package because earlier custom builds share this version.
3. Run **Developer: Reload Window**. The publisher, extension ID, settings, and
   SecretStorage key are unchanged; if credentials are not retained by the
   uninstall/install flow, configure them again.
4. Run **JIRA MCP: Test JIRA Connection**, followed by
   **JIRA MCP: Refresh MCP Registration**.
5. Start a new chat and explicitly request the JIRA MCP `get_current_user` tool.
   Confirm an actual successful tool result, not just an answer or status message.

The regression tests do not exercise the installed VS Code Agent Host UI. This
manual post-installation test is still required to confirm end-to-end forwarding
in your VS Code build.

For missing commands after remote installation,
see [README troubleshooting](./README.md#troubleshooting).

Project website: [SutharLabs](https://sutharlabs.com).

## 🆕 What's New in v1.0.4

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
