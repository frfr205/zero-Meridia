import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { attemptLog, caseSessions, stageProgress } from "@/db/schema";
import { STAGE_IDS, type StageId } from "@/lib/case-types";
import { buildCaseState, ensureStageRow, getOrCreateSession, isStageUnlocked } from "@/lib/case-service";
import { verifyStage } from "@/lib/case-solutions";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { stageId?: string; payload?: unknown };
  const stageId = String(body.stageId ?? "") as StageId;
  if (!STAGE_IDS.includes(stageId)) return NextResponse.json({ ok: false, message: "Unknown stage." }, { status: 400 });
  if (JSON.stringify(body.payload ?? {}).length > 30000) return NextResponse.json({ ok: false, message: "Answer payload is too large." }, { status: 413 });

  const session = await getOrCreateSession();
  if (!(await isStageUnlocked(session, stageId))) return NextResponse.json({ ok: false, message: "This stage is still locked: finish the previous link first." }, { status: 403 });
  const row = await ensureStageRow(session.id, stageId);
  if (row.solvedAt) return NextResponse.json({ ok: true, correct: true, message: "This stage is already solved and saved.", state: await buildCaseState(session.id) });

  const verdict = verifyStage(stageId, body.payload);
  await db.insert(attemptLog).values({ sessionId: session.id, stageId, submitted: body.payload ?? {}, correct: verdict.correct ? 1 : 0 });
  const now = new Date();

  if (verdict.correct) {
    await db.update(stageProgress).set({ solvedAt: now, payload: body.payload ?? {}, updatedAt: now }).where(eq(stageProgress.id, row.id));
    if (stageId === "core") await db.update(caseSessions).set({ completedAt: now, updatedAt: now }).where(eq(caseSessions.id, session.id));
  } else {
    await db.update(stageProgress).set({ attempts: row.attempts + 1, updatedAt: now }).where(eq(stageProgress.id, row.id));
    await db.update(caseSessions).set({ wrongAttempts: session.wrongAttempts + 1, updatedAt: now }).where(eq(caseSessions.id, session.id));
  }

  return NextResponse.json({ ok: true, correct: verdict.correct, message: verdict.message, state: await buildCaseState(session.id) });
}
