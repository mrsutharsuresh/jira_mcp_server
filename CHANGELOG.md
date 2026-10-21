# Changelog

## [1.0.5] - 2026-10-21

### Fixed
- Derive initialization, version-tool, and registration versions from package
  metadata; derive the version tool's release date from the same manifest.
- Expose Refresh MCP Registration from the JIRA status-bar configuration menu.
- Explain after credential updates that existing MCP processes can retain old
  credentials and a new chat is needed.
- Return launch-ready MCP definitions containing the existing SecretStorage token,
  so Copilot/Agent Host forwarding does not launch with an empty `JIRA_TOKEN`.
  Discovery remains non-interactive; missing credentials are logged and no unusable
  server definition is returned.
- Retain the Local-harness resolver and re-read credentials before editor-managed
  startup, including after token rotation or removal.
- Refresh definitions after credential, Jira setting, or workspace-folder changes.
  Include an explicit working directory and a revision for tool-definition refresh.

### Added
- `JIRA MCP: Refresh MCP Registration` for workflows without restart controls.
  This signals a definition change, not a guaranteed restart of an existing session.
- Workspace extension-host placement for remote installations.
- Twelve regression tests, including an actual stdio MCP initialization, discovery
  of all 14 tools, and an authenticated read-only call against a loopback fixture.

### Changed
- Require VS Code 1.102 or newer and compile against its stable MCP API types.
- Distinguish saved configuration and successful Jira API tests from MCP startup
  in the status bar, notifications, and setup documentation.
- Rebuild and type-check automatically when packaging; align the MCP server's
  reported version with extension version 1.0.5.
- Keep the extension identity, SecretStorage key, Jira authentication logic, tool
  behavior, and existing fork/client configuration synchronization unchanged.

## [1.0.4] — 2026-05-19

### Added
- **Jira Cloud (API Token) Support**: Implemented automatic dual-authentication mode. The client now dynamically detects your hosting target: Jira Cloud instances (URLs containing `.atlassian.net`) automatically utilize Basic Auth with `email:API_token`, while Jira Server and Data Center continue to leverage secure Personal Access Tokens (`Bearer ${token}`).
- **Automatic Sync to VS Code Forks & Clients**: Implemented automatic registration and settings synchronization for popular AI-focused VS Code forks and external clients. The extension automatically writes, updates, or deletes the `jira-mcp` server registration in local settings configurations (`mcp_config.json` or `claude_desktop_config.json`) for:
  - **Antigravity**
  - **KIRO**
  - **Cursor**
  - **Claude Desktop**

### Improved
- **Robust Dynamic Execution Path**: Updated the spawned MCP server configuration command. It now dynamically checks the environment: on remote hosts (WSL, SSH, Dev Containers), it resolves to **`process.execPath`** to execute on the identical modern Node.js engine running the VS Code Server (eliminating potential startup syntax crashes due to outdated system-wide Node versions); on local environments, it falls back to standard system **`node`** (allowing local clients like Claude Desktop or Antigravity to spawn the server smoothly without relying on the VS Code Electron binary).

## [1.0.3] — 2026-05-05

### Fixed
- **Attachment download failures on Linux/macOS/Windows**: `WORKSPACE_FOLDER` env was never injected into the MCP server subprocess, causing downloads to fall back to `process.cwd()` — often a system directory without write permission (`UNKNOWN: unknown error, write`). The extension now reads `vscode.workspace.workspaceFolders[0]` and passes it explicitly to the server.

### Improved
- **Attachment error logging**: `mkdirSync` and `writeFileSync` are now individually wrapped in try/catch blocks that capture `code`, `syscall`, and `path` from Node.js `ErrnoException` and return them in the tool response alongside a `hint` explaining how to fix it.
- **Server-level error serialization**: The MCP tool dispatch error handler now surfaces Node.js filesystem error fields (`code`, `syscall`, `path`) in the response payload instead of the generic message only. Same improvement applied to the fatal error handler.
- **Diagnostic logging**: The extension logs the resolved `workspaceFolder` path at server startup, and the attachment handler logs the target directory and final file path on `stderr` so failures are immediately visible in VS Code's Output panel.

## [1.0.0] — 2026-04-24

### Added
- Initial release
- 14 JIRA MCP tools: search, get, create, comment, status, projects, user, custom fields, attachments
- Secure PAT storage via VS Code SecretStorage (OS keychain)
- Interactive configuration command with live connection validation
- Status bar indicator showing connection state
- Test connection command
- Clear credentials command
