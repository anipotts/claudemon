export interface MonitorToolInfo {
  description?: string;
  command?: string;
  persistent?: boolean;
  timeoutMs?: number;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function truncate(value: string, maxLen: number): string {
  return value.length <= maxLen ? value : `${value.slice(0, Math.max(0, maxLen - 3))}...`;
}

export function getMonitorToolInfo(input?: Record<string, unknown>): MonitorToolInfo {
  if (!input) return {};

  return {
    description: readString(input.description),
    command: readString(input.command),
    persistent: readBoolean(input.persistent),
    timeoutMs: readNumber(input.timeout_ms),
  };
}

export function formatMonitorTimeout(timeoutMs?: number): string | null {
  if (timeoutMs === undefined || timeoutMs <= 0) return null;
  if (timeoutMs < 1000) return `${timeoutMs}ms`;

  const seconds = Math.round(timeoutMs / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remSeconds = seconds % 60;
  return remSeconds > 0 ? `${minutes}m ${remSeconds}s` : `${minutes}m`;
}

export function summarizeMonitorTarget(input?: Record<string, unknown>, maxLen = 60): string | null {
  const info = getMonitorToolInfo(input);
  if (info.description) return truncate(info.description, maxLen);
  if (info.command) return truncate(info.command, maxLen);
  return null;
}

export function getMonitorMetaSummary(input?: Record<string, unknown>): string | null {
  const info = getMonitorToolInfo(input);
  const parts: string[] = [];

  if (info.persistent === true) parts.push("persistent");
  if (info.persistent === false) parts.push("one-shot");

  const timeout = formatMonitorTimeout(info.timeoutMs);
  if (timeout) parts.push(`${timeout} timeout`);

  return parts.length > 0 ? parts.join(" / ") : null;
}
