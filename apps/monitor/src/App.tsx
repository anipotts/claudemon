import { type Component, For, Show, createMemo, createSignal, onMount } from "solid-js";
import "./globals.css";
import { createSessionStore } from "./stores/sessions";
import { AgentMap } from "./components/AgentMap";
import { ActivityTimeline } from "./components/ActivityTimeline";
import { ConflictPanel, type ConflictData } from "./components/ConflictPanel";
import { SessionDetail } from "./components/SessionDetail";
import { Onboarding } from "./components/Onboarding";
import { ShieldCheck, Lightning, ListBullets, TreeStructure, Trash } from "./components/Icons";

const API_URL = import.meta.env.VITE_MONITOR_API_URL || "https://api.claudemon.com";

interface User {
  sub: string;
  name: string;
  login: string;
  avatar_url: string;
}

const App: Component = () => {
  const { sessions, connectionStatus } = createSessionStore();
  const [selectedSessionIds, setSelectedSessionIds] = createSignal<string[]>([]);
  const [user, setUser] = createSignal<User | null>(null);
  const [authLoading, setAuthLoading] = createSignal(true);

  onMount(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    fetch(`${API_URL}/auth/me`, { credentials: "include", signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setUser(data);
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(timeout);
        setAuthLoading(false);
      });
  });

  const allSessions = createMemo(() => Object.values(sessions));
  const totalAgents = createMemo(() => allSessions().length);
  const activeCount = createMemo(
    () => allSessions().filter((s) => s.status === "working" || s.status === "thinking").length,
  );
  const waitingCount = createMemo(() => allSessions().filter((s) => s.status === "waiting").length);
  const offCount = createMemo(() => allSessions().filter((s) => s.status === "offline" || s.status === "done").length);

  const selectedSessions = createMemo(() =>
    selectedSessionIds()
      .map((id) => sessions[id])
      .filter(Boolean),
  );

  const allEvents = createMemo(() => {
    const events = allSessions().flatMap((s) => s.events);
    events.sort((a, b) => b.timestamp - a.timestamp);
    return events.slice(0, 200);
  });

  const conflicts = createMemo<ConflictData[]>(() => {
    const fileEditors = new Map<string, Set<string>>();
    const now = Date.now();
    for (const e of allEvents()) {
      if (
        e.tool_name &&
        (e.tool_name === "Edit" || e.tool_name === "Write") &&
        e.tool_input?.file_path &&
        now - e.timestamp < 300000
      ) {
        const fp = e.tool_input.file_path as string;
        if (!fileEditors.has(fp)) fileEditors.set(fp, new Set());
        fileEditors.get(fp)!.add(e.session_id);
      }
    }
    const result: ConflictData[] = [];
    for (const [filePath, sids] of fileEditors) {
      if (sids.size > 1) result.push({ id: filePath, filePath, sessionIds: Array.from(sids), detectedAt: now });
    }
    return result;
  });

  const hasAgents = createMemo(() => totalAgents() > 0 || allEvents().length > 0);
  const connected = () => connectionStatus() === "connected";
  const [notificationsOn, setNotificationsOn] = createSignal(
    typeof localStorage !== "undefined" && localStorage.getItem("claudemon_notifications") === "on",
  );

  const toggleNotifications = async () => {
    if (notificationsOn()) {
      localStorage.setItem("claudemon_notifications", "off");
      setNotificationsOn(false);
    } else {
      if (typeof Notification !== "undefined") {
        const perm = await Notification.requestPermission();
        if (perm === "granted") {
          localStorage.setItem("claudemon_notifications", "on");
          setNotificationsOn(true);
        }
      }
    }
  };

  const handlePurge = () => {
    if (!confirm("Clear all sessions?")) return;
    fetch(`${API_URL}/sessions/purge`, { method: "POST", credentials: "include" }).catch(() => {});
  };

  const handleSelectSession = (id: string) => {
    setSelectedSessionIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return [...prev.slice(1), id];
      return [...prev, id];
    });
  };

  const handleCloseSession = (id: string) => {
    setSelectedSessionIds((prev) => prev.filter((x) => x !== id));
  };

  return (
    <div class="flex flex-col h-screen bg-bg text-text-primary font-mono overflow-hidden">
      {/* Header */}
      <header class="h-11 shrink-0 flex items-center justify-between px-5 bg-item border-b border-panel-border shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
        <div class="flex items-center gap-3">
          <span class="text-lg font-bold tracking-wider flex items-center gap-1.5">
            <ShieldCheck size={20} /> ClaudeMon
          </span>
          <Show when={hasAgents()}>
            <span class="text-text-sub">|</span>
            <span class="text-[11px] text-text-dim tracking-wider">Monitor your Claude Code sessions in real time</span>
          </Show>
        </div>
        <div class="flex items-center gap-4">
          <Show when={hasAgents()}>
            <div class="flex items-center gap-3 text-[10px]">
              <Show when={activeCount() > 0}>
                <span class="flex items-center gap-1 text-safe">
                  <span class="w-1.5 h-1.5 rounded-full bg-safe animate-pulse" />
                  {activeCount()} active
                </span>
              </Show>
              <Show when={waitingCount() > 0}>
                <span class="flex items-center gap-1 text-suspicious font-bold">
                  <span
                    class="w-1.5 h-1.5 rounded-full bg-suspicious animate-pulse"
                    style={{ "box-shadow": "0 0 6px var(--suspicious)" }}
                  />
                  {waitingCount()} waiting
                </span>
              </Show>
              <Show when={offCount() > 0}>
                <span class="flex items-center gap-1 text-text-sub">
                  <span class="w-1.5 h-1.5 rounded-full bg-text-sub" />
                  {offCount()} off
                </span>
              </Show>
            </div>

            <button
              onClick={handlePurge}
              class="text-text-sub hover:text-text-primary transition-colors"
              title="Clear all sessions"
              aria-label="Clear all sessions"
            >
              <Trash size={13} />
            </button>
          </Show>

          <button
            onClick={toggleNotifications}
            class="text-text-sub hover:text-text-primary transition-colors"
            title={notificationsOn() ? "Disable notifications" : "Enable notifications"}
            aria-label={notificationsOn() ? "Disable notifications" : "Enable notifications"}
          >
            <Show
              when={notificationsOn()}
              fallback={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 256 256"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="20"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M96 224c0 17.7 14.3 32 32 32s32-14.3 32-32" />
                  <path d="M56 104a72 72 0 0 1 144 0c0 35.8 8.5 56.4 16.3 68.5A8 8 0 0 1 209.4 184H46.6a8 8 0 0 1-6.9-11.5C47.5 160.4 56 139.8 56 104Z" />
                </svg>
              }
            >
              <svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor" stroke="none">
                <path d="M96 224c0 17.7 14.3 32 32 32s32-14.3 32-32" />
                <path d="M56 104a72 72 0 0 1 144 0c0 35.8 8.5 56.4 16.3 68.5A8 8 0 0 1 209.4 184H46.6a8 8 0 0 1-6.9-11.5C47.5 160.4 56 139.8 56 104Z" />
              </svg>
            </Show>
          </button>

          <div class="flex items-center gap-2">
            <span class="text-[10px] text-text-dim">{connected() ? "LIVE" : connectionStatus().toUpperCase()}</span>
            <span
              class={`w-2.5 h-2.5 rounded-full status-transition ${connected() ? "bg-safe animate-pulse" : "bg-suspicious"}`}
              style={{ "box-shadow": connected() ? "0 0 6px var(--safe)" : "0 0 4px var(--suspicious)" }}
            />
          </div>

          {/* Auth */}
          <Show when={!authLoading()}>
            <Show
              when={user()}
              fallback={
                <a
                  href={`${API_URL}/auth/login`}
                  class="text-[10px] text-text-dim hover:text-text-primary transition-colors"
                >
                  Sign in
                </a>
              }
            >
              {(u) => (
                <div class="flex items-center gap-2">
                  <img src={u().avatar_url} alt={u().login} class="w-5 h-5 rounded-full border border-panel-border" />
                  <span class="text-[10px] text-text-dim">{u().login}</span>
                  <a
                    href={`${API_URL}/auth/logout`}
                    class="text-[9px] text-text-sub hover:text-text-dim transition-colors"
                  >
                    out
                  </a>
                </div>
              )}
            </Show>
          </Show>
        </div>
      </header>

      {/* Reconnecting bar */}
      <Show when={connectionStatus() === "connecting"}>
        <div class="h-0.5 bg-suspicious/50 animate-pulse" />
      </Show>

      <Show when={hasAgents()} fallback={<Onboarding apiUrl={API_URL} user={user()} authLoading={authLoading()} />}>
        <div class="flex flex-1 overflow-hidden">
          {/* Left: Agent Map */}
          <div class="flex-1 min-w-0 flex flex-col border-r border-panel-border">
            <div class="px-4 py-2 border-b border-panel-border flex items-center gap-2 h-[33px]">
              <TreeStructure size={14} class="text-text-label" />
              <span class="text-[10px] text-text-label uppercase tracking-[2px]">Agent Map</span>
              <span class="text-[9px] text-text-sub ml-auto">
                {totalAgents()} session{totalAgents() !== 1 ? "s" : ""}
              </span>
            </div>
            <div class="flex-1 overflow-y-auto smooth-scroll p-3">
              <AgentMap sessions={sessions} selectedIds={selectedSessionIds()} onSelect={handleSelectSession} />
            </div>
          </div>

          {/* Middle: Session Detail columns (up to 3) */}
          <For each={selectedSessions()}>
            {(session) => <SessionDetail session={session} onClose={() => handleCloseSession(session.session_id)} />}
          </For>

          {/* Right sidebar: Activity + Conflicts */}
          <div class="w-[340px] shrink-0 flex flex-col overflow-hidden border-l border-panel-border">
            {/* Activity Timeline */}
            <div class="flex-1 flex flex-col min-h-0 border-b border-panel-border">
              <div class="px-3 py-2 border-b border-panel-border flex items-center gap-2 shrink-0 h-[33px]">
                <ListBullets size={14} class="text-text-label" />
                <span class="text-[10px] text-text-label uppercase tracking-[2px]">Activity</span>
                <span class="text-[9px] text-text-sub ml-auto">{allEvents().length} events</span>
              </div>
              <div class="flex-1 overflow-y-auto smooth-scroll">
                <ActivityTimeline events={allEvents()} onSelectSession={handleSelectSession} />
              </div>
            </div>

            {/* Conflicts */}
            <div class="shrink-0 max-h-[220px] overflow-y-auto smooth-scroll">
              <div class="px-3 py-2 border-b border-panel-border flex items-center gap-2 h-[33px]">
                <Lightning size={14} class="text-attack" />
                <span class="text-[10px] text-text-label uppercase tracking-[2px]">Conflicts</span>
                <Show when={conflicts().length > 0}>
                  <span class="text-[9px] text-attack font-bold ml-auto">{conflicts().length}</span>
                </Show>
              </div>
              <div class="p-2">
                <ConflictPanel conflicts={conflicts()} />
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default App;
