type SoryvoRoomPreviewProps = {
  compact?: boolean;
  currentUserName?: string;
};

export function SoryvoRoomPreview({ compact = false, currentUserName }: SoryvoRoomPreviewProps) {
  const hasCurrentUser = currentUserName !== undefined;
  const currentName = currentUserName || "You";
  const currentGoal = currentUserName ? "Setting up a study session" : "Your study goal";
  const members = [
    ...(hasCurrentUser ? [[currentName, currentGoal, "Ready"]] : []),
    ["Maya", "AP Biology notes", "Focused"],
    ["Jordan", "SAT Math practice", "Focused"],
    ["Alex", "History outline", "Taking a break"]
  ];

  return (
    <div className="w-full" aria-label="Soryvo room preview">
      <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
        <p className={`${compact ? "text-base" : "text-xl"} font-semibold text-primary`}>Sample study room</p>
        <p className="font-mono text-sm text-muted">24:18</p>
      </div>

      <div className="divide-y divide-border">
        {members.slice(0, compact ? 4 : 3).map(([name, goal, status]) => (
          <div key={name} className="flex items-start justify-between gap-4 py-4">
            <div>
              <p className="font-medium text-primary">{name}</p>
              <p className="text-sm text-muted">{goal}</p>
            </div>
            <span className="shrink-0 text-sm text-muted">{status}</span>
          </div>
        ))}
      </div>

      <p className="border-t border-border pt-3 text-sm text-muted">
        Private by default. Shared momentum only.
      </p>
    </div>
  );
}
