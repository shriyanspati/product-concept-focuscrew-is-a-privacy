# Soryvo Pitch

## 30-Second Pitch

Soryvo is a private AI study room that helps friends catch a fading study session before it turns into a wasted night. Unlike a normal timer that only counts down, Soryvo helps a group stay in rhythm, notice when momentum is slipping, and reset together without publicly calling anyone out. During focus blocks, friends work quietly. During planned breaks, they can talk instead of disappearing into phone scrolling.

**Lock in. Break. Come back.**

## 90-Second Demo Script

Start in the sample room, `CREW42`.

Show the shared focus block, the group’s individual study goals, and the room’s overall momentum state. Explain that Soryvo is designed for accountability without surveillance: students can use private Focus Checks and opt-in focus signals, but the room never sees private answers, saved screenshots, URLs, or individual activity details.

Click **Simulate Group Drift**.

Show the anonymous recovery prompt and explain that Soryvo does not say who is struggling or distracted. Instead, it gives the group a chance to reset together.

Click **Start 3-Minute Reset**.

Explain that the reset is meant to stop a small distraction from becoming a lost study block. Then click **Back on Track** to show the room recovering without blame or public callouts.

Open **Focus Check** and show the private task-alignment guidance. Point out that responses stay private and are never shown to other room members.

Finally, start a planned break and show that Break Lounge enables microphones, giving friends a way to talk or decompress together instead of automatically scrolling on their phones. End the session and show the room summary.

## Best Original Idea

Most study tools treat focus as an individual problem. Soryvo treats it as a group rhythm.

Its core idea is **shared recovery**: when the room starts drifting, Soryvo uses broad anonymous signals and quick reset prompts to help everyone return to work together. It does not turn classmates into monitors or make one person the target. The product is built around making recovery easy, private, and social.

## Best Social Value

Soryvo gives students a healthier way to hold each other accountable.

Instead of rewarding pressure, shame, or public callouts, it encourages friends to support one another through shared focus blocks, intentional breaks, and anonymous reset moments. Students can talk during planned breaks, recharge together, and return to work with less friction. Soryvo supports study flow and attention recovery, but never claims to diagnose, treat, or measure mental-health conditions.

## Best UI/UX

Soryvo is designed to feel calm, clear, and intentional rather than like a crowded productivity dashboard.

The interface uses warm paper-white surfaces, charcoal typography, restrained editorial red, and simple room states that make the next action obvious. The design avoids clutter, aggressive alerts, and surveillance-style visuals. Important moments, such as a reset prompt or a break beginning, feel noticeable without becoming stressful.

## Real Multiplayer Value

Soryvo matters most when real friends are in the same room.

Supabase Realtime allows participants to join one shared study room, see live broad statuses, stay synchronized on the same timer, experience reset moments together, and move into breaks at the same time. This makes Soryvo more than a solo timer with extra features: it is a shared study environment built around group momentum.

## AI Usage

Soryvo uses AI to provide short, private task-alignment guidance and supportive recovery prompts.

AI can help turn a vague moment of distraction or frustration into a practical next step, such as: *“What is one thing you can finish in five minutes?”* AI guidance is private and is never used to publicly rank, shame, or label students.

When an `OPENAI_API_KEY` is not configured, Soryvo uses deterministic local rules so the sample room and core recovery flow still work. Optional cloud-based screen analysis, when enabled, requires separate user consent and is designed only for one-time task-alignment feedback.

## Privacy Protections

Soryvo is built around consent and minimal data collection.

It does not use hidden screen surveillance. Optional Screen Check requires the user to click enable, choose what to share through the browser’s screen picker, and separately consent before any cloud-based analysis occurs. Screen frames are never stored, logged, shown to room members, sent through room infrastructure, or added to the user’s study history.

Soryvo does not capture browser history, URLs, page titles, keystrokes, private messages, typed Focus Check answers, webcam recordings, or microphone recordings. Public room views only show broad study statuses and carefully gated anonymous recovery invitations.
