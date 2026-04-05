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
  --panel: #1a1916;
  --panel-border: #3d3a34;
  --card: #141210;
  --text-primary: #e8e0d4;
  --text-label: #8a8478;
  --text-dim: #6b6560;
  --text-sub: #4a4640;
  --safe: #a3b18a;
  --suspicious: #c9a96e;
  --attack: #b85c4a;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  background: var(--bg);
  color: var(--text-primary);
  font-family: 'Geist Mono', 'SF Mono', 'Fira Code', monospace;
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

.container {
  max-width: 900px;
  margin: 0 auto;
  padding: 0 24px;
}

a { color: var(--safe); text-decoration: none; }
a:hover { text-decoration: underline; }
code { background: var(--panel); padding: 2px 8px; border-radius: 4px; font-size: 13px; }

/* Hero */
.hero {
  padding: 120px 0 80px;
  text-align: center;
  border-bottom: 1px solid var(--panel-border);
}
.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 16px;
}
.logo h1 {
  font-size: 32px;
  font-weight: 700;
  letter-spacing: 2px;
}
.logo svg { color: var(--safe); }
.tagline {
  font-size: 16px;
  color: var(--text-label);
  margin-bottom: 12px;
}
.subtitle {
  font-size: 13px;
  color: var(--text-dim);
  max-width: 560px;
  margin: 0 auto 32px;
}
.cta-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
}
.btn {
  display: inline-block;
  padding: 10px 24px;
  border-radius: 6px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.15s;
}
.btn-primary {
  background: var(--safe);
  color: var(--bg);
}
.btn-primary:hover { background: #b5c49c; text-decoration: none; }
.btn-secondary {
  background: transparent;
  color: var(--text-label);
  border: 1px solid var(--panel-border);
}
.btn-secondary:hover { border-color: var(--text-dim); color: var(--text-primary); text-decoration: none; }
.install-cmd {
  background: var(--panel);
  border: 1px solid var(--panel-border);
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--safe);
  cursor: pointer;
  user-select: all;
}

/* Features */
.features {
  padding: 80px 0;
  border-bottom: 1px solid var(--panel-border);
}
.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
}
.feature {
  padding: 24px;
  background: var(--card);
  border: 1px solid var(--panel-border);
  border-radius: 8px;
}
.feature-icon {
  color: var(--safe);
  margin-bottom: 16px;
}
.feature h3 {
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 8px;
  letter-spacing: 0.5px;
}
.feature p {
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.7;
}

/* How it works */
.how-it-works {
  padding: 80px 0;
  border-bottom: 1px solid var(--panel-border);
}
.how-it-works h2 {
  font-size: 20px;
  margin-bottom: 40px;
  letter-spacing: 1px;
}
.steps {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.step {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  padding: 20px;
  background: var(--card);
  border: 1px solid var(--panel-border);
  border-radius: 8px;
}
.step-num {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--safe);
  color: var(--bg);
  border-radius: 50%;
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
}
.step h4 {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 4px;
}
.step p {
  font-size: 12px;
  color: var(--text-dim);
}

/* Privacy */
.privacy {
  padding: 80px 0;
  border-bottom: 1px solid var(--panel-border);
}
.privacy h2 {
  font-size: 20px;
  margin-bottom: 40px;
  letter-spacing: 1px;
}
.privacy-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}
.privacy-item {
  padding: 20px;
  background: var(--card);
  border: 1px solid var(--panel-border);
  border-radius: 8px;
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
}

/* Final CTA */
.final-cta {
  padding: 80px 0;
  text-align: center;
}
.final-cta h2 {
  font-size: 24px;
  margin-bottom: 12px;
}
.final-cta p {
  font-size: 13px;
  color: var(--text-dim);
  margin-bottom: 32px;
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
  .feature-grid { grid-template-columns: 1fr; }
  .privacy-grid { grid-template-columns: 1fr; }
  .hero { padding: 80px 0 60px; }
}
  </style>
</head>
<body>
  <!-- Hero -->
  <section class="hero">
    <div class="container">
      <div class="logo">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <h1>ClaudeMon</h1>
      </div>
      <p class="tagline">Monitor your Claude Code sessions in real time</p>
      <p class="subtitle">See what every agent is doing across machines and branches. Detect file conflicts. Know when Claude needs your input.</p>
      <div class="cta-row">
        <a href="https://app.claudemon.com" class="btn btn-primary">Open Dashboard</a>
        <code class="install-cmd">npx claudemon init</code>
      </div>
    </div>
  </section>

  <!-- Features -->
  <section class="features">
    <div class="container">
      <div class="feature-grid">
        <div class="feature">
          <div class="feature-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          </div>
          <h3>Agent Map</h3>
          <p>Live topology of all Claude Code sessions. See status, branch, project, and current tool call at a glance. Sessions across machines, worktrees, and cloud instances.</p>
        </div>
        <div class="feature">
          <div class="feature-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <h3>Live Activity</h3>
          <p>Real-time stream of every tool call, edit, bash command, and search. Click into any session for the full timeline with inline diffs and syntax-highlighted output.</p>
        </div>
        <div class="feature">
          <div class="feature-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
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
      <h2>How it works</h2>
      <div class="steps">
        <div class="step">
          <span class="step-num">1</span>
          <div>
            <h4>Install the hook</h4>
            <p>Run <code>npx claudemon init</code>. It adds a lightweight async hook to your Claude Code settings. Under 50ms overhead, non-blocking.</p>
          </div>
        </div>
        <div class="step">
          <span class="step-num">2</span>
          <div>
            <h4>Use Claude Code normally</h4>
            <p>Every tool call, edit, and command fires an event to the ClaudeMon relay. Events are ephemeral — no persistent database, no data retention.</p>
          </div>
        </div>
        <div class="step">
          <span class="step-num">3</span>
          <div>
            <h4>Watch the dashboard</h4>
            <p>Open <a href="https://app.claudemon.com">app.claudemon.com</a> to see all your sessions in real time. WebSocket-powered, instant updates.</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Privacy -->
  <section class="privacy">
    <div class="container">
      <h2>Privacy-first architecture</h2>
      <div class="privacy-grid">
        <div class="privacy-item">
          <strong>Ephemeral relay</strong>
          <p>No persistent database. Events live in Durable Object memory and auto-purge after 1 hour of inactivity.</p>
        </div>
        <div class="privacy-item">
          <strong>You control what's sent</strong>
          <p>The hook sends tool metadata including file paths, tool names, and inputs. Review the open-source hook script to see exactly what data flows through.</p>
        </div>
        <div class="privacy-item">
          <strong>Self-hostable</strong>
          <p>Run your own ClaudeMon instance on Cloudflare Workers. One command deploy, zero ongoing cost on the free tier.</p>
        </div>
        <div class="privacy-item">
          <strong>Open source</strong>
          <p>Every line of code is on GitHub. Audit the hook, the relay, and the dashboard yourself.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- CTA -->
  <section class="final-cta">
    <div class="container">
      <h2>Start monitoring</h2>
      <p>Set up in 30 seconds. No account required for self-hosted.</p>
      <div class="cta-row">
        <a href="https://app.claudemon.com" class="btn btn-primary">Get Started</a>
        <a href="https://github.com/anipotts/lightning-validia" class="btn btn-secondary">View Source</a>
      </div>
    </div>
  </section>

  <footer>
    <div class="container">
      <span>ClaudeMon</span>
      <span class="sep">|</span>
      <a href="https://github.com/anipotts/lightning-validia">GitHub</a>
    </div>
  </footer>
</body>
</html>`;
