import { createSignal, onCleanup } from "solid-js";
import type { WsMessage } from "../../../../packages/types/monitor";

const WORKER_HOST = "api.claudemon.com";

const WS_URL = import.meta.env.VITE_MONITOR_WS_URL || `wss://${WORKER_HOST}/ws`;

const DEV_WS_URL = "ws://localhost:8787/ws";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export function createWebSocket(onMessage: (msg: WsMessage) => void) {
  const [status, setStatus] = createSignal<ConnectionStatus>("connecting");
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout>;
  let pingTimer: ReturnType<typeof setInterval>;
  let reconnectDelay = 1000;

  function connect() {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;

    let url = import.meta.env.DEV ? DEV_WS_URL : WS_URL;

    // Primary auth: cookie on upgrade request (same-site)
    // Fallback: API key as query param (cross-origin WebSocket may not carry cookies)
    const apiKey = typeof localStorage !== "undefined" ? localStorage.getItem("claudemon_api_key") : null;
    if (apiKey) {
      const sep = url.includes("?") ? "&" : "?";
      url = `${url}${sep}token=${encodeURIComponent(apiKey)}`;
    }

    setStatus("connecting");

    ws = new WebSocket(url);

    ws.onopen = () => {
      setStatus("connected");
      reconnectDelay = 1000;
      pingTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 30000);
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as WsMessage;
        onMessage(msg);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      clearInterval(pingTimer);
      setStatus("disconnected");
      ws = null;
      reconnectTimer = setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    };

    ws.onerror = () => {
      ws?.close();
    };
  }

  // Reconnect immediately when tab becomes visible
  const handleVisibility = () => {
    if (document.visibilityState === "visible" && status() !== "connected") {
      clearTimeout(reconnectTimer);
      reconnectDelay = 1000;
      connect();
    }
  };
  document.addEventListener("visibilitychange", handleVisibility);

  onCleanup(() => {
    document.removeEventListener("visibilitychange", handleVisibility);
    clearTimeout(reconnectTimer);
    clearInterval(pingTimer);
    ws?.close();
  });

  connect();

  function send(data: Record<string, unknown>) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  return { status, reconnect: connect, send };
}
