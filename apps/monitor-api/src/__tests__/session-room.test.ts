import { describe, it, expect } from "vitest";
import { TOOL_CATEGORIES } from "../../../../packages/types/monitor";
import type { MonitorEvent, SessionState } from "../../../../packages/types/monitor";

// ---------------------------------------------------------------------------
// Test harness: mirrors the processEvent logic from session-room.ts
// without requiring Durable Object instantiation.
// ---------------------------------------------------------------------------

const MAX_EVENTS = 200;

function createTestSession(overrides?: Partial<SessionState>): SessionState {
  return {
    session_id: "s1",
    machine_id: "test-machine",
    project_name: "test-project",
    project_path: "/test/project",
    status: "thinking",
    started_at: Date.now(),
    last_event_at: Date.now(),
    edit_count: 0,
    command_count: 0,
    read_count: 0,
    search_count: 0,
    error_count: 0,
    compaction_count: 0,
    permission_denied_count: 0,
    files_touched: [],
    commands_run: [],
    events: [],
    subagents: [],
    source: "local",
    ...overrides,
  };
}

function makeEvent(overrides: Partial<MonitorEvent> & Pick<MonitorEvent, "hook_event_name">): MonitorEvent {
  return {
    session_id: "s1",
    machine_id: "test-machine",
    project_path: "/test/project",
    timestamp: Date.now(),
    ...overrides,
  };
}

/**
 * Replicates the processEvent method from SessionRoom (session-room.ts).
 * Returns the updated session, or null if the event was skipped.
 */
function processEvent(sessions: Map<string, SessionState>, event: MonitorEvent): SessionState | null {
  const { session_id } = event;

  // Ghost prevention
  if (!session_id || session_id.startsWith("unknown")) return null;

  // Auto-cleanup: mark sessions idle for 10+ minutes as offline
  const now = Date.now();
  for (const [_id, s] of sessions) {
    if (now - s.last_event_at > 600000 && s.status !== "done" && s.status !== "offline") {
      s.status = "offline";
    }
  }

  let session = sessions.get(session_id);
  if (!session) {
    session = {
      session_id,
      machine_id: event.machine_id,
      project_name: event.project_path.split("/").pop() || "unknown",
      project_path: event.project_path,
      branch: event.branch,
      model: event.model,
      permission_mode: event.permission_mode,
      transcript_path: event.transcript_path,
      cwd: event.cwd,
      status: "thinking",
      started_at: event.timestamp,
      last_event_at: event.timestamp,
      edit_count: 0,
      command_count: 0,
      read_count: 0,
      search_count: 0,
      events: [],
      subagents: [],
      error_count: 0,
      compaction_count: 0,
      permission_denied_count: 0,
      files_touched: [],
      commands_run: [],
      source: "local",
    };
    sessions.set(session_id, session);
  }

  session.last_event_at = event.timestamp;
  if (event.model) session.model = event.model;
  if (event.permission_mode) session.permission_mode = event.permission_mode;
  if (event.cwd) session.cwd = event.cwd;
  if (event.transcript_path) session.transcript_path = event.transcript_path;
  if (event.branch) session.branch = event.branch;

  switch (event.hook_event_name) {
    case "PreToolUse":
      session.status = "working";
      break;
    case "PostToolUse":
    case "PostToolUseFailure":
      session.status = "thinking";
      if (event.tool_name) {
        if (TOOL_CATEGORIES.edits.has(event.tool_name)) session.edit_count++;
        if (TOOL_CATEGORIES.commands.has(event.tool_name)) session.command_count++;
        if (TOOL_CATEGORIES.reads.has(event.tool_name)) session.read_count++;
        if (TOOL_CATEGORIES.searches.has(event.tool_name)) session.search_count++;
      }
      break;
    case "Notification":
      session.status = "waiting";
      break;
    case "Stop":
      session.status = "done";
      break;
    case "StopFailure":
      session.status = "error";
      break;
    case "SessionEnd":
      session.status = "offline";
      break;
    case "SessionStart":
      session.status = "thinking";
      session.edit_count = 0;
      session.command_count = 0;
      session.read_count = 0;
      session.search_count = 0;
      session.error_count = 0;
      session.compaction_count = 0;
      session.permission_denied_count = 0;
      session.files_touched = [];
      session.commands_run = [];
      session.tool_rate = undefined;
      session.error_rate = undefined;
      session.notification_message = undefined;
      session.end_reason = undefined;
      session.compact_summary = undefined;
      session.events = [];
      session.started_at = event.timestamp;
      if (event.source) session.session_source = event.source as any;
      if (event.model) session.model = event.model;
      if (event.permission_mode) session.permission_mode = event.permission_mode;
      if (event.transcript_path) session.transcript_path = event.transcript_path;
      if (event.agent_type) session.agent_type = event.agent_type;
      break;
    case "SubagentStart":
      if (event.agent_id) {
        session.subagents.push({
          session_id: event.agent_id,
          machine_id: session.machine_id,
          project_name: session.project_name,
          project_path: session.project_path,
          branch: session.branch,
          status: "working",
          started_at: event.timestamp,
          last_event_at: event.timestamp,
          edit_count: 0,
          command_count: 0,
          read_count: 0,
          search_count: 0,
          error_count: 0,
          compaction_count: 0,
          permission_denied_count: 0,
          files_touched: [],
          commands_run: [],
          events: [],
          parent_session_id: session_id,
          agent_type: event.agent_type,
          subagents: [],
          source: session.source,
        });
      }
      break;
    case "SubagentStop":
      if (event.agent_id) {
        const sub = session.subagents.find((s) => s.session_id === event.agent_id);
        if (sub) sub.status = "done";
      }
      break;
    case "PreCompact":
      session.status = "working";
      break;
    case "PostCompact":
      session.status = "thinking";
      session.compaction_count++;
      if (event.compact_summary) {
        session.compact_summary = event.compact_summary;
      }
      break;
    case "UserPromptSubmit":
      session.status = "working";
      break;
    case "PermissionRequest":
      session.status = "waiting";
      break;
    case "PermissionDenied":
      session.permission_denied_count++;
      break;
    case "CwdChanged":
      if (event.new_cwd) {
        session.cwd = event.new_cwd;
      }
      break;
    case "FileChanged":
      if (event.file_path) {
        const fp = event.file_path;
        if (!session.files_touched.includes(fp)) {
          session.files_touched.push(fp);
        }
      }
      break;
  }

  // Notification fields
  if (event.hook_event_name === "Notification") {
    if (event.notification_message) session.notification_message = event.notification_message;
  }

  // End reason
  if (event.hook_event_name === "SessionEnd") {
    if (event.end_reason) session.end_reason = event.end_reason;
  }

  // Track files touched from Edit/Write tool_input
  if (event.tool_name && (event.tool_name === "Edit" || event.tool_name === "Write") && event.tool_input?.file_path) {
    const fp = event.tool_input.file_path as string;
    if (!session.files_touched.includes(fp)) {
      session.files_touched.push(fp);
    }
  }

  // Track bash commands
  if (event.tool_name === "Bash" && event.tool_input?.command) {
    session.commands_run.push((event.tool_input.command as string).slice(0, 100));
    if (session.commands_run.length > 20) session.commands_run = session.commands_run.slice(-20);
  }

  // Error tracking
  if (event.hook_event_name === "PostToolUseFailure") {
    session.error_count++;
  }

  // Compute derived rates
  const elapsed = (event.timestamp - session.started_at) / 60000;
  if (elapsed > 0) {
    const totalTools = session.edit_count + session.command_count + session.read_count + session.search_count;
    session.tool_rate = Math.round((totalTools / elapsed) * 10) / 10;
    session.error_rate = totalTools > 0 ? Math.round((session.error_count / totalTools) * 100) / 100 : 0;
  }

  // Deduplicate Pre/Post via tool_use_id
  if (event.hook_event_name === "PostToolUse" && event.tool_use_id) {
    const idx = session.events.findIndex(
      (e) => e.tool_use_id === event.tool_use_id && e.hook_event_name === "PreToolUse",
    );
    if (idx >= 0) {
      session.events[idx].tool_response = event.tool_response;
      session.events[idx].hook_event_name = "PostToolUse";
      return session;
    }
  }

  // Ring buffer
  session.events.push(event);
  if (session.events.length > MAX_EVENTS) {
    session.events = session.events.slice(-MAX_EVENTS);
  }

  return session;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("processEvent — ghost prevention", () => {
  it("skips events with missing session_id", () => {
    const sessions = new Map<string, SessionState>();
    const event = makeEvent({ hook_event_name: "PreToolUse", session_id: "" });
    const result = processEvent(sessions, event);
    expect(result).toBeNull();
    expect(sessions.size).toBe(0);
  });

  it("skips events with session_id starting with 'unknown'", () => {
    const sessions = new Map<string, SessionState>();
    const event = makeEvent({ hook_event_name: "PreToolUse", session_id: "unknown-abc-123" });
    const result = processEvent(sessions, event);
    expect(result).toBeNull();
    expect(sessions.size).toBe(0);
  });

  it("skips session_id that is exactly 'unknown'", () => {
    const sessions = new Map<string, SessionState>();
    const event = makeEvent({ hook_event_name: "PreToolUse", session_id: "unknown" });
    const result = processEvent(sessions, event);
    expect(result).toBeNull();
  });
});

describe("processEvent — session creation", () => {
  it("creates a new session when session_id is not in the map", () => {
    const sessions = new Map<string, SessionState>();
    const event = makeEvent({
      hook_event_name: "SessionStart",
      session_id: "new-session",
      project_path: "/home/user/my-project",
    });
    processEvent(sessions, event);
    expect(sessions.has("new-session")).toBe(true);
    const session = sessions.get("new-session")!;
    expect(session.project_name).toBe("my-project");
    expect(session.status).toBe("thinking");
    expect(session.source).toBe("local");
  });

  it("derives project_name from project_path", () => {
    const sessions = new Map<string, SessionState>();
    const event = makeEvent({
      hook_event_name: "PreToolUse",
      session_id: "s1",
      project_path: "/Users/dev/Code/claudemon",
    });
    processEvent(sessions, event);
    expect(sessions.get("s1")!.project_name).toBe("claudemon");
  });

  it("sets project_name to 'unknown' when project_path has no segments", () => {
    const sessions = new Map<string, SessionState>();
    const event = makeEvent({
      hook_event_name: "PreToolUse",
      session_id: "s1",
      project_path: "",
    });
    processEvent(sessions, event);
    expect(sessions.get("s1")!.project_name).toBe("unknown");
  });
});

describe("processEvent — status derivation", () => {
  it("PreToolUse sets status to 'working'", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(sessions, makeEvent({ hook_event_name: "PreToolUse" }));
    expect(sessions.get("s1")!.status).toBe("working");
  });

  it("PostToolUse sets status to 'thinking'", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession({ status: "working" }));
    processEvent(sessions, makeEvent({ hook_event_name: "PostToolUse" }));
    expect(sessions.get("s1")!.status).toBe("thinking");
  });

  it("PostToolUseFailure sets status to 'thinking'", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession({ status: "working" }));
    processEvent(sessions, makeEvent({ hook_event_name: "PostToolUseFailure" }));
    expect(sessions.get("s1")!.status).toBe("thinking");
  });

  it("Notification sets status to 'waiting'", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(sessions, makeEvent({ hook_event_name: "Notification" }));
    expect(sessions.get("s1")!.status).toBe("waiting");
  });

  it("Stop sets status to 'done'", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(sessions, makeEvent({ hook_event_name: "Stop" }));
    expect(sessions.get("s1")!.status).toBe("done");
  });

  it("StopFailure sets status to 'error'", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(sessions, makeEvent({ hook_event_name: "StopFailure" }));
    expect(sessions.get("s1")!.status).toBe("error");
  });

  it("SessionEnd sets status to 'offline'", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(sessions, makeEvent({ hook_event_name: "SessionEnd" }));
    expect(sessions.get("s1")!.status).toBe("offline");
  });

  it("PreCompact sets status to 'working'", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(sessions, makeEvent({ hook_event_name: "PreCompact" }));
    expect(sessions.get("s1")!.status).toBe("working");
  });

  it("PostCompact sets status to 'thinking' and increments compaction_count", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession({ compaction_count: 2 }));
    processEvent(sessions, makeEvent({ hook_event_name: "PostCompact" }));
    const s = sessions.get("s1")!;
    expect(s.status).toBe("thinking");
    expect(s.compaction_count).toBe(3);
  });

  it("UserPromptSubmit sets status to 'working'", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(sessions, makeEvent({ hook_event_name: "UserPromptSubmit" }));
    expect(sessions.get("s1")!.status).toBe("working");
  });

  it("PermissionRequest sets status to 'waiting'", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(sessions, makeEvent({ hook_event_name: "PermissionRequest" }));
    expect(sessions.get("s1")!.status).toBe("waiting");
  });

  it("PermissionDenied increments permission_denied_count", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession({ permission_denied_count: 1 }));
    processEvent(sessions, makeEvent({ hook_event_name: "PermissionDenied" }));
    expect(sessions.get("s1")!.permission_denied_count).toBe(2);
  });
});

describe("processEvent — SessionStart reset", () => {
  it("resets all counters to 0", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set(
      "s1",
      createTestSession({
        edit_count: 10,
        command_count: 5,
        read_count: 3,
        search_count: 2,
        error_count: 4,
        compaction_count: 1,
        permission_denied_count: 2,
      }),
    );
    const ts = Date.now();
    processEvent(sessions, makeEvent({ hook_event_name: "SessionStart", timestamp: ts }));
    const s = sessions.get("s1")!;
    expect(s.edit_count).toBe(0);
    expect(s.command_count).toBe(0);
    expect(s.read_count).toBe(0);
    expect(s.search_count).toBe(0);
    expect(s.error_count).toBe(0);
    expect(s.compaction_count).toBe(0);
    expect(s.permission_denied_count).toBe(0);
  });

  it("clears events, files_touched, and commands_run", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set(
      "s1",
      createTestSession({
        events: [makeEvent({ hook_event_name: "PreToolUse" })],
        files_touched: ["/a.ts", "/b.ts"],
        commands_run: ["ls", "pwd"],
      }),
    );
    processEvent(sessions, makeEvent({ hook_event_name: "SessionStart" }));
    const s = sessions.get("s1")!;
    // After SessionStart, only the SessionStart event itself is in the buffer
    expect(s.events).toHaveLength(1);
    expect(s.events[0].hook_event_name).toBe("SessionStart");
    expect(s.files_touched).toHaveLength(0);
    expect(s.commands_run).toHaveLength(0);
  });

  it("updates started_at to the SessionStart event timestamp", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession({ started_at: 1000 }));
    const ts = 99999;
    processEvent(sessions, makeEvent({ hook_event_name: "SessionStart", timestamp: ts }));
    expect(sessions.get("s1")!.started_at).toBe(ts);
  });

  it("clears derived rate fields", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set(
      "s1",
      createTestSession({
        tool_rate: 5.0,
        error_rate: 0.1,
        notification_message: "old msg",
        end_reason: "timeout",
        compact_summary: "old summary",
      }),
    );
    processEvent(sessions, makeEvent({ hook_event_name: "SessionStart" }));
    const s = sessions.get("s1")!;
    expect(s.tool_rate).toBeUndefined();
    expect(s.error_rate).toBeUndefined();
    expect(s.notification_message).toBeUndefined();
    expect(s.end_reason).toBeUndefined();
    expect(s.compact_summary).toBeUndefined();
  });

  it("captures session_source from event.source", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(sessions, makeEvent({ hook_event_name: "SessionStart", source: "resume" }));
    expect(sessions.get("s1")!.session_source).toBe("resume");
  });

  it("captures model and permission_mode from SessionStart", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(
      sessions,
      makeEvent({ hook_event_name: "SessionStart", model: "claude-opus-4-20250514", permission_mode: "auto-approve" }),
    );
    const s = sessions.get("s1")!;
    expect(s.model).toBe("claude-opus-4-20250514");
    expect(s.permission_mode).toBe("auto-approve");
  });
});

describe("processEvent — tool categorization", () => {
  it("Edit increments edit_count", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(sessions, makeEvent({ hook_event_name: "PostToolUse", tool_name: "Edit" }));
    expect(sessions.get("s1")!.edit_count).toBe(1);
  });

  it("Write increments edit_count", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(sessions, makeEvent({ hook_event_name: "PostToolUse", tool_name: "Write" }));
    expect(sessions.get("s1")!.edit_count).toBe(1);
  });

  it("NotebookEdit increments edit_count", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(sessions, makeEvent({ hook_event_name: "PostToolUse", tool_name: "NotebookEdit" }));
    expect(sessions.get("s1")!.edit_count).toBe(1);
  });

  it("Bash increments command_count", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(sessions, makeEvent({ hook_event_name: "PostToolUse", tool_name: "Bash" }));
    expect(sessions.get("s1")!.command_count).toBe(1);
  });

  it("Read increments read_count", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(sessions, makeEvent({ hook_event_name: "PostToolUse", tool_name: "Read" }));
    expect(sessions.get("s1")!.read_count).toBe(1);
  });

  it("Grep increments search_count", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(sessions, makeEvent({ hook_event_name: "PostToolUse", tool_name: "Grep" }));
    expect(sessions.get("s1")!.search_count).toBe(1);
  });

  it("Glob increments search_count", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(sessions, makeEvent({ hook_event_name: "PostToolUse", tool_name: "Glob" }));
    expect(sessions.get("s1")!.search_count).toBe(1);
  });

  it("PostToolUseFailure also categorizes the tool", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(sessions, makeEvent({ hook_event_name: "PostToolUseFailure", tool_name: "Edit" }));
    expect(sessions.get("s1")!.edit_count).toBe(1);
  });

  it("unknown tool_name does not increment any counter", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(sessions, makeEvent({ hook_event_name: "PostToolUse", tool_name: "CustomTool" }));
    const s = sessions.get("s1")!;
    expect(s.edit_count).toBe(0);
    expect(s.command_count).toBe(0);
    expect(s.read_count).toBe(0);
    expect(s.search_count).toBe(0);
  });
});

describe("processEvent — file tracking", () => {
  it("Edit with file_path in tool_input adds to files_touched", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(
      sessions,
      makeEvent({
        hook_event_name: "PostToolUse",
        tool_name: "Edit",
        tool_input: { file_path: "/src/index.ts" },
      }),
    );
    expect(sessions.get("s1")!.files_touched).toContain("/src/index.ts");
  });

  it("Write with file_path in tool_input adds to files_touched", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(
      sessions,
      makeEvent({
        hook_event_name: "PostToolUse",
        tool_name: "Write",
        tool_input: { file_path: "/src/new.ts" },
      }),
    );
    expect(sessions.get("s1")!.files_touched).toContain("/src/new.ts");
  });

  it("duplicate file_path is NOT added again", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession({ files_touched: ["/src/index.ts"] }));
    processEvent(
      sessions,
      makeEvent({
        hook_event_name: "PostToolUse",
        tool_name: "Edit",
        tool_input: { file_path: "/src/index.ts" },
      }),
    );
    expect(sessions.get("s1")!.files_touched).toEqual(["/src/index.ts"]);
  });

  it("FileChanged with file_path adds to files_touched", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(sessions, makeEvent({ hook_event_name: "FileChanged", file_path: "/src/changed.ts" }));
    expect(sessions.get("s1")!.files_touched).toContain("/src/changed.ts");
  });

  it("FileChanged deduplicates file_path", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession({ files_touched: ["/src/changed.ts"] }));
    processEvent(sessions, makeEvent({ hook_event_name: "FileChanged", file_path: "/src/changed.ts" }));
    expect(sessions.get("s1")!.files_touched).toEqual(["/src/changed.ts"]);
  });

  it("Bash tool does NOT add to files_touched", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(
      sessions,
      makeEvent({
        hook_event_name: "PostToolUse",
        tool_name: "Bash",
        tool_input: { file_path: "/src/whatever.ts", command: "ls" },
      }),
    );
    expect(sessions.get("s1")!.files_touched).toHaveLength(0);
  });
});

describe("processEvent — command tracking", () => {
  it("Bash with command in tool_input adds to commands_run", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(
      sessions,
      makeEvent({
        hook_event_name: "PostToolUse",
        tool_name: "Bash",
        tool_input: { command: "npm test" },
      }),
    );
    expect(sessions.get("s1")!.commands_run).toContain("npm test");
  });

  it("truncates commands longer than 100 characters", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    const longCmd = "x".repeat(200);
    processEvent(
      sessions,
      makeEvent({
        hook_event_name: "PostToolUse",
        tool_name: "Bash",
        tool_input: { command: longCmd },
      }),
    );
    expect(sessions.get("s1")!.commands_run[0]).toHaveLength(100);
  });

  it("commands_run ring buffer: max 20, oldest dropped", () => {
    const sessions = new Map<string, SessionState>();
    const existing = Array.from({ length: 20 }, (_, i) => `cmd-${i}`);
    sessions.set("s1", createTestSession({ commands_run: existing }));
    processEvent(
      sessions,
      makeEvent({
        hook_event_name: "PostToolUse",
        tool_name: "Bash",
        tool_input: { command: "cmd-new" },
      }),
    );
    const cmds = sessions.get("s1")!.commands_run;
    expect(cmds).toHaveLength(20);
    expect(cmds[0]).toBe("cmd-1"); // cmd-0 dropped
    expect(cmds[19]).toBe("cmd-new");
  });
});

describe("processEvent — derived rates", () => {
  it("computes tool_rate as total tools / elapsed minutes", () => {
    const sessions = new Map<string, SessionState>();
    const startTime = Date.now() - 120000; // 2 minutes ago
    sessions.set("s1", createTestSession({ started_at: startTime, edit_count: 3, command_count: 3 }));
    processEvent(
      sessions,
      makeEvent({
        hook_event_name: "PostToolUse",
        tool_name: "Read",
        timestamp: Date.now(),
      }),
    );
    const s = sessions.get("s1")!;
    // 3 edits + 3 commands + 1 read = 7 tools over ~2 minutes
    expect(s.tool_rate).toBeGreaterThan(0);
    expect(s.tool_rate).toBeTypeOf("number");
  });

  it("computes error_rate as errors / total tools", () => {
    const sessions = new Map<string, SessionState>();
    const startTime = Date.now() - 60000;
    sessions.set("s1", createTestSession({ started_at: startTime, edit_count: 9 }));
    processEvent(
      sessions,
      makeEvent({
        hook_event_name: "PostToolUseFailure",
        tool_name: "Edit",
        timestamp: Date.now(),
      }),
    );
    const s = sessions.get("s1")!;
    // 10 edits, 1 error => error_rate = 0.1
    expect(s.error_rate).toBe(0.1);
  });

  it("error_rate is 0 when no tools have been used", () => {
    const sessions = new Map<string, SessionState>();
    const startTime = Date.now() - 60000;
    sessions.set("s1", createTestSession({ started_at: startTime }));
    processEvent(
      sessions,
      makeEvent({
        hook_event_name: "Notification",
        timestamp: Date.now(),
      }),
    );
    const s = sessions.get("s1")!;
    expect(s.error_rate).toBe(0);
  });
});

describe("processEvent — event ring buffer", () => {
  it("caps events at MAX_EVENTS (200)", () => {
    const sessions = new Map<string, SessionState>();
    const existingEvents = Array.from({ length: 200 }, (_, i) =>
      makeEvent({ hook_event_name: "PreToolUse", timestamp: i }),
    );
    sessions.set("s1", createTestSession({ events: existingEvents }));
    processEvent(sessions, makeEvent({ hook_event_name: "Notification", timestamp: 9999 }));
    const s = sessions.get("s1")!;
    expect(s.events).toHaveLength(200);
    // The oldest event (timestamp 0) was dropped
    expect(s.events[0].timestamp).toBe(1);
    // The newest event is our Notification
    expect(s.events[199].hook_event_name).toBe("Notification");
  });
});

describe("processEvent — idle detection", () => {
  it("marks sessions idle for 10+ minutes as offline", () => {
    const sessions = new Map<string, SessionState>();
    const staleTime = Date.now() - 700000; // 11+ minutes ago
    sessions.set(
      "stale-session",
      createTestSession({
        session_id: "stale-session",
        status: "thinking",
        last_event_at: staleTime,
      }),
    );
    // Process an event for a different session to trigger the idle check
    processEvent(sessions, makeEvent({ hook_event_name: "PreToolUse", session_id: "other-session" }));
    expect(sessions.get("stale-session")!.status).toBe("offline");
  });

  it("does NOT re-mark sessions already 'done' as offline", () => {
    const sessions = new Map<string, SessionState>();
    const staleTime = Date.now() - 700000;
    sessions.set(
      "done-session",
      createTestSession({
        session_id: "done-session",
        status: "done",
        last_event_at: staleTime,
      }),
    );
    processEvent(sessions, makeEvent({ hook_event_name: "PreToolUse", session_id: "other-session" }));
    expect(sessions.get("done-session")!.status).toBe("done");
  });

  it("does NOT re-mark sessions already 'offline'", () => {
    const sessions = new Map<string, SessionState>();
    const staleTime = Date.now() - 700000;
    sessions.set(
      "offline-session",
      createTestSession({
        session_id: "offline-session",
        status: "offline",
        last_event_at: staleTime,
      }),
    );
    processEvent(sessions, makeEvent({ hook_event_name: "PreToolUse", session_id: "other-session" }));
    expect(sessions.get("offline-session")!.status).toBe("offline");
  });
});

describe("processEvent — SubagentStart", () => {
  it("creates a new subagent entry", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(sessions, makeEvent({ hook_event_name: "SubagentStart", agent_id: "agent-1", agent_type: "task" }));
    const s = sessions.get("s1")!;
    expect(s.subagents).toHaveLength(1);
    expect(s.subagents[0].session_id).toBe("agent-1");
    expect(s.subagents[0].status).toBe("working");
    expect(s.subagents[0].agent_type).toBe("task");
  });

  it("subagent has correct parent_session_id", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession({ session_id: "s1" }));
    processEvent(sessions, makeEvent({ hook_event_name: "SubagentStart", session_id: "s1", agent_id: "agent-1" }));
    expect(sessions.get("s1")!.subagents[0].parent_session_id).toBe("s1");
  });

  it("inherits machine_id and project_name from parent", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession({ machine_id: "m1", project_name: "proj" }));
    processEvent(sessions, makeEvent({ hook_event_name: "SubagentStart", agent_id: "agent-1" }));
    const sub = sessions.get("s1")!.subagents[0];
    expect(sub.machine_id).toBe("m1");
    expect(sub.project_name).toBe("proj");
  });

  it("does not create subagent when agent_id is missing", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(sessions, makeEvent({ hook_event_name: "SubagentStart" }));
    expect(sessions.get("s1")!.subagents).toHaveLength(0);
  });
});

describe("processEvent — SubagentStop", () => {
  it("sets subagent status to 'done'", () => {
    const sessions = new Map<string, SessionState>();
    const sub = createTestSession({ session_id: "agent-1", status: "working", parent_session_id: "s1" });
    sessions.set("s1", createTestSession({ subagents: [sub] }));
    processEvent(sessions, makeEvent({ hook_event_name: "SubagentStop", agent_id: "agent-1" }));
    expect(sessions.get("s1")!.subagents[0].status).toBe("done");
  });

  it("does nothing if agent_id does not match any subagent", () => {
    const sessions = new Map<string, SessionState>();
    const sub = createTestSession({ session_id: "agent-1", status: "working" });
    sessions.set("s1", createTestSession({ subagents: [sub] }));
    processEvent(sessions, makeEvent({ hook_event_name: "SubagentStop", agent_id: "agent-999" }));
    expect(sessions.get("s1")!.subagents[0].status).toBe("working");
  });
});

describe("processEvent — tool dedup (PreToolUse + PostToolUse merge)", () => {
  it("PostToolUse with matching tool_use_id merges into PreToolUse event", () => {
    const sessions = new Map<string, SessionState>();
    const preEvent = makeEvent({
      hook_event_name: "PreToolUse",
      tool_use_id: "tu-123",
      tool_name: "Edit",
    });
    sessions.set("s1", createTestSession({ events: [preEvent] }));

    processEvent(
      sessions,
      makeEvent({
        hook_event_name: "PostToolUse",
        tool_use_id: "tu-123",
        tool_name: "Edit",
        tool_response: { success: true },
      }),
    );

    const s = sessions.get("s1")!;
    // The PreToolUse event was merged — only one event in the buffer
    expect(s.events).toHaveLength(1);
    expect(s.events[0].hook_event_name).toBe("PostToolUse");
    expect(s.events[0].tool_response).toEqual({ success: true });
    expect(s.events[0].tool_use_id).toBe("tu-123");
  });

  it("PostToolUse without matching tool_use_id is added as new event", () => {
    const sessions = new Map<string, SessionState>();
    const preEvent = makeEvent({
      hook_event_name: "PreToolUse",
      tool_use_id: "tu-111",
    });
    sessions.set("s1", createTestSession({ events: [preEvent] }));

    processEvent(
      sessions,
      makeEvent({
        hook_event_name: "PostToolUse",
        tool_use_id: "tu-222",
        tool_name: "Read",
      }),
    );

    const s = sessions.get("s1")!;
    expect(s.events).toHaveLength(2);
  });

  it("PostToolUse without tool_use_id is added as new event", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession({ events: [] }));
    processEvent(sessions, makeEvent({ hook_event_name: "PostToolUse", tool_name: "Read" }));
    expect(sessions.get("s1")!.events).toHaveLength(1);
  });
});

describe("processEvent — Notification fields", () => {
  it("stores notification_message on the session", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(sessions, makeEvent({ hook_event_name: "Notification", notification_message: "Task complete" }));
    expect(sessions.get("s1")!.notification_message).toBe("Task complete");
  });
});

describe("processEvent — SessionEnd fields", () => {
  it("stores end_reason on the session", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(sessions, makeEvent({ hook_event_name: "SessionEnd", end_reason: "user_exit" }));
    expect(sessions.get("s1")!.end_reason).toBe("user_exit");
  });
});

describe("processEvent — PostToolUseFailure error tracking", () => {
  it("increments error_count on PostToolUseFailure", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession({ error_count: 0 }));
    processEvent(sessions, makeEvent({ hook_event_name: "PostToolUseFailure", tool_name: "Bash" }));
    expect(sessions.get("s1")!.error_count).toBe(1);
  });
});

describe("processEvent — CwdChanged", () => {
  it("updates session cwd from new_cwd", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession({ cwd: "/old/path" }));
    processEvent(sessions, makeEvent({ hook_event_name: "CwdChanged", new_cwd: "/new/path" }));
    expect(sessions.get("s1")!.cwd).toBe("/new/path");
  });
});

describe("processEvent — PostCompact compact_summary", () => {
  it("stores compact_summary on the session", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(sessions, makeEvent({ hook_event_name: "PostCompact", compact_summary: "Compacted 2k tokens" }));
    expect(sessions.get("s1")!.compact_summary).toBe("Compacted 2k tokens");
  });
});

describe("processEvent — metadata propagation", () => {
  it("updates model when present in event", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession({ model: "old-model" }));
    processEvent(sessions, makeEvent({ hook_event_name: "PreToolUse", model: "claude-opus-4-20250514" }));
    expect(sessions.get("s1")!.model).toBe("claude-opus-4-20250514");
  });

  it("updates branch when present in event", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession());
    processEvent(sessions, makeEvent({ hook_event_name: "PreToolUse", branch: "feature/new" }));
    expect(sessions.get("s1")!.branch).toBe("feature/new");
  });

  it("updates last_event_at on every event", () => {
    const sessions = new Map<string, SessionState>();
    sessions.set("s1", createTestSession({ last_event_at: 1000 }));
    const ts = 50000;
    processEvent(sessions, makeEvent({ hook_event_name: "PreToolUse", timestamp: ts }));
    expect(sessions.get("s1")!.last_event_at).toBe(ts);
  });
});

// ---------------------------------------------------------------------------
// Action Bridge — message routing logic
//
// The SessionRoom Durable Object manages an action bridge that routes
// sync hook events (PermissionRequest, Notification, Elicitation) to
// browser clients for approval/denial. These tests validate the routing
// logic by simulating the webSocketMessage handler behavior.
// ---------------------------------------------------------------------------

/**
 * Minimal mock WebSocket for action bridge testing.
 * Captures sent messages for assertion.
 */
class MockWebSocket {
  sent: string[] = [];
  closed = false;
  tags: string[];

  constructor(tags: string[] = []) {
    this.tags = tags;
  }

  send(data: string) {
    if (this.closed) throw new Error("WebSocket is closed");
    this.sent.push(data);
  }

  close() {
    this.closed = true;
  }

  lastMessage(): Record<string, unknown> | null {
    if (this.sent.length === 0) return null;
    return JSON.parse(this.sent[this.sent.length - 1]);
  }

  allMessages(): Record<string, unknown>[] {
    return this.sent.map((s) => JSON.parse(s));
  }
}

/**
 * Simulates the action bridge routing logic from SessionRoom.webSocketMessage().
 * This is an extracted version of the message handler that works with mock
 * WebSockets instead of requiring Durable Object infrastructure.
 */
class ActionBridgeHarness {
  pendingActions: Map<
    string,
    {
      id: string;
      session_id: string;
      hook_event_name: string;
      event_data: Record<string, unknown>;
      hookWs: MockWebSocket;
    }
  > = new Map();
  actionHookSockets: Map<string, MockWebSocket> = new Map();
  browserSockets: MockWebSocket[] = [];
  actionSockets: MockWebSocket[] = [];
  uuidCounter = 0;

  addBrowser(): MockWebSocket {
    const ws = new MockWebSocket(["browser"]);
    this.browserSockets.push(ws);
    return ws;
  }

  addActionHook(): MockWebSocket {
    const ws = new MockWebSocket(["action"]);
    this.actionSockets.push(ws);
    return ws;
  }

  generateUUID(): string {
    this.uuidCounter++;
    return `action-${this.uuidCounter}`;
  }

  /**
   * Process a WebSocket message — mirrors SessionRoom.webSocketMessage().
   */
  processMessage(ws: MockWebSocket, data: Record<string, unknown>): void {
    const isAction = ws.tags.includes("action");
    const isBrowser = ws.tags.includes("browser");

    // Ping/pong
    if (data.type === "ping") {
      ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
      return;
    }

    // Action hook sends an event for browser approval
    if (isAction && data.type === "action_request") {
      const id = this.generateUUID();

      if (this.browserSockets.filter((b) => !b.closed).length === 0) {
        ws.send(JSON.stringify({ type: "no_browser" }));
        return;
      }

      const action = {
        id,
        session_id: (data.session_id as string) || "",
        hook_event_name: (data.hook_event_name as string) || "",
        event_data: data,
        hookWs: ws,
      };
      this.pendingActions.set(id, action);
      this.actionHookSockets.set(id, ws);

      const broadcastData = JSON.stringify({
        type: "action_request",
        action: { id, session_id: action.session_id, hook_event_name: action.hook_event_name, event_data: data },
      });
      for (const bws of this.browserSockets) {
        if (!bws.closed) {
          try {
            bws.send(broadcastData);
          } catch {}
        }
      }
      return;
    }

    // Browser sends an action response (approve/deny)
    if (isBrowser && data.type === "action_response") {
      const actionId = data.action_id as string;
      const pending = this.pendingActions.get(actionId);
      if (pending) {
        const hookWs = this.actionHookSockets.get(actionId);
        if (hookWs) {
          try {
            hookWs.send(
              JSON.stringify({
                type: "response",
                hook_response: data.hook_response || {},
              }),
            );
          } catch {}
        }
        this.pendingActions.delete(actionId);
        this.actionHookSockets.delete(actionId);

        // Notify all browsers that the action is resolved
        const resolvedData = JSON.stringify({ type: "action_resolved", action_id: actionId });
        for (const bws of this.browserSockets) {
          if (!bws.closed) {
            try {
              bws.send(resolvedData);
            } catch {}
          }
        }
      }
      return;
    }
  }

  /**
   * Simulate webSocketClose — clean up pending actions for this socket.
   */
  handleClose(ws: MockWebSocket): void {
    for (const [id, hookWs] of this.actionHookSockets) {
      if (hookWs === ws) {
        this.pendingActions.delete(id);
        this.actionHookSockets.delete(id);
      }
    }
  }

  /**
   * Simulate webSocketError — same cleanup as close.
   */
  handleError(ws: MockWebSocket): void {
    this.handleClose(ws);
  }
}

describe("Action Bridge — action_request with no browser sockets", () => {
  it("returns no_browser to hook when no browsers are connected", () => {
    const bridge = new ActionBridgeHarness();
    const hookWs = bridge.addActionHook();

    bridge.processMessage(hookWs, {
      type: "action_request",
      session_id: "s1",
      hook_event_name: "PermissionRequest",
    });

    expect(hookWs.sent).toHaveLength(1);
    const msg = hookWs.lastMessage();
    expect(msg).not.toBeNull();
    expect(msg!.type).toBe("no_browser");
  });

  it("does not create a pending action", () => {
    const bridge = new ActionBridgeHarness();
    const hookWs = bridge.addActionHook();

    bridge.processMessage(hookWs, {
      type: "action_request",
      session_id: "s1",
      hook_event_name: "PermissionRequest",
    });

    expect(bridge.pendingActions.size).toBe(0);
  });

  it("returns no_browser when all browsers have disconnected", () => {
    const bridge = new ActionBridgeHarness();
    const browserWs = bridge.addBrowser();
    browserWs.closed = true; // simulate disconnect
    const hookWs = bridge.addActionHook();

    bridge.processMessage(hookWs, {
      type: "action_request",
      session_id: "s1",
      hook_event_name: "PermissionRequest",
    });

    expect(hookWs.lastMessage()!.type).toBe("no_browser");
  });
});

describe("Action Bridge — action_request with browser connected", () => {
  it("broadcasts action_request to browser with UUID", () => {
    const bridge = new ActionBridgeHarness();
    const browserWs = bridge.addBrowser();
    const hookWs = bridge.addActionHook();

    bridge.processMessage(hookWs, {
      type: "action_request",
      session_id: "s1",
      hook_event_name: "PermissionRequest",
    });

    expect(browserWs.sent).toHaveLength(1);
    const msg = browserWs.lastMessage()!;
    expect(msg.type).toBe("action_request");
    const action = msg.action as Record<string, unknown>;
    expect(action.id).toBe("action-1");
    expect(action.session_id).toBe("s1");
    expect(action.hook_event_name).toBe("PermissionRequest");
  });

  it("creates a pending action entry", () => {
    const bridge = new ActionBridgeHarness();
    bridge.addBrowser();
    const hookWs = bridge.addActionHook();

    bridge.processMessage(hookWs, {
      type: "action_request",
      session_id: "s1",
      hook_event_name: "PermissionRequest",
    });

    expect(bridge.pendingActions.size).toBe(1);
    const pending = bridge.pendingActions.get("action-1")!;
    expect(pending.session_id).toBe("s1");
    expect(pending.hook_event_name).toBe("PermissionRequest");
    expect(pending.hookWs).toBe(hookWs);
  });

  it("stores the hook socket reference for relay", () => {
    const bridge = new ActionBridgeHarness();
    bridge.addBrowser();
    const hookWs = bridge.addActionHook();

    bridge.processMessage(hookWs, {
      type: "action_request",
      session_id: "s1",
      hook_event_name: "PermissionRequest",
    });

    expect(bridge.actionHookSockets.get("action-1")).toBe(hookWs);
  });

  it("broadcasts to multiple browsers", () => {
    const bridge = new ActionBridgeHarness();
    const browser1 = bridge.addBrowser();
    const browser2 = bridge.addBrowser();
    const hookWs = bridge.addActionHook();

    bridge.processMessage(hookWs, {
      type: "action_request",
      session_id: "s1",
      hook_event_name: "Notification",
    });

    expect(browser1.sent).toHaveLength(1);
    expect(browser2.sent).toHaveLength(1);
    // Both receive the same action ID
    expect((browser1.lastMessage()!.action as Record<string, unknown>).id).toBe("action-1");
    expect((browser2.lastMessage()!.action as Record<string, unknown>).id).toBe("action-1");
  });

  it("does not send anything back to the hook socket on broadcast", () => {
    const bridge = new ActionBridgeHarness();
    bridge.addBrowser();
    const hookWs = bridge.addActionHook();

    bridge.processMessage(hookWs, {
      type: "action_request",
      session_id: "s1",
      hook_event_name: "PermissionRequest",
    });

    // Hook socket should not receive any message (it waits for browser response)
    expect(hookWs.sent).toHaveLength(0);
  });
});

describe("Action Bridge — action_response from browser", () => {
  it("relays hook_response to the hook socket", () => {
    const bridge = new ActionBridgeHarness();
    const browserWs = bridge.addBrowser();
    const hookWs = bridge.addActionHook();

    // Hook sends action request
    bridge.processMessage(hookWs, {
      type: "action_request",
      session_id: "s1",
      hook_event_name: "PermissionRequest",
    });

    // Browser responds
    bridge.processMessage(browserWs, {
      type: "action_response",
      action_id: "action-1",
      hook_response: {
        hookSpecificOutput: {
          hookEventName: "PermissionRequest",
          decision: { behavior: "allow" },
        },
      },
    });

    // Hook should receive the response
    expect(hookWs.sent).toHaveLength(1);
    const msg = hookWs.lastMessage()!;
    expect(msg.type).toBe("response");
    const hookResponse = msg.hook_response as Record<string, unknown>;
    const hso = hookResponse.hookSpecificOutput as Record<string, unknown>;
    const decision = hso.decision as Record<string, unknown>;
    expect(decision.behavior).toBe("allow");
  });

  it("broadcasts action_resolved to all browsers", () => {
    const bridge = new ActionBridgeHarness();
    const browser1 = bridge.addBrowser();
    const browser2 = bridge.addBrowser();
    const hookWs = bridge.addActionHook();

    bridge.processMessage(hookWs, {
      type: "action_request",
      session_id: "s1",
      hook_event_name: "Notification",
    });

    // Browser 1 responds
    bridge.processMessage(browser1, {
      type: "action_response",
      action_id: "action-1",
      hook_response: {},
    });

    // Both browsers should receive action_resolved (browser1 gets request + resolved, browser2 gets request + resolved)
    const browser1Msgs = browser1.allMessages();
    const browser2Msgs = browser2.allMessages();

    expect(browser1Msgs).toHaveLength(2); // action_request + action_resolved
    expect(browser1Msgs[1].type).toBe("action_resolved");
    expect(browser1Msgs[1].action_id).toBe("action-1");

    expect(browser2Msgs).toHaveLength(2);
    expect(browser2Msgs[1].type).toBe("action_resolved");
  });

  it("cleans up pending action after response", () => {
    const bridge = new ActionBridgeHarness();
    const browserWs = bridge.addBrowser();
    const hookWs = bridge.addActionHook();

    bridge.processMessage(hookWs, {
      type: "action_request",
      session_id: "s1",
      hook_event_name: "PermissionRequest",
    });
    expect(bridge.pendingActions.size).toBe(1);

    bridge.processMessage(browserWs, {
      type: "action_response",
      action_id: "action-1",
      hook_response: {},
    });

    expect(bridge.pendingActions.size).toBe(0);
    expect(bridge.actionHookSockets.size).toBe(0);
  });

  it("relays empty hook_response as empty object", () => {
    const bridge = new ActionBridgeHarness();
    const browserWs = bridge.addBrowser();
    const hookWs = bridge.addActionHook();

    bridge.processMessage(hookWs, {
      type: "action_request",
      session_id: "s1",
      hook_event_name: "Notification",
    });

    bridge.processMessage(browserWs, {
      type: "action_response",
      action_id: "action-1",
      // no hook_response
    });

    const msg = hookWs.lastMessage()!;
    expect(msg.hook_response).toEqual({});
  });
});

describe("Action Bridge — action_response for unknown action_id", () => {
  it("does nothing when action_id is not in pending actions", () => {
    const bridge = new ActionBridgeHarness();
    const browserWs = bridge.addBrowser();

    bridge.processMessage(browserWs, {
      type: "action_response",
      action_id: "nonexistent-id",
      hook_response: {},
    });

    // No messages sent to browser beyond what was already there
    expect(browserWs.sent).toHaveLength(0);
  });

  it("does not affect existing pending actions", () => {
    const bridge = new ActionBridgeHarness();
    const browserWs = bridge.addBrowser();
    const hookWs = bridge.addActionHook();

    // Create a real pending action
    bridge.processMessage(hookWs, {
      type: "action_request",
      session_id: "s1",
      hook_event_name: "PermissionRequest",
    });

    // Try to respond to a different action_id
    bridge.processMessage(browserWs, {
      type: "action_response",
      action_id: "wrong-id",
      hook_response: {},
    });

    // Original pending action should still be there
    expect(bridge.pendingActions.size).toBe(1);
    expect(bridge.pendingActions.has("action-1")).toBe(true);
  });
});

describe("Action Bridge — pending action cleanup on hook socket close", () => {
  it("removes pending actions when the hook socket closes", () => {
    const bridge = new ActionBridgeHarness();
    bridge.addBrowser();
    const hookWs = bridge.addActionHook();

    bridge.processMessage(hookWs, {
      type: "action_request",
      session_id: "s1",
      hook_event_name: "PermissionRequest",
    });
    expect(bridge.pendingActions.size).toBe(1);

    bridge.handleClose(hookWs);

    expect(bridge.pendingActions.size).toBe(0);
    expect(bridge.actionHookSockets.size).toBe(0);
  });

  it("only removes actions for the disconnected hook socket", () => {
    const bridge = new ActionBridgeHarness();
    bridge.addBrowser();
    const hook1 = bridge.addActionHook();
    const hook2 = bridge.addActionHook();

    bridge.processMessage(hook1, {
      type: "action_request",
      session_id: "s1",
      hook_event_name: "PermissionRequest",
    });
    bridge.processMessage(hook2, {
      type: "action_request",
      session_id: "s2",
      hook_event_name: "Notification",
    });
    expect(bridge.pendingActions.size).toBe(2);

    bridge.handleClose(hook1);

    expect(bridge.pendingActions.size).toBe(1);
    expect(bridge.pendingActions.has("action-2")).toBe(true);
  });

  it("handles close when hook has no pending actions", () => {
    const bridge = new ActionBridgeHarness();
    const hookWs = bridge.addActionHook();

    // Close without any pending actions — should not throw
    bridge.handleClose(hookWs);
    expect(bridge.pendingActions.size).toBe(0);
  });
});

describe("Action Bridge — pending action cleanup on hook socket error", () => {
  it("removes pending actions on webSocketError", () => {
    const bridge = new ActionBridgeHarness();
    bridge.addBrowser();
    const hookWs = bridge.addActionHook();

    bridge.processMessage(hookWs, {
      type: "action_request",
      session_id: "s1",
      hook_event_name: "Elicitation",
    });
    expect(bridge.pendingActions.size).toBe(1);

    bridge.handleError(hookWs);

    expect(bridge.pendingActions.size).toBe(0);
    expect(bridge.actionHookSockets.size).toBe(0);
  });

  it("only removes actions for the errored socket", () => {
    const bridge = new ActionBridgeHarness();
    bridge.addBrowser();
    const hook1 = bridge.addActionHook();
    const hook2 = bridge.addActionHook();

    bridge.processMessage(hook1, {
      type: "action_request",
      session_id: "s1",
      hook_event_name: "PermissionRequest",
    });
    bridge.processMessage(hook2, {
      type: "action_request",
      session_id: "s2",
      hook_event_name: "Notification",
    });

    bridge.handleError(hook1);

    expect(bridge.pendingActions.size).toBe(1);
    expect(bridge.actionHookSockets.size).toBe(1);
    expect(bridge.pendingActions.has("action-2")).toBe(true);
  });
});

describe("Action Bridge — ping/pong", () => {
  it("responds to ping with pong", () => {
    const bridge = new ActionBridgeHarness();
    const browserWs = bridge.addBrowser();

    bridge.processMessage(browserWs, { type: "ping" });

    const msg = browserWs.lastMessage()!;
    expect(msg.type).toBe("pong");
    expect(msg.ts).toBeTypeOf("number");
  });

  it("responds to ping from action hook socket", () => {
    const bridge = new ActionBridgeHarness();
    const hookWs = bridge.addActionHook();

    bridge.processMessage(hookWs, { type: "ping" });

    const msg = hookWs.lastMessage()!;
    expect(msg.type).toBe("pong");
  });
});

describe("Action Bridge — message isolation", () => {
  it("browser sending action_request is ignored (only action hooks can)", () => {
    const bridge = new ActionBridgeHarness();
    const browserWs = bridge.addBrowser();

    bridge.processMessage(browserWs, {
      type: "action_request",
      session_id: "s1",
      hook_event_name: "PermissionRequest",
    });

    // No pending actions should be created
    expect(bridge.pendingActions.size).toBe(0);
    // Browser should not receive anything back
    expect(browserWs.sent).toHaveLength(0);
  });

  it("action hook sending action_response is ignored (only browsers can)", () => {
    const bridge = new ActionBridgeHarness();
    bridge.addBrowser();
    const hookWs = bridge.addActionHook();

    // First create a pending action
    bridge.processMessage(hookWs, {
      type: "action_request",
      session_id: "s1",
      hook_event_name: "PermissionRequest",
    });

    // Action hook tries to respond to its own action — should be ignored
    bridge.processMessage(hookWs, {
      type: "action_response",
      action_id: "action-1",
      hook_response: {},
    });

    // Pending action should still be there
    expect(bridge.pendingActions.size).toBe(1);
  });
});
