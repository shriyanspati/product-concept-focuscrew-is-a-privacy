"use client";

import { LogOut, Mic, MicOff, Video, VideoOff } from "lucide-react";

type BreakCallControlsProps = {
  joined: boolean;
  micEnabled: boolean;
  cameraEnabled: boolean;
  joining: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
};

export function BreakCallControls({
  joined,
  micEnabled,
  cameraEnabled,
  joining,
  onJoin,
  onLeave,
  onToggleMic,
  onToggleCamera
}: BreakCallControlsProps) {
  if (!joined) {
    return (
      <button
        type="button"
        onClick={onJoin}
        disabled={joining}
        className="rounded-control bg-focus px-4 py-3 font-semibold text-white transition hover:bg-focusDark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {joining ? "Joining..." : "Join Break Lounge"}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onToggleMic}
        className="inline-flex items-center gap-2 rounded-control border border-border px-3 py-2 text-sm font-semibold text-primary transition hover:bg-surfaceHover"
      >
        {micEnabled ? <Mic aria-hidden="true" size={16} /> : <MicOff aria-hidden="true" size={16} />}
        {micEnabled ? "Mute" : "Unmute"}
      </button>
      <button
        type="button"
        onClick={onToggleCamera}
        className="inline-flex items-center gap-2 rounded-control border border-border px-3 py-2 text-sm font-semibold text-primary transition hover:bg-surfaceHover"
      >
        {cameraEnabled ? <Video aria-hidden="true" size={16} /> : <VideoOff aria-hidden="true" size={16} />}
        {cameraEnabled ? "Camera Off" : "Camera On"}
      </button>
      <button
        type="button"
        onClick={onLeave}
        className="inline-flex items-center gap-2 rounded-control border border-border px-3 py-2 text-sm font-semibold text-primary transition hover:bg-surfaceHover"
      >
        <LogOut aria-hidden="true" size={16} />
        Leave Call
      </button>
    </div>
  );
}
