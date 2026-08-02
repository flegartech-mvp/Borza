"use client";

import { useSyncExternalStore } from "react";
import type {
  CompetenceEvidence,
  DemoClassroom,
  DemoClassroomResponse,
  DemoLifeSession,
  PracticalAttempt,
} from "./types";

const KEY = "borza-practical-finance-demo-v1";
const EVENT = "borza:practical-finance-change";

export type PracticalDemoState = {
  version: 1;
  attempts: PracticalAttempt[];
  evidence: CompetenceEvidence[];
  lifeSessions: DemoLifeSession[];
  classrooms: DemoClassroom[];
};

const EMPTY: PracticalDemoState = {
  version: 1,
  attempts: [],
  evidence: [],
  lifeSessions: [],
  classrooms: [],
};

let rawCache: string | null | undefined;
let stateCache = EMPTY;

function snapshot() {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === rawCache) return stateCache;
    rawCache = raw;
    if (!raw) return (stateCache = EMPTY);
    const parsed = JSON.parse(raw) as Partial<PracticalDemoState>;
    if (parsed.version !== 1) return (stateCache = EMPTY);
    return (stateCache = {
      ...EMPTY,
      ...parsed,
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
      lifeSessions: Array.isArray(parsed.lifeSessions)
        ? parsed.lifeSessions
        : [],
      classrooms: Array.isArray(parsed.classrooms) ? parsed.classrooms : [],
    });
  } catch {
    return EMPTY;
  }
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function write(next: PracticalDemoState) {
  stateCache = next;
  rawCache = JSON.stringify(next);
  try {
    localStorage.setItem(KEY, rawCache);
  } catch {
    // The current tab still keeps a usable in-memory demo.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function usePracticalDemoState() {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

export function saveDemoAttempt(
  value: PracticalAttempt,
  evidence: CompetenceEvidence[],
) {
  const state = snapshot();
  write({
    ...state,
    attempts: [value, ...state.attempts],
    evidence: [...evidence, ...state.evidence],
  });
}

export function saveDemoLifeSession(value: DemoLifeSession) {
  const state = snapshot();
  write({
    ...state,
    lifeSessions: [
      value,
      ...state.lifeSessions.filter((item) => item.id !== value.id),
    ],
  });
}

export function createDemoClassroom(
  input: Omit<
    DemoClassroom,
    "id" | "code" | "createdAt" | "responses" | "participantCount"
  >,
) {
  const code = Array.from({ length: 7 }, () =>
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".charAt(Math.floor(Math.random() * 32)),
  ).join("");
  const classroom: DemoClassroom = {
    ...input,
    id: crypto.randomUUID(),
    code,
    createdAt: new Date().toISOString(),
    responses: [],
    participantCount: 0,
  };
  const state = snapshot();
  write({ ...state, classrooms: [classroom, ...state.classrooms] });
  return classroom;
}

export function joinDemoClassroom(code: string) {
  const state = snapshot();
  const classroom = state.classrooms.find(
    (item) => item.code === code.toUpperCase() && item.status === "active",
  );
  if (!classroom) return null;
  const updated = {
    ...classroom,
    participantCount: classroom.participantCount + 1,
  };
  write({
    ...state,
    classrooms: state.classrooms.map((item) =>
      item.id === updated.id ? updated : item,
    ),
  });
  return { classroom: updated, participantId: crypto.randomUUID() };
}

export function saveDemoClassroomResponse(
  classroomId: string,
  response: DemoClassroomResponse,
) {
  const state = snapshot();
  write({
    ...state,
    classrooms: state.classrooms.map((classroom) =>
      classroom.id === classroomId
        ? { ...classroom, responses: [...classroom.responses, response] }
        : classroom,
    ),
  });
}

export function closeDemoClassroom(classroomId: string) {
  const state = snapshot();
  write({
    ...state,
    classrooms: state.classrooms.map((classroom) =>
      classroom.id === classroomId
        ? { ...classroom, status: "closed" }
        : classroom,
    ),
  });
}
