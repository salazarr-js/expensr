---
name: Live refresh via WebSocket + Durable Object
description: Real-time app refresh when records change from Shortcut or another device
type: project
---

When a record is created from the iPhone Shortcut (or any external client), the web app should auto-refresh.

**Approach:** WebSocket via Cloudflare Durable Object.

**Architecture:**
- Durable Object class (`NotificationRoom`) holds active WebSocket connections
- Web app connects via WebSocket on mount, reconnects on disconnect
- When any mutation happens (create/update/delete via API or /quick), Worker notifies the Durable Object
- Durable Object broadcasts "refresh" to all connected clients
- Client receives message → refetches current page data (records, dashboard, etc.)

**Implementation steps:**
1. Create `packages/api/src/notification-room.ts` — Durable Object class with WebSocket handling
2. Add Durable Object binding in `packages/web/wrangler.jsonc` (`NOTIFICATION_ROOM`)
3. Add `GET /api/ws` route — upgrades to WebSocket, proxies to Durable Object
4. After record mutations in API routes (create, update, delete, batch, quick, reorder), call `notificationRoom.notify()`
5. Frontend composable `useRealtimeRefresh()` — connects WebSocket, on message refetches active store data
6. Mount composable in DashboardLayout so it's always active

**Why Durable Object:** Workers are stateless — can't hold WebSocket connections between requests. The DO is the persistent "room" where connections live. Free tier covers single-user usage easily.
