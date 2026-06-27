import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AccessToken, TrackSource } from "livekit-server-sdk";
import { z } from "zod";

const tokenRequestSchema = z.object({
  roomId: z.string().uuid(),
  supabaseAccessToken: z.string().min(20),
  requestedMedia: z.enum(["audio", "audio_video"]).default("audio")
});

export async function POST(request: Request) {
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const livekitApiKey = process.env.LIVEKIT_API_KEY;
  const livekitApiSecret = process.env.LIVEKIT_API_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
    return NextResponse.json({ error: "LiveKit is not configured for this deployment." }, { status: 503 });
  }

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase is not configured for live rooms." }, { status: 503 });
  }

  let body: z.infer<typeof tokenRequestSchema>;

  try {
    body = tokenRequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid LiveKit token request." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${body.supabaseAccessToken}`
      }
    }
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(body.supabaseAccessToken);
  const user = userData.user;

  if (userError || !user) {
    return NextResponse.json({ error: "A valid Supabase session is required." }, { status: 401 });
  }

  const { data: member, error: memberError } = await supabase
    .from("room_members")
    .select("display_name, room_id")
    .eq("room_id", body.roomId)
    .eq("user_id", user.id)
    .single();

  if (memberError || !member) {
    return NextResponse.json({ error: "You must be a room member to join this break call." }, { status: 403 });
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, phase, cycle_number")
    .eq("id", body.roomId)
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: "Room was not found." }, { status: 404 });
  }

  if (room.phase !== "break") {
    return NextResponse.json({ error: "Break Lounge calls are only available during shared break time." }, { status: 409 });
  }

  const roomName = `soryvo-break-${room.id}-${room.cycle_number}`;
  const token = new AccessToken(livekitApiKey, livekitApiSecret, {
    identity: `${user.id}:${room.id}`,
    name: member.display_name,
    ttl: "10m",
    metadata: JSON.stringify({
      app: "soryvo",
      roomId: room.id,
      cycleNumber: room.cycle_number,
      privacy: "no-recording-no-transcription-no-screenshare"
    })
  });

  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
    canUpdateOwnMetadata: false,
    roomRecord: false,
    canPublishSources: [TrackSource.MICROPHONE, TrackSource.CAMERA]
  });

  return NextResponse.json({
    token: await token.toJwt(),
    serverUrl: livekitUrl,
    roomName
  });
}
