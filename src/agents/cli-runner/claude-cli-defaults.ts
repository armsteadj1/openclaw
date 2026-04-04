import crypto from "node:crypto";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CliBackendConfig } from "../../config/types.js";

const CLAUDE_CLI_BACKEND_ID = "claude-cli";

const CLAUDE_CLI_CONFIG_DEFAULTS: Partial<CliBackendConfig> = {
  args: [],
  resumeArgs: ["--resume", "{sessionId}"],
  output: "jsonl",
  input: "stdin",
  modelArg: "--model",
  modelAliases: {
    opus: "opus",
    "opus-4.6": "opus",
    "opus-4.5": "opus",
    "opus-4": "opus",
    "claude-opus-4-6": "opus",
    "claude-opus-4-5": "opus",
    "claude-opus-4": "opus",
    sonnet: "sonnet",
    "sonnet-4.6": "sonnet",
    "sonnet-4.5": "sonnet",
    "sonnet-4.1": "sonnet",
    "sonnet-4.0": "sonnet",
    "claude-sonnet-4-6": "sonnet",
    "claude-sonnet-4-5": "sonnet",
    "claude-sonnet-4-1": "sonnet",
    "claude-sonnet-4-0": "sonnet",
    haiku: "haiku",
    "haiku-3.5": "haiku",
    "claude-haiku-3-5": "haiku",
  },
  sessionArg: "--session-id",
  sessionMode: "managed",
  sessionIdFields: ["session_id", "sessionId", "conversation_id", "conversationId"],
  systemPromptArg: "--append-system-prompt",
  systemPromptMode: "append",
  systemPromptWhen: "first",
  clearEnv: ["ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY_OLD"],
  serialize: false,
};

export function applyClaudeCliConfigDefaults(
  backend: CliBackendConfig,
  backendId: string,
): CliBackendConfig {
  if (backendId !== CLAUDE_CLI_BACKEND_ID) {
    return backend;
  }
  const merged: Record<string, unknown> = { ...backend };
  for (const [key, value] of Object.entries(CLAUDE_CLI_CONFIG_DEFAULTS)) {
    if (merged[key] === undefined || merged[key] === null) {
      merged[key] = value;
    }
  }
  return merged as CliBackendConfig;
}

const CLI_AUTO_DIR = path.join(os.tmpdir(), "openclaw-cli-auto");

function ensureAutoDir(): void {
  try {
    fsSync.mkdirSync(CLI_AUTO_DIR, { recursive: true, mode: 0o700 });
  } catch {
    // Directory may already exist.
  }
}

function ensureTokenHelper(token: string): string {
  ensureAutoDir();
  const hash = crypto.createHash("sha256").update(token).digest("hex").slice(0, 12);
  const tokenFile = path.join(CLI_AUTO_DIR, `.token-${hash}`);
  const helperFile = path.join(CLI_AUTO_DIR, `helper-${hash}.sh`);
  fsSync.writeFileSync(tokenFile, token, { mode: 0o600 });
  if (!fsSync.existsSync(helperFile)) {
    fsSync.writeFileSync(helperFile, `#!/bin/bash\ncat "${tokenFile}"\n`, { mode: 0o700 });
  }
  return helperFile;
}

// MCP server script content — auto-generated at runtime.
const MCP_SERVER_SCRIPT = [
  "#!/usr/bin/env node",
  "// Auto-generated OpenClaw MCP bridge for Claude CLI backends.",
  '// Exposes a "message" tool so the CLI can post Slack messages.',
  'import { readFileSync } from "node:fs";',
  'import { join } from "node:path";',
  'import { homedir } from "node:os";',
  'import { createInterface } from "node:readline";',
  'const CONFIG_PATH = join(homedir(), ".openclaw", "openclaw.json");',
  'function loadConfig() { return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")); }',
  'function write(obj) { process.stdout.write(JSON.stringify(obj) + "\\n"); }',
  'function respond(id, result) { write({ jsonrpc: "2.0", id, result }); }',
  'function respondError(id, code, message) { write({ jsonrpc: "2.0", id, error: { code, message } }); }',
  "async function slackPost(botToken, { channel, text, thread_ts }) {",
  "  const body = { channel, text }; if (thread_ts) body.thread_ts = thread_ts;",
  '  const res = await fetch("https://slack.com/api/chat.postMessage", {',
  '    method: "POST", headers: { Authorization: "Bearer " + botToken, "Content-Type": "application/json" },',
  "    body: JSON.stringify(body) });",
  '  const data = await res.json(); if (!data.ok) throw new Error("Slack: " + data.error); return data;',
  "}",
  'const TOOLS = [{ name: "message", description: "Send a message to a Slack channel or DM.",',
  '  inputSchema: { type: "object", properties: {',
  '    channel: { type: "string", description: "Slack channel ID" },',
  '    text: { type: "string", description: "Message text (Slack markdown)" },',
  '    thread_ts: { type: "string", description: "Thread timestamp for in-thread reply" }',
  '  }, required: ["channel", "text"] } }];',
  "async function handle(req) {",
  "  const { id, method, params } = req;",
  '  if (method === "initialize") return respond(id, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "openclaw-tools", version: "1.0.0" } });',
  '  if (method === "notifications/initialized") return;',
  '  if (method === "tools/list") return respond(id, { tools: TOOLS });',
  '  if (method === "tools/call") {',
  '    if (params.name === "message") {',
  "      try { const cfg = loadConfig(); const t = cfg.channels?.slack?.botToken;",
  '        if (!t) throw new Error("No Slack bot token in openclaw.json");',
  "        await slackPost(t, params.arguments);",
  '        return respond(id, { content: [{ type: "text", text: "Message sent to " + params.arguments.channel + (params.arguments.thread_ts ? " (thread)" : "") }] });',
  '      } catch (e) { return respond(id, { content: [{ type: "text", text: "Error: " + e.message }], isError: true }); }',
  "    }",
  '    return respondError(id, -32001, "Unknown tool: " + params.name);',
  "  }",
  '  if (id !== undefined) return respondError(id, -32601, "Method not found: " + method);',
  "}",
  "let pending = 0, closed = false;",
  "const rl = createInterface({ input: process.stdin, terminal: false });",
  'rl.on("line", async (l) => { pending++; try { await handle(JSON.parse(l)); } catch { write({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" } }); } pending--; if (closed && pending === 0) process.exit(0); });',
  'rl.on("close", () => { closed = true; if (pending === 0) process.exit(0); });',
].join("\n");

let mcpConfigPath: string | null = null;

function ensureMcpBridge(): string {
  if (mcpConfigPath) {
    return mcpConfigPath;
  }
  ensureAutoDir();
  const scriptPath = path.join(CLI_AUTO_DIR, "openclaw-tools-mcp.mjs");
  const configPath = path.join(CLI_AUTO_DIR, "openclaw-tools-mcp.json");
  fsSync.writeFileSync(scriptPath, MCP_SERVER_SCRIPT, { mode: 0o700 });
  fsSync.writeFileSync(
    configPath,
    JSON.stringify({
      mcpServers: { "openclaw-tools": { command: "node", args: [scriptPath] } },
    }),
    { mode: 0o644 },
  );
  mcpConfigPath = configPath;
  return configPath;
}

export function injectClaudeCliArgs(
  args: string[],
  backendId: string,
  backend?: CliBackendConfig,
): string[] {
  if (backendId !== CLAUDE_CLI_BACKEND_ID) {
    return args;
  }
  const joined = args.join(" ");
  const out = [...args];

  if (!args.includes("--bare")) {
    out.unshift("--bare");
  }
  if (!args.includes("-p") && !args.includes("--print")) {
    out.unshift("-p");
  }
  if (!joined.includes("--output-format")) {
    out.push("--output-format", "stream-json");
  }
  if (!args.includes("--verbose")) {
    out.push("--verbose");
  }
  if (!args.includes("--dangerously-skip-permissions")) {
    out.push("--dangerously-skip-permissions");
  }
  if (backend?.token && !joined.includes("--settings")) {
    const helperPath = ensureTokenHelper(backend.token);
    out.push("--settings", JSON.stringify({ apiKeyHelper: helperPath }));
  }
  if (!joined.includes("--mcp-config")) {
    const mcpPath = ensureMcpBridge();
    out.push("--mcp-config", mcpPath);
  }

  return out;
}
