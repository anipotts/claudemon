# apps/monitor

SolidJS + Vite + Tailwind v4 frontend deployed to Cloudflare Pages.

## Stack

- SolidJS (not React — no virtual DOM, fine-grained reactivity via signals)
- Tailwind v4 with CSS custom properties
- Vite dev server, wrangler for preview/deploy

## Important Patterns

- WebSocket store at `src/stores/websocket.ts` — connects to `wss://api.claudemon.com`
- Session state at `src/stores/sessions.ts` — derives all UI state from WebSocket events
- Icons wrapper at `src/components/Icons.tsx` — re-exports from Phosphor, never use raw emoji
- Types imported via relative path `../../../../packages/types/monitor` (not workspace alias)

## Color Tokens (Tailwind v4 custom properties)

- `text-safe` / `bg-safe` — `#a3b18a` (green, healthy state)
- `text-suspicious` / `bg-suspicious` — `#c9a96e` (amber, warning)
- `text-attack` / `bg-attack` — `#b85c4a` (red, error)
- `text-blocked` / `bg-blocked` — `#8a3a2e` (dark red, blocked)
- `bg-panel` — panel backgrounds
- `text-text-primary`, `text-text-sub`, `text-text-dim`, `text-text-label` — text hierarchy

## Deploy

```bash
npm run build && wrangler deploy
```
