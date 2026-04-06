// Cache timezone name at module scope (doesn't change during a session)
const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Friendly time format: 11:24:30.123 PM, precise to milliseconds
export function formatTime(ts: number): string {
  const d = new Date(ts);
  const base = d.toLocaleTimeString("en-US", {
    hour12: true,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  // Insert .ms before the AM/PM: "11:24:30 PM" → "11:24:30.123 PM"
  return base.replace(/(\d{2})\s+(AM|PM)/i, `$1.${ms} $2`);
}

// Full technical timestamp for hover tooltip
export function formatTimeFull(ts: number): string {
  const d = new Date(ts);
  const iso = d.toISOString();
  const local = d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hour12: true,
  });
  return `${local} ${localTz}\n${iso}\nepoch: ${ts}`;
}

export function formatDuration(startMs: number): string {
  const secs = Math.floor((Date.now() - startMs) / 1000);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

export function formatGapDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return remSecs > 0 ? `${mins}m ${remSecs}s` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 5000) return "now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  return `${Math.floor(diff / 3600000)}h`;
}
