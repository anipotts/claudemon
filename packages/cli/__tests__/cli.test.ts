import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// CLI constants extracted for testing.
//
// The CLI is a single executable ESM file with top-level await and
// process.argv routing at module scope — it cannot be directly imported
// without triggering side effects. We duplicate the constants here and
// validate them against the source file and package.json.
// ---------------------------------------------------------------------------

const CLI_PATH = join(__dirname, "..", "bin", "claudemon.js");
const PKG_PATH = join(__dirname, "..", "package.json");

function readCliSource(): string {
  return readFileSync(CLI_PATH, "utf-8");
}

function readPackageJson(): { version: string; name: string } {
  return JSON.parse(readFileSync(PKG_PATH, "utf-8"));
}

/**
 * Extract the HOOK_EVENTS array from the CLI source by parsing the
 * array literal between `const HOOK_EVENTS = [` and `];`.
 */
function extractHookEvents(): string[] {
  const src = readCliSource();
  const start = src.indexOf("const HOOK_EVENTS = [");
  if (start === -1) throw new Error("HOOK_EVENTS not found in CLI source");
  const arrayStart = src.indexOf("[", start);
  const arrayEnd = src.indexOf("];", arrayStart);
  const arrayStr = src.slice(arrayStart + 1, arrayEnd);
  return arrayStr
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter((s) => s.length > 0 && !s.startsWith("//"));
}

/**
 * Extract the VERSION constant from the CLI source.
 */
function extractVersion(): string {
  const src = readCliSource();
  const match = src.match(/const VERSION = ["']([^"']+)["']/);
  if (!match) throw new Error("VERSION not found in CLI source");
  return match[1];
}

/**
 * Extract the ACTION_EVENTS array from the CLI source.
 */
function extractActionEvents(): string[] {
  const src = readCliSource();
  const start = src.indexOf("const ACTION_EVENTS = [");
  if (start === -1) throw new Error("ACTION_EVENTS not found in CLI source");
  const arrayStart = src.indexOf("[", start);
  const arrayEnd = src.indexOf("];", arrayStart);
  const arrayStr = src.slice(arrayStart + 1, arrayEnd);
  return arrayStr
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter((s) => s.length > 0);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CLI — HOOK_EVENTS array", () => {
  it("has exactly 27 entries (all Claude Code hook events)", () => {
    const events = extractHookEvents();
    expect(events).toHaveLength(27);
  });

  it("contains no duplicates", () => {
    const events = extractHookEvents();
    const unique = new Set(events);
    expect(unique.size).toBe(events.length);
  });

  it("includes all tier-1 action events", () => {
    const events = extractHookEvents();
    expect(events).toContain("PermissionRequest");
    expect(events).toContain("Notification");
    expect(events).toContain("Elicitation");
    expect(events).toContain("StopFailure");
    expect(events).toContain("PostToolUseFailure");
  });

  it("includes all tier-2 status events", () => {
    const events = extractHookEvents();
    for (const evt of [
      "SessionStart",
      "SessionEnd",
      "Stop",
      "UserPromptSubmit",
      "PreToolUse",
      "PostToolUse",
      "SubagentStart",
      "SubagentStop",
      "PostCompact",
      "PermissionDenied",
    ]) {
      expect(events).toContain(evt);
    }
  });

  it("includes all tier-3 background events", () => {
    const events = extractHookEvents();
    for (const evt of [
      "PreCompact",
      "CwdChanged",
      "FileChanged",
      "ConfigChange",
      "WorktreeCreate",
      "WorktreeRemove",
      "InstructionsLoaded",
      "Setup",
    ]) {
      expect(events).toContain(evt);
    }
  });

  it("includes all tier-4 swarm events", () => {
    const events = extractHookEvents();
    for (const evt of ["TaskCreated", "TaskCompleted", "TeammateIdle", "ElicitationResult"]) {
      expect(events).toContain(evt);
    }
  });

  it("matches the HOOK_EVENTS from packages/types/monitor.ts", () => {
    const cliEvents = extractHookEvents();
    const typesPath = join(__dirname, "..", "..", "types", "monitor.ts");
    const typesSrc = readFileSync(typesPath, "utf-8");
    const start = typesSrc.indexOf("export const HOOK_EVENTS: HookEventName[] = [");
    const arrayStart = typesSrc.indexOf("[", start);
    const arrayEnd = typesSrc.indexOf("];", arrayStart);
    const arrayStr = typesSrc.slice(arrayStart + 1, arrayEnd);
    const typesEvents = arrayStr
      .split(",")
      .map((s) => {
        const match = s.match(/["']([^"']+)["']/);
        return match ? match[1] : "";
      })
      .filter((s) => s.length > 0);

    // Both should have 27 events and contain the same set
    expect(cliEvents).toHaveLength(typesEvents.length);
    expect(new Set(cliEvents)).toEqual(new Set(typesEvents));
  });
});

describe("CLI — VERSION constant", () => {
  it("exists in CLI source", () => {
    const version = extractVersion();
    expect(version).toBeTruthy();
  });

  it("matches package.json version", () => {
    const cliVersion = extractVersion();
    const pkg = readPackageJson();
    expect(cliVersion).toBe(pkg.version);
  });

  it("follows semver format", () => {
    const version = extractVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("CLI — ACTION_EVENTS array", () => {
  it("contains exactly 3 events for remote approval", () => {
    const events = extractActionEvents();
    expect(events).toHaveLength(3);
  });

  it("contains PermissionRequest, Notification, Elicitation", () => {
    const events = extractActionEvents();
    expect(events).toContain("PermissionRequest");
    expect(events).toContain("Notification");
    expect(events).toContain("Elicitation");
  });

  it("ACTION_EVENTS is a subset of HOOK_EVENTS", () => {
    const hookEvents = new Set(extractHookEvents());
    const actionEvents = extractActionEvents();
    for (const evt of actionEvents) {
      expect(hookEvents.has(evt)).toBe(true);
    }
  });
});

describe("CLI — init command hook structure", () => {
  // These tests validate the hook structure that init() writes by
  // simulating the settings.json mutation logic from the CLI source.

  function buildHookEntry(key: string): {
    matcher: string;
    hooks: { type: string; command: string; timeout: number; async: boolean }[];
  } {
    const curlCmd = [
      `curl -sf -X POST "https://api.claudemon.com/events"`,
      `-H "Content-Type: application/json"`,
      `-H "Authorization: Bearer ${key}"`,
      `-d "$(cat)" --max-time 5 2>/dev/null || true`,
    ].join(" ");

    return {
      matcher: "",
      hooks: [
        {
          type: "command",
          command: curlCmd,
          timeout: 8,
          async: true,
        },
      ],
    };
  }

  it("produces a command hook (not http)", () => {
    const entry = buildHookEntry("test-key-123");
    expect(entry.hooks[0].type).toBe("command");
  });

  it("hook command includes curl POST to /events", () => {
    const entry = buildHookEntry("test-key-123");
    expect(entry.hooks[0].command).toContain("curl -sf -X POST");
    expect(entry.hooks[0].command).toContain("/events");
  });

  it("hook command includes Authorization Bearer header with the key", () => {
    const entry = buildHookEntry("my-secret-key");
    expect(entry.hooks[0].command).toContain("Authorization: Bearer my-secret-key");
  });

  it("hook is async: true (non-blocking)", () => {
    const entry = buildHookEntry("test-key-123");
    expect(entry.hooks[0].async).toBe(true);
  });

  it("hook has timeout of 8 seconds", () => {
    const entry = buildHookEntry("test-key-123");
    expect(entry.hooks[0].timeout).toBe(8);
  });

  it("hook command includes --max-time 5 for curl timeout", () => {
    const entry = buildHookEntry("test-key-123");
    expect(entry.hooks[0].command).toContain("--max-time 5");
  });

  it("hook command includes error suppression (|| true)", () => {
    const entry = buildHookEntry("test-key-123");
    expect(entry.hooks[0].command).toContain("|| true");
  });

  it("matcher is empty string (matches all)", () => {
    const entry = buildHookEntry("test-key-123");
    expect(entry.matcher).toBe("");
  });

  it("writes hooks for all 27 events to settings object", () => {
    const settings: Record<string, unknown[]> = {};
    const entry = buildHookEntry("test-key-123");
    const events = extractHookEvents();
    for (const evt of events) {
      settings[evt] = [entry];
    }
    expect(Object.keys(settings)).toHaveLength(27);
    for (const evt of events) {
      expect(settings[evt]).toHaveLength(1);
    }
  });
});

describe("CLI — uninstall logic (hook removal)", () => {
  // The uninstall/init logic filters hooks by checking if the hook url
  // or command includes "claudemon". We replicate that filter here.

  function isClaudemonHook(group: { hooks?: { url?: string; command?: string }[] }): boolean {
    return !!group.hooks?.some((h) => (h.url || h.command || "").includes("claudemon"));
  }

  it("identifies claudemon HTTP hooks", () => {
    const group = { hooks: [{ url: "https://api.claudemon.com/events" }] };
    expect(isClaudemonHook(group)).toBe(true);
  });

  it("identifies claudemon command hooks", () => {
    const group = {
      hooks: [
        {
          command:
            'curl -sf -X POST "https://api.claudemon.com/events" -H "Content-Type: application/json" -d "$(cat)"',
        },
      ],
    };
    expect(isClaudemonHook(group)).toBe(true);
  });

  it("does NOT identify non-claudemon hooks", () => {
    const group = { hooks: [{ url: "https://other-service.com/webhook" }] };
    expect(isClaudemonHook(group)).toBe(false);
  });

  it("handles groups with no hooks array", () => {
    const group = {};
    expect(isClaudemonHook(group)).toBe(false);
  });

  it("preserves non-claudemon hooks when removing claudemon hooks", () => {
    const groups = [
      { hooks: [{ url: "https://other-service.com/webhook" }] },
      { hooks: [{ command: 'curl -sf -X POST "https://api.claudemon.com/events" -d "$(cat)"' }] },
      { hooks: [{ url: "https://another.com/hook" }] },
    ];

    const filtered = groups.filter((g) => !isClaudemonHook(g));
    expect(filtered).toHaveLength(2);
    expect(filtered[0].hooks[0].url).toBe("https://other-service.com/webhook");
    expect(filtered[1].hooks[0].url).toBe("https://another.com/hook");
  });

  it("removes all claudemon hooks when multiple are present", () => {
    const groups = [
      { hooks: [{ url: "https://api.claudemon.com/events" }] },
      { hooks: [{ command: 'curl "https://api.claudemon.com/events"' }] },
    ];

    const filtered = groups.filter((g) => !isClaudemonHook(g));
    expect(filtered).toHaveLength(0);
  });
});

describe("CLI — status command expected fields", () => {
  // The status command checks and outputs these fields:
  // 1. Claude hooks (configured or not, count, type)
  // 2. API server (reachable or not, URL, version)
  // 3. curl availability
  // 4. Transit encryption status

  it("source code contains all status check sections", () => {
    const src = readCliSource();

    // Hook check
    expect(src).toContain("Claude hooks");
    expect(src).toContain("hookCount");
    expect(src).toContain("hookType");

    // API check
    expect(src).toContain("API server");
    expect(src).toContain("/health");

    // curl check
    expect(src).toContain("which curl");

    // Transit encryption check
    expect(src).toContain("Transit encryption");
    expect(src).toContain("transit-key");
  });

  it("status warns about old HTTP hooks", () => {
    const src = readCliSource();
    expect(src).toContain('hookType === "http"');
    expect(src).toContain("HTTP hooks detected");
    expect(src).toContain("SessionStart events are silently dropped");
  });

  it("status outputs dashboard URL", () => {
    const src = readCliSource();
    expect(src).toContain("https://app.claudemon.com");
  });
});

describe("CLI — export command structure", () => {
  // Verify the export output shape matches expected schema

  it("source code builds correct output structure", () => {
    const src = readCliSource();

    // Required top-level fields
    expect(src).toContain("claudemon_version");
    expect(src).toContain("node_version");
    expect(src).toContain("platform");
    expect(src).toContain("arch");
    expect(src).toContain("exported_at");

    // Hooks section (JS object literals use unquoted keys)
    expect(src).toContain("configured:");
    expect(src).toContain("count:");
    expect(src).toContain("type:");
    expect(src).toContain("events:");

    // Transit encryption section
    expect(src).toContain("transit_encryption");
    expect(src).toContain("key_fingerprint");
  });
});

describe("CLI — generate-key command", () => {
  it("source code generates 32-byte hex key", () => {
    const src = readCliSource();
    expect(src).toContain("randomBytes(32)");
    expect(src).toContain('.toString("hex")');
  });

  it("source code stores key with mode 0o600 (owner-only)", () => {
    const src = readCliSource();
    expect(src).toContain("mode: 0o600");
  });

  it("source code stores key in ~/.claudemon/transit-key", () => {
    const src = readCliSource();
    expect(src).toContain("transit-key");
    expect(src).toContain(".claudemon");
  });
});

describe("CLI — source structure", () => {
  it("is an ESM module (uses import statements)", () => {
    const src = readCliSource();
    expect(src).toContain("import { readFileSync");
    expect(src).toContain('from "node:fs"');
  });

  it("has shebang for direct execution", () => {
    const src = readCliSource();
    expect(src.startsWith("#!/usr/bin/env node")).toBe(true);
  });

  it("defines all CLI commands in the router", () => {
    const src = readCliSource();
    // All commands from the usage output
    expect(src).toContain('command === "init"');
    expect(src).toContain('command === "status"');
    expect(src).toContain('command === "migrate"');
    expect(src).toContain('command === "generate-key"');
    expect(src).toContain('command === "export"');
    expect(src).toContain('command === "--version"');
    expect(src).toContain('command === "-v"');
  });

  it("uses zero dependencies (only node: built-ins)", () => {
    const src = readCliSource();
    // All imports should be node: protocol
    const importLines = src.split("\n").filter((l: string) => l.startsWith("import "));
    for (const line of importLines) {
      expect(line).toContain("node:");
    }
  });
});
