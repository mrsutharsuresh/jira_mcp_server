# Changelog

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
