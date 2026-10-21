# Production-Ready MCP Server Extension Blueprint

This document captures the complete architectural blueprint, design patterns, and code templates introduced since **v1.0.4** of the Jira MCP Server. You can use this guide as a direct template when building or refactoring any Model Context Protocol (MCP) server extension for **VS Code**, **GitHub Copilot Agent Mode**, **Antigravity**, **Kiro**, **Cursor**, **Claude Desktop**, and **Claude Code**.

---

## 1. Summary of Changes Since v1.0.4

| Area | Before (v1.0.4) | After (v1.0.5) | Why It Matters |
| :--- | :--- | :--- | :--- |
| **Copilot / Agent Host Startup** | Definition returned with empty `TOKEN: ""`, expecting `resolveMcpServerDefinition` callback to populate it before launch. | `provideMcpServerDefinitions` reads `SecretStorage` directly and returns a **launch-ready** definition with credentials populated. | VS Code Agent Host forwards the definition without calling the resolver, which previously crashed the subprocess immediately. |
| **Discovery Reliability** | Returned definitions even without credentials configured. | If credentials or required URLs are missing, discovery returns `[]` and logs non-interactively. | Prevents registering unusable/broken servers into AI chat menus. |
| **Dynamic Lifecycle & Revision** | Static registration; configuration updates didn't update active definitions until restart. | Incremental `definitionRevision` appended to server version (`${VERSION}.${revision}`); refreshed via secret, config, and workspace event listeners. | VS Code detects the revision change and invalidates cached tool definitions. |
| **Refresh UX** | No manual refresh; users had to restart the editor. | Added `Refresh MCP Registration` command and status bar action with user guidance. | Signals definition updates for future chats without promising impossible live-process patching. |
| **Remote Host Execution** | Default extension host placement. | Explicit `"extensionKind": ["workspace"]` in `package.json` and explicit `definition.cwd = vscode.Uri.file(...)`. | Ensures Remote SSH, WSL, and Dev Containers run using the remote node binary, filesystem, and workspace root. |
| **Version Alignment** | Hardcoded version strings scattered across server and tools. | `src/version.ts` re-exports `version` and `releaseDate` from `package.json`. | Eliminates version drift between manifest, server handshake, and version inquiry tools. |
| **Multi-Agent Sync** | Limited to legacy Cursor and app-specific Antigravity paths. | Added modern paths: Antigravity (`~/.gemini/config/mcp_config.json`), Kiro (`~/.kiro/settings/mcp.json`), Cursor (`~/.cursor/mcp.json`), Claude Desktop (Linux added), and Claude Code (`~/.claude.json`). | Auto-configures all modern AI agents on save without manual JSON editing. |
| **Quality & CI Guardrails** | No regression tests; build and packaging were decoupled. | 12 automated regression tests (`node:test`) testing actual stdio handshakes, mock loopbacks, and SecretStorage; `"vscode:prepublish"` enforces typecheck + build before packaging. | Guarantees extension and MCP server integrity before releasing. |

---

## 2. Reusable Core Patterns & Templates

### Pattern A: Launch-Ready Definition Provider with Retained Resolver

In modern VS Code (1.102+), different harnesses consume MCP providers differently:
- **Copilot / Agent Host**: Consumes definitions from `provideMcpServerDefinitions` directly.
- **Local Editor Harness**: Calls `provideMcpServerDefinitions` followed by `resolveMcpServerDefinition`.

```typescript
// src/extension.ts
import * as vscode from "vscode";
import { SERVER_VERSION } from "./version";

const SECRET_KEY = "my-mcp.token";
const CONFIG_SECTION = "my-mcp";

let mcpChangeEmitter: vscode.EventEmitter<void>;
let definitionRevision = 0;

export function refreshMcpDefinitions(reason: string): void {
  definitionRevision += 1;
  log(`MCP registration refreshed: ${reason}`);
  mcpChangeEmitter.fire();
}

export function createMcpDefinition(
  context: vscode.ExtensionContext,
  token: string
): vscode.McpStdioServerDefinition | undefined {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const endpoint = config.get<string>("endpointUrl")?.trim();
  if (!endpoint) {
    log("MCP registration unavailable: endpoint URL is not configured.");
    return undefined;
  }

  const serverPath = context.asAbsolutePath("dist/server.js");
  const workspaceFolder =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? context.extensionPath;

  const definition = new vscode.McpStdioServerDefinition(
    "My MCP Server",
    process.execPath,
    [serverPath],
    {
      ELECTRON_RUN_AS_NODE: "1",
      SERVICE_URL: endpoint,
      SERVICE_TOKEN: token.trim(),
      WORKSPACE_FOLDER: workspaceFolder,
    },
    // Append revision so VS Code detects definition updates
    `${SERVER_VERSION}.${definitionRevision}`
  );

  // Set explicit working directory for workspace operations
  definition.cwd = vscode.Uri.file(workspaceFolder);
  return definition;
}

export function registerMcpProvider(context: vscode.ExtensionContext): void {
  mcpChangeEmitter = new vscode.EventEmitter<void>();
  context.subscriptions.push(mcpChangeEmitter);

  // Auto-refresh on configuration, secret, or workspace changes
  context.subscriptions.push(
    context.secrets.onDidChange((e) => {
      if (e.key === SECRET_KEY) {
        refreshMcpDefinitions("saved credentials changed");
      }
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(CONFIG_SECTION)) {
        refreshMcpDefinitions("settings changed");
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      refreshMcpDefinitions("workspace folders changed");
    })
  );

  // Register provider
  context.subscriptions.push(
    vscode.lm.registerMcpServerDefinitionProvider("my-mcp-provider", {
      onDidChangeMcpServerDefinitions: mcpChangeEmitter.event,

      async provideMcpServerDefinitions(cancellationToken) {
        if (cancellationToken.isCancellationRequested) return [];

        // Read token from secure SecretStorage non-interactively
        const token = await context.secrets.get(SECRET_KEY);
        if (!token?.trim()) {
          log("MCP registration unavailable: no saved token configured.");
          return [];
        }

        const definition = createMcpDefinition(context, token);
        return definition ? [definition] : [];
      },

      async resolveMcpServerDefinition(server, cancellationToken) {
        if (cancellationToken.isCancellationRequested) return undefined;

        const token = await context.secrets.get(SECRET_KEY);
        if (!token?.trim()) {
          vscode.window.showWarningMessage(
            "My MCP: No credentials configured. Run 'My MCP: Configure'."
          );
          return undefined;
        }

        if (server instanceof vscode.McpStdioServerDefinition) {
          log("MCP resolveMcpServerDefinition: refreshing launch credentials.");
          return createMcpDefinition(context, token);
        }
        return server;
      },
    })
  );
}
```

---

### Pattern B: Remote Host Placement & Manifest Metadata

To guarantee execution in Remote SSH, WSL, or Dev Containers:

```json
// package.json
{
  "name": "my-mcp",
  "version": "1.0.0",
  "releaseDate": "2026-10-21",
  "engines": {
    "vscode": "^1.102.0"
  },
  "extensionKind": ["workspace"],
  "main": "./dist/extension.js",
  "contributes": {
    "mcpServerDefinitionProviders": [
      {
        "id": "my-mcp-provider",
        "label": "My MCP Server"
      }
    ],
    "commands": [
      {
        "command": "my-mcp.refresh",
        "title": "Refresh MCP Registration",
        "category": "My MCP"
      }
    ]
  },
  "scripts": {
    "vscode:prepublish": "npm run typecheck && npm run build",
    "build": "node esbuild.mjs",
    "typecheck": "tsc --noEmit",
    "test": "npm run build && node --test test/*.test.cjs",
    "package": "vsce package --no-dependencies"
  }
}
```

---

### Pattern C: Single Source of Truth Versioning

Avoid hardcoding version strings in multiple server files:

```typescript
// src/version.ts
export { version as SERVER_VERSION, releaseDate as RELEASE_DATE } from "../package.json";
```

```typescript
// src/server/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SERVER_VERSION } from "../version.js";

const server = new McpServer({
  name: "my-mcp",
  version: SERVER_VERSION,
});
```

---

### Pattern D: Universal Multi-Agent Config Synchronizer

Allows a single configuration wizard in your extension to configure **Antigravity**, **Kiro**, **Cursor**, **Claude Desktop**, and **Claude Code**:

```typescript
// src/extension.ts
async function syncForkConfigs(
  context: vscode.ExtensionContext,
  token: string | undefined
): Promise<void> {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const serviceUrl = config.get<string>("endpointUrl") || "";
  const serverPath = context.asAbsolutePath("dist/server.js");
  const workspaceFolder =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? context.extensionPath;
  const homedir = os.homedir();

  const configFiles: {
    path: string;
    isGemini?: boolean;
    requireExistingFileOrDir?: string;
  }[] = [];

  // 1. Antigravity (Canonical Global Root + App Root)
  configFiles.push({
    path: path.join(homedir, ".gemini", "config", "mcp_config.json"),
    isGemini: true,
  });
  configFiles.push({
    path: path.join(homedir, ".gemini", "antigravity", "mcp_config.json"),
    isGemini: true,
  });

  // 2. Kiro (Modern settings path + Legacy Gemini path)
  configFiles.push({
    path: path.join(homedir, ".kiro", "settings", "mcp.json"),
  });
  configFiles.push({
    path: path.join(homedir, ".gemini", "kiro", "mcp_config.json"),
    isGemini: true,
  });

  // 3. Cursor (Modern global path + Legacy globalStorage)
  configFiles.push({
    path: path.join(homedir, ".cursor", "mcp.json"),
  });
  if (process.platform === "win32") {
    configFiles.push({
      path: path.join(process.env.APPDATA || "", "Cursor", "User", "globalStorage", "tongshuai.cursor-chat", "mcp_config.json"),
    });
  } else if (process.platform === "darwin") {
    configFiles.push({
      path: path.join(homedir, "Library", "Application Support", "Cursor", "User", "globalStorage", "tongshuai.cursor-chat", "mcp_config.json"),
    });
  } else {
    configFiles.push({
      path: path.join(homedir, ".config", "Cursor", "User", "globalStorage", "tongshuai.cursor-chat", "mcp_config.json"),
    });
  }

  // 4. Claude Desktop (Cross-Platform)
  if (process.platform === "win32") {
    configFiles.push({
      path: path.join(process.env.APPDATA || "", "Claude", "claude_desktop_config.json"),
    });
  } else if (process.platform === "darwin") {
    configFiles.push({
      path: path.join(homedir, "Library", "Application Support", "Claude", "claude_desktop_config.json"),
    });
  } else {
    configFiles.push({
      path: path.join(homedir, ".config", "Claude", "claude_desktop_config.json"),
    });
  }

  // 5. Claude Code CLI (Guarded: only writes if Claude exists)
  configFiles.push({
    path: path.join(homedir, ".claude.json"),
    requireExistingFileOrDir: path.join(homedir, ".claude"),
  });

  for (const item of configFiles) {
    const dir = path.dirname(item.path);
    if (!fs.existsSync(dir)) continue;
    if (
      item.requireExistingFileOrDir &&
      !fs.existsSync(item.requireExistingFileOrDir) &&
      !fs.existsSync(item.path)
    ) {
      continue;
    }

    try {
      let data: any = {};
      if (fs.existsSync(item.path)) {
        try {
          data = JSON.parse(fs.readFileSync(item.path, "utf8"));
        } catch {
          data = {};
        }
      }

      if (!data.mcpServers) data.mcpServers = {};

      const mcpKey = "my-mcp";
      if (token && serviceUrl) {
        const command = vscode.env.remoteName ? process.execPath : "node";
        const env: Record<string, string> = {
          SERVICE_URL: serviceUrl,
          WORKSPACE_FOLDER: workspaceFolder,
          SERVICE_TOKEN: token,
        };
        if (command === process.execPath) {
          env["ELECTRON_RUN_AS_NODE"] = "1";
        }

        data.mcpServers[mcpKey] = {
          command: command,
          args: [serverPath],
          env: env,
        };

        // Antigravity protobuf discriminator
        if (item.isGemini) {
          data.mcpServers[mcpKey]["$typeName"] =
            "exa.cascade_plugins_pb.CascadePluginCommandTemplate";
        }
      } else {
        if (data.mcpServers[mcpKey]) {
          delete data.mcpServers[mcpKey];
        }
      }

      fs.writeFileSync(item.path, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
      logError(`Failed to sync config at ${item.path}`, err);
    }
  }
}
```

---

### Pattern E: Integration Testing Template (`test/mcp.test.cjs`)

Use Node.js's native test runner (`node:test`) to test the real MCP server via standard stdio:

```javascript
// test/mcp.test.cjs
const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");

const root = path.resolve(__dirname, "..");
const packageMetadata = require("../package.json");

test("MCP server initializes and discovers tools over stdio", { timeout: 15000 }, async (t) => {
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(root, "dist/server.js")],
    env: {
      ELECTRON_RUN_AS_NODE: "1",
      SERVICE_URL: "https://example.com",
      SERVICE_TOKEN: "dummy-test-token",
      WORKSPACE_FOLDER: root,
    },
    stderr: "pipe",
  });

  t.after(() => client.close());
  await client.connect(transport);

  // 1. Verify handshake version aligns with package.json
  assert.equal(client.getServerVersion().version, packageMetadata.version);

  // 2. Verify all registered tools are listed
  const { tools } = await client.listTools();
  assert.ok(tools.length > 0);

  // 3. Verify server version tool
  const versionTool = await client.callTool({
    name: "get_server_version",
    arguments: {},
  });
  const data = JSON.parse(versionTool.content[0].text);
  assert.equal(data.version, packageMetadata.version);
});
```

---

## 3. Checklist for New MCP Server Extensions

When creating a new MCP server extension, verify the following:

- [ ] **Engine Requirement**: `"vscode": "^1.102.0"` in `package.json`.
- [ ] **Remote Placement**: `"extensionKind": ["workspace"]` in `package.json`.
- [ ] **Launch-Ready Credentials**: `provideMcpServerDefinitions` injects token from `SecretStorage`.
- [ ] **Non-Interactive Discovery**: Returns `[]` if token or required URL is missing; does not prompt.
- [ ] **Retained Resolver**: `resolveMcpServerDefinition` re-reads SecretStorage for Local harness sessions.
- [ ] **Revision Bumping**: Appends `${VERSION}.${definitionRevision}` to definition version and refreshes on settings/secrets changes.
- [ ] **Working Directory**: Explicitly sets `definition.cwd = vscode.Uri.file(workspaceFolder)`.
- [ ] **Unified Versioning**: `package.json` drives handshake and version tool responses via `src/version.ts`.
- [ ] **Multi-Agent Sync**: `syncForkConfigs` covers Antigravity, Kiro, Cursor, Claude Desktop, and Claude Code.
- [ ] **Build Guard**: `"vscode:prepublish": "npm run typecheck && npm run build"`.
- [ ] **Automated Testing**: Real stdio MCP test suite via `npm test`.
