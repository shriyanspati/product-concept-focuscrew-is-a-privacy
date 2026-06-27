"use client";

import { MicOff, UserRound, VideoOff } from "lucide-react";

type BreakParticipantGridProps = {
  localName: string;
  remoteNames: string[];
  joined: boolean;
  micEnabled: boolean;
  cameraEnabled: boolean;
  demoMode?: boolean;
};

export function BreakParticipantGrid({
  localName,
  remoteNames,
  joined,
  micEnabled,
  cameraEnabled,
  demoMode = false
}: BreakParticipantGridProps) {
  const names = joined || demoMode ? [localName, ...remoteNames] : ["You"];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {names.map((name, index) => (
        <div key={`${name}-${index}`} className="border-t border-border pt-4">
          <div className="grid aspect-video place-items-center bg-surfaceSoft">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-redSoft text-focus">
              <UserRound aria-hidden="true" size={24} />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-primary">{name}</p>
              <p className="text-xs text-muted">
                {demoMode ? "Demo tile" : index === 0 ? "You" : "Room member"}
              </p>
            </div>
            {index === 0 && (
              <div className="flex items-center gap-1 text-muted">
                {!micEnabled && <MicOff aria-label="Microphone off" size={16} />}
                {!cameraEnabled && <VideoOff aria-label="Camera off" size={16} />}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
