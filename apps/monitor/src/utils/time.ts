// Friendly time format: 11:24:30 PM — EST biased, precise to seconds
export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour12: true,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/New_York",
  });
}

// Full technical timestamp for hover tooltip
export function formatTimeFull(ts: number): string {
  const d = new Date(ts);
  const iso = d.toISOString();
  const local = d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hour12: true,
  });
  return `${local} EST\n${iso}\nepoch: ${ts}`;
}

export function formatDuration(startMs: number): string {
  const secs = Math.floor((Date.now() - startMs) / 1000);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 5000) return "now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  return `${Math.floor(diff / 3600000)}h`;
}
