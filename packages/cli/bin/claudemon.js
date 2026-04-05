#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createInterface } from "node:readline";

const VERSION = "0.5.4";
const API_URL = "https://api.claudemon.com";

// HOOK_EVENTS — duplicated from packages/types/monitor.ts (can't import TS at runtime)
// Keep in sync! Currently 27 events. Run `node -e "import('./packages/types/monitor.ts')"` won't work,
// but you can compare: grep -c "'" packages/cli/bin/claudemon.js vs grep -c "|" packages/types/monitor.ts
const HOOK_EVENTS = [
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "Stop",
  "StopFailure",
  "Notification",
  "SessionStart",
  "SessionEnd",
  "SubagentStart",
  "SubagentStop",
  "PreCompact",
  "PostCompact",
  "UserPromptSubmit",
  "PermissionRequest",
  "PermissionDenied",
  "TaskCreated",
  "TaskCompleted",
  "TeammateIdle",
  "CwdChanged",
  "FileChanged",
  "ConfigChange",
  "WorktreeCreate",
  "WorktreeRemove",
  "InstructionsLoaded",
  "Elicitation",
  "ElicitationResult",
  "Setup",
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

function quoteForShell(val) {
  return "'" + val.replace(/'/g, "'\\''") + "'";
}

function detectRcFile() {
  const shell = process.env.SHELL || "";
  if (shell.includes("fish")) {
    const p = join(homedir(), ".config", "fish", "config.fish");
    if (existsSync(p)) return p;
    // fish users without config.fish yet — create it
    return p;
  }
  if (shell.includes("zsh")) {
    return join(homedir(), ".zshrc");
  }
  for (const f of [".bashrc", ".bash_profile"]) {
    const p = join(homedir(), f);
    if (existsSync(p)) return p;
  }
  return join(homedir(), ".bashrc");
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
    } catch (e) {
      console.log(red("  Error: ") + `${settingsPath} contains invalid JSON.`);
      console.log(dim("  Fix the file manually, then re-run claudemon init."));
      process.exit(1);
    }
  }

  const hook = {
    type: "http",
    url: `${API_URL}/events`,
    headers: { Authorization: "Bearer $CLAUDEMON_API_KEY" },
    allowedEnvVars: ["CLAUDEMON_API_KEY"],
    timeout: 3,
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

  // 3. Set env var in shell rc
  const rcFile = detectRcFile();
  const rcDir = join(rcFile, "..");
  if (!existsSync(rcDir)) mkdirSync(rcDir, { recursive: true });

  const exportLine = `export CLAUDEMON_API_KEY=${quoteForShell(key)}`;

  if (existsSync(rcFile)) {
    let content = readFileSync(rcFile, "utf-8");
    if (/CLAUDEMON_API_KEY=/.test(content)) {
      content = content.replace(/^.*CLAUDEMON_API_KEY=.*$/gm, () => exportLine);
    } else {
      content = content.trimEnd() + "\n" + exportLine + "\n";
    }
    writeFileSync(rcFile, content);
  } else {
    writeFileSync(rcFile, exportLine + "\n");
  }
  console.log(green("  +") + ` API key saved to ${dim(rcFile)}`);

  // Done
  console.log();
  console.log(green("  Done!") + " Restart your terminal, then open Claude Code.");
  console.log(dim("  Sessions will appear at https://app.claudemon.com"));
  console.log();
}

// ── CLI router ─────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];

if (command === "init") {
  const keyIdx = args.indexOf("--key");
  const key = keyIdx !== -1 ? args[keyIdx + 1] : null;
  await init(key);
} else if (command === "--version" || command === "-v") {
  console.log(VERSION);
} else {
  console.log();
  console.log(bold("claudemon") + dim(` v${VERSION}`));
  console.log();
  console.log("  " + bold("claudemon init") + dim("          Set up ClaudeMon hooks"));
  console.log("  " + bold("claudemon init --key") + dim("   Pass API key directly"));
  console.log("  " + bold("claudemon --version") + dim("    Show version"));
  console.log();
}
