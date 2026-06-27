# Soryvo

Soryvo is a private AI study room that helps friends stay focused, recover from distractions, and return to work together without public surveillance or individual callouts.

> **Lock in. Break. Come back.**

## Product Summary

Students create or join a study room, set an individual goal, and follow the same shared focus timer. During focus blocks, the room stays quiet so everyone can work without constant conversation or distractions.

Soryvo uses private Focus Checks, optional Screen Check support, broad anonymous statuses, and group reset prompts to help students notice when momentum is slipping. Instead of publicly naming someone who is distracted, Soryvo encourages the whole room to reset together.

During planned breaks, the Break Lounge opens microphones so friends can talk, laugh, ask quick questions, or decompress together instead of immediately getting pulled into endless phone scrolling.

## Design System

Soryvo uses a warm paper-white and editorial-red visual system that feels more like a shared study space than a generic AI dashboard.

* Page: `#F7F6F3`
* Warm section background: `#F1EFEA`
* Surface: `#FFFFFF`
* Borders: `#DCD8D1`
* Main text: `#171716`
* Muted text: `#706D68`
* Accent red: `#A6232B`

Red is intentionally sparse and only appears in important moments: primary buttons, active timer progress, selected controls, input focus rings, small live indicators, and the Soryvo mark.

## Real Room Behavior

With Supabase configured, normal rooms are real multiplayer study rooms:

* Passwordless email sign-in is required before creating or joining a live room.
* Room creation happens through the `create_live_room` RPC.
* Joining happens through the `join_live_room` RPC.
* Participants, shared timer state, room phases, broad statuses, breaks, and room events update through Supabase Realtime.
* Real rooms only show real participants and never include seeded demo users.
* Invite links use `/room/[code]`.
* Hosts can end a session for everyone, while participants can leave without ending the room.
* Shared Pomodoro sessions stay synchronized across everyone in the room.

Without Supabase credentials, normal rooms run in clearly labeled `Local Preview Mode`. They do not pretend to be live multiplayer rooms or show fake classmates.

## Focus Check

Focus Check is a private self-check that helps students reconnect with their goal when they feel stuck, distracted, or unsure what to do next.

It can ask simple questions such as:

> “What is the next thing you can finish in five minutes?”

Focus Check may provide a short private suggestion, but it never publicly labels someone as distracted or exposes their response to the group.

Focus Check never stores typed answers in Supabase. Only these broad fields may be stored:

* `last_focus_check_at`
* `last_focus_check_state`
* Public participant status: `focused`, `taking_break`, `needs_reset`, or `not_sharing_activity`

The group never sees typed answers, activity confidence, private AI messages, check frequency, or personal focus details.

## Optional Browser Extension

The prototype extension can privately improve Focus Check with an explicit, session-only signal. It reports only a broad activity category and tab-switch count.

- It has no browser-history permission.
- It never sends URLs, tab titles, search terms, screenshots, or page contents.
- The user starts and stops sharing from the popup.
- Sanitized signal state lives only in `chrome.storage.session` and is cleared on stop.
- Focus Check answers and extension signals are never shown to the room or stored in Supabase.

To try it locally in Chrome or Edge:

1. Open the browser's extensions page and enable Developer mode.
2. Choose `Load unpacked` and select this project&apos;s `extension/` folder.
3. Open Soryvo on `http://127.0.0.1:3000`, open the extension popup, and click `Start private signals`.
4. Stop the session from the popup to immediately clear its category and switch count.

## Optional Screen Check

Screen Check is off by default and only begins after a user selects expected study contexts, clicks `Enable Screen Check`, and approves the browser’s screen-sharing picker.

The interface only shows Screen Check as active after the browser returns a live video track and the app receives a fresh frame.

* Local heuristic mode does not upload, save, encode, or transmit screen frames.
* Local mode uses a user’s declared goal, expected contexts, private Focus Check state, and optional broad activity category.
* Cloud vision mode only appears when `OPENAI_API_KEY` is configured and requires separate consent.
* Cloud vision mode sends one low-resolution frame, capped at `320x180`, to `/api/screen-check` for one-time analysis.
* Frames are never saved, logged, cached, placed in React state, sent to Supabase, sent to LiveKit, or shown to anyone in the room.
* The offscreen canvas is cleared and reduced to `1x1` immediately after each sample.
* Screen capture stops when the user clicks stop, the browser track ends, a planned break begins, the session ends, or the component unmounts.

Screen Check is designed to support accountability, not prove that someone is working perfectly.

## Accountability Pulse

Accountability Pulse is a room-level reset feature designed to encourage the group without calling out a specific person.

It only activates when:

* Every current participant has opted in.
* At least three active members are in the room.
* The room is currently in a focus phase.
* A qualifying private reset request has occurred.
* The cooldown period has passed.

When group momentum drops, Soryvo can show an anonymous message such as:

> “Momentum dip in the room. Want a 90-second lock-in?”

The room never sees who triggered the reset, what they were doing, or what appeared on their screen.

## Break Lounge

Break Lounge is available only during planned breaks.

* Microphones can be enabled during breaks.
* Optional video can be enabled by the user.
* Screen sharing is not part of Break Lounge.
* Calls are never recorded or transcribed.
* Microphones and cameras are disabled again when the next focus block begins.

The goal is to make breaks social and intentional, so friends can recharge together instead of immediately losing the break to scrolling.

## Privacy Boundaries

Soryvo never stores or records:

* Screenshots
* Screen recordings
* Webcam recordings
* Microphone recordings
* Keystrokes
* Passwords
* Private messages
* Browser history
* URLs or page titles
* Typed Focus Check answers
* Raw activity-category signals
* Break Lounge conversations

In Cloud Vision mode only, a separately consented low-resolution frame exists temporarily in request memory for one-time analysis. It is discarded after the request and is never persisted.

Soryvo supports study flow, shared accountability, and attention recovery. It is not a medical, mental-health, or academic diagnostic tool.

## Tech Stack

* Next.js App Router
* React
* TypeScript strict mode
* Tailwind CSS
* Lucide React
* Framer Motion
* Recharts
* Supabase PostgreSQL
* Supabase Realtime
* Supabase passwordless email authentication
* LiveKit
* LocalStorage for local preferences and demo persistence
* Optional server-side OpenAI integration with deterministic fallback
* Vercel deployment
* Codex and Claude for AI-assisted prototyping and debugging

## Local Setup

```bash
npm install
npm run dev
```

Open:

```txt
http://localhost:3000
```

## Environment Variables

Create `.env.local` when using live rooms, Break Lounge, or optional OpenAI features:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key

# Legacy fallback, only if your project still uses it
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

NEXT_PUBLIC_LIVEKIT_URL=your_livekit_cloud_url
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret

OPENAI_API_KEY=optional_openai_key
OPENAI_MODEL=gpt-4.1-mini
OPENAI_VISION_MODEL=gpt-4.1-mini
```

`OPENAI_API_KEY` is optional. When it is missing, Soryvo uses local deterministic coaching and local Screen Check logic.

`OPENAI_VISION_MODEL` is optional and falls back to `OPENAI_MODEL`.

LiveKit variables are optional for local demos, but real Break Lounge audio and video calls require all three LiveKit values.

Never commit `.env.local`, API keys, or service-role keys to GitHub.

## Supabase Setup

1. Create a Supabase project.
2. In Authentication settings, enable Email Auth.
3. Turn on email confirmation or magic-link sign-in.
4. Set the Auth Site URL to:

```txt
http://localhost:3000
```

5. Add these redirect URLs:

```txt
http://localhost:3000/auth/callback
https://YOUR_DEPLOYED_DOMAIN/auth/callback
```

6. Open the Supabase SQL editor.
7. Run `supabase/schema.sql`.
8. Add the project URL and publishable key to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

9. Restart the development server:

```bash
npm run dev
```

The schema uses Row Level Security, authenticated `auth.uid()` membership checks, and narrowly scoped room RPCs:

* `create_live_room`
* `join_live_room`
* `start_pomodoro`
* `pause_pomodoro`
* `resume_pomodoro`
* `start_break`
* `end_break`
* `end_room`
* `heartbeat_room_member`

Do not add a Supabase service-role key to `.env.local` or any frontend environment. Soryvo only needs the publishable key for its passwordless sign-in flow.

Email addresses stay inside Supabase Auth and are not written into public room tables. Participants only see display names, goals, and broad study statuses.

## LiveKit Setup

1. Create a LiveKit Cloud project.
2. Copy the project URL into `NEXT_PUBLIC_LIVEKIT_URL`.
3. Create an API key and secret.
4. Add them to `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`.
5. Restart the app.

Break Lounge tokens are generated only through:

```txt
app/api/livekit/token/route.ts
```

Tokens are only issued to active room members while the room phase is `break`.

## Judge Demo Mode

Judge Demo Mode provides a fully functional sample room without requiring email sign-in or Supabase setup.

It uses deterministic seeded participants from:

```txt
lib/demoData.ts
```

Demo users are never written into Supabase tables.

Demo flow:

1. Open `/room/CREW42` or select `Try a Sample Room`.
2. Accept the privacy consent screen.
3. Start a shared focus block.
4. Click `Simulate Group Drift`.
5. Trigger the anonymous reset flow.
6. Use the private Focus Check controls.
7. Start a planned break and open Break Lounge.
8. End the session to view the summary.

## Local Preview Mode

When Supabase environment variables are missing, normal rooms run locally only.

The interface clearly labels this as `Local Preview Mode` and does not show fake friends, fake room syncing, or misleading live invite behavior.

## Exact Run Command

```bash
npm run dev
```
