import { describe, it, expect } from "vitest";
import { isValidEvent, enrichEvent } from "../events";

// ── isValidEvent ────────────────────────────────────────────────────

describe("isValidEvent", () => {
  it("returns true for valid event", () => {
    expect(isValidEvent({ session_id: "abc", hook_event_name: "PreToolUse" })).toBe(true);
  });

  it("returns false for missing session_id", () => {
    expect(isValidEvent({ hook_event_name: "PreToolUse" })).toBe(false);
  });

  it("returns false for empty string session_id", () => {
    expect(isValidEvent({ session_id: "", hook_event_name: "PreToolUse" })).toBe(false);
  });

  it("returns false for missing hook_event_name", () => {
    expect(isValidEvent({ session_id: "abc" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isValidEvent(null)).toBe(false);
  });

  it("returns false for array", () => {
    expect(isValidEvent([1, 2])).toBe(false);
  });

  it("returns false for string", () => {
    expect(isValidEvent("hello")).toBe(false);
  });

  it("returns false for number", () => {
    expect(isValidEvent(42)).toBe(false);
  });
});

// ── enrichEvent ─────────────────────────────────────────────────────

describe("enrichEvent", () => {
  it("sets timestamp if missing", () => {
    const event: any = { session_id: "s1", hook_event_name: "SessionStart" };
    enrichEvent(event, "user1");
    expect(event.timestamp).toBeTypeOf("number");
  });

  it("sets machine_id from userId if missing", () => {
    const event: any = { session_id: "s1", hook_event_name: "SessionStart" };
    enrichEvent(event, "user1");
    expect(event.machine_id).toBe("user1");
  });

  it("sets project_path from cwd if missing", () => {
    const event: any = { session_id: "s1", hook_event_name: "SessionStart", cwd: "/home/proj" };
    enrichEvent(event, "user1");
    expect(event.project_path).toBe("/home/proj");
  });

  it("falls back project_path to unknown when no cwd", () => {
    const event: any = { session_id: "s1", hook_event_name: "SessionStart" };
    enrichEvent(event, "user1");
    expect(event.project_path).toBe("unknown");
  });

  it("does NOT overwrite existing timestamp", () => {
    const event: any = { session_id: "s1", hook_event_name: "SessionStart", timestamp: 999 };
    enrichEvent(event, "user1");
    expect(event.timestamp).toBe(999);
  });

  it("does NOT overwrite existing machine_id", () => {
    const event: any = { session_id: "s1", hook_event_name: "SessionStart", machine_id: "my-machine" };
    enrichEvent(event, "user1");
    expect(event.machine_id).toBe("my-machine");
  });

  it("does NOT overwrite existing project_path", () => {
    const event: any = { session_id: "s1", hook_event_name: "SessionStart", project_path: "/existing" };
    enrichEvent(event, "user1");
    expect(event.project_path).toBe("/existing");
  });

  // Normalization tests

  it("normalizes Notification message and title", () => {
    const event: any = { session_id: "s1", hook_event_name: "Notification", message: "hi", title: "Alert" };
    enrichEvent(event, "u");
    expect(event.notification_message).toBe("hi");
    expect(event.notification_title).toBe("Alert");
  });

  it("does NOT overwrite existing notification_message", () => {
    const event: any = {
      session_id: "s1",
      hook_event_name: "Notification",
      message: "new",
      notification_message: "old",
    };
    enrichEvent(event, "u");
    expect(event.notification_message).toBe("old");
  });

  it("normalizes SessionEnd reason", () => {
    const event: any = { session_id: "s1", hook_event_name: "SessionEnd", reason: "timeout" };
    enrichEvent(event, "u");
    expect(event.end_reason).toBe("timeout");
  });

  it("normalizes PermissionDenied reason", () => {
    const event: any = { session_id: "s1", hook_event_name: "PermissionDenied", reason: "denied" };
    enrichEvent(event, "u");
    expect(event.permission_denied_reason).toBe("denied");
  });

  it("normalizes PreCompact trigger", () => {
    const event: any = { session_id: "s1", hook_event_name: "PreCompact", trigger: "auto" };
    enrichEvent(event, "u");
    expect(event.compact_trigger).toBe("auto");
  });

  it("normalizes PostCompact trigger", () => {
    const event: any = { session_id: "s1", hook_event_name: "PostCompact", trigger: "manual" };
    enrichEvent(event, "u");
    expect(event.compact_trigger).toBe("manual");
  });

  it("normalizes FileChanged event", () => {
    const event: any = { session_id: "s1", hook_event_name: "FileChanged", event: "modified" };
    enrichEvent(event, "u");
    expect(event.file_event).toBe("modified");
  });

  it("normalizes WorktreeCreate name", () => {
    const event: any = { session_id: "s1", hook_event_name: "WorktreeCreate", name: "feature-x" };
    enrichEvent(event, "u");
    expect(event.worktree_name).toBe("feature-x");
  });

  it("normalizes ConfigChange source and file_path", () => {
    const event: any = {
      session_id: "s1",
      hook_event_name: "ConfigChange",
      source: "user",
      file_path: "/etc/config",
    };
    enrichEvent(event, "u");
    expect(event.config_source).toBe("user");
    expect(event.config_file_path).toBe("/etc/config");
  });

  it("does NOT overwrite existing normalized fields", () => {
    const event: any = {
      session_id: "s1",
      hook_event_name: "ConfigChange",
      source: "new",
      config_source: "existing",
      file_path: "new.txt",
      config_file_path: "existing.txt",
    };
    enrichEvent(event, "u");
    expect(event.config_source).toBe("existing");
    expect(event.config_file_path).toBe("existing.txt");
  });

  it("normalizes SubagentStop agent_transcript_path to transcript_path", () => {
    const event: any = {
      session_id: "s1",
      hook_event_name: "SubagentStop",
      agent_transcript_path: "/home/.claude/projects/abc/agent-123.jsonl",
    };
    enrichEvent(event, "u");
    expect(event.transcript_path).toBe("/home/.claude/projects/abc/agent-123.jsonl");
  });

  it("does NOT overwrite existing transcript_path on SubagentStop", () => {
    const event: any = {
      session_id: "s1",
      hook_event_name: "SubagentStop",
      agent_transcript_path: "/new-path.jsonl",
      transcript_path: "/existing-path.jsonl",
    };
    enrichEvent(event, "u");
    expect(event.transcript_path).toBe("/existing-path.jsonl");
  });

  it("normalizes Notification type field", () => {
    const event: any = {
      session_id: "s1",
      hook_event_name: "Notification",
      message: "Done",
      type: "completion",
    };
    enrichEvent(event, "u");
    expect(event.notification_type).toBe("completion");
  });
});
