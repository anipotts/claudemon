export const LANDING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ClaudeMon — Monitor your Claude Code sessions in real time</title>
  <meta name="description" content="Real-time monitoring for Claude Code sessions. See what every agent is doing, detect file conflicts, know when Claude needs your input.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@300..800&display=swap" rel="stylesheet">
  <style>
:root {
  --bg: #0a0a0a;
  --bg-subtle: #0e0e0c;
  --panel: #1a1916;
  --panel-border: #3d3a34;
  --card: #141210;
  --card-hover: #1a1816;
  --text-primary: #e8e0d4;
  --text-label: #8a8478;
  --text-dim: #6b6560;
  --text-sub: #4a4640;
  --safe: #a3b18a;
  --safe-dim: rgba(163, 177, 138, 0.15);
  --suspicious: #c9a96e;
  --attack: #b85c4a;
  --thinking: #7b9dba;
  --done: #5a5650;
  --glow-green: rgba(163, 177, 138, 0.08);
  --glow-term: rgba(163, 177, 138, 0.03);
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

.container {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 24px;
}

a { color: var(--safe); text-decoration: none; }
a:hover { text-decoration: underline; }
code { background: var(--panel); padding: 2px 8px; border-radius: 4px; font-size: 13px; font-family: inherit; }

/* Fade-in on scroll */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}

.fade-in {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.fade-in.visible {
  opacity: 1;
  transform: translateY(0);
}

/* Hero */
.hero {
  padding: 100px 0 0;
  text-align: center;
  position: relative;
}
.hero::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  height: 400px;
  background: radial-gradient(ellipse, var(--glow-green), transparent 70%);
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
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--safe);
  display: flex;
  align-items: center;
  justify-content: center;
}
.logo h1 {
  font-size: 36px;
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
  max-width: 520px;
  margin: 0 auto 36px;
  line-height: 1.8;
}
.cta-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
}
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 11px 28px;
  border-radius: 8px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s;
  border: none;
  cursor: pointer;
}
.btn-primary {
  background: var(--safe);
  color: var(--bg);
}
.btn-primary:hover { background: #b5c49c; text-decoration: none; transform: translateY(-1px); }
.btn-secondary {
  background: transparent;
  color: var(--text-label);
  border: 1px solid var(--panel-border);
}
.btn-secondary:hover { border-color: var(--text-dim); color: var(--text-primary); text-decoration: none; transform: translateY(-1px); }
.install-cmd {
  background: var(--panel);
  border: 1px solid var(--panel-border);
  padding: 11px 20px;
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
  color: var(--safe);
  cursor: pointer;
  user-select: all;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  transition: border-color 0.2s;
}
.install-cmd:hover { border-color: var(--safe); }
.install-cmd svg { color: var(--text-dim); flex-shrink: 0; }

/* Terminal mockup */
.terminal-section {
  padding: 64px 0 80px;
}
.terminal {
  max-width: 640px;
  margin: 0 auto;
  border-radius: 12px;
  border: 1px solid var(--panel-border);
  background: var(--card);
  overflow: hidden;
  position: relative;
  box-shadow:
    0 0 60px rgba(163, 177, 138, 0.06),
    0 0 120px rgba(163, 177, 138, 0.03),
    0 24px 48px rgba(0, 0, 0, 0.4);
}
.terminal::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(163, 177, 138, 0.008) 2px,
    rgba(163, 177, 138, 0.008) 4px
  );
  pointer-events: none;
  z-index: 2;
  border-radius: 12px;
}
.terminal-bar {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: var(--panel);
  border-bottom: 1px solid var(--panel-border);
  gap: 8px;
}
.terminal-dots {
  display: flex;
  gap: 6px;
}
.terminal-dots span {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--panel-border);
}
.terminal-dots span:first-child { background: #b85c4a; }
.terminal-dots span:nth-child(2) { background: var(--suspicious); }
.terminal-dots span:last-child { background: var(--safe); }
.terminal-title {
  flex: 1;
  text-align: center;
  font-size: 11px;
  color: var(--text-dim);
  letter-spacing: 0.5px;
}
.terminal-body {
  padding: 20px;
  font-size: 13px;
  line-height: 1.8;
  position: relative;
  z-index: 1;
}
.term-line {
  display: flex;
  align-items: baseline;
  gap: 0;
  white-space: nowrap;
  overflow: hidden;
}
.term-line + .term-line { margin-top: 2px; }
.term-sub {
  padding-left: 26px;
  color: var(--text-dim);
  font-size: 12px;
}
.term-spacer { height: 12px; }
.term-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 10px;
  flex-shrink: 0;
  position: relative;
  top: -1px;
}
.term-dot.working {
  background: var(--safe);
  box-shadow: 0 0 8px rgba(163, 177, 138, 0.5);
  animation: pulse 2s ease-in-out infinite;
}
.term-dot.thinking {
  background: var(--thinking);
  box-shadow: 0 0 8px rgba(123, 157, 186, 0.5);
  animation: pulse 2s ease-in-out infinite 0.5s;
}
.term-dot.done {
  background: var(--done);
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.term-project { color: var(--text-primary); font-weight: 600; min-width: 110px; display: inline-block; }
.term-branch { color: var(--suspicious); min-width: 90px; display: inline-block; }
.term-status { min-width: 80px; display: inline-block; }
.term-status.working { color: var(--safe); }
.term-status.thinking { color: var(--thinking); }
.term-status.done { color: var(--text-dim); }
.term-time { color: var(--text-sub); margin-left: auto; padding-left: 12px; }
.term-tool { color: var(--text-label); }
.term-file { color: var(--suspicious); }
.term-diff-add { color: var(--safe); }
.term-diff-del { color: var(--attack); }
.term-border-top {
  border-top: 1px solid var(--panel-border);
  margin: 0 -20px;
  padding: 0 20px;
}

/* Stats bar */
.stats-section {
  padding: 0 0 80px;
  border-bottom: 1px solid var(--panel-border);
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
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
}
.stat-label {
  font-size: 11px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* Section headings */
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

/* Features */
.features {
  padding: 80px 0;
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
  transition: border-color 0.2s, background 0.2s;
}
.feature:hover {
  border-color: var(--text-sub);
  background: var(--card-hover);
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
.feature-icon.yellow { background: rgba(201, 169, 110, 0.15); color: var(--suspicious); }
.feature-icon.red { background: rgba(184, 92, 74, 0.15); color: var(--attack); }
.feature h3 {
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 10px;
  letter-spacing: 0.3px;
}
.feature p {
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.8;
}

/* How it works */
.how-it-works {
  padding: 80px 0;
  border-bottom: 1px solid var(--panel-border);
}
.steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
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
.step h4 {
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 8px;
}
.step p {
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.8;
}

/* Privacy */
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
}
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
.privacy-item strong {
  display: block;
  font-size: 13px;
  margin-bottom: 6px;
  color: var(--text-primary);
}
.privacy-item p {
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.7;
}

/* Final CTA */
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
  width: 500px;
  height: 300px;
  background: radial-gradient(ellipse, var(--glow-green), transparent 70%);
  pointer-events: none;
}
.final-cta .container { position: relative; }
.final-cta h2 {
  font-size: 28px;
  margin-bottom: 12px;
  font-weight: 700;
}
.final-cta p {
  font-size: 13px;
  color: var(--text-dim);
  margin-bottom: 36px;
}

/* Footer */
footer {
  padding: 24px 0;
  border-top: 1px solid var(--panel-border);
  font-size: 11px;
  color: var(--text-sub);
}
footer .container {
  display: flex;
  align-items: center;
  gap: 8px;
}
footer .sep { color: var(--panel-border); }

/* Responsive */
@media (max-width: 768px) {
  .hero { padding: 72px 0 0; }
  .logo h1 { font-size: 28px; }
  .tagline { font-size: 15px; }
  .terminal-body { padding: 16px; font-size: 11px; overflow-x: auto; }
  .term-project { min-width: 80px; }
  .term-branch { min-width: 70px; }
  .term-status { min-width: 64px; }
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
  </style>
</head>
<body>
  <!-- Hero -->
  <section class="hero">
    <div class="container">
      <div class="logo">
        <div class="logo-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <h1>ClaudeMon</h1>
      </div>
      <p class="tagline">Monitor your Claude Code sessions in real time</p>
      <p class="subtitle">See what every agent is doing across machines and branches. Detect file conflicts before they happen. Know when Claude needs your input.</p>
      <div class="cta-row">
        <a href="https://app.claudemon.com" class="btn btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M14 9l3 3-3 3"/></svg>
          Open Dashboard
        </a>
        <span class="install-cmd" title="Click to select">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
          npx claudemon-cli init
        </span>
      </div>
    </div>
  </section>

  <!-- Terminal mockup -->
  <section class="terminal-section fade-in">
    <div class="container">
      <div class="terminal">
        <div class="terminal-bar">
          <div class="terminal-dots"><span></span><span></span><span></span></div>
          <span class="terminal-title">ClaudeMon</span>
          <div style="width: 52px;"></div>
        </div>
        <div class="terminal-body">
          <div class="term-line">
            <span class="term-dot working"></span>
            <span class="term-project">claudemon</span>
            <span class="term-branch">main</span>
            <span class="term-status working">working</span>
            <span class="term-time">3m 12s</span>
          </div>
          <div class="term-line term-sub">
            <span class="term-tool">Edit</span>&nbsp;&nbsp;<span class="term-file">src/index.ts</span>&nbsp;&nbsp;<span class="term-diff-add">+5</span> <span class="term-diff-del">-2</span>
          </div>

          <div class="term-spacer"></div>

          <div class="term-line">
            <span class="term-dot thinking"></span>
            <span class="term-project">vector-seo</span>
            <span class="term-branch">feat/api</span>
            <span class="term-status thinking">thinking</span>
            <span class="term-time">1m 45s</span>
          </div>
          <div class="term-line term-sub">
            <span class="term-tool">Bash</span>&nbsp;&nbsp;<span class="term-file">npm run test</span>
          </div>

          <div class="term-spacer"></div>

          <div class="term-line">
            <span class="term-dot done"></span>
            <span class="term-project">data-sync</span>
            <span class="term-branch">main</span>
            <span class="term-status done">done</span>
            <span class="term-time">15m 22s</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Stats bar -->
  <section class="stats-section fade-in">
    <div class="container">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">27</div>
          <div class="stat-label">Hook Events</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">&lt; 50ms</div>
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

  <!-- Features -->
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
        <div class="feature fade-in">
          <div class="feature-icon yellow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <h3>Live Activity</h3>
          <p>Real-time stream of every tool call, edit, bash command, and search. Click into any session for the full timeline with inline diffs and syntax-highlighted output.</p>
        </div>
        <div class="feature fade-in">
          <div class="feature-icon red">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <h3>Conflict Detection</h3>
          <p>Automatic detection when multiple sessions edit the same file. Catch merge conflicts before they happen. Real-time alerts when agents step on each other.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- How it works -->
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
        <div class="step fade-in">
          <span class="step-num">2</span>
          <h4>Use Claude Code normally</h4>
          <p>Every tool call, edit, and command fires an event to the ClaudeMon relay. Events are ephemeral — no persistent database, no data retention.</p>
        </div>
        <div class="step fade-in">
          <span class="step-num">3</span>
          <h4>Watch the dashboard</h4>
          <p>Open <a href="https://app.claudemon.com">app.claudemon.com</a> to see all your sessions in real time. WebSocket-powered, instant updates.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Privacy -->
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
        <div class="privacy-item fade-in">
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
        <div class="privacy-item fade-in">
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

  <!-- Final CTA -->
  <section class="final-cta">
    <div class="container">
      <h2 class="fade-in">Start monitoring</h2>
      <p class="fade-in">Set up in 30 seconds. No account required.</p>
      <div class="cta-row fade-in">
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
    var els = document.querySelectorAll('.fade-in');
    if (!('IntersectionObserver' in window)) {
      for (var i = 0; i < els.length; i++) els[i].classList.add('visible');
      return;
    }
    var obs = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function(el) { obs.observe(el); });
  })();
  </script>
</body>
</html>`;
