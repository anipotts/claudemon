#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createInterface } from "node:readline";

const VERSION = "0.6.0";
const API_URL = "https://api.claudemon.com";

// Core monitoring events — the minimal set that captures full session lifecycle.
// All 27 Claude Code hook events — registered for full monitoring + IndexedDB persistence.
// Signal tiers (computed client-side) control UI visibility:
//   Tier 1 (Action):     PermissionRequest, Notification, Elicitation, StopFailure, PostToolUseFailure
//   Tier 2 (Status):     SessionStart, SessionEnd, Stop, UserPromptSubmit, PreToolUse, PostToolUse,
//                         SubagentStart, SubagentStop, PostCompact, PermissionDenied
//   Tier 3 (Background): PreCompact, CwdChanged, FileChanged, ConfigChange, WorktreeCreate,
//                         WorktreeRemove, InstructionsLoaded, Setup
//   Tier 4 (Swarm):      TaskCreated, TaskCompleted, TeammateIdle, ElicitationResult
const HOOK_EVENTS = [
  "SessionStart",
  "SessionEnd",
  "Setup",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "Stop",
  "StopFailure",
  "SubagentStart",
  "SubagentStop",
  "UserPromptSubmit",
  "Notification",
  "PreCompact",
  "PostCompact",
  "PermissionRequest",
  "PermissionDenied",
  "Elicitation",
  "ElicitationResult",
  "TaskCreated",
  "TaskCompleted",
  "TeammateIdle",
  "CwdChanged",
  "FileChanged",
  "ConfigChange",
  "WorktreeCreate",
  "WorktreeRemove",
  "InstructionsLoaded",
];

// Events that get sync hooks for remote approval (opt-in via --remote)
const ACTION_EVENTS = ["PermissionRequest", "Notification", "Elicitation"];

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

// ── Generate encryption key ──────────────────────────────────────

async function generateTransitKey() {
  console.log();
  console.log(bold("ClaudeMon") + dim(" — transit encryption key"));
  console.log();

  const { randomBytes } = await import("node:crypto");
  const key = randomBytes(32).toString("hex");

  // Store locally
  const keyDir = join(homedir(), ".claudemon");
  if (!existsSync(keyDir)) mkdirSync(keyDir, { recursive: true });
  const keyPath = join(keyDir, "transit-key");
  writeFileSync(keyPath, key, { mode: 0o600 });

  console.log(green("  Transit key generated:"));
  console.log();
  console.log(`  ${bold(key)}`);
  console.log();
  console.log(dim("  Paste this key into Settings > Privacy in your ClaudeMon browser."));
  console.log(dim(`  Stored at: ${keyPath}`));
  console.log();

  // If hooks are already configured, add CLAUDEMON_ENCRYPTION_KEY to the hook commands
  const settingsPath = join(homedir(), ".claude", "settings.json");
  if (existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
      let updated = false;
      for (const evt of Object.keys(settings.hooks || {})) {
        for (const g of settings.hooks[evt] || []) {
          for (const h of g.hooks || []) {
            if ((h.command || "").includes("claudemon") && !(h.command || "").includes("CLAUDEMON_ENCRYPTION_KEY")) {
              h.command = `CLAUDEMON_ENCRYPTION_KEY="${key}" ${h.command}`;
              updated = true;
            }
          }
        }
      }
      if (updated) {
        writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
        console.log(green("  +") + ` Updated hooks in ${dim(settingsPath)} with encryption key`);
      }
    } catch {}
  }
  console.log();
}

// ── CLI router ─────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];

if (command === "init") {
  const keyIdx = args.indexOf("--key");
  const key = keyIdx !== -1 ? args[keyIdx + 1] : null;
  const isPrivate = args.includes("--private");
  const isRemote = args.includes("--remote");
  await init(key);
  if (isPrivate) {
    await generateTransitKey();
  }
  if (isRemote) {
    // Register sync action hooks for remote approval
    const settingsPath = join(homedir(), ".claude", "settings.json");
    try {
      const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
      const actionCmd = `node "${join(homedir(), ".claudemon", "action-hook.js")}" || echo '{}'`;
      const actionHook = {
        type: "command",
        command: `CLAUDEMON_API_URL="${API_URL}" CLAUDE_PLUGIN_OPTION_API_KEY="${key || ""}" ${actionCmd}`,
        timeout: 15,
      };
      const actionEntry = { matcher: "", hooks: [actionHook] };
      for (const evt of ACTION_EVENTS) {
        const groups = settings.hooks[evt] || [];
        // Add sync action hook (doesn't replace async monitoring hook)
        groups.push(actionEntry);
        settings.hooks[evt] = groups;
      }
      writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
      console.log(green("  +") + ` Remote approval hooks added for ${ACTION_EVENTS.join(", ")}`);
      console.log(dim("    Permissions and plans will route to ClaudeMon when browser is connected."));
    } catch {
      console.log(red("  Error adding remote hooks. Run claudemon init first."));
    }
    console.log();
  }
} else if (command === "status") {
  await status();
} else if (command === "migrate") {
  await migrate();
} else if (command === "generate-key") {
  await generateTransitKey();
} else if (command === "--version" || command === "-v") {
  console.log(VERSION);
} else {
  console.log();
  console.log(bold("claudemon") + dim(` v${VERSION}`));
  console.log();
  console.log("  " + bold("claudemon init") + dim("              Set up ClaudeMon hooks"));
  console.log("  " + bold("claudemon init --key") + dim("       Pass API key directly"));
  console.log("  " + bold("claudemon init --private") + dim("   Set up hooks + generate transit encryption key"));
  console.log("  " + bold("claudemon generate-key") + dim("     Generate/rotate transit encryption key"));
  console.log("  " + bold("claudemon status") + dim("           Check connection status"));
  console.log("  " + bold("claudemon migrate") + dim("          Upgrade hooks to v0.6.0"));
  console.log("  " + bold("claudemon --version") + dim("        Show version"));
  console.log();
}
