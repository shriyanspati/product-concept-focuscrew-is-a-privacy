import type { FocusPoint, RoomMember } from "@/lib/types";

export const seededMembers: RoomMember[] = [
  {
    id: "maya",
    name: "Maya",
    goal: "AP Biology notes",
    status: "focused",
    sharing: true,
    accountabilityPulseOptIn: true
  },
  {
    id: "jordan",
    name: "Jordan",
    goal: "SAT Math practice",
    status: "focused",
    sharing: true,
    accountabilityPulseOptIn: true
  },
  {
    id: "alex",
    name: "Alex",
    goal: "History essay outline",
    status: "focused",
    sharing: true,
    accountabilityPulseOptIn: true
  },
  {
    id: "sam",
    name: "Sam",
    goal: "Chemistry problem set",
    status: "focused",
    sharing: true,
    accountabilityPulseOptIn: true
  }
];

export const initialFocusHistory: FocusPoint[] = [
  { minute: 0, score: 82 },
  { minute: 5, score: 86 },
  { minute: 10, score: 84 },
  { minute: 15, score: 88 }
];

export const demoSubjects = [
  "AP Biology",
  "SAT Math",
  "History",
  "Chemistry",
  "Computer Science",
  "Literature",
  "World Language",
  "Other"
];
