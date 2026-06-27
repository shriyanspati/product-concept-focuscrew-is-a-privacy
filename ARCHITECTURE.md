# Soryvo Architecture

## App Structure

- `app/page.tsx`: homepage.
- `app/signin/page.tsx`: entry screen with live preview personalization.
- `app/room/page.tsx`: create or join flow.
- `app/room/[code]/page.tsx`: study room dashboard.
- `app/api/focus-coach/route.ts`: server-only AI focus coach endpoint.
- `app/api/focus-check/route.ts`: server-only private Focus Check endpoint.
- `app/api/screen-check/route.ts`: no-store, server-only cloud vision endpoint.
- `app/api/livekit/token/route.ts`: server-only LiveKit token endpoint for Break Lounge calls.
- `components/BreakLounge.tsx`: explicit-join break call surface.
- `components/BreakCallControls.tsx`: custom mic/camera/leave controls.
- `components/BreakParticipantGrid.tsx`: Soryvo-styled call participant tiles.
- `components/FocusCheckModal.tsx`: private self-check flow.
- `components/ScreenCheckPanel.tsx`: Screen Check consent, status, private results, and demo diagnostics.
- `hooks/useLiveRoom.ts`: Supabase Realtime subscription and heartbeat hook.
- `hooks/useSyncedPomodoro.ts`: client countdown derived from room phase timestamps.
- `hooks/useScreenCheckSession.ts`: display capture, real frame health checks, scheduling, and resource cleanup.
- `hooks/useRoomRealtime.ts`: compatibility re-export for older imports.
- `lib/liveRoomApi.ts`: live room RPC/table adapter.
- `lib/supabase/client.ts`: browser Supabase client.
- `lib/supabase/ensureAnonymousSession.ts`: anonymous auth helper.
- `lib/supabaseClient.ts`: compatibility re-export.
- `lib/focusCheckService.ts`: Focus Check schema, fallback logic, mappings, and AI prompt.
- `lib/screenCheckService.ts`: strict cloud vision input/output schema and conservative prompt.
- `lib/demoData.ts`: isolated Judge Demo seed data.
- `supabase/schema.sql`: tables, enums, RLS policies, and RPCs.

## Data Model

`rooms` stores room code, creator, room metadata, Pomodoro phase, phase timestamps, cycle number, and running state.

`room_members` stores display name, goal, broad public status, join timestamps, heartbeat timestamp, the last broad Focus Check state, and Accountability Pulse opt-in. It does not store private Focus Check answers or Screen Check results.

`room_events` stores shared room events such as focus started, break started, break ended, reset started, anonymous accountability pulse, paused, and ended. Pulse payloads are empty and must never include private Focus Check responses, screen details, or an identity.

## Supabase Anonymous Auth

Live rooms require Supabase anonymous authentication. The client calls `supabase.auth.signInAnonymously()` before invoking room RPCs. The browser only receives the anon key, never a service-role key.

## RLS Boundaries

RLS is enabled on all live tables.

- Users can read a room only after joining it.
- Users can read member summaries only for rooms they joined.
- Users can update only their own `room_members` row.
- Room members can read and insert room events for their room.
- `create_live_room`, `join_live_room`, timer, break, end, and heartbeat functions are security-definer RPCs with safe search paths.
- No policy uses public `using (true)` access.

## Realtime Flow

`useLiveRoom` joins the room through the RPC, receives the current snapshot, and subscribes to room-specific changes:

- `rooms` filtered by room ID
- `room_members` filtered by room ID
- `room_events` filtered by room ID

Subscriptions are cleaned up when leaving the component. A heartbeat RPC updates `last_seen_at` every 30 seconds, and the hook attempts to mark the current user as `not_sharing_activity` on unload.

## Live Versus Demo

Live rooms use Supabase and show only real participants.

Judge Demo Mode uses `CREW42` and seeded demo members from `lib/demoData.ts`. Demo participants are never written to live tables.

Local Preview Mode appears when Supabase env vars are missing. It remains honest: no fake multiplayer and no misleading live invite link.

## Shared Timer

Live rooms use `phase`, `phase_started_at`, `phase_ends_at`, `focus_minutes`, `break_minutes`, `cycle_number`, and `is_running` as the source of truth. Each client updates the countdown locally for smoothness, but only room creator RPCs transition focus and break phases.

## Break Lounge

Break Lounge uses LiveKit only during `break` phase. The browser asks `app/api/livekit/token/route.ts` for a short-lived token, passing the current Supabase access token. The server validates the user, membership, and room phase before issuing a token.

Token permissions allow joining, subscribing, and publishing microphone/camera only. They explicitly do not grant recording, data publishing, room admin, screen share, or screen-share audio. Screen Check uses a separate local browser `getDisplayMedia()` stream that is never published to LiveKit.

## Group Focus Score

Real group focus is computed from broad statuses:

- `focused`: 100
- `taking_break`: 70
- `needs_reset`: 55
- `not_sharing_activity`: excluded

If no participant is sharing, the room should avoid pretending to have a meaningful focus score. The current UI keeps the last known score and labels not-sharing users neutrally.

## Focus Check Data Flow

Focus Check asks private self-check questions and sends them only to `/api/focus-check`.

The API validates input with Zod. If `OPENAI_API_KEY` exists, the server asks OpenAI for strict JSON. Otherwise, `lib/focusCheckService.ts` returns deterministic guidance.

After completion, only broad public state is mapped to the participant row:

- clear alignment -> `focused`
- stuck or reset needed -> `needs_reset`
- intentional break -> `taking_break`
- skipped -> `not_sharing_activity`

## AI Fallback Behavior

Fallback logic uses simple text relevance, self-reported state, and optional broad activity category. It never accuses users, never mentions attention disorders, and never makes medical claims.

## Screen Check Data Flow

`useScreenCheckSession` calls `getDisplayMedia()` only from the `Enable Screen Check` click. A detached, muted video element receives the stream. `requestVideoFrameCallback()` proves fresh frames are arriving; a current-time fallback is used when that API is unavailable. The status becomes active only after the track is live and the first fresh frame arrives.

Every private check draws one frame to a new offscreen canvas capped at `320x180`. Local heuristic mode does not call `toDataURL`, create a Blob, or make a network request. It clears the canvas immediately after using non-image context signals.

Cloud vision mode requires separate consent. The canvas is encoded once, then cleared before the request starts. `/api/screen-check` validates the request, sends it directly to the configured vision model with `no-store`, returns only `aligned`, `unclear`, or `likely_mismatch`, and keeps no database or application log record. The encoded request string remains only in transient client/server request memory and becomes collectible when the fetch and request scope finish.

One likely mismatch produces only a private self-check. Two consecutive likely mismatches produce a private reset suggestion. Screen Check never changes public member status. An Accountability Pulse can be requested only after two consecutive private reset suggestions or an explicit reset click, plus unanimous opt-in, three active members, focus phase, and a ten-minute cooldown.

The same cleanup path stops all tracks, cancels frame callbacks and timers, pauses and detaches the video, clears the canvas, and releases references after user stop, track end, 15 seconds without a fresh frame, shared break, session end, or component unmount.

## Data Intentionally Never Stored

Soryvo intentionally never stores:

- Typed Focus Check answers
- Raw confidence scores
- Activity categories
- Browser URLs or page titles
- Screen Check frames or screen recordings after one-time analysis
- Browser history
- Keystrokes
- Private messages
- Webcam or microphone data
- Individual reasons behind a public broad status
