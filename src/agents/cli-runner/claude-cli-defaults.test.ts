import { describe, expect, it } from "vitest";
import type { CliBackendConfig } from "../../config/types.js";
import { applyClaudeCliConfigDefaults, injectClaudeCliArgs } from "./claude-cli-defaults.js";

describe("applyClaudeCliConfigDefaults", () => {
  it("returns unmodified config for non-claude-cli backends", () => {
    const backend: CliBackendConfig = { command: "some-cli" };
    const result = applyClaudeCliConfigDefaults(backend, "other-backend");
    expect(result).toBe(backend);
  });

  it("fills defaults for claude-cli with minimal config", () => {
    const backend: CliBackendConfig = { command: "claude" };
    const result = applyClaudeCliConfigDefaults(backend, "claude-cli");
    expect(result.command).toBe("claude");
    expect(result.output).toBe("jsonl");
    expect(result.input).toBe("stdin");
    expect(result.modelArg).toBe("--model");
    expect(result.sessionArg).toBe("--session-id");
    expect(result.sessionMode).toBe("managed");
    expect(result.systemPromptArg).toBe("--append-system-prompt");
    expect(result.systemPromptMode).toBe("append");
    expect(result.systemPromptWhen).toBe("first");
    expect(result.serialize).toBe(false);
    expect(result.args).toEqual([]);
    expect(result.resumeArgs).toEqual(["--resume", "{sessionId}"]);
    expect(result.clearEnv).toEqual(["ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY_OLD"]);
    expect(result.modelAliases).toBeDefined();
    expect(result.modelAliases?.["opus"]).toBe("opus");
    expect(result.modelAliases?.["sonnet"]).toBe("sonnet");
    expect(result.sessionIdFields).toEqual([
      "session_id",
      "sessionId",
      "conversation_id",
      "conversationId",
    ]);
  });

  it("user values take precedence over defaults", () => {
    const backend: CliBackendConfig = {
      command: "claude",
      output: "text",
      input: "arg",
      sessionMode: "always",
      serialize: true,
    };
    const result = applyClaudeCliConfigDefaults(backend, "claude-cli");
    expect(result.output).toBe("text");
    expect(result.input).toBe("arg");
    expect(result.sessionMode).toBe("always");
    expect(result.serialize).toBe(true);
    // Defaults still fill missing fields.
    expect(result.modelArg).toBe("--model");
  });
});

describe("injectClaudeCliArgs", () => {
  it("returns unmodified args for non-claude-cli backends", () => {
    const args = ["--foo", "bar"];
    const result = injectClaudeCliArgs(args, "other-backend");
    expect(result).toBe(args);
  });

  it("injects all default flags when args is empty", () => {
    const result = injectClaudeCliArgs([], "claude-cli");
    expect(result).toContain("-p");
    expect(result).toContain("--bare");
    expect(result).toContain("--output-format");
    expect(result).toContain("stream-json");
    expect(result).toContain("--verbose");
    expect(result).toContain("--dangerously-skip-permissions");
    expect(result).toContain("--mcp-config");
  });

  it("does not duplicate flags already present", () => {
    const args = ["-p", "--bare", "--output-format", "json", "--verbose"];
    const result = injectClaudeCliArgs(args, "claude-cli");
    const pCount = result.filter((a) => a === "-p").length;
    expect(pCount).toBe(1);
    const bareCount = result.filter((a) => a === "--bare").length;
    expect(bareCount).toBe(1);
    const verboseCount = result.filter((a) => a === "--verbose").length;
    expect(verboseCount).toBe(1);
    // --output-format already present so should not be added again.
    const formatCount = result.filter((a) => a === "--output-format").length;
    expect(formatCount).toBe(1);
  });

  it("generates token helper when backend.token is set", () => {
    const backend: CliBackendConfig = { command: "claude", token: "sk-test-token-abc" };
    const result = injectClaudeCliArgs([], "claude-cli", backend);
    expect(result).toContain("--settings");
    const settingsIdx = result.indexOf("--settings");
    expect(settingsIdx).toBeGreaterThan(-1);
    const settingsValue = result[settingsIdx + 1];
    expect(settingsValue).toBeDefined();
    const parsed = JSON.parse(settingsValue);
    expect(parsed.apiKeyHelper).toBeDefined();
    expect(typeof parsed.apiKeyHelper).toBe("string");
  });

  it("generates MCP config when not present", () => {
    const result = injectClaudeCliArgs([], "claude-cli");
    expect(result).toContain("--mcp-config");
    const mcpIdx = result.indexOf("--mcp-config");
    expect(mcpIdx).toBeGreaterThan(-1);
    const mcpPath = result[mcpIdx + 1];
    expect(mcpPath).toBeDefined();
    expect(typeof mcpPath).toBe("string");
  });
});
