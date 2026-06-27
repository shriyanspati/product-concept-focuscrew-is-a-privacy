"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  createLocalAudioTrack,
  createLocalVideoTrack,
  LocalAudioTrack,
  LocalVideoTrack,
  Room as LiveKitRoom,
  RoomEvent
} from "livekit-client";
import { Coffee, ShieldCheck } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { BreakCallControls } from "@/components/BreakCallControls";
import { BreakParticipantGrid } from "@/components/BreakParticipantGrid";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type BreakLoungeProps = {
  open: boolean;
  roomId?: string;
  displayName: string;
  demoMode?: boolean;
};

export type BreakLoungeHandle = {
  disconnect(): Promise<void>;
  isConnected(): boolean;
};

type MediaDevice = {
  deviceId: string;
  label: string;
};

export const BreakLounge = forwardRef<BreakLoungeHandle, BreakLoungeProps>(function BreakLounge({ open, roomId, displayName, demoMode = false }, ref) {
  const [liveRoom, setLiveRoom] = useState<LiveKitRoom | null>(null);
  const [remoteNames, setRemoteNames] = useState<string[]>([]);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [message, setMessage] = useState("");
  const [audioTrack, setAudioTrack] = useState<LocalAudioTrack | null>(null);
  const [videoTrack, setVideoTrack] = useState<LocalVideoTrack | null>(null);
  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [microphones, setMicrophones] = useState<MediaDevice[]>([]);
  const [cameras, setCameras] = useState<MediaDevice[]>([]);
  const [selectedMic, setSelectedMic] = useState("");
  const [selectedCamera, setSelectedCamera] = useState("");
  const liveRoomRef = useRef<LiveKitRoom | null>(null);
  const audioTrackRef = useRef<LocalAudioTrack | null>(null);
  const videoTrackRef = useRef<LocalVideoTrack | null>(null);
  const joinedRef = useRef(false);

  const livekitConfigured = Boolean(process.env.NEXT_PUBLIC_LIVEKIT_URL);
  const simulatedNames = useMemo(() => ["Maya", "Jordan", "Alex"], []);

  const disconnectResources = useCallback(async (updateUi = true) => {
    const room = liveRoomRef.current;
    const currentAudioTrack = audioTrackRef.current;
    const currentVideoTrack = videoTrackRef.current;

    await Promise.allSettled([
      currentAudioTrack?.mute() ?? Promise.resolve(),
      room && currentAudioTrack ? room.localParticipant.unpublishTrack(currentAudioTrack) : Promise.resolve(),
      room && currentVideoTrack ? room.localParticipant.unpublishTrack(currentVideoTrack) : Promise.resolve()
    ]);

    currentAudioTrack?.stop();
    currentVideoTrack?.stop();
    await Promise.resolve(room?.disconnect());

    liveRoomRef.current = null;
    audioTrackRef.current = null;
    videoTrackRef.current = null;
    joinedRef.current = false;

    if (updateUi) {
      setLiveRoom(null);
      setAudioTrack(null);
      setVideoTrack(null);
      setMicEnabled(false);
      setCameraEnabled(false);
      setJoined(false);
      setRemoteNames([]);
    }
  }, []);

  const leaveCall = useCallback(async () => {
    await disconnectResources(true);
  }, [disconnectResources]);

  useImperativeHandle(ref, () => ({
    disconnect: leaveCall,
    isConnected() {
      return joinedRef.current || liveRoomRef.current !== null;
    }
  }), [leaveCall]);

  useEffect(() => {
    if (!open) {
      void leaveCall();
    }
  }, [leaveCall, open]);

  useEffect(() => () => {
    void disconnectResources(false);
  }, [disconnectResources]);

  useEffect(() => {
    if (!liveRoom) {
      return;
    }

    const syncParticipants = () => {
      setRemoteNames(
        Array.from(liveRoom.remoteParticipants.values()).map((participant) => participant.name || "Room member")
      );
    };

    liveRoom
      .on(RoomEvent.ParticipantConnected, syncParticipants)
      .on(RoomEvent.ParticipantDisconnected, syncParticipants)
      .on(RoomEvent.Disconnected, syncParticipants);

    syncParticipants();

    return () => {
      liveRoom
        .off(RoomEvent.ParticipantConnected, syncParticipants)
        .off(RoomEvent.ParticipantDisconnected, syncParticipants)
        .off(RoomEvent.Disconnected, syncParticipants);
    };
  }, [liveRoom]);

  async function refreshDevices() {
    if (!("mediaDevices" in navigator)) {
      return;
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const nextMics = devices
      .filter((device) => device.kind === "audioinput")
      .map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Microphone ${index + 1}` }));
    const nextCameras = devices
      .filter((device) => device.kind === "videoinput")
      .map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Camera ${index + 1}` }));

    setMicrophones(nextMics);
    setCameras(nextCameras);
    setSelectedMic((current) => current || nextMics[0]?.deviceId || "");
    setSelectedCamera((current) => current || nextCameras[0]?.deviceId || "");
  }

  async function joinCall() {
    if (demoMode) {
      setJoined(true);
      joinedRef.current = true;
      setRemoteNames(simulatedNames);
      setMessage("Demo mode: no real call is connected.");
      return;
    }

    if (!roomId) {
      setMessage("Live room data is still loading.");
      return;
    }

    if (!livekitConfigured) {
      setMessage("Live calls need NEXT_PUBLIC_LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const session = await supabase?.auth.getSession();
    const accessToken = session?.data.session?.access_token;

    if (!accessToken) {
      setMessage("A Supabase session is required before joining a break call.");
      return;
    }

    setJoining(true);
    setMessage("");

    try {
      const response = await fetch("/api/livekit/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          roomId,
          supabaseAccessToken: accessToken,
          requestedMedia: "audio_video"
        })
      });

      const data = await response.json() as { token?: string; serverUrl?: string; error?: string };

      if (!response.ok || !data.token || !data.serverUrl) {
        throw new Error(data.error ?? "Could not join the Break Lounge.");
      }

      const nextRoom = new LiveKitRoom({
        adaptiveStream: true,
        dynacast: true
      });

      await nextRoom.connect(data.serverUrl, data.token, { autoSubscribe: true });
      liveRoomRef.current = nextRoom;
      setLiveRoom(nextRoom);
      setJoined(true);
      joinedRef.current = true;
      await refreshDevices();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not join the Break Lounge.");
    } finally {
      setJoining(false);
    }
  }

  async function toggleMic() {
    if (!liveRoom) {
      return;
    }

    if (audioTrack) {
      if (micEnabled) {
        await audioTrack.mute();
        setMicEnabled(false);
      } else {
        await audioTrack.unmute();
        setMicEnabled(true);
      }
      return;
    }

    const track = await createLocalAudioTrack(selectedMic ? { deviceId: selectedMic } : undefined);
    await liveRoom.localParticipant.publishTrack(track);
    audioTrackRef.current = track;
    setAudioTrack(track);
    setMicEnabled(true);
    await refreshDevices();
  }

  async function toggleCamera() {
    if (!liveRoom) {
      return;
    }

    if (videoTrack) {
      if (cameraEnabled) {
        await liveRoom.localParticipant.unpublishTrack(videoTrack);
        videoTrack.stop();
        videoTrackRef.current = null;
        setVideoTrack(null);
        setCameraEnabled(false);
      } else {
        const track = await createLocalVideoTrack(selectedCamera ? { deviceId: selectedCamera } : undefined);
        await liveRoom.localParticipant.publishTrack(track);
        videoTrackRef.current = track;
        setVideoTrack(track);
        setCameraEnabled(true);
      }
      return;
    }

    const track = await createLocalVideoTrack(selectedCamera ? { deviceId: selectedCamera } : undefined);
    await liveRoom.localParticipant.publishTrack(track);
    videoTrackRef.current = track;
    setVideoTrack(track);
    setCameraEnabled(true);
    await refreshDevices();
  }

  if (!open) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="border-y border-border py-6"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm text-muted">Break Lounge</p>
            <h2 className="mt-2 text-2xl font-semibold">A short reset space for this break</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Calls are optional. Soryvo does not record, transcribe, save screenshots, or allow screen sharing here.
            </p>
            <p className="mt-2 text-sm font-semibold text-primary">
              Live only. No recordings, transcripts, or screen sharing.
            </p>
          </div>
          <BreakCallControls
            joined={joined}
            joining={joining}
            micEnabled={micEnabled}
            cameraEnabled={cameraEnabled}
            onJoin={joinCall}
            onLeave={() => void leaveCall()}
            onToggleMic={() => void toggleMic()}
            onToggleCamera={() => void toggleCamera()}
          />
        </div>

        {joined && !demoMode && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-muted">Microphone</span>
              <select
                value={selectedMic}
                onChange={(event) => setSelectedMic(event.target.value)}
                className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-primary"
              >
                {microphones.length === 0 ? <option>No microphone selected</option> : microphones.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-muted">Camera</span>
              <select
                value={selectedCamera}
                onChange={(event) => setSelectedCamera(event.target.value)}
                className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-primary"
              >
                {cameras.length === 0 ? <option>No camera selected</option> : cameras.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {demoMode && (
          <p className="mt-4 border-l-2 border-focus pl-3 text-sm font-semibold text-primary">
            Demo mode: no real call is connected.
          </p>
        )}

        {message && !demoMode && (
          <p className="mt-4 border-l-2 border-border pl-3 text-sm text-muted">{message}</p>
        )}

        <div className="mt-5">
          <BreakParticipantGrid
            localName={displayName || "You"}
            remoteNames={demoMode ? simulatedNames : remoteNames}
            joined={joined}
            micEnabled={micEnabled}
            cameraEnabled={cameraEnabled}
            demoMode={demoMode}
          />
        </div>

        <div className="mt-5 grid gap-5 border-t border-border pt-5 sm:grid-cols-2">
          <div>
            <Coffee aria-hidden="true" className="mb-3 text-focus" size={20} />
            <p className="font-semibold text-primary">Breaks are intentional</p>
            <p className="mt-2 text-sm leading-6 text-muted">Use this space for a quick reset, not a performance check.</p>
          </div>
          <div>
            <ShieldCheck aria-hidden="true" className="mb-3 text-focus" size={20} />
            <p className="font-semibold text-primary">Private by default</p>
            <p className="mt-2 text-sm leading-6 text-muted">No recording, no transcription, no screen share, and no Focus Check answers stored.</p>
          </div>
        </div>
      </motion.section>
    </AnimatePresence>
  );
});
