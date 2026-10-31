<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Architecture rules

- Live readings flow ESP32 → public MQTT broker → browser (mqtt.js over WSS) inside `TelemetryProvider` (src/lib/telemetry.tsx); the browser, not the server, persists a reading every 30 s — there is no server-side MQTT client because Workers can't hold long-lived sockets.
- The MQTT message contract lives in src/lib/telemetry-types.ts and must stay in sync with public/firmware/powerpulse_meter.ino and the demo simulator (src/lib/simulator.ts) — all three produce/consume the same JSON.
- Business types, circuits and loss profiles are defined once in src/lib/business.ts; the DB `business_type` CHECK constraint and signup trigger list must match its ids.
- Pure money/units rules live in src/lib/energy.ts with tests in src/test/energy.test.ts; UI and ZedBot import them rather than re-implementing.
- ZedBot is a streaming server route (src/routes/api/zedbot.ts) that verifies the bearer token itself, builds context from the profile, saved readings, the client's live snapshot and src/lib/zedbot-knowledge.ts, and calls the Gemini REST API with GEMINI_API_KEY.
- Theme is a `.dark` class on <html> set by an inline head script (src/lib/theme.tsx) to avoid flashes; components use semantic tokens from src/styles.css only.
