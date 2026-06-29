"use client";

import type { LocalVideoTrack, RemoteAudioTrack, RemoteVideoTrack } from "livekit-client";
import { MicOff, UserRound, VideoOff } from "lucide-react";
import { useEffect, useRef } from "react";

export type BreakRemoteParticipant = {
  id: string;
  name: string;
  audioTrack: RemoteAudioTrack | null;
  videoTrack: RemoteVideoTrack | null;
  micEnabled: boolean;
  cameraEnabled: boolean;
};

type BreakParticipantGridProps = {
  localName: string;
  localVideoTrack: LocalVideoTrack | null;
  remoteParticipants: BreakRemoteParticipant[];
  joined: boolean;
  micEnabled: boolean;
  cameraEnabled: boolean;
  demoMode?: boolean;
  demoNames?: string[];
};

export function BreakParticipantGrid({
  localName,
  localVideoTrack,
  remoteParticipants,
  joined,
  micEnabled,
  cameraEnabled,
  demoMode = false,
  demoNames = []
}: BreakParticipantGridProps) {
  if (!joined && !demoMode) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <ParticipantTile name="You" subtitle="Not connected" micEnabled={false} cameraEnabled={false} />
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ParticipantTile
        name={localName}
        subtitle="You"
        micEnabled={micEnabled}
        cameraEnabled={cameraEnabled}
        videoTrack={localVideoTrack}
        muted
        mirrored
      />

      {demoMode
        ? demoNames.map((name) => (
            <ParticipantTile
              key={name}
              name={name}
              subtitle="Demo tile"
              micEnabled
              cameraEnabled={false}
            />
          ))
        : remoteParticipants.map((participant) => (
            <ParticipantTile
              key={participant.id}
              name={participant.name}
              subtitle="Room member"
              micEnabled={participant.micEnabled}
              cameraEnabled={participant.cameraEnabled}
              videoTrack={participant.videoTrack}
              audioTrack={participant.audioTrack}
            />
          ))}
    </div>
  );
}

function ParticipantTile({
  name,
  subtitle,
  micEnabled,
  cameraEnabled,
  videoTrack,
  audioTrack,
  muted = false,
  mirrored = false
}: {
  name: string;
  subtitle: string;
  micEnabled: boolean;
  cameraEnabled: boolean;
  videoTrack?: LocalVideoTrack | RemoteVideoTrack | null;
  audioTrack?: RemoteAudioTrack | null;
  muted?: boolean;
  mirrored?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !videoTrack) {
      return;
    }

    videoTrack.attach(element);
    return () => {
      videoTrack.detach(element);
    };
  }, [videoTrack]);

  useEffect(() => {
    const element = audioRef.current;
    if (!element || !audioTrack) {
      return;
    }

    audioTrack.attach(element);
    return () => {
      audioTrack.detach(element);
    };
  }, [audioTrack]);

  return (
    <div className="border-t border-border pt-4">
      <div className="relative grid aspect-video place-items-center overflow-hidden bg-surfaceSoft">
        {videoTrack && cameraEnabled ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={muted}
            className={`h-full w-full object-cover ${mirrored ? "-scale-x-100" : ""}`}
          />
        ) : (
          <div className="grid h-14 w-14 place-items-center rounded-full bg-redSoft text-focus">
            <UserRound aria-hidden="true" size={24} />
          </div>
        )}
        {audioTrack && <audio ref={audioRef} autoPlay />}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-primary">{name}</p>
          <p className="text-xs text-muted">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1 text-muted">
          {!micEnabled && <MicOff aria-label="Microphone off" size={16} />}
          {!cameraEnabled && <VideoOff aria-label="Camera off" size={16} />}
        </div>
      </div>
    </div>
  );
}
