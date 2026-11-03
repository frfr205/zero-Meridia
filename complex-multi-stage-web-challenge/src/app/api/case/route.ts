import { NextResponse } from "next/server";
import { buildCaseState, getOrCreateSession, resetSession, saveNotes, startSession } from "@/lib/case-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getOrCreateSession();
  return NextResponse.json({ ok: true, state: await buildCaseState(session.id) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { action?: string; alias?: string; notes?: string; confirm?: string };
  const session = await getOrCreateSession();

  if (body.action === "start") {
    await startSession(String(body.alias ?? ""));
  } else if (body.action === "notes") {
    await saveNotes(String(body.notes ?? ""));
  } else if (body.action === "reset") {
    if (body.confirm !== "ZERO MERIDIAN") return NextResponse.json({ ok: false, message: "Type the full case name to reset." }, { status: 400 });
    await resetSession();
  } else {
    return NextResponse.json({ ok: false, message: "Unknown action." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, state: await buildCaseState(session.id) });
}
