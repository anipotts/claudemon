#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createInterface } from "node:readline";

const VERSION = "0.6.0";
const API_URL = "https://api.claudemon.com";

// Core monitoring events — the minimal set that captures full session lifecycle.
// Claude Code has 27 hook events total; we only need 12 for effective monitoring.
// Reduced from 27 to eliminate noise (TaskCreated, TeammateIdle, Elicitation, etc.)
const HOOK_EVENTS = [
  "SessionStart", // session lifecycle (MUST be command hook — HTTP blocked by CC)
  "SessionEnd", // session lifecycle
  "Setup", // initial setup (MUST be command hook — HTTP blocked by CC)
  "PreToolUse", // tool activity start + tool_input
  "PostToolUse", // tool completion + tool_response
  "Stop", // session completion
  "StopFailure", // error tracking
  "SubagentStart", // agent hierarchy
  "SubagentStop", // agent hierarchy
  "UserPromptSubmit", // what user is asking
  "Notification", // "needs input" / completion
  "PostCompact", // context overflow tracking
];

// ── Helpers ────────────────────────────────────────────────────────

function dim(s) {
  return `\x1b[2m${s}\x1b[0m`;
}
function green(s) {
  return `\x1b[32m${s}\x1b[0m`;
}
function red(s) {
  return `\x1b[31m${s}\x1b[0m`;
}
function bold(s) {
  return `\x1b[1m${s}\x1b[0m`;
}

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ── Init ───────────────────────────────────────────────────────────

async function init(keyArg) {
  console.log();
  console.log(bold("ClaudeMon") + dim(" — monitor your Claude Code sessions"));
  console.log();

  // 1. Get API key
  let key = keyArg;
  if (!key) {
    console.log(dim("  Get your key at https://app.claudemon.com"));
    console.log();
    key = await prompt("  API key: ");
  }
  if (!key) {
    console.log(red("\n  No API key provided. Aborting.\n"));
    process.exit(1);
  }

  // 2. Write hooks to ~/.claude/settings.json
  const claudeDir = join(homedir(), ".claude");
  const settingsPath = join(claudeDir, "settings.json");

  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true });
  }

  let settings = {};
  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    } catch (_e) {
      console.log(red("  Error: ") + `${settingsPath} contains invalid JSON.`);
      console.log(dim("  Fix the file manually, then re-run claudemon init."));
      process.exit(1);
    }
  }

  // Async command hook — non-blocking, batched, works for ALL events including
  // SessionStart/Setup (HTTP hooks are silently blocked by Claude Code for those).
  // Uses curl to POST to the API in the background. The `async: true` flag means
  // Claude Code fires the hook without waiting for it to complete.
  const curlCmd = [
    `curl -sf -X POST "${API_URL}/events"`,
    `-H "Content-Type: application/json"`,
    `-H "Authorization: Bearer ${key}"`,
    `-d "$(cat)" --max-time 5 2>/dev/null || true`,
  ].join(" ");

  const hook = {
    type: "command",
    command: curlCmd,
    timeout: 8,
    async: true,
  };
  const entry = { matcher: "", hooks: [hook] };

  if (!settings.hooks) settings.hooks = {};

  // Count unique existing hook groups (not per-event)
  const seen = new Set();
  for (const evt of HOOK_EVENTS) {
    for (const g of settings.hooks[evt] || []) {
      if (!g.hooks?.some((h) => (h.url || h.command || "").includes("claudemon"))) {
        seen.add(JSON.stringify(g));
      }
    }
  }
  const preserved = seen.size;

  for (const evt of HOOK_EVENTS) {
    const groups = (settings.hooks[evt] || []).filter(
      (g) => !g.hooks?.some((h) => (h.url || h.command || "").includes("claudemon")),
    );
    groups.push(entry);
    settings.hooks[evt] = groups;
  }

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  console.log(green("  +") + ` Hooks added to ${dim(settingsPath)}`);
  if (preserved > 0) console.log(dim(`    (preserved ${preserved} existing hook groups)`));

  // Done — no env var needed, key is hardcoded in hook config
  // Claude Code watches settings.json, so hooks activate immediately
  console.log();
  console.log(green("  Done!") + " Hooks are active immediately — no restart needed.");
  console.log(dim("  Open Claude Code and sessions will appear at https://app.claudemon.com"));
  console.log();
}

// ── Status ────────────────────────────────────────────────────────

async function status() {
  console.log();
  console.log(bold("ClaudeMon") + dim(" — status check"));
  console.log();

  // 1. Hooks in settings.json
  const settingsPath = join(homedir(), ".claude", "settings.json");
  let hasHooks = false;
  let hookType = "";
  let hookCount = 0;
  if (existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
      const hooks = settings.hooks || {};
      for (const [_evt, groups] of Object.entries(hooks)) {
        for (const g of groups) {
          if (g.hooks?.some((h) => (h.url || h.command || "").includes("claudemon"))) {
            hasHooks = true;
            hookCount++;
            const h = g.hooks.find((h) => (h.url || h.command || "").includes("claudemon"));
            if (h) hookType = h.type;
          }
        }
      }
    } catch {}
  }
  console.log(
    (hasHooks ? green("  [ok]") : red("  [!!]")) +
      " Claude hooks " +
      (hasHooks ? dim(`${hookCount} events via ${hookType} hooks`) : red("not found — run: claudemon init")),
  );

  // Warn if using old HTTP hooks (blocked for SessionStart/Setup)
  if (hookType === "http") {
    console.log(red("  [!!]") + " HTTP hooks detected — SessionStart events are silently dropped by Claude Code.");
    console.log(dim("       Re-run `claudemon init` to upgrade to async command hooks."));
  }

  // 2. API health check
  let apiOk = false;
  let apiVersion = "";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${API_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    apiOk = res.ok;
    if (res.ok) {
      const data = await res.json();
      apiVersion = data.version || "";
    }
  } catch {}
  console.log(
    (apiOk ? green("  [ok]") : red("  [!!]")) +
      " API server " +
      (apiOk
        ? dim(`reachable at ${API_URL}` + (apiVersion ? ` (v${apiVersion})` : ""))
        : red("unreachable — check your network")),
  );

  // 3. curl available (required for async command hooks)
  let hasCurl = false;
  try {
    const { execSync } = await import("node:child_process");
    execSync("which curl", { stdio: "ignore" });
    hasCurl = true;
  } catch {}
  console.log(
    (hasCurl ? green("  [ok]") : red("  [!!]")) +
      " curl " +
      (hasCurl ? dim("available (required for async hooks)") : red("not found — install curl")),
  );

  console.log();
  console.log(dim("  Dashboard: ") + "https://app.claudemon.com");
  console.log();
}

// ── Migrate ──────────────────────────────────────────────────────

async function migrate() {
  console.log();
  console.log(bold("ClaudeMon") + dim(" — migrate hooks to v0.6.0"));
  console.log();

  const settingsPath = join(homedir(), ".claude", "settings.json");
  if (!existsSync(settingsPath)) {
    console.log(red("  No settings.json found. Run: claudemon init"));
    console.log();
    return;
  }

  let settings;
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
  } catch {
    console.log(red("  Error: ") + `${settingsPath} contains invalid JSON.`);
    process.exit(1);
  }

  const hooks = settings.hooks || {};

  // Find API key from existing HTTP hooks
  let key = "";
  for (const groups of Object.values(hooks)) {
    for (const g of groups) {
      for (const h of g.hooks || []) {
        if (h.type === "http" && (h.url || "").includes("claudemon") && h.headers?.Authorization) {
          key = h.headers.Authorization.replace(/^Bearer\s+/i, "");
        }
        if (h.type === "command" && (h.command || "").includes("claudemon")) {
          const match = (h.command || "").match(/Bearer\s+([^\s"']+)/);
          if (match) key = match[1];
        }
      }
    }
  }

  if (!key) {
    console.log(red("  No ClaudeMon API key found in existing hooks."));
    console.log(dim("  Run: claudemon init --key <your-key>"));
    console.log();
    return;
  }

  console.log(dim("  Found API key: ") + key.slice(0, 8) + "...");

  // Remove ALL old claudemon hooks (both HTTP and command)
  let removedEvents = 0;
  for (const evt of Object.keys(hooks)) {
    const before = hooks[evt].length;
    hooks[evt] = hooks[evt].filter((g) => !g.hooks?.some((h) => (h.url || h.command || "").includes("claudemon")));
    if (hooks[evt].length < before) removedEvents++;
    if (hooks[evt].length === 0) delete hooks[evt];
  }

  // Re-add with new async command hooks for the optimized event set
  await init(key);
  console.log(
    green("  Migrated!") +
      dim(` Removed ${removedEvents} old hook entries, added ${HOOK_EVENTS.length} async command hooks.`),
  );
  console.log();
}

// ── CLI router ─────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];

if (command === "init") {
  const keyIdx = args.indexOf("--key");
  const key = keyIdx !== -1 ? args[keyIdx + 1] : null;
  await init(key);
} else if (command === "status") {
  await status();
} else if (command === "migrate") {
  await migrate();
} else if (command === "--version" || command === "-v") {
  console.log(VERSION);
} else {
  console.log();
  console.log(bold("claudemon") + dim(` v${VERSION}`));
  console.log();
  console.log("  " + bold("claudemon init") + dim("           Set up ClaudeMon hooks"));
  console.log("  " + bold("claudemon init --key") + dim("    Pass API key directly"));
  console.log("  " + bold("claudemon status") + dim("        Check connection status"));
  console.log("  " + bold("claudemon migrate") + dim("       Upgrade hooks to v0.6.0 (HTTP -> async command)"));
  console.log("  " + bold("claudemon --version") + dim("     Show version"));
  console.log();
}
