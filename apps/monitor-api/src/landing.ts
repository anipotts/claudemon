export const LANDING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ClaudeMon -- the lightweight monitor for Claude Code</title>
  <meta name="description" content="The lightweight monitor for Claude Code. Watch every session -- tool calls, agent trees, and permission prompts stream in real time. Zero-dependency CLI, ephemeral WebSocket relay, no database.">
  <meta property="og:title" content="ClaudeMon -- the lightweight monitor for Claude Code">
  <meta property="og:description" content="The lightweight monitor for Claude Code. Watch every session in real time.">
  <meta property="og:url" content="https://claudemon.com">
  <meta property="og:type" content="website">
  <meta property="og:image" content="https://app.claudemon.com/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="ClaudeMon -- the lightweight monitor for Claude Code">
  <meta name="twitter:description" content="The lightweight monitor for Claude Code. Watch every session in real time.">
  <meta name="twitter:image" content="https://app.claudemon.com/og-image.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@300..800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="icon" type="image/png" sizes="32x32" href="https://app.claudemon.com/favicon-32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="https://app.claudemon.com/favicon-16.png">
  <style>
:root {
  --bg: #0a0a0a;
  --bg-subtle: #0e0e0c;
  --panel: #1a1916;
  --panel-border: #3d3a34;
  --card: #141210;
  --card-hover: #1a1816;
  --item: #12110f;
  --text-primary: #e8e0d4;
  --text-label: #8a8478;
  --text-dim: #6b6560;
  --text-sub: #4a4640;
  --safe: #a3b18a;
  --safe-dim: rgba(163, 177, 138, 0.15);
  --suspicious: #c9a96e;
  --attack: #b85c4a;
  --thinking: #7b9fbf;
  --done: #5a5650;
  --agent: #b07bac;
}

* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }

body {
  background: var(--bg);
  color: var(--text-primary);
  font-family: 'Geist Mono', 'SF Mono', 'Fira Code', monospace;
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

.container { max-width: 960px; margin: 0 auto; padding: 0 24px; }
.wide-container { max-width: 1100px; margin: 0 auto; padding: 0 24px; }

a { color: var(--safe); text-decoration: none; }
a:hover { text-decoration: underline; }
code { background: var(--panel); padding: 2px 8px; border-radius: 4px; font-size: 13px; font-family: inherit; }

.fade-in {
  opacity: 0;
  transform: translateY(28px);
  transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
}
.fade-in.visible { opacity: 1; transform: translateY(0); }
.fade-in-d1 { transition-delay: 0.1s; }
.fade-in-d2 { transition-delay: 0.2s; }
.fade-in-d3 { transition-delay: 0.3s; }

.hero {
  padding: 72px 0 0;
  text-align: center;
  position: relative;
}
.hero::before {
  content: '';
  position: absolute;
  top: -100px;
  left: 50%;
  transform: translateX(-50%);
  width: 800px;
  height: 600px;
  background: radial-gradient(ellipse, rgba(163,177,138,0.1), transparent 70%);
  pointer-events: none;
  z-index: 0;
}
.hero .container { position: relative; z-index: 1; }

.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-bottom: 20px;
}
.logo-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--safe);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 20px rgba(163,177,138,0.3);
}
.logo h1 {
  font-size: 38px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: var(--text-primary);
}
.tagline {
  font-size: 17px;
  color: var(--text-label);
  margin-bottom: 12px;
  font-weight: 400;
}
.subtitle {
  font-size: 13px;
  color: var(--text-dim);
  max-width: 540px;
  margin: 0 auto 28px;
  line-height: 1.8;
}
.cta-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 48px;
}
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 28px;
  border-radius: 8px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  border: none;
  cursor: pointer;
}
.btn-primary {
  background: var(--safe);
  color: var(--bg);
  box-shadow: 0 0 20px rgba(163,177,138,0.2);
}
.btn-primary:hover { background: #b5c49c; text-decoration: none; transform: translateY(-2px); box-shadow: 0 4px 24px rgba(163,177,138,0.3); }
.btn-secondary {
  background: transparent;
  color: var(--text-label);
  border: 1px solid var(--panel-border);
}
.btn-secondary:hover { border-color: var(--text-dim); color: var(--text-primary); text-decoration: none; transform: translateY(-2px); }
.install-cmd {
  background: var(--panel);
  border: 1px solid var(--panel-border);
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
  color: var(--safe);
  cursor: pointer;
  user-select: all;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  transition: all 0.2s;
  position: relative;
}
.install-cmd:hover { border-color: var(--safe); box-shadow: 0 0 12px rgba(163,177,138,0.1); }
.install-cmd svg { color: var(--text-dim); flex-shrink: 0; }
.install-cmd .copied-toast {
  position: absolute;
  top: -32px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--safe);
  color: var(--bg);
  font-size: 10px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}
.install-cmd .copied-toast.show { opacity: 1; }

.hero-dashboard {
  max-width: 1100px;
  margin: 0 auto;
  opacity: 0;
  transform: scale(0.98);
  transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}
.hero-dashboard.visible { opacity: 1; transform: scale(1); }

.mock-browser {
  border-radius: 12px;
  border: 1px solid var(--panel-border);
  background: var(--bg);
  overflow: hidden;
  box-shadow:
    0 0 80px rgba(163,177,138,0.06),
    0 0 160px rgba(163,177,138,0.03),
    0 32px 64px rgba(0,0,0,0.5);
}
.mock-browser-bar {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  background: var(--panel);
  border-bottom: 1px solid var(--panel-border);
  gap: 8px;
}
.mock-dots { display: flex; gap: 6px; }
.mock-dots span { width: 10px; height: 10px; border-radius: 50%; }
.mock-dots span:first-child { background: #b85c4a; }
.mock-dots span:nth-child(2) { background: var(--suspicious); }
.mock-dots span:last-child { background: var(--safe); }
.mock-url {
  flex: 1;
  background: var(--card);
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  padding: 5px 12px;
  font-size: 11px;
  color: var(--text-dim);
  text-align: center;
}

/* App header inside mockup */
.mock-header {
  height: 33px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--item);
  border-bottom: 1px solid var(--panel-border);
  box-shadow: 0 1px 3px rgba(0,0,0,0.4);
}
.mock-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.mock-header-title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.mock-header-sep { color: var(--text-sub); }
.mock-header-tagline { font-size: 10px; color: var(--text-dim); letter-spacing: 0.5px; }
.mock-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.mock-status-count {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
}
.mock-status-count .dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}
.mock-live {
  display: flex;
  align-items: center;
  gap: 6px;
}
.mock-live-text { font-size: 10px; color: var(--text-dim); }
.mock-live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--safe);
  box-shadow: 0 0 6px var(--safe);
  animation: pulse-dot 2s ease-in-out infinite;
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* 3-column layout */
.mock-body {
  display: grid;
  grid-template-columns: 260px 1fr 290px;
  min-height: 400px;
  font-size: 10px;
}

.mock-agents {
  border-right: 1px solid var(--panel-border);
  display: flex;
  flex-direction: column;
}
.mock-col-header {
  padding: 8px 12px;
  font-size: 10px;
  font-weight: 700;
  color: var(--text-label);
  text-transform: uppercase;
  letter-spacing: 2px;
  border-bottom: 1px solid var(--panel-border);
  display: flex;
  align-items: center;
  gap: 6px;
  height: 33px;
}
.mock-col-header svg { color: var(--text-label); }
.mock-col-header .count { font-size: 9px; color: var(--text-sub); margin-left: auto; font-weight: 400; }

/* Environment group */
.mock-env-group {
  padding: 6px 8px 0;
}
.mock-env-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
}
.mock-env-header svg { color: var(--text-label); }
.mock-env-name { font-size: 11px; font-weight: 700; color: var(--text-primary); }
.mock-env-type { font-size: 9px; color: var(--text-sub); text-transform: uppercase; letter-spacing: 1px; }
.mock-env-count { margin-left: auto; font-size: 9px; color: var(--text-label); display: flex; align-items: center; gap: 3px; }

/* Project group */
.mock-project-group {
  border: 1px solid var(--panel-border);
  border-radius: 3px;
  background: var(--card);
  margin-top: 6px;
}
.mock-project-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
}
.mock-project-header svg { color: var(--text-dim); }
.mock-project-name { font-size: 11px; font-weight: 700; color: var(--text-primary); }
.mock-project-branch { font-size: 9px; color: var(--text-sub); display: flex; align-items: center; gap: 3px; }
.mock-project-count { margin-left: auto; font-size: 9px; color: var(--text-sub); }
.mock-project-sessions { padding: 0 6px 6px; }

/* Session card */
.mock-session {
  border: 1px solid;
  border-radius: 3px;
  padding: 8px 10px;
  margin-top: 5px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.mock-session.working {
  border-color: rgba(163,177,138,0.3);
  background: rgba(163,177,138,0.03);
  box-shadow: 0 0 12px rgba(163,177,138,0.12), inset 0 0 12px rgba(163,177,138,0.04);
}
.mock-session.thinking {
  border-color: rgba(123,159,191,0.25);
  background: rgba(123,159,191,0.03);
}
.mock-session.waiting {
  background: linear-gradient(135deg, rgba(201,169,110,0.06), rgba(201,169,110,0.03));
  border-color: rgba(201,169,110,0.4);
  animation: waiting-border 2s ease-in-out infinite;
}
@keyframes waiting-border {
  0%, 100% { border-color: rgba(201,169,110,0.4); box-shadow: 0 0 0 0 rgba(201,169,110,0); }
  50% { border-color: rgba(201,169,110,0.7); box-shadow: 0 0 12px 0 rgba(201,169,110,0.1); }
}
.mock-session-row1 {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
}
.mock-session .s-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.mock-session .s-id {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-primary);
}
.mock-session .s-time {
  font-size: 9px;
  color: var(--text-sub);
  margin-left: auto;
}
.mock-session .s-badge {
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 1px 5px;
  border-radius: 2px;
  flex-shrink: 0;
}
.mock-session .s-meta {
  font-size: 9px;
  color: var(--text-dim);
  display: flex;
  gap: 6px;
  align-items: center;
}
.mock-session .s-meta svg { flex-shrink: 0; }
.mock-session .s-tool {
  font-size: 9px;
  color: var(--text-dim);
  margin-top: 3px;
  padding-top: 3px;
  border-top: 1px solid rgba(61,58,52,0.2);
  display: flex;
  gap: 4px;
  align-items: center;
}
.mock-session .s-tool-name { font-weight: 700; color: var(--text-label); }

/* Waiting input banner inside session card */
.mock-waiting-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-weight: 700;
  color: var(--suspicious);
  margin-top: 4px;
}
.mock-waiting-label .wd {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--suspicious);
  box-shadow: 0 0 6px var(--suspicious);
  animation: pulse-dot 2s ease-in-out infinite;
}

.mock-detail {
  border-right: 1px solid var(--panel-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.mock-detail-header {
  padding: 8px 12px;
  font-size: 9px;
  border-bottom: 1px solid var(--panel-border);
  display: flex;
  align-items: center;
  gap: 8px;
  height: 33px;
}
.mock-detail-header .d-close { color: var(--text-sub); font-size: 11px; cursor: default; }
.mock-detail-header .d-id { font-weight: 700; color: var(--text-primary); font-size: 10px; }
.mock-detail-header .d-perm { color: var(--text-sub); font-size: 9px; }
.mock-detail-header .d-project { color: var(--text-dim); font-size: 9px; }
.mock-detail-header .d-model { color: var(--text-dim); font-size: 9px; margin-left: auto; }

/* Tool call rows */
.mock-tool-row {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-bottom: 1px solid rgba(61,58,52,0.15);
  font-size: 9px;
  opacity: 0;
  transform: translateY(-3px);
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.mock-tool-row.visible { opacity: 1; transform: translateY(0); }
.mock-tool-row .d-icon { color: var(--text-dim); width: 14px; text-align: center; font-size: 10px; flex-shrink: 0; font-family: inherit; }
.mock-tool-row .d-name { font-weight: 700; color: var(--text-label); font-size: 10px; }
.mock-tool-row .d-file {
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 600;
  font-size: 10px;
}
.mock-tool-row .d-file.src { background: rgba(123,159,191,0.15); color: var(--thinking); }
.mock-tool-row .d-file.config { background: rgba(176,123,172,0.15); color: var(--agent); }
.mock-tool-row .d-file.test { background: rgba(163,177,138,0.15); color: var(--safe); }
.mock-tool-row .d-diff { font-size: 8px; font-family: inherit; }
.mock-tool-row .d-pill {
  font-size: 8px;
  color: var(--text-sub);
  background: rgba(74,70,64,0.2);
  padding: 0 4px;
  border-radius: 2px;
}
.mock-tool-row .d-bash-cmd { color: var(--text-dim); font-size: 9px; }
.mock-tool-row .d-bash-ok { font-size: 8px; color: var(--safe); background: rgba(163,177,138,0.12); padding: 0 4px; border-radius: 2px; }
.mock-tool-row .d-grep { color: var(--text-dim); font-size: 9px; }
.mock-tool-row .d-time { color: var(--text-sub); margin-left: auto; font-size: 8px; flex-shrink: 0; }

/* Session info bar at bottom */
.mock-detail-footer {
  margin-top: auto;
  padding: 8px 12px;
  border-top: 1px solid var(--panel-border);
  background: var(--item);
}
.mock-detail-footer .row1 {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
}
.mock-detail-footer .row1 .fd {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--safe);
  box-shadow: 0 0 4px var(--safe);
  animation: pulse-dot 2s ease-in-out infinite;
}
.mock-detail-footer .row1 svg { flex-shrink: 0; }
.mock-detail-footer .row2 {
  display: flex;
  gap: 6px;
  font-size: 9px;
  color: var(--text-dim);
  margin-top: 2px;
}

.mock-right {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.mock-activity {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-bottom: 1px solid var(--panel-border);
}
.mock-activity-scroll {
  flex: 1;
  overflow: hidden;
}
.mock-evt {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  padding: 5px 8px;
  border-bottom: 1px solid rgba(61,58,52,0.15);
  font-size: 9px;
  opacity: 0;
  transform: translateY(-3px);
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.mock-evt.visible { opacity: 1; transform: translateY(0); }
.mock-evt .e-sid {
  font-size: 7px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 2px;
  flex-shrink: 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.mock-evt .e-icon { font-size: 9px; width: 12px; text-align: center; flex-shrink: 0; }
.mock-evt .e-name { font-weight: 700; text-transform: uppercase; font-size: 9px; }
.mock-evt .e-file {
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 600;
  font-size: 9px;
}
.mock-evt .e-file.src { background: rgba(123,159,191,0.15); color: var(--thinking); }
.mock-evt .e-file.config { background: rgba(176,123,172,0.15); color: var(--agent); }
.mock-evt .e-file.test { background: rgba(163,177,138,0.15); color: var(--safe); }
.mock-evt .e-detail { color: var(--text-dim); font-size: 9px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mock-evt .e-time { color: var(--text-sub); margin-left: auto; font-size: 8px; flex-shrink: 0; }

/* Conflicts section */
.mock-conflicts {
  flex-shrink: 0;
}
.mock-conflict-row {
  padding: 6px 8px;
  margin: 6px 6px;
  border: 1px solid rgba(184,92,74,0.3);
  border-radius: 3px;
  background: rgba(184,92,74,0.05);
}
.mock-conflict-file {
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 600;
  font-size: 10px;
  background: rgba(123,159,191,0.15);
  color: var(--thinking);
  display: inline-block;
  margin-bottom: 4px;
}
.mock-conflict-sids {
  display: flex;
  gap: 4px;
  margin-bottom: 3px;
}
.mock-conflict-sids span {
  font-size: 7px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 1px 5px;
  border-radius: 2px;
}
.mock-conflict-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 9px;
  color: var(--attack);
}
.mock-conflict-label svg { flex-shrink: 0; }

.transparency {
  padding: 80px 0 64px;
}
.transp-box {
  max-width: 640px;
  margin: 0 auto;
  background: var(--card);
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  padding: 28px 32px;
}
.transp-box h3 {
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 16px;
  color: var(--text-primary);
}
.transp-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.transp-col h4 {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
}
.transp-col.yes h4 { color: var(--safe); }
.transp-col.no h4 { color: var(--attack); }
.transp-col ul {
  list-style: none;
  font-size: 12px;
  color: var(--text-dim);
  line-height: 2;
}
.transp-col ul li::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 8px;
  position: relative;
  top: -1px;
}
.transp-col.yes ul li::before { background: var(--safe); }
.transp-col.no ul li::before { background: var(--attack); }

.stats-section {
  padding: 0 0 80px;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--panel-border);
  border-radius: 10px;
  overflow: hidden;
}
.stat-card {
  background: var(--card);
  padding: 28px 20px;
  text-align: center;
}
.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
  font-variant-numeric: tabular-nums;
}
.stat-label {
  font-size: 11px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.section-heading {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 12px;
  letter-spacing: 0.5px;
}
.section-sub {
  font-size: 13px;
  color: var(--text-dim);
  margin-bottom: 48px;
  max-width: 480px;
}

.features {
  padding: 80px 0;
  border-top: 1px solid var(--panel-border);
  border-bottom: 1px solid var(--panel-border);
}
.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
.feature {
  padding: 28px;
  background: var(--card);
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.feature:hover {
  border-color: var(--text-sub);
  background: var(--card-hover);
  transform: translateY(-3px);
  box-shadow: 0 12px 24px rgba(0,0,0,0.3);
}
.feature-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}
.feature-icon.green { background: var(--safe-dim); color: var(--safe); }
.feature-icon.yellow { background: rgba(201,169,110,0.15); color: var(--suspicious); }
.feature-icon.red { background: rgba(184,92,74,0.15); color: var(--attack); }
.feature h3 { font-size: 14px; font-weight: 700; margin-bottom: 10px; }
.feature p { font-size: 12px; color: var(--text-dim); line-height: 1.8; }

.how-it-works {
  padding: 80px 0;
  border-bottom: 1px solid var(--panel-border);
}
.steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  position: relative;
}
.step {
  padding: 28px;
  background: var(--card);
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  position: relative;
}
.step-num {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--safe);
  color: var(--bg);
  border-radius: 6px;
  font-weight: 700;
  font-size: 12px;
  margin-bottom: 16px;
}
.step h4 { font-size: 14px; font-weight: 700; margin-bottom: 8px; }
.step p { font-size: 12px; color: var(--text-dim); line-height: 1.8; }

.privacy {
  padding: 80px 0;
  border-bottom: 1px solid var(--panel-border);
}
.privacy-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}
.privacy-item {
  padding: 24px;
  background: var(--card);
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  display: flex;
  gap: 16px;
  align-items: flex-start;
  transition: border-color 0.2s;
}
.privacy-item:hover { border-color: var(--text-sub); }
.privacy-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--safe-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--safe);
}
.privacy-item strong { display: block; font-size: 13px; margin-bottom: 6px; }
.privacy-item p { font-size: 12px; color: var(--text-dim); line-height: 1.7; }

.faq-section {
  padding: 80px 0;
  border-bottom: 1px solid var(--panel-border);
}
.faq-item {
  border-bottom: 1px solid var(--panel-border);
}
.faq-item:first-child { border-top: 1px solid var(--panel-border); }
.faq-q {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 18px 0;
  background: none;
  border: none;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
}
.faq-q:hover { color: var(--safe); }
.faq-q .faq-arrow {
  margin-left: auto;
  transition: transform 0.2s;
  color: var(--text-sub);
}
.faq-q.open .faq-arrow { transform: rotate(180deg); }
.faq-a {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease, padding 0.3s ease;
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.8;
}
.faq-a.open {
  max-height: 200px;
  padding-bottom: 18px;
}

.final-cta {
  padding: 100px 0;
  text-align: center;
  position: relative;
}
.final-cta::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  height: 400px;
  background: radial-gradient(ellipse, rgba(163,177,138,0.08), transparent 70%);
  pointer-events: none;
}
.final-cta .container { position: relative; }
.final-cta h2 { font-size: 28px; margin-bottom: 12px; font-weight: 700; }
.final-cta p { font-size: 13px; color: var(--text-dim); margin-bottom: 36px; }

footer {
  padding: 24px 0;
  border-top: 1px solid var(--panel-border);
  font-size: 11px;
  color: var(--text-sub);
}
footer .container { display: flex; align-items: center; gap: 8px; }
footer .sep { color: var(--panel-border); }

@media (max-width: 900px) {
  .mock-body { grid-template-columns: 1fr; min-height: auto; }
  .mock-agents { border-right: none; border-bottom: 1px solid var(--panel-border); }
  .mock-detail { border-right: none; border-bottom: 1px solid var(--panel-border); }
  .mock-right { display: none; }
}
@media (max-width: 768px) {
  .hero { padding: 56px 0 0; }
  .logo h1 { font-size: 28px; }
  .tagline { font-size: 15px; }
  .mock-body { grid-template-columns: 1fr; }
  .mock-agents { display: none; }
  .mock-detail { border-right: none; }
  .mock-right { display: none; }
  .mock-header-tagline { display: none; }
  .mock-header-sep { display: none; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .feature-grid { grid-template-columns: 1fr; }
  .steps { grid-template-columns: 1fr; }
  .privacy-grid { grid-template-columns: 1fr; }
  .section-heading { font-size: 18px; }
  .final-cta h2 { font-size: 22px; }
  .final-cta { padding: 64px 0; }
}
@media (max-width: 480px) {
  .stats-grid { grid-template-columns: 1fr 1fr; }
  .cta-row { flex-direction: column; }
  .install-cmd { width: 100%; justify-content: center; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
  </style>
</head>
<body>

  <section class="hero">
    <div class="container">
      <div class="logo fade-in">
        <div class="logo-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <h1>Claude<span style="color: var(--suspicious);">Mon</span></h1>
      </div>
      <p class="tagline fade-in fade-in-d1">the lightweight monitor for Claude Code</p>
      <p class="subtitle fade-in fade-in-d2">See what every agent is doing across machines and branches. Detect file conflicts before they happen. Know when Claude needs your input.</p>
      <div style="display:flex; align-items:center; justify-content:center; gap:12px; margin-bottom:24px; font-size:11px; color:#6b6560;" class="fade-in fade-in-d2">
        <span>Open source</span>
        <span style="color:#3d3a34;">|</span>
        <span>Self-hostable</span>
        <span style="color:#3d3a34;">|</span>
        <span>Zero persistent storage</span>
      </div>
      <div class="cta-row fade-in fade-in-d3">
        <a href="https://app.claudemon.com" class="btn btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M14 9l3 3-3 3"/></svg>
          Open Dashboard
        </a>
        <span class="install-cmd" id="installCmd" title="Click to copy">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
          npx claudemon-cli init
          <span class="copied-toast" id="copiedToast">Copied</span>
        </span>
      </div>
    </div>

    <div class="wide-container">
      <div class="hero-dashboard" id="heroDash">
        <div class="mock-browser">
          <div class="mock-browser-bar">
            <div class="mock-dots"><span></span><span></span><span></span></div>
            <div class="mock-url">app.claudemon.com</div>
          </div>

          <div class="mock-header">
            <div class="mock-header-left">
              <span class="mock-header-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                ClaudeMon
              </span>
              <span class="mock-header-sep">|</span>
              <span class="mock-header-tagline">the lightweight monitor for Claude Code</span>
            </div>
            <div class="mock-header-right">
              <span class="mock-status-count" style="color:var(--safe);">
                <span class="dot" style="background:var(--safe);box-shadow:0 0 4px var(--safe);animation:pulse-dot 2s ease-in-out infinite;"></span>
                2 active
              </span>
              <span class="mock-status-count" style="color:var(--suspicious);font-weight:700;">
                <span class="dot" style="background:var(--suspicious);box-shadow:0 0 6px var(--suspicious);animation:pulse-dot 2s ease-in-out infinite;"></span>
                1 waiting
              </span>
              <span class="mock-live">
                <span class="mock-live-text">LIVE</span>
                <span class="mock-live-dot"></span>
              </span>
            </div>
          </div>

          <div class="mock-body">
            <div class="mock-agents">
              <div class="mock-col-header">
                <svg width="12" height="12" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"><path d="M128 24v64"/><path d="M128 160v72"/><path d="M56 160v72"/><path d="M200 160v72"/><path d="M56 160a24 24 0 0 1 24-24h96a24 24 0 0 1 24 24"/><circle cx="128" cy="108" r="20"/></svg>
                Agent Map
                <span class="count">3 sessions</span>
              </div>

              <div class="mock-env-group">
                <div class="mock-env-header">
                  <svg width="10" height="10" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"><rect x="32" y="48" width="192" height="140" rx="16"/><path d="M160 232H96"/><path d="M128 188v44"/></svg>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--text-sub)" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                  <span class="mock-env-name">dev-machine</span>
                  <span class="mock-env-type">local</span>
                  <span class="mock-env-count">
                    <svg width="8" height="8" viewBox="0 0 256 256" fill="none" stroke="var(--safe)" stroke-width="20"><path d="M128 128a40 40 0 1 1 0-1"/><path d="M128 28a100 100 0 1 1 0 200"/></svg>
                    3
                  </span>
                </div>

                <div class="mock-project-group">
                  <div class="mock-project-header">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--text-sub)" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    <svg width="10" height="10" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"><path d="M216 72H40a8 8 0 0 1-8-8V48a8 8 0 0 1 8-8h64l24 24h88a8 8 0 0 1 8 8v168a8 8 0 0 1-8 8H40a8 8 0 0 1-8-8V72"/></svg>
                    <span class="mock-project-name">claudemon</span>
                    <span class="mock-project-branch">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3v12"/><path d="M18 9a3 3 0 0 1-3 3H6"/></svg>
                      main
                    </span>
                    <span class="mock-project-count">2 sessions</span>
                  </div>
                  <div class="mock-project-sessions">
                    <div class="mock-session working">
                      <div class="mock-session-row1">
                        <span class="s-dot" style="background:var(--safe);box-shadow:0 0 6px var(--safe);animation:pulse-dot 2s ease-in-out infinite;"></span>
                        <span class="s-id">a3f2b8c1</span>
                        <span class="s-time">4m 12s</span>
                        <span class="s-badge" style="color:var(--safe);background:rgba(163,177,138,0.2);">Working</span>
                      </div>
                      <div class="s-meta">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3v12"/><path d="M18 9a3 3 0 0 1-3 3H6"/></svg>
                        main
                        <span>3 edits &middot; 6 cmds</span>
                      </div>
                      <div class="s-tool">
                        <span class="s-tool-name">Edit</span>
                        <span style="color:var(--thinking);">src/index.ts</span>
                      </div>
                    </div>

                    <div class="mock-session thinking">
                      <div class="mock-session-row1">
                        <span class="s-dot" style="background:var(--thinking);box-shadow:0 0 6px var(--thinking);animation:pulse-dot 2s ease-in-out infinite;"></span>
                        <span class="s-id">b7d2e914</span>
                        <span class="s-time">1m 45s</span>
                        <span class="s-badge" style="color:var(--thinking);background:rgba(123,159,191,0.2);">Thinking</span>
                      </div>
                      <div class="s-meta">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3v12"/><path d="M18 9a3 3 0 0 1-3 3H6"/></svg>
                        feat/api
                        <span>1 edit &middot; 3 cmds</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="mock-project-group" style="margin-bottom:8px;">
                  <div class="mock-project-header">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--text-sub)" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    <svg width="10" height="10" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"><path d="M216 72H40a8 8 0 0 1-8-8V48a8 8 0 0 1 8-8h64l24 24h88a8 8 0 0 1 8 8v168a8 8 0 0 1-8 8H40a8 8 0 0 1-8-8V72"/></svg>
                    <span class="mock-project-name">vector-seo</span>
                    <span class="mock-project-branch">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3v12"/><path d="M18 9a3 3 0 0 1-3 3H6"/></svg>
                      main
                    </span>
                    <span class="mock-project-count">1 session</span>
                  </div>
                  <div class="mock-project-sessions">
                    <div class="mock-session waiting">
                      <div class="mock-session-row1">
                        <span class="s-dot" style="background:var(--suspicious);box-shadow:0 0 8px var(--suspicious);animation:pulse-dot 2s ease-in-out infinite;"></span>
                        <span class="s-id">c4e9a1f0</span>
                        <span class="s-time">2m 33s</span>
                        <span class="s-badge" style="color:var(--suspicious);background:rgba(201,169,110,0.2);font-size:9px;padding:1px 7px;">Waiting</span>
                      </div>
                      <div class="s-meta">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3v12"/><path d="M18 9a3 3 0 0 1-3 3H6"/></svg>
                        main
                        <span>5 edits &middot; 2 cmds</span>
                      </div>
                      <div class="mock-waiting-label">
                        <span class="wd"></span>
                        Claude needs your input
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="mock-detail">
              <div class="mock-detail-header">
                <span class="d-close">x</span>
                <span class="d-id">a3f2b8c1</span>
                <span class="d-perm">bypass</span>
                <span class="d-project">claudemon</span>
                <span class="d-model">opus-4-6</span>
              </div>

              <div class="mock-tool-row" data-mock-idx="0">
                <span class="d-icon">.</span>
                <span class="d-name">Read</span>
                <span class="d-file src">store.ts</span>
                <span class="d-pill">85 lines</span>
                <span class="d-time">4m ago</span>
              </div>
              <div class="mock-tool-row" data-mock-idx="1">
                <span class="d-icon">~</span>
                <span class="d-name">Edit</span>
                <span class="d-file src">index.ts</span>
                <span class="d-diff"><span style="color:var(--safe);">+5</span> <span style="color:var(--attack);">-2</span></span>
                <span class="d-time">3m ago</span>
              </div>
              <div class="mock-tool-row" data-mock-idx="2">
                <span class="d-icon">>_</span>
                <span class="d-name">Bash</span>
                <span class="d-bash-cmd">npm run build</span>
                <span class="d-bash-ok">0 errors</span>
                <span class="d-time">2m ago</span>
              </div>
              <div class="mock-tool-row" data-mock-idx="3">
                <span class="d-icon">?</span>
                <span class="d-name">Grep</span>
                <span class="d-grep">/handleEvent/</span>
                <span class="d-time">1m ago</span>
              </div>
              <div class="mock-tool-row" data-mock-idx="4">
                <span class="d-icon">~</span>
                <span class="d-name">Edit</span>
                <span class="d-file config">wrangler.toml</span>
                <span class="d-diff"><span style="color:var(--safe);">+1</span> <span style="color:var(--attack);">-1</span></span>
                <span class="d-time">30s ago</span>
              </div>
              <div class="mock-tool-row" data-mock-idx="5">
                <span class="d-icon">.</span>
                <span class="d-name">Read</span>
                <span class="d-file test">relay.test.ts</span>
                <span class="d-pill">158 lines</span>
                <span class="d-time">just now</span>
              </div>

              <div class="mock-detail-footer">
                <div class="row1">
                  <span class="fd"></span>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--text-sub)" stroke-width="2"><path d="M6 3v12"/><path d="M18 9a3 3 0 0 1-3 3H6"/></svg>
                  <span style="color:var(--text-sub);">main</span>
                  <span style="color:var(--text-sub);margin-left:auto;">4m 12s</span>
                </div>
                <div class="row2">
                  <span>3 edits</span>
                  <span>6 cmds</span>
                  <span>4 reads</span>
                  <span>2 searches</span>
                  <span>&middot;</span>
                  <span>3.4 tools/min</span>
                </div>
              </div>
            </div>

            <div class="mock-right">
              <div class="mock-activity">
                <div class="mock-col-header">
                  <svg width="12" height="12" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"><path d="M40 68h176"/><path d="M40 108h176"/><path d="M40 148h176"/><path d="M40 188h176"/></svg>
                  Activity
                  <span class="count" id="evtCount">0 events</span>
                </div>
                <div class="mock-activity-scroll">
                  <div class="mock-evt" data-evt-idx="0">
                    <span class="e-sid" style="color:var(--safe);background:rgba(163,177,138,0.12);">a3f2b8</span>
                    <span class="e-icon" style="color:var(--text-sub);">.</span>
                    <span class="e-name" style="color:var(--text-label);">Read</span>
                    <span class="e-file src">store.ts</span>
                    <span class="e-time">4m</span>
                  </div>
                  <div class="mock-evt" data-evt-idx="1">
                    <span class="e-sid" style="color:var(--safe);background:rgba(163,177,138,0.12);">a3f2b8</span>
                    <span class="e-icon" style="color:var(--suspicious);">~</span>
                    <span class="e-name" style="color:var(--suspicious);">Edit</span>
                    <span class="e-file src">index.ts</span>
                    <span class="e-time">3m</span>
                  </div>
                  <div class="mock-evt" data-evt-idx="2">
                    <span class="e-sid" style="color:var(--safe);background:rgba(163,177,138,0.12);">a3f2b8</span>
                    <span class="e-icon" style="color:var(--thinking);">>_</span>
                    <span class="e-name" style="color:var(--thinking);">Bash</span>
                    <span class="e-detail">npm run build</span>
                    <span class="e-time">2m</span>
                  </div>
                  <div class="mock-evt" data-evt-idx="3">
                    <span class="e-sid" style="color:var(--safe);background:rgba(163,177,138,0.12);">a3f2b8</span>
                    <span class="e-icon" style="color:var(--text-sub);">?</span>
                    <span class="e-name" style="color:var(--text-label);">Grep</span>
                    <span class="e-detail">/handleEvent/</span>
                    <span class="e-time">1m</span>
                  </div>
                  <div class="mock-evt" data-evt-idx="4">
                    <span class="e-sid" style="color:var(--safe);background:rgba(163,177,138,0.12);">a3f2b8</span>
                    <span class="e-icon" style="color:var(--suspicious);">~</span>
                    <span class="e-name" style="color:var(--suspicious);">Edit</span>
                    <span class="e-file config">wrangler.toml</span>
                    <span class="e-time">30s</span>
                  </div>
                  <div class="mock-evt" data-evt-idx="5">
                    <span class="e-sid" style="color:var(--safe);background:rgba(163,177,138,0.12);">a3f2b8</span>
                    <span class="e-icon" style="color:var(--text-sub);">.</span>
                    <span class="e-name" style="color:var(--text-label);">Read</span>
                    <span class="e-file test">relay.test.ts</span>
                    <span class="e-time">now</span>
                  </div>
                  <div class="mock-evt" data-evt-idx="2" style="opacity:0;">
                    <span class="e-sid" style="color:var(--thinking);background:rgba(123,159,191,0.12);">b7d2e9</span>
                    <span class="e-icon" style="color:var(--thinking);">>_</span>
                    <span class="e-name" style="color:var(--thinking);">Bash</span>
                    <span class="e-detail">npm test</span>
                    <span class="e-time">1m</span>
                  </div>
                  <div class="mock-evt" data-evt-idx="3" style="opacity:0;">
                    <span class="e-sid" style="color:var(--suspicious);background:rgba(201,169,110,0.12);">c4e9a1</span>
                    <span class="e-icon" style="color:var(--suspicious);">?!</span>
                    <span class="e-name" style="color:var(--suspicious);">Notify</span>
                    <span class="e-detail">needs input</span>
                    <span class="e-time">2m</span>
                  </div>
                </div>
              </div>

              <div class="mock-conflicts">
                <div class="mock-col-header">
                  <svg width="12" height="12" viewBox="0 0 256 256" fill="none" stroke="var(--attack)" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"><path d="M96 240l64-192"/><path d="M16 128h48l16-48 32 96 16-48h48"/></svg>
                  <span style="color:var(--text-label);">Conflicts</span>
                  <span class="count" style="color:var(--attack);font-weight:700;">1</span>
                </div>
                <div class="mock-conflict-row">
                  <span class="mock-conflict-file">src/index.ts</span>
                  <div class="mock-conflict-sids">
                    <span style="color:var(--safe);background:rgba(163,177,138,0.12);border:1px solid rgba(163,177,138,0.2);">a3f2b8c1</span>
                    <span style="color:var(--thinking);background:rgba(123,159,191,0.12);border:1px solid rgba(123,159,191,0.2);">b7d2e914</span>
                  </div>
                  <div class="mock-conflict-label">
                    <svg width="8" height="8" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"><path d="M96 240l64-192"/><path d="M16 128h48l16-48 32 96 16-48h48"/></svg>
                    Both editing
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="transparency fade-in">
    <div class="container">
      <div class="transp-box">
        <h3>What gets sent to ClaudeMon</h3>
        <div class="transp-cols">
          <div class="transp-col yes">
            <h4>Sent</h4>
            <ul>
              <li>Tool names (Read, Edit, Bash)</li>
              <li>File paths</li>
              <li>Session IDs</li>
              <li>Timestamps</li>
            </ul>
          </div>
          <div class="transp-col no">
            <h4>Never sent</h4>
            <ul>
              <li>File contents</li>
              <li>Conversations</li>
              <li>API keys</li>
              <li>Environment variables</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="stats-section fade-in">
    <div class="container">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value" data-count="27">0</div>
          <div class="stat-label">Hook Events</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" data-prefix="< " data-count="50" data-suffix="ms">0</div>
          <div class="stat-label">Overhead</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">Zero</div>
          <div class="stat-label">Persistent Storage</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">OSS</div>
          <div class="stat-label">Open Source</div>
        </div>
      </div>
    </div>
  </section>

  <section class="features">
    <div class="container">
      <h2 class="section-heading fade-in">What you get</h2>
      <p class="section-sub fade-in">Everything updates over WebSocket. No polling, no refresh.</p>
      <div class="feature-grid">
        <div class="feature fade-in">
          <div class="feature-icon green">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.07-7.07l-2.83 2.83M9.76 14.24l-2.83 2.83m0-10.14l2.83 2.83m4.48 4.48l2.83 2.83"/></svg>
          </div>
          <h3>Agent Map</h3>
          <p>Live topology of all Claude Code sessions. See status, branch, project, and current tool call at a glance. Sessions across machines, worktrees, and cloud instances.</p>
        </div>
        <div class="feature fade-in fade-in-d1">
          <div class="feature-icon yellow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <h3>Live Activity</h3>
          <p>Real-time stream of every tool call, edit, bash command, and search. Click into any session for the full timeline with inline diffs and syntax-highlighted output.</p>
        </div>
        <div class="feature fade-in fade-in-d2">
          <div class="feature-icon red">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <h3>Conflict Detection</h3>
          <p>Automatic detection when multiple sessions edit the same file. Catch merge conflicts before they happen. Real-time alerts when agents step on each other.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="how-it-works">
    <div class="container">
      <h2 class="section-heading fade-in">How it works</h2>
      <p class="section-sub fade-in">Three steps. Under a minute.</p>
      <div class="steps">
        <div class="step fade-in">
          <span class="step-num">1</span>
          <h4>Install the hook</h4>
          <p>Run <code>npx claudemon-cli init</code>. It adds a lightweight async hook to your Claude Code settings. Under 50ms overhead, non-blocking.</p>
        </div>
        <div class="step fade-in fade-in-d1">
          <span class="step-num">2</span>
          <h4>Use Claude Code normally</h4>
          <p>Every tool call, edit, and command fires an event to the ClaudeMon relay. Events are ephemeral -- no persistent database, no data retention.</p>
        </div>
        <div class="step fade-in fade-in-d2">
          <span class="step-num">3</span>
          <h4>Watch the dashboard</h4>
          <p>Open <a href="https://app.claudemon.com">app.claudemon.com</a> to see all your sessions in real time. WebSocket-powered, instant updates.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="privacy">
    <div class="container">
      <h2 class="section-heading fade-in">Privacy-first architecture</h2>
      <p class="section-sub fade-in">No tracking, no accounts, no data retention.</p>
      <div class="privacy-grid">
        <div class="privacy-item fade-in">
          <div class="privacy-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div>
            <strong>Ephemeral relay</strong>
            <p>No persistent database. Events live in Durable Object memory and auto-purge after 1 hour of inactivity.</p>
          </div>
        </div>
        <div class="privacy-item fade-in fade-in-d1">
          <div class="privacy-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </div>
          <div>
            <strong>You control what's sent</strong>
            <p>The hook sends tool metadata including file paths, tool names, and inputs. Review the open-source hook script to see exactly what data flows through.</p>
          </div>
        </div>
        <div class="privacy-item fade-in">
          <div class="privacy-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 12h.01"/><path d="M17 12h.01"/><path d="M7 12h.01"/></svg>
          </div>
          <div>
            <strong>Self-hostable</strong>
            <p>Run your own ClaudeMon instance on Cloudflare Workers. One command deploy, zero ongoing cost on the free tier.</p>
          </div>
        </div>
        <div class="privacy-item fade-in fade-in-d1">
          <div class="privacy-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"/></svg>
          </div>
          <div>
            <strong>Open source</strong>
            <p>Every line of code is on GitHub. Audit the hook, the relay, and the dashboard yourself.</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="faq-section">
    <div class="container">
      <h2 class="section-heading fade-in">FAQ</h2>
      <div class="fade-in">
        <div class="faq-item">
          <button class="faq-q" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')">
            Is my code sent to ClaudeMon?
            <svg class="faq-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="faq-a">No. ClaudeMon only receives tool metadata: tool names, file paths, session IDs, and timestamps. File contents, conversations, and environment variables are never sent.</div>
        </div>
        <div class="faq-item">
          <button class="faq-q" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')">
            Can I self-host ClaudeMon?
            <svg class="faq-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="faq-a">Yes. ClaudeMon runs on Cloudflare Workers with Durable Objects. Clone the repo, run <code>wrangler deploy</code>, and point the CLI at your own instance. It fits within Cloudflare's free tier.</div>
        </div>
        <div class="faq-item">
          <button class="faq-q" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')">
            Does it slow down Claude Code?
            <svg class="faq-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="faq-a">No. The hook fires asynchronously and adds under 50ms of non-blocking overhead. Claude Code never waits for ClaudeMon to respond.</div>
        </div>
        <div class="faq-item">
          <button class="faq-q" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')">
            What events are tracked?
            <svg class="faq-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="faq-a">All 27 Claude Code hook events: SessionStart, SessionEnd, tool use events (PreToolUse, PostToolUse), notifications, permission requests, context compaction, subagent lifecycle, and more.</div>
        </div>
      </div>
    </div>
  </section>

  <section class="final-cta">
    <div class="container">
      <h2 class="fade-in">Start monitoring</h2>
      <p class="fade-in fade-in-d1">Set up in 30 seconds. No account required.</p>
      <div class="cta-row fade-in fade-in-d2">
        <a href="https://app.claudemon.com" class="btn btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M14 9l3 3-3 3"/></svg>
          Open Dashboard
        </a>
        <a href="https://github.com/anipotts/claudemon" class="btn btn-secondary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"/></svg>
          View Source
        </a>
      </div>
    </div>
  </section>

  <footer>
    <div class="container">
      <span>ClaudeMon</span>
      <span class="sep">|</span>
      <a href="https://github.com/anipotts/claudemon">GitHub</a>
    </div>
  </footer>

  <script>
  (function(){
    // Intersection Observer for fade-ins
    var fadeEls = document.querySelectorAll('.fade-in');
    if ('IntersectionObserver' in window) {
      var obs = new IntersectionObserver(function(entries) {
        entries.forEach(function(e) {
          if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
        });
      }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
      fadeEls.forEach(function(el) { obs.observe(el); });
    } else {
      fadeEls.forEach(function(el) { el.classList.add('visible'); });
    }

    // Copy install command
    var cmd = document.getElementById('installCmd');
    var toast = document.getElementById('copiedToast');
    if (cmd) {
      cmd.addEventListener('click', function() {
        navigator.clipboard.writeText('npx claudemon-cli init').then(function() {
          toast.classList.add('show');
          setTimeout(function() { toast.classList.remove('show'); }, 1500);
        });
      });
    }

    // Stats count-up
    var counted = false;
    var statEls = document.querySelectorAll('[data-count]');
    function countUp() {
      if (counted) return;
      counted = true;
      statEls.forEach(function(el) {
        var target = parseInt(el.getAttribute('data-count'));
        var prefix = el.getAttribute('data-prefix') || '';
        var suffix = el.getAttribute('data-suffix') || '';
        var duration = 1200;
        var startTime = null;
        function step(ts) {
          if (!startTime) startTime = ts;
          var progress = Math.min((ts - startTime) / duration, 1);
          var eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = prefix + Math.round(target * eased) + suffix;
          if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
    }
    if (statEls.length > 0 && 'IntersectionObserver' in window) {
      var statObs = new IntersectionObserver(function(entries) {
        if (entries[0].isIntersecting) { countUp(); statObs.disconnect(); }
      }, { threshold: 0.5 });
      statEls.forEach(function(el) { statObs.observe(el); });
    }

    // Dashboard mockup animation
    var dash = document.getElementById('heroDash');
    var toolRows = document.querySelectorAll('.mock-tool-row');
    var evtRows = document.querySelectorAll('.mock-evt');
    var evtCounter = document.getElementById('evtCount');
    var animRunning = false;

    function runDashAnim() {
      animRunning = true;
      // Reset all
      toolRows.forEach(function(r) { r.classList.remove('visible'); });
      evtRows.forEach(function(r) { r.classList.remove('visible'); r.style.opacity = ''; });

      var toolDelays = [0, 800, 1600, 2400, 3200, 4000];
      var loopMs = 8000;
      var visibleEvtCount = 0;

      toolRows.forEach(function(row, i) {
        setTimeout(function() {
          row.classList.add('visible');
          // Show matching activity event
          var matchEvt = evtRows[i];
          if (matchEvt) {
            matchEvt.classList.add('visible');
            matchEvt.style.opacity = '1';
          }
          visibleEvtCount = Math.min(i + 1, evtRows.length);
          if (evtCounter) evtCounter.textContent = visibleEvtCount + ' events';
          // Show cross-session events after main sequence
          if (i >= 4) {
            var extra = evtRows[6];
            if (extra) { extra.classList.add('visible'); extra.style.opacity = '1'; }
          }
          if (i >= 5) {
            var extra2 = evtRows[7];
            if (extra2) { extra2.classList.add('visible'); extra2.style.opacity = '1'; }
            if (evtCounter) evtCounter.textContent = '8 events';
          }
        }, toolDelays[i]);
      });

      // Loop: fade out then replay
      setTimeout(function() {
        toolRows.forEach(function(r) {
          r.style.transition = 'opacity 0.4s ease';
          r.style.opacity = '0';
        });
        evtRows.forEach(function(r) {
          r.style.transition = 'opacity 0.4s ease';
          r.style.opacity = '0';
        });
        setTimeout(function() {
          toolRows.forEach(function(r) {
            r.classList.remove('visible');
            r.style.transition = '';
            r.style.opacity = '';
          });
          evtRows.forEach(function(r) {
            r.classList.remove('visible');
            r.style.transition = '';
            r.style.opacity = '';
          });
          runDashAnim();
        }, 500);
      }, loopMs);
    }

    // Start dashboard animation when visible
    if (dash && 'IntersectionObserver' in window) {
      var dashObs = new IntersectionObserver(function(entries) {
        if (entries[0].isIntersecting) {
          dash.classList.add('visible');
          if (!animRunning) runDashAnim();
        }
      }, { threshold: 0.15 });
      dashObs.observe(dash);
    } else if (dash) {
      dash.classList.add('visible');
      runDashAnim();
    }
  })();
  </script>
</body>
</html>`;
