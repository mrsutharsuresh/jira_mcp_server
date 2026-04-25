import * as vscode from "vscode";
import axios, { type AxiosRequestConfig } from "axios";

const SECRET_KEY = "jira-mcp.pat";

// ─── Output Channel (View → Output → "JIRA MCP") ─────────────────────────────
let out: vscode.OutputChannel;

function log(msg: string): void {
  const ts = new Date().toISOString();
  out?.appendLine(`[${ts}] ${msg}`);
}

function logError(label: string, err: unknown): void {
  log(`ERROR: ${label}`);
  if (axios.isAxiosError(err)) {
    log(`  axios code    : ${err.code ?? "(none)"}`);
    log(`  message       : ${err.message}`);
    log(`  status        : ${err.response?.status ?? "no response"}`);
    log(`  url           : ${err.config?.url ?? "?"}`);
    log(`  proxy cfg     : ${JSON.stringify((err.config as AxiosRequestConfig & { proxy?: unknown })?.proxy ?? null)}`);
    if (err.response?.data) {
      log(`  response body : ${JSON.stringify(err.response.data).slice(0, 500)}`);
    }
  } else if (err instanceof Error) {
    log(`  ${err.stack ?? err.message}`);
  } else {
    log(`  ${String(err)}`);
  }
}

/**
 * When the JIRA instance is mounted at a context path (e.g. /jira),
 * calling the root URL causes a redirect loop to SSO and back.
 * This detects that and offers the user a corrected URL to try.
 */
async function handleTooManyRedirects(
  context: vscode.ExtensionContext,
  baseUrl: string
): Promise<void> {
  const suggestions = ["/jira", "/jira-server", "/atlassian"];
  const existingSuffix = suggestions.find((s) => baseUrl.endsWith(s));
  if (existingSuffix) {
    // Already has a context path — something else is wrong
    showError(
      `JIRA MCP: Too many redirects. The server at ${baseUrl} keeps redirecting (possible SSO loop). Check that your PAT is valid and try again.`
    );
    return;
  }

  // Offer to try appending /jira
  const suggested = baseUrl.replace(/\/$/, "") + "/jira";
  const action = await vscode.window.showErrorMessage(
    `JIRA MCP: Too many redirects — the URL "${baseUrl}" may be missing a context path (e.g. /jira).`,
    `Try ${suggested}`,
    "Show Logs",
    "Edit URL"
  );

  if (action === `Try ${suggested}`) {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    await config.update("jiraUrl", suggested, vscode.ConfigurationTarget.Global);
    log(`Auto-corrected URL to: ${suggested}`);
    vscode.window.showInformationMessage(
      `JIRA MCP: URL updated to ${suggested}. Run Configure or Test Connection to verify.`
    );
  } else if (action === "Show Logs") {
    out?.show(true);
  } else if (action === "Edit URL") {
    await promptForUrl(context);
  }
}

/** Show an error notification with a "Show Logs" button. */
async function showError(msg: string): Promise<void> {
  const action = await vscode.window.showErrorMessage(msg, "Show Logs");
  if (action === "Show Logs") out?.show(true);
}

/**
 * Build an axios config that respects VS Code's proxy settings.
 * VS Code extensions run in an isolated Node.js process that does not inherit
 * system proxy settings automatically — this reads the VS Code http.proxy
 * setting and environment variables and passes them to axios explicitly.
 */
function buildAxiosConfig(pat: string, extraOptions: Partial<AxiosRequestConfig> = {}): AxiosRequestConfig {
  const httpSettings = vscode.workspace.getConfiguration("http");
  const vscodeProxy = httpSettings.get<string>("proxy") || "";
  const envProxy =
    process.env["HTTPS_PROXY"] ||
    process.env["https_proxy"] ||
    process.env["HTTP_PROXY"] ||
    process.env["http_proxy"] ||
    "";
  const proxyUrl = vscodeProxy || envProxy;

  log(`buildAxiosConfig: vscode http.proxy="${vscodeProxy}" env proxy="${envProxy}" → using="${proxyUrl || "(none, direct)"}"`);

  const cfg: AxiosRequestConfig = {
    headers: { Authorization: `Bearer ${pat.slice(0, 6)}…` }, // log safe
    timeout: 30000,
    maxRedirects: 5,
    ...extraOptions,
  };
  // Re-add real token (log-safe copy used above only for logging)
  (cfg.headers as Record<string, string>)["Authorization"] = `Bearer ${pat}`;

  if (proxyUrl) {
    try {
      const u = new URL(proxyUrl);
      cfg.proxy = {
        host: u.hostname,
        port: parseInt(u.port || (u.protocol === "https:" ? "443" : "8080")),
        protocol: u.protocol.replace(":", ""),
        ...(u.username ? { auth: { username: decodeURIComponent(u.username), password: decodeURIComponent(u.password) } } : {}),
      };
      log(`  proxy resolved : ${u.hostname}:${cfg.proxy.port}`);
    } catch {
      log(`  WARNING: malformed proxy URL "${proxyUrl}" — connecting directly`);
    }
  }

  return cfg;
}
const CONFIG_SECTION = "jira-mcp";

let statusBarItem: vscode.StatusBarItem;
let mcpChangeEmitter: vscode.EventEmitter<void>;

export function activate(context: vscode.ExtensionContext): void {
  // Output channel — always created first so all subsequent code can log
  out = vscode.window.createOutputChannel("JIRA MCP");
  context.subscriptions.push(out);
  log("Extension activated");
  log(`VS Code version : ${vscode.version}`);
  log(`Platform        : ${process.platform} / Node ${process.version}`);

  // Status bar
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = "jira-mcp.configure";
  context.subscriptions.push(statusBarItem);

  // Register all commands
  context.subscriptions.push(
    vscode.commands.registerCommand("jira-mcp.configure", () =>
      runConfigure(context)
    ),
    vscode.commands.registerCommand("jira-mcp.clearCredentials", () =>
      runClearCredentials(context)
    ),
    vscode.commands.registerCommand("jira-mcp.testConnection", () =>
      runTestConnection(context)
    ),
    vscode.commands.registerCommand("jira-mcp.getToken", () =>
      getToken(context)
    )
  );

  // ── MCP server definition provider ────────────────────────────────────────
  mcpChangeEmitter = new vscode.EventEmitter<void>();
  context.subscriptions.push(mcpChangeEmitter);

  context.subscriptions.push(
    vscode.lm.registerMcpServerDefinitionProvider("jira-mcp-provider", {
      onDidChangeMcpServerDefinitions: mcpChangeEmitter.event,

      async provideMcpServerDefinitions(_token) {
        const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
        const jiraUrl = config.get<string>("jiraUrl") || "";
        if (!jiraUrl) return [];

        const username = config.get<string>("username") || "";
        const serverPath = context.asAbsolutePath("dist/server.js");
        log(`MCP provideMcpServerDefinitions: jiraUrl=${jiraUrl}, serverPath=${serverPath}`);

        return [
          new vscode.McpStdioServerDefinition(
            "JIRA MCP",
            "node",
            [serverPath],
            {
              JIRA_URL: jiraUrl,
              JIRA_USERNAME: username,
              // PAT injected in resolveMcpServerDefinition
              JIRA_TOKEN: "",
            }
          ),
        ];
      },

      async resolveMcpServerDefinition(server, _token) {
        const pat = await context.secrets.get(SECRET_KEY);
        if (!pat) {
          vscode.window
            .showWarningMessage(
              "JIRA MCP: No PAT configured. Run 'JIRA MCP: Configure JIRA Connection'.",
              "Configure Now"
            )
            .then((action) => {
              if (action === "Configure Now") runConfigure(context);
            });
          return undefined; // Abort server start
        }

        if (server instanceof vscode.McpStdioServerDefinition) {
          const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
          const jiraUrl = config.get<string>("jiraUrl") || "";
          const username = config.get<string>("username") || "";
          log(`MCP resolveMcpServerDefinition: injecting PAT for ${jiraUrl}`);
          return new vscode.McpStdioServerDefinition(
            server.label,
            server.command,
            server.args ?? [],
            {
              JIRA_URL: jiraUrl,
              JIRA_USERNAME: username,
              JIRA_TOKEN: pat,
            }
          );
        }
        return server;
      },
    })
  );

  // Set initial status bar state
  updateStatusBar(context);
}

export function deactivate(): void {
  log("Extension deactivated");
  statusBarItem?.dispose();
  out?.dispose();
}

// ─── Commands ────────────────────────────────────────────────────────────────

async function runConfigure(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);

  // Load whatever is already saved
  const savedUrl = config.get<string>("jiraUrl") || "";
  const savedUsername = config.get<string>("username") || "";
  const savedPat = await context.secrets.get(SECRET_KEY);

  // If everything is already configured, offer targeted actions instead of
  // restarting the full wizard from scratch.
  if (savedUrl && savedUsername && savedPat) {
    const choice = await vscode.window.showQuickPick(
      [
        {
          label: "$(check) Test Connection",
          description: "Verify current credentials are working",
        },
        {
          label: "$(key) Update PAT",
          description: "Replace your Personal Access Token",
        },
        {
          label: "$(person) Update Username",
          description: savedUsername,
        },
        {
          label: "$(link) Update Server URL",
          description: savedUrl,
        },
        {
          label: "$(pencil) Reconfigure All",
          description: "Re-enter all three settings",
        },
      ],
      {
        title: "JIRA MCP: Already Configured",
        placeHolder: "What would you like to do?",
        ignoreFocusOut: true,
      }
    );
    if (!choice) return;

    if (choice.label.includes("Test Connection")) {
      await runTestConnection(context);
      return;
    }
    if (choice.label.includes("Update PAT")) {
      await promptForPat(context, savedUrl, savedUsername);
      return;
    }
    if (choice.label.includes("Update Username")) {
      await promptForUsername(context, savedUrl);
      return;
    }
    if (choice.label.includes("Update Server URL")) {
      await promptForUrl(context);
      return;
    }
    // "Reconfigure All" — fall through to full wizard below
  }

  // ── Full wizard: only prompt for fields that are not yet saved ──────────

  // Step 1: URL
  let jiraUrl = savedUrl;
  if (!jiraUrl) {
    const input = await promptForUrl(context);
    if (!input) return;
    jiraUrl = input;
  }

  // Step 2: Username
  let username = savedUsername;
  if (!username) {
    const input = await promptForUsername(context, jiraUrl);
    if (!input) return;
    username = input;
  }

  // Step 3: PAT
  if (!savedPat) {
    await promptForPat(context, jiraUrl, username);
  }
}

/** Prompts for JIRA URL, saves it, returns the entered value (or undefined if cancelled). */
async function promptForUrl(
  context: vscode.ExtensionContext
): Promise<string | undefined> {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const current = config.get<string>("jiraUrl") || "";
  const value = await vscode.window.showInputBox({
    title: "JIRA MCP — Server URL",
    prompt: "Enter your JIRA server URL",
    value: current,
    placeHolder: "https://jira.example.com",
    ignoreFocusOut: true,
    validateInput: (v) => {
      if (!v.trim()) return "URL is required";
      try {
        new URL(v.trim());
        return undefined;
      } catch {
        return "Enter a valid URL (e.g. https://jira.example.com)";
      }
    },
  });
  if (!value) return undefined;
  await config.update(
    "jiraUrl",
    value.replace(/\/$/, ""),
    vscode.ConfigurationTarget.Global
  );
  mcpChangeEmitter?.fire(); // URL changed — refresh MCP server list
  return value.replace(/\/$/, "");
}

/** Prompts for username, saves it, returns the entered value (or undefined if cancelled). */
async function promptForUsername(
  context: vscode.ExtensionContext,
  jiraUrl: string
): Promise<string | undefined> {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const current = config.get<string>("username") || "";
  const value = await vscode.window.showInputBox({
    title: "JIRA MCP — Username",
    prompt: "Enter your JIRA username or email",
    value: current,
    placeHolder: "user@company.com",
    ignoreFocusOut: true,
    validateInput: (v) => (!v.trim() ? "Username is required" : undefined),
  });
  if (!value) return undefined;
  await config.update(
    "username",
    value.trim(),
    vscode.ConfigurationTarget.Global
  );
  return value.trim();
}

/** Prompts for PAT, validates the connection, saves on success. */
async function promptForPat(
  context: vscode.ExtensionContext,
  jiraUrl: string,
  username: string
): Promise<void> {
  const existingPat = await context.secrets.get(SECRET_KEY);
  const pat = await vscode.window.showInputBox({
    title: "JIRA MCP — Personal Access Token",
    prompt: "Enter your JIRA Personal Access Token",
    password: true,
    value: existingPat || "",
    placeHolder: "Paste your PAT here",
    ignoreFocusOut: true,
    validateInput: (v) =>
      !v.trim() ? "Personal Access Token is required" : undefined,
  });
  if (!pat) return;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "JIRA MCP: Testing connection...",
      cancellable: false,
    },
    async () => {
      try {
        const base = jiraUrl.replace(/\/$/, "");
        const url = `${base}/rest/api/2/myself`;
        log(`Testing connection → GET ${url}`);
        const response = await axios.get(
          url,
          buildAxiosConfig(pat, { validateStatus: (s) => s < 500 })
        );
        log(`Response: HTTP ${response.status}`);

        if (response.status === 401 || response.status === 403) {
          log(`Auth failed: ${JSON.stringify(response.data).slice(0, 200)}`);
          showError("JIRA MCP: Authentication failed. Check your PAT and try again.");
          return;
        }
        if (response.status !== 200) {
          log(`Unexpected status: ${response.status} body: ${JSON.stringify(response.data).slice(0, 200)}`);
          showError(`JIRA MCP: Server returned ${response.status}. Check the URL and try again.`);
          return;
        }

        await context.secrets.store(SECRET_KEY, pat.trim());
        mcpChangeEmitter?.fire(); // Notify VS Code to (re)start the MCP server
        const displayName: string =
          response.data?.displayName || username;
        log(`Connected as: ${displayName}`);
        vscode.window.showInformationMessage(
          `JIRA MCP: Connected as ${displayName} ✓`
        );
        updateStatusBar(context);
      } catch (err: unknown) {
        logError("promptForPat connection test", err);
        if (axios.isAxiosError(err) && err.code === "ERR_FR_TOO_MANY_REDIRECTS") {
          await handleTooManyRedirects(context, jiraUrl);
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          showError(`JIRA MCP: Connection failed — ${msg}`);
        }
      }
    }
  );
}

async function runClearCredentials(
  context: vscode.ExtensionContext
): Promise<void> {
  const confirm = await vscode.window.showWarningMessage(
    "JIRA MCP: This will remove your saved PAT and disconnect the MCP server. Continue?",
    { modal: true },
    "Clear Credentials"
  );
  if (confirm !== "Clear Credentials") return;

  await context.secrets.delete(SECRET_KEY);
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  await config.update("jiraUrl", undefined, vscode.ConfigurationTarget.Global);
  await config.update(
    "username",
    undefined,
    vscode.ConfigurationTarget.Global
  );

  mcpChangeEmitter?.fire(); // Notify VS Code to stop the MCP server
  updateStatusBar(context);
  vscode.window.showInformationMessage("JIRA MCP: Credentials cleared.");
}

async function runTestConnection(
  context: vscode.ExtensionContext
): Promise<void> {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const jiraUrl = config.get<string>("jiraUrl");
  const pat = await context.secrets.get(SECRET_KEY);

  if (!jiraUrl || !pat) {
    const action = await vscode.window.showWarningMessage(
      "JIRA MCP: Not configured. Set up your connection first.",
      "Configure Now"
    );
    if (action === "Configure Now") {
      await runConfigure(context);
    }
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "JIRA MCP: Testing connection...",
      cancellable: false,
    },
    async () => {
      try {
        const base = jiraUrl.replace(/\/$/, "");
        const url = `${base}/rest/api/2/myself`;
        log(`Testing connection → GET ${url}`);
        const response = await axios.get(
          url,
          buildAxiosConfig(pat)
        );
        log(`Response: HTTP ${response.status}`);
        const displayName: string =
          response.data?.displayName ||
          config.get<string>("username") ||
          "Unknown";
        log(`Connected as: ${displayName}`);
        vscode.window.showInformationMessage(
          `JIRA MCP: Connected as ${displayName} ✓`
        );
        updateStatusBar(context, true);
      } catch (err: unknown) {
        logError("runTestConnection", err);
        if (axios.isAxiosError(err) && err.code === "ERR_FR_TOO_MANY_REDIRECTS") {
          await handleTooManyRedirects(context, jiraUrl);
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          showError(`JIRA MCP: Connection failed — ${msg}`);
        }
        updateStatusBar(context, false);
      }
    }
  );
}

/**
 * Called by VS Code via ${command:jira-mcp.getToken} to inject the PAT
 * as an environment variable into the MCP server subprocess.
 */
async function getToken(
  context: vscode.ExtensionContext
): Promise<string | undefined> {
  const pat = await context.secrets.get(SECRET_KEY);
  if (!pat) {
    vscode.window.showWarningMessage(
      "JIRA MCP: No PAT configured. Run 'JIRA MCP: Configure JIRA Connection'.",
      "Configure Now"
    ).then((action) => {
      if (action === "Configure Now") runConfigure(context);
    });
    return undefined;
  }
  return pat;
}

// ─── Status Bar ──────────────────────────────────────────────────────────────

async function updateStatusBar(
  context: vscode.ExtensionContext,
  forceConnected?: boolean
): Promise<void> {
  const pat = await context.secrets.get(SECRET_KEY);
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const url = config.get<string>("jiraUrl");

  if (forceConnected === true || (pat && url)) {
    statusBarItem.text = "$(check) JIRA: Connected";
    statusBarItem.tooltip = `JIRA MCP Server — ${url}\nClick to reconfigure`;
    statusBarItem.backgroundColor = undefined;
  } else {
    statusBarItem.text = "$(warning) JIRA: Not configured";
    statusBarItem.tooltip = "JIRA MCP: Click to configure your JIRA connection";
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground"
    );
    // Prompt first-time users
    if (!pat && !url) {
      vscode.window
        .showInformationMessage(
          "JIRA MCP: Configure your JIRA connection to use JIRA tools in Copilot.",
          "Configure Now",
          "Later"
        )
        .then((action) => {
          if (action === "Configure Now") runConfigure(context);
        });
    }
  }
  statusBarItem.show();
}
