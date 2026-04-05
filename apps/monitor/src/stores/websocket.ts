import { createSignal, onCleanup } from "solid-js";
import type { WsMessage } from "../../../../packages/types/monitor";

const WORKER_HOST = "api.claudemon.com";

const WS_URL =
  import.meta.env.VITE_MONITOR_WS_URL ||
  `wss://${WORKER_HOST}/ws`;

const DEV_WS_URL = "ws://localhost:8787/ws";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export function createWebSocket(onMessage: (msg: WsMessage) => void) {
  const [status, setStatus] = createSignal<ConnectionStatus>("connecting");
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout>;
  let reconnectDelay = 1000;

  function connect() {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;

    const url = import.meta.env.DEV ? DEV_WS_URL : WS_URL;
    setStatus("connecting");

    ws = new WebSocket(url);

    ws.onopen = () => {
      setStatus("connected");
      reconnectDelay = 1000;
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

  connect();

  return { status, reconnect: connect };
}
