import { describe, it, expect, vi } from "vitest";
import { isValidEvent, enrichEvent, sendEvent } from "../events";

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

  it("does NOT overwrite existing notification_type", () => {
    const event: any = {
      session_id: "s1",
      hook_event_name: "Notification",
      type: "new-type",
      notification_type: "existing-type",
    };
    enrichEvent(event, "u");
    expect(event.notification_type).toBe("existing-type");
  });

  it("normalizes PostCompact summary to compact_summary", () => {
    const event: any = {
      session_id: "s1",
      hook_event_name: "PostCompact",
      summary: "Compacted 500 tokens",
    };
    enrichEvent(event, "u");
    expect(event.compact_summary).toBe("Compacted 500 tokens");
  });

  it("does NOT overwrite existing compact_summary on PostCompact", () => {
    const event: any = {
      session_id: "s1",
      hook_event_name: "PostCompact",
      summary: "new summary",
      compact_summary: "existing summary",
    };
    enrichEvent(event, "u");
    expect(event.compact_summary).toBe("existing summary");
  });

  it("sets machine_id to unknown when userId is empty string", () => {
    const event: any = { session_id: "s1", hook_event_name: "SessionStart" };
    enrichEvent(event, "");
    expect(event.machine_id).toBe("unknown");
  });

  it("does NOT add notification_message to a PreToolUse event", () => {
    const event: any = {
      session_id: "s1",
      hook_event_name: "PreToolUse",
      tool_name: "Edit",
      message: "some message",
    };
    enrichEvent(event, "u");
    expect(event.notification_message).toBeUndefined();
  });

  it("does NOT add end_reason to a Notification event", () => {
    const event: any = {
      session_id: "s1",
      hook_event_name: "Notification",
      reason: "some reason",
    };
    enrichEvent(event, "u");
    expect(event.end_reason).toBeUndefined();
  });

  it("does NOT add compact_trigger to a SessionEnd event", () => {
    const event: any = {
      session_id: "s1",
      hook_event_name: "SessionEnd",
      trigger: "auto",
    };
    enrichEvent(event, "u");
    expect(event.compact_trigger).toBeUndefined();
  });

  it("is idempotent — calling enrichEvent twice does not change values", () => {
    const event: any = {
      session_id: "s1",
      hook_event_name: "Notification",
      message: "hi",
      title: "Alert",
      type: "info",
    };
    enrichEvent(event, "user1");
    const snapshot = { ...event };
    enrichEvent(event, "user1");
    expect(event.timestamp).toBe(snapshot.timestamp);
    expect(event.machine_id).toBe(snapshot.machine_id);
    expect(event.project_path).toBe(snapshot.project_path);
    expect(event.notification_message).toBe(snapshot.notification_message);
    expect(event.notification_title).toBe(snapshot.notification_title);
    expect(event.notification_type).toBe(snapshot.notification_type);
  });
});

// ── sendEvent ──────────────────────────────────────────────────────

describe("sendEvent", () => {
  it("calls room.fetch with correct URL, method, headers, and body", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
    const room = { fetch: mockFetch };
    const event = { session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Edit" };

    await sendEvent(room, event);

    expect(mockFetch).toHaveBeenCalledOnce();
    const request = mockFetch.mock.calls[0][0] as Request;
    expect(request.url).toBe("https://do/event");
    expect(request.method).toBe("POST");
    expect(request.headers.get("Content-Type")).toBe("application/json");
  });

  it("serializes the event as JSON in the request body", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
    const room = { fetch: mockFetch };
    const event = { session_id: "s1", hook_event_name: "Stop", timestamp: 12345 };

    await sendEvent(room, event);

    const request = mockFetch.mock.calls[0][0] as Request;
    const body = await request.json();
    expect(body).toEqual(event);
  });

  it("returns the Response from room.fetch", async () => {
    const mockResponse = new Response("custom", { status: 201 });
    const mockFetch = vi.fn().mockResolvedValue(mockResponse);
    const room = { fetch: mockFetch };

    const result = await sendEvent(room, { session_id: "s1", hook_event_name: "SessionStart" });
    expect(result).toBe(mockResponse);
  });
});
