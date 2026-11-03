import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { caseSessions, stageProgress } from "@/db/schema";
import { HINTS } from "@/lib/case-solutions";
import { STAGE_IDS, type StageId } from "@/lib/case-types";
import { buildCaseState, ensureStageRow, getOrCreateSession, isStageUnlocked } from "@/lib/case-service";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { stageId?: string };
  const stageId = String(body.stageId ?? "") as StageId;
  if (!STAGE_IDS.includes(stageId)) return NextResponse.json({ ok: false, message: "Unknown stage." }, { status: 400 });
  const session = await getOrCreateSession();
  if (!(await isStageUnlocked(session, stageId))) return NextResponse.json({ ok: false, message: "Hints unlock together with the stage." }, { status: 403 });
  const row = await ensureStageRow(session.id, stageId);
  if (row.hintsUsed >= 3) return NextResponse.json({ ok: false, message: "All three hint levels are already open.", state: await buildCaseState(session.id) }, { status: 400 });
  const hint = HINTS[stageId][row.hintsUsed];
  await db.update(stageProgress).set({ hintsUsed: row.hintsUsed + 1, updatedAt: new Date() }).where(eq(stageProgress.id, row.id));
  await db.update(caseSessions).set({ hintsUsed: session.hintsUsed + 1, updatedAt: new Date() }).where(eq(caseSessions.id, session.id));
  return NextResponse.json({ ok: true, hint, level: row.hintsUsed + 1, state: await buildCaseState(session.id) });
}
