"use client";

const debugIdentityKey = "soryvo:debug-identity";

export type DebugIdentity = {
  displayName: string;
  email: string;
};

export function isDebugAuthEnabled() {
  return process.env.NEXT_PUBLIC_GUEST_ACCESS !== "false";
}

export function saveDebugIdentity(identity: DebugIdentity) {
  if (!isDebugAuthEnabled() || typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(debugIdentityKey, JSON.stringify(identity));
}

export function loadDebugIdentity(): DebugIdentity | null {
  if (!isDebugAuthEnabled() || typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(debugIdentityKey);
  if (!raw) {
    return null;
  }

  try {
    const identity = JSON.parse(raw) as Partial<DebugIdentity>;
    if (typeof identity.displayName !== "string" || typeof identity.email !== "string") {
      return null;
    }

    return {
      displayName: identity.displayName,
      email: identity.email
    };
  } catch {
    return null;
  }
}
