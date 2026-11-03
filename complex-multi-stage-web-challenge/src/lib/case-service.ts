import "server-only";

import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { attemptLog, caseSessions, stageProgress } from "@/db/schema";
import { FRAGMENTS, getStage, STAGES } from "./case-data";
import { HINTS } from "./case-solutions";
import type { CaseState, StageId } from "./case-types";

const COOKIE_NAME = "nm_case_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

type SessionRow = typeof caseSessions.$inferSelect;

export async function getOrCreateSession(): Promise<SessionRow> {
  const jar = await cookies();
  const existingId = jar.get(COOKIE_NAME)?.value;
  const validSessionId = existingId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existingId);
  if (validSessionId && existingId) {
    const [existing] = await db.select().from(caseSessions).where(eq(caseSessions.id, existingId)).limit(1);
    if (existing) return existing;
  }

  const [created] = await db.insert(caseSessions).values({}).returning();
  jar.set(COOKIE_NAME, created.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return created;
}

export async function buildCaseState(sessionId: string): Promise<CaseState> {
  const [session] = await db.select().from(caseSessions).where(eq(caseSessions.id, sessionId)).limit(1);
  if (!session) throw new Error("Investigation session not found");
  const progress = await db.select().from(stageProgress).where(eq(stageProgress.sessionId, sessionId));
  const progressMap = new Map(progress.map((row) => [row.stageId, row]));
  const solved = new Set(progress.filter((row) => row.solvedAt).map((row) => row.stageId));
  const now = session.completedAt ?? new Date();
  const elapsedSeconds = session.startedAt
    ? Math.max(0, Math.floor((now.getTime() - session.startedAt.getTime()) / 1000))
    : 0;
  const fragments: CaseState["fragments"] = {};
  const revealedHints: CaseState["revealedHints"] = {};

  const stages = STAGES.map((definition) => {
    const row = progressMap.get(definition.id);
    const isSolved = Boolean(row?.solvedAt);
    if (isSolved && definition.id !== "core") fragments[definition.id] = FRAGMENTS[definition.id];
    if (row?.hintsUsed) revealedHints[definition.id] = HINTS[definition.id].slice(0, row.hintsUsed);
    return {
      id: definition.id,
      unlocked: Boolean(session.startedAt) && definition.prerequisites.every((id) => solved.has(id)),
      solved: isSolved,
      attempts: row?.attempts ?? 0,
      hintsUsed: row?.hintsUsed ?? 0,
      solvedAt: row?.solvedAt?.toISOString() ?? null,
    };
  });

  return {
    session: {
      id: session.id,
      alias: session.alias,
      startedAt: session.startedAt?.toISOString() ?? null,
      completedAt: session.completedAt?.toISOString() ?? null,
    },
    stages,
    fragments,
    revealedHints,
    notes: session.notes,
    stats: {
      solved: stages.filter((stage) => stage.solved).length,
      attempts: session.wrongAttempts,
      hints: session.hintsUsed,
      elapsedSeconds,
    },
  };
}

export async function isStageUnlocked(session: SessionRow, stageId: StageId): Promise<boolean> {
  if (!session.startedAt) return false;
  const definition = getStage(stageId);
  if (!definition) return false;
  if (definition.prerequisites.length === 0) return true;
  const rows = await db.select().from(stageProgress).where(eq(stageProgress.sessionId, session.id));
  const solved = new Set(rows.filter((row) => row.solvedAt).map((row) => row.stageId));
  return definition.prerequisites.every((id) => solved.has(id));
}

export async function ensureStageRow(sessionId: string, stageId: StageId) {
  await db.insert(stageProgress).values({ sessionId, stageId }).onConflictDoNothing();
  const [row] = await db.select().from(stageProgress).where(and(eq(stageProgress.sessionId, sessionId), eq(stageProgress.stageId, stageId))).limit(1);
  return row;
}

export async function startSession(alias: string): Promise<void> {
  const session = await getOrCreateSession();
  await db.update(caseSessions).set({
    alias: alias.trim().slice(0, 40) || "Observer",
    startedAt: session.startedAt ?? new Date(),
    updatedAt: new Date(),
  }).where(eq(caseSessions.id, session.id));
}

export async function saveNotes(notes: string): Promise<void> {
  const session = await getOrCreateSession();
  await db.update(caseSessions).set({ notes: notes.slice(0, 20000), updatedAt: new Date() }).where(eq(caseSessions.id, session.id));
}

export async function resetSession(): Promise<void> {
  const session = await getOrCreateSession();
  await db.delete(attemptLog).where(eq(attemptLog.sessionId, session.id));
  await db.delete(stageProgress).where(eq(stageProgress.sessionId, session.id));
  await db.update(caseSessions).set({
    startedAt: null,
    completedAt: null,
    notes: "",
    wrongAttempts: 0,
    hintsUsed: 0,
    updatedAt: new Date(),
  }).where(eq(caseSessions.id, session.id));
}
