import { EVIDENCE, STAGES } from "@/lib/case-data";
import { buildCaseState, getOrCreateSession } from "@/lib/case-service";

export const dynamic = "force-dynamic";

function duration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours} h ${minutes} min`;
}

export async function GET(request: Request) {
  const session = await getOrCreateSession();
  const state = await buildCaseState(session.id);
  const format = new URL(request.url).searchParams.get("format");
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "json") {
    return new Response(JSON.stringify({ case: "Zero Meridian", exportedAt: new Date().toISOString(), ...state }, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="zero-meridian-${stamp}.json"`,
      },
    });
  }

  const solvedIds = state.stages.filter((stage) => stage.solved).map((stage) => stage.id);
  const lines = [
    "# ZERO MERIDIAN",
    "",
    `Observer: ${state.session.alias}`,
    `Status: ${state.session.completedAt ? "CASE CLOSED" : "UNDER INVESTIGATION"}`,
    `Stages solved: ${state.stats.solved} / 7`,
    `Time: ${duration(state.stats.elapsedSeconds)}`,
    `Failed checks: ${state.stats.attempts}`,
    `Hints opened: ${state.stats.hints}`,
    "",
    "## Stages",
    ...STAGES.map((stage) => {
      const progress = state.stages.find((item) => item.id === stage.id);
      const fragment = state.fragments[stage.id];
      return `- [${progress?.solved ? "x" : " "}] ${stage.number} · ${stage.title}${fragment ? ` — fragment ${fragment}` : ""}`;
    }),
    "",
    "## Evidence collected",
    ...(EVIDENCE.filter((item) => solvedIds.includes(item.stageId)).flatMap((item) => [
      `### ${item.title}`, `${item.source} · ${item.tag}`, item.body, "",
    ])),
    "## Personal notes",
    state.notes || "No notes.",
    "",
    "This export contains only materials actually unlocked. Unsolved answers are never revealed.",
  ];
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="zero-meridian-${stamp}.md"`,
    },
  });
}
