#!/usr/bin/env node
// ClaudeMon Action Hook — Sync hook for remote approval via WebSocket.
// Opens a WebSocket to ClaudeMon, sends the event, waits for browser response.
// If no browser is connected, returns {} immediately (CC shows normal dialog).
// Timeout: 10s (configurable via CLAUDEMON_ACTION_TIMEOUT).
//
// Requires Node.js 22+ (built-in WebSocket) or Node.js 18+ with --experimental-websocket.

const API_URL = process.env.CLAUDEMON_API_URL || "wss://api.claudemon.com";
const API_KEY = process.env.CLAUDE_PLUGIN_OPTION_API_KEY || "";
const TIMEOUT = Number.parseInt(process.env.CLAUDEMON_ACTION_TIMEOUT || "10000", 10);

let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  try {
    const event = JSON.parse(input);
    const wsUrl = `${API_URL.replace(/^http/, "ws")}/ws/action?token=${encodeURIComponent(API_KEY)}`;

    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      process.stdout.write("{}");
      try {
        ws.close();
      } catch {}
      process.exit(0);
    }, TIMEOUT);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "action_request", ...event }));
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(typeof e.data === "string" ? e.data : "{}");

        // No browser connected — fall through to CC's normal dialog
        if (data.type === "no_browser") {
          process.stdout.write("{}");
          clearTimeout(timeout);
          ws.close();
          process.exit(0);
        }

        // Browser responded with a decision
        if (data.type === "response") {
          process.stdout.write(JSON.stringify(data.hook_response || {}));
          clearTimeout(timeout);
          ws.close();
          process.exit(0);
        }

        // Timeout from server side
        if (data.type === "timeout") {
          process.stdout.write("{}");
          clearTimeout(timeout);
          ws.close();
          process.exit(0);
        }
      } catch {}
    };

    ws.onerror = () => {
      process.stdout.write("{}");
      clearTimeout(timeout);
      process.exit(0);
    };

    ws.onclose = () => {
      clearTimeout(timeout);
    };
  } catch {
    process.stdout.write("{}");
    process.exit(0);
  }
});
