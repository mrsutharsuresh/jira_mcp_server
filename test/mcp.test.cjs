const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { once } = require("node:events");
const vm = require("node:vm");
const { test } = require("node:test");
const { buildSync } = require("esbuild");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");

const root = path.resolve(__dirname, "..");
const packageMetadata = require("../package.json");
const token = "fixture-token-not-a-real-credential";
const cancellation = { isCancellationRequested: false };
const bundle = buildSync({
  entryPoints: [path.join(root, "src/extension.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["vscode", "axios"],
  write: false,
}).outputFiles[0].text;

class EventEmitter {
  listeners = new Set();
  event = (listener) => {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  };
  fire(event) {
    for (const listener of this.listeners) listener(event);
  }
  dispose() {
    this.listeners.clear();
  }
}

function activateFixture(options = {}) {
  const values = {
    jiraUrl: options.jiraUrl ?? "http://127.0.0.1/jira",
    username: "fixture-user",
  };
  let pat = options.pat === undefined ? token : options.pat;
  const secretsChanged = new EventEmitter();
  const configChanged = new EventEmitter();
  const foldersChanged = new EventEmitter();
  const logs = [];
  const messages = [];
  const commands = new Map();
  const requests = [];
  let provider;
  let refreshes = 0;
  let prompts = 0;
  let writes = 0;
  let secretReadError;
  class McpStdioServerDefinition {
    constructor(label, command, args, env, version) {
      Object.assign(this, { label, command, args, env, version });
    }
  }
  const vscode = {
    version: "1.142.0",
    env: { remoteName: options.remoteName ?? "ssh-remote" },
    EventEmitter,
    McpStdioServerDefinition,
    Uri: { file: (fsPath) => ({ fsPath }) },
    StatusBarAlignment: { Right: 2 },
    ConfigurationTarget: { Global: 1 },
    ProgressLocation: { Notification: 15 },
    ThemeColor: class {},
    workspace: {
      workspaceFolders: [{ uri: { fsPath: root } }],
      getConfiguration: (section) => ({
        get: (key) => section === "jira-mcp" ? values[key] : undefined,
        update: async (key, value) => {
          values[key] = value;
          configChanged.fire({ affectsConfiguration: (name) => name === section });
        },
      }),
      onDidChangeConfiguration: configChanged.event,
      onDidChangeWorkspaceFolders: foldersChanged.event,
    },
    window: {
      createOutputChannel: () => ({
        appendLine: (line) => logs.push(line),
        show() {},
        dispose() {},
      }),
      createStatusBarItem: () => ({ show() {}, dispose() {} }),
      showInformationMessage: async (message) => { messages.push(message); },
      showWarningMessage: async (message) => { messages.push(message); },
      showErrorMessage: async (message) => { messages.push(message); },
      showInputBox: async () => { prompts += 1; },
      showQuickPick: async (items) => items.find(
        (item) => item.label.includes(options.menuChoice ?? "Refresh MCP Registration")
      ),
      withProgress: async (_options, task) => task(),
    },
    commands: {
      executeCommand: async (name) => commands.get(name)(),
      registerCommand: (name, handler) => {
        commands.set(name, handler);
        return { dispose: () => commands.delete(name) };
      },
    },
    lm: {
      registerMcpServerDefinitionProvider: (id, definitionProvider) => {
        assert.equal(id, "jira-mcp-provider");
        provider = definitionProvider;
        const subscription = provider.onDidChangeMcpServerDefinitions(() => { refreshes += 1; });
        return subscription;
      },
    },
  };
  const context = {
    extensionPath: root,
    subscriptions: [],
    asAbsolutePath: (relative) => path.join(root, relative),
    secrets: {
      get: async () => {
        if (secretReadError) throw secretReadError;
        return pat;
      },
      store: async (_key, value) => {
        pat = value;
        secretsChanged.fire({ key: "jira-mcp.pat" });
      },
      delete: async () => {
        pat = undefined;
        secretsChanged.fire({ key: "jira-mcp.pat" });
      },
      onDidChange: secretsChanged.event,
    },
  };
  const axios = {
    isAxiosError: () => false,
    get: async (url, config) => {
      requests.push({ url, config });
      return { status: 200, data: { displayName: "Fixture User" } };
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(bundle, {
    module,
    exports: module.exports,
    require: (name) => {
      if (name === "vscode") return vscode;
      if (name === "axios") return axios;
      if (name === "fs") return {
        existsSync: () => false,
        writeFileSync: () => { writes += 1; throw new Error("Unexpected config write"); },
      };
      return require(name);
    },
    process, Buffer, URL, console,
  });
  module.exports.activate(context);
  return {
    provider, context, commands, logs, messages, requests, values, vscode,
    secretsChanged, configChanged, foldersChanged,
    get refreshes() { return refreshes; },
    get prompts() { return prompts; },
    get writes() { return writes; },
    setSecretReadError: (error) => { secretReadError = error; },
  };
}

test("forwarded definition is launch-ready without calling the resolver", async () => {
  const fixture = activateFixture();
  const definitions = await fixture.provider.provideMcpServerDefinitions(cancellation);
  assert.equal(definitions.length, 1);
  const definition = definitions[0];
  assert.equal(definition.env.JIRA_TOKEN, token);
  assert.equal(definition.command, process.execPath);
  assert.equal(definition.args[0], path.join(root, "dist/server.js"));
  assert.equal(definition.env.ELECTRON_RUN_AS_NODE, "1");
  assert.equal(definition.env.WORKSPACE_FOLDER, root);
  assert.equal(definition.cwd.fsPath, root);
  assert.equal(fixture.prompts, 0);
  assert.equal(fixture.writes, 0);
  assert.ok(!fixture.logs.join("\n").includes(token));
});

test("missing or whitespace-only credentials never publish an unusable server", async () => {
  for (const pat of [null, "", "   "]) {
    const fixture = activateFixture({ pat });
    const definitions = await fixture.provider.provideMcpServerDefinitions(cancellation);
    assert.equal(definitions.length, 0);
    assert.equal(fixture.prompts, 0);
    assert.match(fixture.logs.join("\n"), /no saved token/);
  }
  const fixture = activateFixture({ jiraUrl: "" });
  assert.equal((await fixture.provider.provideMcpServerDefinitions(cancellation)).length, 0);
  assert.match(fixture.logs.join("\n"), /configure the JIRA URL/);
});

test("credential changes and revocation refresh definitions without exposing tokens", async () => {
  const fixture = activateFixture();
  const [before] = await fixture.provider.provideMcpServerDefinitions(cancellation);
  await fixture.context.secrets.store("jira-mcp.pat", "rotated-fixture-token");
  const [after] = await fixture.provider.provideMcpServerDefinitions(cancellation);
  assert.equal(fixture.refreshes, 1);
  assert.notEqual(after.version, before.version);
  assert.equal(after.env.JIRA_TOKEN, "rotated-fixture-token");
  await fixture.context.secrets.delete("jira-mcp.pat");
  assert.equal((await fixture.provider.provideMcpServerDefinitions(cancellation)).length, 0);
  assert.equal(fixture.refreshes, 2);
  assert.ok(!fixture.logs.join("\n").includes("rotated-fixture-token"));
});

test("Local resolver uses the latest saved token and refuses revoked credentials", async () => {
  const fixture = activateFixture({ remoteName: "" });
  const [old] = await fixture.provider.provideMcpServerDefinitions(cancellation);
  await fixture.context.secrets.store("jira-mcp.pat", "new-fixture-token");
  fixture.values.username = "updated-user";
  const resolved = await fixture.provider.resolveMcpServerDefinition(old, cancellation);
  assert.equal(resolved.env.JIRA_TOKEN, "new-fixture-token");
  assert.equal(resolved.env.JIRA_USERNAME, "updated-user");
  assert.equal(resolved.cwd.fsPath, root);
  await fixture.context.secrets.delete("jira-mcp.pat");
  assert.equal(await fixture.provider.resolveMcpServerDefinition(old, cancellation), undefined);
  assert.match(fixture.messages.join("\n"), /No PAT configured/);
});

test("settings, workspace changes and explicit refresh update the provider", async () => {
  const fixture = activateFixture();
  fixture.configChanged.fire({ affectsConfiguration: () => false });
  fixture.secretsChanged.fire({ key: "another-extension" });
  assert.equal(fixture.refreshes, 0);
  fixture.values.jiraUrl = "http://127.0.0.1/updated-jira";
  fixture.configChanged.fire({ affectsConfiguration: () => true });
  fixture.vscode.workspace.workspaceFolders = [{ uri: { fsPath: path.dirname(root) } }];
  fixture.foldersChanged.fire();
  await fixture.commands.get("jira-mcp.refresh")();
  assert.equal(fixture.refreshes, 3);
  const [definition] = await fixture.provider.provideMcpServerDefinitions(cancellation);
  assert.equal(definition.env.JIRA_URL, fixture.values.jiraUrl);
  assert.equal(definition.cwd.fsPath, path.dirname(root));
  assert.match(fixture.messages.join("\n"), /does not restart/);
  for (const subscription of fixture.context.subscriptions) subscription.dispose();
  assert.equal(fixture.configChanged.listeners.size, 0);
  assert.equal(fixture.secretsChanged.listeners.size, 0);
  assert.equal(fixture.foldersChanged.listeners.size, 0);
});

test("no-workspace discovery uses the extension directory", async () => {
  const fixture = activateFixture();
  fixture.vscode.workspace.workspaceFolders = undefined;
  const [definition] = await fixture.provider.provideMcpServerDefinitions(cancellation);
  assert.equal(definition.env.WORKSPACE_FOLDER, root);
  assert.equal(definition.cwd.fsPath, root);
});

test("status-bar configuration menu exposes the refresh command", async () => {
  const fixture = activateFixture();
  await fixture.commands.get("jira-mcp.configure")();
  assert.equal(fixture.refreshes, 1);
  assert.match(fixture.messages.join("\n"), /does not restart/);
});

test("cancelled discovery and resolution do not return a server", async () => {
  const fixture = activateFixture();
  const [definition] = await fixture.provider.provideMcpServerDefinitions(cancellation);
  const cancelled = { isCancellationRequested: true };
  assert.equal((await fixture.provider.provideMcpServerDefinitions(cancelled)).length, 0);
  assert.equal(await fixture.provider.resolveMcpServerDefinition(definition, cancelled), undefined);
});

test("SecretStorage read failures propagate instead of returning an empty configuration", async () => {
  const fixture = activateFixture();
  await new Promise(setImmediate);
  fixture.setSecretReadError(new Error("Fixture SecretStorage unavailable"));
  await assert.rejects(
    fixture.provider.provideMcpServerDefinitions(cancellation),
    /SecretStorage unavailable/
  );
});

test("successful API test refreshes registration without claiming MCP is running", async () => {
  for (const [jiraUrl, expected] of [
    ["http://127.0.0.1/jira", `Bearer ${token}`],
    ["https://fixture.atlassian.net", `Basic ${Buffer.from(`fixture-user:${token}`).toString("base64")}`],
  ]) {
    const fixture = activateFixture({ jiraUrl });
    await fixture.commands.get("jira-mcp.testConnection")();
    assert.equal(fixture.requests[0].config.headers.Authorization, expected);
    assert.equal(fixture.refreshes, 1);
    assert.match(fixture.messages.join("\n"), /MCP startup is verified separately/);
    assert.ok(!fixture.logs.join("\n").includes(token));
  }
});

test("published definition completes MCP initialization and an authenticated read-only tool call", { timeout: 20000 }, async (t) => {
  let request;
  const jira = http.createServer((req, res) => {
    request = { url: req.url, authorization: req.headers.authorization };
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ total: 1, issues: [{
      key: "TEST-1",
      fields: { summary: "Fixture issue", status: { name: "Open" } },
    }] }));
  });
  jira.listen(0, "127.0.0.1");
  await once(jira, "listening");
  t.after(() => new Promise((resolve, reject) => {
    jira.close((error) => error ? reject(error) : resolve());
    jira.closeAllConnections();
  }));
  const fixture = activateFixture({ jiraUrl: `http://127.0.0.1:${jira.address().port}/jira` });
  const [definition] = await fixture.provider.provideMcpServerDefinitions(cancellation);
  const client = new Client({ name: "jira-mcp-regression-test", version: "1.0.5" });
  const transport = new StdioClientTransport({
    command: definition.command,
    args: definition.args,
    cwd: definition.cwd.fsPath,
    env: { ...definition.env, NO_PROXY: "127.0.0.1", no_proxy: "127.0.0.1" },
    stderr: "pipe",
  });
  let stderr = "";
  transport.stderr.on("data", (chunk) => { stderr += chunk; });
  t.after(() => client.close());
  await client.connect(transport);
  assert.equal(client.getServerVersion().version, packageMetadata.version);
  assert.ok(definition.version.startsWith(`${packageMetadata.version}.`));
  const { tools } = await client.listTools();
  assert.equal(tools.length, 14);
  assert.ok(tools.some((tool) => tool.name === "search_issues"));
  const versionResult = await client.callTool({
    name: "get_server_version",
    arguments: {},
  });
  assert.ok(!versionResult.isError);
  const reported = JSON.parse(versionResult.content[0].text);
  assert.equal(reported.version, packageMetadata.version);
  assert.equal(reported.release_date, packageMetadata.releaseDate);
  const result = await client.callTool({
    name: "search_issues",
    arguments: { jql: "assignee = currentUser()" },
  });
  assert.ok(!result.isError, JSON.stringify(result));
  assert.equal(JSON.parse(result.content[0].text).issues[0].key, "TEST-1");
  assert.equal(request.authorization, `Bearer ${token}`);
  assert.match(request.url, /^\/jira\/rest\/api\/2\/search\?/);
  assert.ok(!stderr.includes(token));
});

test("standalone server explicitly fails when the token is missing", () => {
  const result = spawnSync(process.execPath, [path.join(root, "dist/server.js")], {
    env: { JIRA_URL: "http://127.0.0.1/jira" },
    encoding: "utf8",
    timeout: 5000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Required environment variable 'JIRA_TOKEN' is not set/);
});
