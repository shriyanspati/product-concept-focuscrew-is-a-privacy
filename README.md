# Soryvo

Soryvo is a private AI study room that helps groups regain momentum without public surveillance or individual callouts.

## Product Summary

Students enter a room, set a clear goal, study together, and use anonymous broad statuses plus private AI-assisted guidance to recover when group momentum slips.

## Design System

Soryvo uses a paper-white and editorial-red visual system:

- Page: `#F7F6F3`
- Warm section background: `#F1EFEA`
- Surface: `#FFFFFF`
- Borders: `#DCD8D1`
- Text: `#171716`
- Muted text: `#706D68`
- Accent red: `#A6232B`

Red is intentionally sparse: primary CTAs, focus meter progress, input focus rings, small active indicators, and the Soryvo mark.

## Real Room Behavior

With Supabase configured, normal rooms are real multiplayer rooms:

- Verified passwordless email sign-in is required before creating or joining a true live room.
- Room creation happens through the `create_live_room` RPC.
- Joining happens through the `join_live_room` RPC.
- Participants, broad statuses, room state, shared breaks, and room events update with Supabase Realtime.
- Real rooms show only real participants, never seeded demo members.
- Invite links use `/room/[code]`.

Without Supabase credentials, normal rooms show `Local Preview Mode` and do not pretend to be multiplayer. Judge Demo Mode remains fully functional and does not require email.

## Focus Check

Focus Check is a private self-check for task alignment. It asks whether the user is still working toward their goal and can provide a short private suggestion.

Focus Check never stores typed answers in Supabase. Only these broad fields may be stored:

- `last_focus_check_at`
- `last_focus_check_state`
- public participant status: focused, taking a break, needs a reset, or not sharing activity

The group never sees typed answers, check frequency, confidence, activity categories, or AI messages.

## Optional Screen Check

Screen Check is off by default and begins only after the user chooses expected study contexts, clicks `Enable Screen Check`, and approves the browser screen picker. The UI says active only after the returned track is live and a fresh video frame has arrived.

- Local heuristic mode never encodes or uploads a frame. It uses the declared goal, expected contexts, private Focus Check state, and optional broad activity category.
- Cloud vision mode appears only when `OPENAI_API_KEY` is configured and requires separate consent. It sends one maximum `320x180` JPEG to `/api/screen-check` for one-time analysis.
- Frames are never stored, logged, cached, written to React state, sent to Supabase/LiveKit, or shown to the room.
- The offscreen canvas is cleared and reduced to `1x1` immediately after every sample. Tracks, timers, video sources, and canvas memory are cleared on stop, track end, stale frames, shared break, session end, and component unmount.

Accountability Pulse stores only a public opt-in boolean and an empty anonymous room event. It requires unanimous current-room opt-in, at least three active members, focus phase, a qualifying reset request, and a ten-minute cooldown.

## Privacy Boundaries

Soryvo never stores or records:

- Screenshots
- Screen recordings
- Webcam or microphone
- Keystrokes
- Passwords
- Private messages
- Browser history
- URLs or page titles
- Typed Focus Check answers
- Raw activity-category signals

In Cloud vision mode only, a separately consented low-resolution frame exists temporarily in request memory for one-time analysis. It is discarded after the request and is never persisted.

Soryvo supports study flow and attention recovery. It is not a medical or mental-health diagnostic tool.

## Tech Stack

- Next.js App Router
- TypeScript strict mode
- Tailwind CSS
- Lucide React
- Framer Motion
- Recharts
- Supabase Realtime and passwordless email auth
- LocalStorage for local preferences and demo persistence
- Optional server-side OpenAI integration with deterministic fallback

## Local Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Create `.env.local` when using live rooms or OpenAI:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
# NEXT_PUBLIC_SUPABASE_ANON_KEY is still supported as a fallback
NEXT_PUBLIC_LIVEKIT_URL=your_livekit_cloud_url
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
OPENAI_API_KEY=optional_openai_key
OPENAI_MODEL=gpt-4.1-mini
OPENAI_VISION_MODEL=gpt-4.1-mini
```

`OPENAI_API_KEY` is optional. The app works with local deterministic coaching and Local heuristic Screen Check when it is missing. `OPENAI_VISION_MODEL` is optional and falls back to `OPENAI_MODEL`.
LiveKit variables are optional for local demos; real Break Lounge audio/video calls need all three LiveKit values.

## Supabase Setup

1. Create a Supabase project.
2. In Authentication settings, enable Email Auth.
3. Turn on email confirmation / magic-link sign-in. No password provider is needed for Soryvo.
4. Set the Auth Site URL to `http://localhost:3000` for local development, and to your deployed domain in production.
5. Add these redirect URLs in Supabase Auth:

```txt
http://localhost:3000/auth/callback
https://YOUR_DEPLOYED_DOMAIN/auth/callback
```

6. Open the Supabase SQL editor.
7. Run `supabase/schema.sql`.
8. Copy the project URL and publishable key into `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

9. Start the app with `npm run dev`.

The schema enables RLS, uses authenticated `auth.uid()` membership checks, and exposes narrowly scoped room RPCs: `create_live_room`, `join_live_room`, `start_pomodoro`, `pause_pomodoro`, `resume_pomodoro`, `start_break`, `end_break`, `end_room`, and `heartbeat_room_member`.

Do not add a Supabase service-role key to `.env.local` or any frontend environment. Soryvo only needs the publishable key for this passwordless email flow. Email addresses stay in Supabase Auth and are not written into public room tables; room participants see display names, goals, and broad study statuses only.

## LiveKit Setup

1. Create a LiveKit Cloud project.
2. Copy the project URL into `NEXT_PUBLIC_LIVEKIT_URL`.
3. Create an API key and secret for `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`.
4. Restart the app.

Break Lounge tokens are generated only by `app/api/livekit/token/route.ts`, only for room members, and only while the room phase is `break`.

## Judge Demo Mode

Judge Demo Mode uses deterministic seeded members from `lib/demoData.ts` and does not write demo users into Supabase tables.

Demo flow:

1. Open `/room/CREW42` or choose Judge Demo Mode on `/room`.
2. Accept consent.
3. Click `Simulate Group Drift`.
4. Start the anonymous three-minute reset.
5. Click `Back on Track`.
6. Use the Focus Check demo controls.
7. End the session to view the report.

## Local Preview Mode

When Supabase variables are missing, normal rooms are local-only. The UI labels this clearly and does not show fake friends or a misleading live invite.

## Exact Run Command

```bash
npm run dev
```
