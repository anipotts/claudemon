import { type Component, For, Show, createMemo, createSignal, createEffect, onMount, onCleanup } from "solid-js";
import "./globals.css";
import { createSessionStore } from "./stores/sessions";
import { AgentMap } from "./components/AgentMap";
import { ActivityTimeline } from "./components/ActivityTimeline";
import { ConflictPanel, type ConflictData } from "./components/ConflictPanel";
import { SessionDetail } from "./components/SessionDetail";
import { SetupScreen } from "./components/SetupScreen";
import { Scrubber } from "./components/Scrubber";
import { Canvas } from "./components/Canvas";
import { Lightning, ListBullets, Trash, GearSix, Terminal, Pulse, CaretRight } from "./components/Icons";
import { ClaudeMonIcon } from "./components/ClaudeMonIcon";
import type { ClaudeMonPose } from "./components/ClaudeMonIcon";
import { SettingsPanel } from "./components/SettingsPanel";

const API_URL = import.meta.env.VITE_MONITOR_API_URL || "https://api.claudemon.com"; // v2

interface User {
  sub: string;
  name: string;
  login: string;
  avatar_url: string;
  has_api_keys?: boolean;
}

const App: Component = () => {
  // Initialize text zoom from localStorage (synchronous, before first render)
  if (typeof document !== "undefined") {
    const zoom = localStorage.getItem("claudemon_text_zoom") || "1";
    document.documentElement.style.setProperty("--cm-zoom", zoom);
  }

  const {
    sessions,
    connectionStatus,
    pendingActions,
    respondToAction,
    loadSessionHistory,
    historyLoading,
    persistenceReady,
    reconnect,
    // v0.7
    sendMessage,
    scrubberTime,
    setScrubberTime,
  } = createSessionStore();
  const pendingActionList = createMemo(() => Object.values(pendingActions).filter(Boolean));
  const [selectedSessionIds, setSelectedSessionIds] = createSignal<string[]>([]);
  const [user, setUser] = createSignal<User | null>(null);
  const [authLoading, setAuthLoading] = createSignal(true);

  const [_authError, setAuthError] = createSignal<string | null>(null);
  onMount(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    fetch(`${API_URL}/auth/me`, { credentials: "include", signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setUser(data);
      })
      .catch((err) => {
        if (err?.name === "AbortError") {
          setAuthError("Auth server timeout");
        }
      })
      .finally(() => {
        clearTimeout(timeout);
        setAuthLoading(false);
      });
  });

  const [settingsOpen, setSettingsOpen] = createSignal(false);

  // Mobile responsive
  const [isMobile, setIsMobile] = createSignal(
    typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches,
  );
  const [showMobileActivity, setShowMobileActivity] = createSignal(false);
  const [activityCollapsed, setActivityCollapsed] = createSignal(
    typeof localStorage !== "undefined" && localStorage.getItem("claudemon_activity_collapsed") === "true",
  );

  onMount(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    onCleanup(() => mq.removeEventListener("change", handler));

    // ── Pinch-to-zoom text sizing (mobile) ─────────────────────
    let pinchInitialDist = 0;
    let pinchStartZoom = 1;
    const getZoom = () => parseFloat(document.documentElement.style.getPropertyValue("--cm-zoom") || "1");
    const setZoom = (z: number) => {
      const clamped = Math.round(Math.max(0.8, Math.min(1.5, z)) * 100) / 100;
      document.documentElement.style.setProperty("--cm-zoom", String(clamped));
      return clamped;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchInitialDist = Math.hypot(dx, dy);
        pinchStartZoom = getZoom();
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchInitialDist > 0) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        setZoom(pinchStartZoom * (dist / pinchInitialDist));
      }
    };
    const onTouchEnd = () => {
      if (pinchInitialDist > 0) {
        pinchInitialDist = 0;
        localStorage.setItem(
          "claudemon_text_zoom",
          document.documentElement.style.getPropertyValue("--cm-zoom") || "1",
        );
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    onCleanup(() => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    });
  });

  const allSessions = createMemo(() => Object.values(sessions));
  const totalAgents = createMemo(() => allSessions().length);
  const activeCount = createMemo(
    () => allSessions().filter((s) => s.status === "working" || s.status === "thinking").length,
  );
  const waitingCount = createMemo(() => allSessions().filter((s) => s.status === "waiting").length);
  const offCount = createMemo(() => allSessions().filter((s) => s.status === "offline" || s.status === "done").length);

  // Derive mascot pose from session states
  const headerPose = createMemo((): ClaudeMonPose => {
    const err = allSessions().some((s) => s.status === "error");
    if (err) return "alert";
    const w = waitingCount();
    if (w > 0) return "watching";
    const a = activeCount();
    if (a > 0) return "scanning-right";
    if (totalAgents() === 0) return "sleep";
    const allDone = allSessions().every((s) => s.status === "done" || s.status === "offline");
    if (allDone) return "celebrate";
    return "default";
  });

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

  // 3-state machine: loading → setup → active
  const appState = createMemo(() => {
    if (hasAgents()) return "active" as const;
    if (!persistenceReady()) return "loading" as const;
    return "setup" as const;
  });

  const handleApiKeySet = (key: string) => {
    localStorage.setItem("claudemon_api_key", key);
    reconnect();
  };

  const connected = () => connectionStatus() === "connected";
  const [wasConnected, setWasConnected] = createSignal(false);
  createEffect(() => {
    if (connected()) setWasConnected(true);
  });
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

  // Tab persistence: restore from localStorage
  const savedTabs = typeof localStorage !== "undefined" ? localStorage.getItem("claudemon_tabs") : null;
  const savedActive = typeof localStorage !== "undefined" ? localStorage.getItem("claudemon_active_tab") : null;
  const [activeTabId, setActiveTabId] = createSignal<string | null>(savedActive);
  const [viewMode, setViewMode] = createSignal<"tabs" | "columns" | "canvas">(
    (typeof localStorage !== "undefined" && (localStorage.getItem("claudemon_view_mode") as "tabs" | "columns" | "canvas")) || "tabs",
  );
  createEffect(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("claudemon_view_mode", viewMode());
    }
  });
  const [pinnedTabs, setPinnedTabs] = createSignal<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = createSignal<{ x: number; y: number; tabId: string } | null>(null);

  // Restore saved tabs once sessions load
  createEffect(() => {
    if (savedTabs && Object.keys(sessions).length > 0 && selectedSessionIds().length === 0) {
      try {
        const ids = JSON.parse(savedTabs) as string[];
        const valid = ids.filter((id) => sessions[id]);
        if (valid.length > 0) {
          setSelectedSessionIds(valid);
          if (!savedActive || !sessions[savedActive]) setActiveTabId(valid[valid.length - 1]);
        }
      } catch {}
    }
  });

  // Persist tabs to localStorage
  createEffect(() => {
    if (typeof localStorage === "undefined") return;
    const ids = selectedSessionIds();
    if (ids.length > 0) {
      localStorage.setItem("claudemon_tabs", JSON.stringify(ids));
    } else {
      localStorage.removeItem("claudemon_tabs");
    }
    const active = activeTabId();
    if (active) {
      localStorage.setItem("claudemon_active_tab", active);
    } else {
      localStorage.removeItem("claudemon_active_tab");
    }
  });

  // Persist activity sidebar collapse state
  createEffect(() => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem("claudemon_activity_collapsed", activityCollapsed() ? "true" : "false");
  });

  const handleSelectSession = (id: string) => {
    setSelectedSessionIds((prev) => {
      // If already open, just switch to it — don't toggle close.
      // Close only via X button or context menu.
      if (prev.includes(id)) {
        setActiveTabId(id);
        return prev;
      }
      if (isMobile()) {
        setActiveTabId(id);
        return [id];
      }
      setActiveTabId(id);
      return [...prev, id];
    });
  };

  const handleCloseSession = (id: string) => {
    if (pinnedTabs().has(id)) return; // Can't close pinned
    setSelectedSessionIds((prev) => {
      const remaining = prev.filter((x) => x !== id);
      if (activeTabId() === id) setActiveTabId(remaining.length > 0 ? remaining[remaining.length - 1] : null);
      return remaining;
    });
  };

  const handleCloseOthers = (keepId: string) => {
    const pinned = pinnedTabs();
    setSelectedSessionIds((prev) => prev.filter((id) => id === keepId || pinned.has(id)));
    setActiveTabId(keepId);
    setContextMenu(null);
  };

  const handleCloseAll = () => {
    const pinned = pinnedTabs();
    if (pinned.size > 0) {
      setSelectedSessionIds((prev) => prev.filter((id) => pinned.has(id)));
      setActiveTabId(Array.from(pinned)[0] || null);
    } else {
      setSelectedSessionIds([]);
      setActiveTabId(null);
    }
    setContextMenu(null);
  };

  const togglePin = (id: string) => {
    setPinnedTabs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setContextMenu(null);
  };

  const _activeSession = createMemo(() => {
    const id = activeTabId();
    return id ? sessions[id] : selectedSessions().length > 0 ? selectedSessions()[0] : undefined;
  });

  // Close context menu on click outside
  const handleGlobalClick = () => setContextMenu(null);
  onMount(() => document.addEventListener("click", handleGlobalClick));
  onCleanup(() => document.removeEventListener("click", handleGlobalClick));

  return (
    <div class="flex flex-col h-screen bg-bg text-text-primary font-mono overflow-hidden">
      {/* Header */}
      <header class="h-11 shrink-0 flex items-center justify-between px-5 bg-item border-b border-panel-border shadow-[0_1px_3px_rgba(0,0,0,0.4)] mobile-header">
        <div class="flex items-center gap-3">
          <span class="text-lg font-bold tracking-wider flex items-center gap-1.5">
            <ClaudeMonIcon pose={headerPose()} size={22} /> ClaudeMon
          </span>
          <Show when={hasAgents() && !isMobile()}>
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

          <button
            onClick={() => setSettingsOpen(true)}
            class="text-text-sub hover:text-text-primary transition-colors"
            title="Settings"
            aria-label="Open settings"
          >
            <GearSix size={14} />
          </button>

          <div class="flex items-center gap-2">
            <span class="text-[10px] text-text-dim">{connected() ? "LIVE" : connectionStatus().toUpperCase()}</span>
            <span
              class={`w-2.5 h-2.5 rounded-full status-transition ${connected() ? "bg-safe animate-pulse" : "bg-suspicious"}`}
              style={{ "box-shadow": connected() ? "0 0 6px var(--safe)" : "0 0 4px var(--suspicious)" }}
            />
          </div>

          {/* Global pending actions badge */}
          <Show when={pendingActionList().length > 0}>
            <button
              class="flex items-center gap-1.5 px-2 py-1 rounded border border-suspicious/40 bg-suspicious/10 action-banner text-[9px] font-bold text-suspicious uppercase"
              onClick={() => {
                const first = pendingActionList()[0];
                if (first) handleSelectSession(first.session_id);
              }}
              title="Click to view session with pending action"
            >
              {pendingActionList().length} action{pendingActionList().length !== 1 ? "s" : ""} pending
            </button>
          </Show>

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

      {/* Reconnecting bar — only shows after first successful connection */}
      <Show when={wasConnected() && connectionStatus() === "connecting"}>
        <div class="h-0.5 bg-suspicious/50 animate-pulse" />
      </Show>

      <Show
        when={appState() === "active"}
        fallback={
          <Show when={appState() === "setup"} fallback={<div class="flex-1" />}>
            <SetupScreen
              onApiKeySet={handleApiKeySet}
              connectionStatus={connectionStatus}
              apiUrl={API_URL}
              user={user()}
              authLoading={authLoading()}
            />
          </Show>
        }
      >
        <div class={`flex flex-1 overflow-hidden ${isMobile() ? "flex-col" : ""}`}>
          {/* Mobile: Conflict banner */}
          <Show when={isMobile() && conflicts().length > 0}>
            <div class="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-attack/5 border-b border-attack/30">
              <Lightning size={12} class="text-attack" />
              <span class="text-[10px] text-attack font-bold">
                {conflicts().length} conflict{conflicts().length !== 1 ? "s" : ""}
              </span>
            </div>
          </Show>

          {/* Sessions sidebar */}
          <div
            class={`flex flex-col ${isMobile() ? "flex-1 min-w-0" : "w-[280px] shrink-0 border-r border-panel-border"}`}
          >
            <div class="flex-1 overflow-y-auto smooth-scroll p-2">
              <AgentMap sessions={sessions} selectedIds={selectedSessionIds()} onSelect={handleSelectSession} />
            </div>
          </div>

          {/* Mobile: Session Detail overlay */}
          <Show when={isMobile() && selectedSessions().length > 0}>
            <div class="absolute inset-0 z-50 bg-bg flex flex-col mobile-session-overlay">
              <SessionDetail
                session={selectedSessions()[0]}
                onClose={() => handleCloseSession(selectedSessions()[0].session_id)}
                isMobile={true}
                pendingActions={pendingActions}
                onActionRespond={respondToAction}
                onRequestHistory={loadSessionHistory}
                historyLoading={historyLoading().has(selectedSessions()[0].session_id)}
                onSendMessage={sendMessage}
              />
            </div>
          </Show>

          {/* Desktop: Main content area */}
          <Show when={!isMobile()}>
            <div class="flex-1 min-w-0 flex flex-col">
              {/* Tab bar — grouped by project */}
              <Show when={selectedSessions().length > 0}>
                <div class="flex items-center shrink-0 bg-item border-b border-panel-border overflow-x-auto">
                  {(() => {
                    // Group selected sessions by project_name
                    const groups = createMemo(() => {
                      const map = new Map<string, string[]>();
                      for (const id of selectedSessionIds()) {
                        const s = sessions[id];
                        if (!s) continue;
                        const proj = s.project_name || "unknown";
                        if (!map.has(proj)) map.set(proj, []);
                        map.get(proj)!.push(id);
                      }
                      return Array.from(map.entries());
                    });
                    return (
                      <For each={groups()}>
                        {([projectName, ids], groupIdx) => (
                          <>
                            {/* Project group separator */}
                            <Show when={groupIdx() > 0}>
                              <div class="w-px h-5 bg-panel-border mx-1 shrink-0" />
                            </Show>
                            {/* Project label */}
                            <span class="text-[8px] text-text-sub uppercase tracking-wider px-1.5 shrink-0">
                              {projectName}
                            </span>
                            {/* Session tabs in this project */}
                            <For each={ids}>
                              {(id) => {
                                const s = () => sessions[id];
                                const isActive = () => id === activeTabId();
                                return (
                                  <Show when={s()}>
                                    <div
                                      class={`flex items-center gap-1 px-2 py-1 rounded-sm mx-0.5 shrink-0 cursor-pointer ${
                                        isActive() ? "bg-bg border border-panel-border" : "hover:bg-panel/20"
                                      }`}
                                      style={{ transition: "all 0.15s ease" }}
                                      onClick={() => setActiveTabId(id)}
                                      onContextMenu={(e: MouseEvent) => {
                                        e.preventDefault();
                                        setContextMenu({ x: e.clientX, y: e.clientY, tabId: id });
                                      }}
                                    >
                                      <Show when={pinnedTabs().has(id)}>
                                        <span class="text-[9px] text-safe shrink-0">*</span>
                                      </Show>
                                      <span
                                        class="w-1.5 h-1.5 rounded-full shrink-0"
                                        style={{
                                          background:
                                            s()!.status === "working"
                                              ? "#a3b18a"
                                              : s()!.status === "thinking"
                                                ? "#7b9fbf"
                                                : s()!.status === "waiting"
                                                  ? "#c9a96e"
                                                  : s()!.status === "error"
                                                    ? "#b85c4a"
                                                    : "#4a4640",
                                          "box-shadow":
                                            s()!.status === "working" || s()!.status === "thinking"
                                              ? `0 0 4px ${s()!.status === "working" ? "#a3b18a" : "#7b9fbf"}`
                                              : "none",
                                          transition: "background 0.3s ease, box-shadow 0.3s ease",
                                        }}
                                      />
                                      <span
                                        class="text-[9px] font-mono text-text-dim truncate max-w-[120px]"
                                        title={id}
                                      >
                                        {s()!.last_prompt?.slice(0, 20) ||
                                          s()!.smart_status?.slice(0, 20) ||
                                          id.slice(0, 8)}
                                      </span>
                                      <Show when={!pinnedTabs().has(id)}>
                                        <span
                                          class="text-text-sub hover:text-text-primary text-[9px] ml-0.5"
                                          onClick={(e: MouseEvent) => {
                                            e.stopPropagation();
                                            handleCloseSession(id);
                                          }}
                                        >
                                          x
                                        </span>
                                      </Show>
                                    </div>
                                  </Show>
                                );
                              }}
                            </For>
                          </>
                        )}
                      </For>
                    );
                  })()}
                  {/* View mode toggle */}
                  <div class="ml-auto flex items-center shrink-0 px-2 gap-1">
                    <button
                      type="button"
                      onClick={() => setViewMode("tabs")}
                      class={`text-[8px] uppercase tracking-wider px-2 py-1 rounded transition-colors ${viewMode() === "tabs" ? "text-suspicious bg-suspicious/10" : "text-text-sub hover:text-text-primary"}`}
                      title="Tabs — one session at a time"
                    >
                      tabs
                    </button>
                    <Show when={selectedSessionIds().length > 1}>
                      <button
                        type="button"
                        onClick={() => setViewMode("columns")}
                        class={`text-[8px] uppercase tracking-wider px-2 py-1 rounded transition-colors ${viewMode() === "columns" ? "text-suspicious bg-suspicious/10" : "text-text-sub hover:text-text-primary"}`}
                        title="Columns — side-by-side"
                      >
                        cols
                      </button>
                    </Show>
                    <button
                      type="button"
                      onClick={() => setViewMode("canvas")}
                      class={`text-[8px] uppercase tracking-wider px-2 py-1 rounded transition-colors ${viewMode() === "canvas" ? "text-safe bg-safe/10" : "text-text-sub hover:text-text-primary"}`}
                      title="Canvas — spatial multi-session view"
                    >
                      canvas
                    </button>
                  </div>
                </div>
              </Show>

              {/* Content below tabs — 3 fixed zones: center + activity sidebar */}
              <div class="flex flex-1 min-h-0 overflow-hidden">
                {/* Center content area — the ONLY part that changes */}
                <div class="flex-1 min-w-0 flex overflow-hidden">
                  <Show
                    when={selectedSessions().length > 0 || viewMode() === "canvas"}
                    fallback={
                      <div class="flex-1 flex flex-col items-center justify-center gap-3">
                        <Terminal size={28} class="text-text-sub" />
                        <span class="text-[13px] text-text-dim">Select a session to view details</span>
                        <span class="text-[10px] text-text-sub">or switch to canvas view</span>
                      </div>
                    }
                  >
                    {/* Tab view: all sessions mounted, only active visible */}
                    <Show when={viewMode() === "tabs" && selectedSessions().length > 0}>
                      <For each={selectedSessions()}>
                        {(session) => (
                          <div
                            class="flex-1 min-w-0 flex flex-col overflow-hidden"
                            style={{ display: session.session_id === activeTabId() ? "flex" : "none" }}
                          >
                            <SessionDetail
                              session={session}
                              onClose={() => handleCloseSession(session.session_id)}
                              showClose={false}
                              pendingActions={pendingActions}
                              onActionRespond={respondToAction}
                              onRequestHistory={loadSessionHistory}
                              historyLoading={historyLoading().has(session.session_id)}
                              onSendMessage={sendMessage}
                            />
                          </div>
                        )}
                      </For>
                    </Show>

                    {/* Column view: horizontal scroll, each column independently scrollable */}
                    <Show when={viewMode() === "columns" && selectedSessions().length > 0}>
                      <div class="flex flex-1 min-w-0 overflow-x-auto">
                        <For each={selectedSessions()}>
                          {(session) => (
                            <div class="flex-1 min-w-[320px] max-w-[50vw] border-r border-panel-border last:border-r-0 flex flex-col overflow-hidden">
                              <SessionDetail
                                session={session}
                                onClose={() => handleCloseSession(session.session_id)}
                                showClose={true}
                                pendingActions={pendingActions}
                                onActionRespond={respondToAction}
                                onRequestHistory={loadSessionHistory}
                                historyLoading={historyLoading().has(session.session_id)}
                                onSendMessage={sendMessage}
                              />
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  </Show>

                  {/* v0.7: Infinite canvas — shows ALL sessions, not just selected */}
                  <Show when={viewMode() === "canvas"}>
                    <Canvas
                      sessions={sessions}
                      pendingActions={pendingActions}
                      onActionRespond={respondToAction}
                      onSendMessage={sendMessage}
                      onOpenSession={handleSelectSession}
                      selectedIds={selectedSessionIds()}
                    />
                  </Show>
                </div>

                {/* Activity sidebar — collapsible, persisted to localStorage */}
                <div
                  class="activity-sidebar shrink-0 flex flex-col border-l border-panel-border"
                  style={{ width: activityCollapsed() ? "36px" : "280px" }}
                >
                  <Show
                    when={!activityCollapsed()}
                    fallback={
                      <button
                        class="flex-1 flex flex-col items-center gap-3 py-3 hover:bg-panel/40 transition-colors cursor-pointer"
                        onClick={() => setActivityCollapsed(false)}
                        title="Expand activity feed"
                      >
                        <Pulse size={14} class="text-text-label" />
                        <span class="text-[9px] text-text-sub font-bold">{allEvents().length}</span>
                        <CaretRight size={10} class="text-text-sub" />
                      </button>
                    }
                  >
                    <div class="flex-1 flex flex-col min-h-0">
                      <div class="px-3 py-2 border-b border-panel-border flex items-center gap-2 shrink-0 h-[33px]">
                        <ListBullets size={14} class="text-text-label" />
                        <span class="text-[10px] text-text-label uppercase tracking-[2px]">Activity</span>
                        <span class="text-[9px] text-text-sub ml-auto">{allEvents().length}</span>
                        <button
                          class="text-text-sub hover:text-text-primary transition-colors p-0.5"
                          onClick={() => setActivityCollapsed(true)}
                          title="Collapse activity feed"
                        >
                          <CaretRight size={10} />
                        </button>
                      </div>
                      <div class="cm-content flex-1 overflow-y-auto smooth-scroll">
                        <ActivityTimeline events={allEvents()} onSelectSession={handleSelectSession} />
                      </div>
                    </div>
                    <Show when={conflicts().length > 0}>
                      <div class="shrink-0 border-t border-panel-border">
                        <div class="px-3 py-1.5 flex items-center gap-2">
                          <Lightning size={12} class="text-attack" />
                          <span class="text-[9px] text-attack font-bold">
                            {conflicts().length} conflict{conflicts().length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div class="px-2 pb-2">
                          <ConflictPanel conflicts={conflicts()} />
                        </div>
                      </div>
                    </Show>
                  </Show>
                </div>
              </div>
            </div>
          </Show>

          {/* Mobile: Activity toggle */}
          <Show when={isMobile()}>
            <div class="shrink-0 border-t border-panel-border">
              <button
                onClick={() => setShowMobileActivity(!showMobileActivity())}
                class="flex items-center gap-2 w-full px-3 py-2 bg-item"
              >
                <ListBullets size={14} class="text-text-label" />
                <span class="text-[10px] text-text-label uppercase tracking-[2px]">Activity</span>
                <span class="text-[9px] text-text-sub ml-auto">{allEvents().length}</span>
              </button>
              <Show when={showMobileActivity()}>
                <div class="max-h-[50vh] overflow-y-auto smooth-scroll border-t border-panel-border">
                  <ActivityTimeline events={allEvents()} onSelectSession={handleSelectSession} />
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </Show>

      {/* Tab context menu */}
      <Show when={contextMenu()}>
        {(menu) => (
          <div
            class="fixed z-[200] bg-card border border-panel-border rounded shadow-lg py-1 min-w-[160px]"
            style={{ left: `${menu().x}px`, top: `${menu().y}px` }}
            onClick={(e: MouseEvent) => e.stopPropagation()}
          >
            <button
              class="w-full text-left px-3 py-1.5 text-[10px] text-text-primary hover:bg-panel/30 transition-colors"
              onClick={() => togglePin(menu().tabId)}
            >
              {pinnedTabs().has(menu().tabId) ? "Unpin" : "Pin"}
            </button>
            <button
              class="w-full text-left px-3 py-1.5 text-[10px] text-text-primary hover:bg-panel/30 transition-colors"
              onClick={() => {
                handleCloseSession(menu().tabId);
                setContextMenu(null);
              }}
            >
              Close
            </button>
            <button
              class="w-full text-left px-3 py-1.5 text-[10px] text-text-primary hover:bg-panel/30 transition-colors"
              onClick={() => handleCloseOthers(menu().tabId)}
            >
              Close Others
            </button>
            <div class="h-px bg-panel-border mx-2 my-1" />
            <button
              class="w-full text-left px-3 py-1.5 text-[10px] text-attack hover:bg-panel/30 transition-colors"
              onClick={handleCloseAll}
            >
              Close All
            </button>
          </div>
        )}
      </Show>

      {/* Settings panel */}
      <Show when={settingsOpen()}>
        <SettingsPanel
          apiUrl={API_URL}
          user={user()}
          connectionStatus={connectionStatus}
          onClose={() => setSettingsOpen(false)}
        />
      </Show>

      {/* v0.7: Time-travel scrubber — bottom of the app, spans full width */}
      <Show when={hasAgents() && !isMobile()}>
        <Scrubber sessions={sessions} scrubberTime={scrubberTime} setScrubberTime={setScrubberTime} />
      </Show>
    </div>
  );
};

export default App;
