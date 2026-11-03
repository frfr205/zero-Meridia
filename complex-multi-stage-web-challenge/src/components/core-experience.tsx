"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowDownToLine, Check, ChevronRight, CircleDot, Copy, Cpu, FileCheck2, Fingerprint, KeyRound, ShieldCheck, Trophy } from "lucide-react";
import { MOTIVES } from "@/lib/puzzle-data";
import { STAGES, SUSPECTS } from "@/lib/case-data";
import type { StageId } from "@/lib/case-types";
import { useCase } from "./case-provider";
import { usePersistentState } from "./use-persistent-state";
import { HintPanel, PuzzleActions, Reveal, StageGate, StageHeader, SubmissionFeedback, useStageSubmission } from "./stage-ui";

function formatDuration(total: number): string {
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function CompletionCertificate() {
  const { state, notify } = useCase();
  if (!state?.session.completedAt) return null;
  const { hints, attempts, elapsedSeconds } = state.stats;
  const rank = hints === 0 && attempts === 0 ? "ABSOLUTE OBSERVER" : hints <= 3 && attempts <= 5 ? "KEEPER OF THE CHAIN" : "INDEPENDENT WITNESS";
  const share = async () => {
    const text = `I closed the "Zero Meridian" case: 7/7 acts, ${formatDuration(elapsedSeconds)}, ${attempts} failed checks, ${hints} hints. Rank: ${rank}.`;
    if (navigator.share) {
      try { await navigator.share({ title: "Zero Meridian", text }); return; } catch (reason) { if (reason instanceof DOMException && reason.name === "AbortError") return; }
    }
    await navigator.clipboard.writeText(text);
    notify("Result text copied without revealing solutions.", "success");
  };
  return <motion.section className="completion-certificate" initial={{ opacity: 0, scale: 0.94, clipPath: "inset(20% 0 20% 0)" }} animate={{ opacity: 1, scale: 1, clipPath: "inset(0% 0 0% 0)" }} transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}>
    <div className="certificate-seal"><Trophy /><span>NM–17</span></div><span className="eyebrow">Independent witness protocol / complete</span><h2>CASE<br /><em>CLOSED</em></h2><p className="certificate-alias">{state.session.alias}</p><div className="certificate-rank"><small>Rank awarded</small><strong>{rank}</strong><span>The rank is computed from actual misses and hints, not handed out at random.</span></div><div className="certificate-stats"><div><strong>7/7</strong><span>acts</span></div><div><strong>{formatDuration(elapsedSeconds)}</strong><span>in the loop</span></div><div><strong>{attempts}</strong><span>misses</span></div><div><strong>{hints}</strong><span>hints</span></div></div><div className="certificate-actions"><a href="/api/case/export?format=md" className="primary-button"><ArrowDownToLine /> Download dossier</a><button className="secondary-button" onClick={() => void share()}><Copy /> Share result</button></div><small>Closed {new Intl.DateTimeFormat("en", { dateStyle: "long", timeStyle: "short" }).format(new Date(state.session.completedAt))}</small>
  </motion.section>;
}

function CorePuzzle() {
  const { state } = useCase();
  const [mask, setMask] = usePersistentState("core-mask", "511");
  const [code, setCode] = usePersistentState("core-code", "");
  const [culprit, setCulprit] = usePersistentState("core-culprit", "");
  const [motive, setMotive] = usePersistentState("core-motive", "");
  const { check, pending, feedback } = useStageSubmission("core");
  const solved = state?.stages.find((stage) => stage.id === "core")?.solved;
  const stageIds: StageId[] = ["protocol", "catalogue", "cipher", "signal", "atlas", "network"];
  const rows = stageIds.map((id, index) => ({ id, title: STAGES.find((stage) => stage.id === id)!.title, value: Number(state?.fragments[id] ?? 0), weight: index + 1 }));
  const registerA = rows.reduce((sum, row) => sum + row.value * row.weight, 0);
  const numericMask = Number(mask);
  const registerB = mask !== "" && Number.isInteger(numericMask) && numericMask >= 0 ? (registerA ^ numericMask) >>> 0 : 0;

  return <StageGate id="core"><div className="core-workbench">
    <div className="core-directive"><Cpu /><div><span className="eyebrow">Integrity directive / revision 511</span><h3>Two registers. One signature.</h3><p>Place the fragments in the order they were earned. Compute <strong>A = Σ(Nᵢ × i)</strong>, where i = 1…6. Then compute <strong>B = A XOR 511</strong>. The lock code is the decimal records of A and B joined, with no space. The mask is editable: the calculator always performs a genuine bitwise XOR.</p></div></div>
    <div className="register-machine"><div className="fragment-register"><div className="register-head"><span>Input register</span><strong>6 / 6 fragments</strong></div>{rows.map((row) => <div className="register-row" key={row.id}><span>{String(row.weight).padStart(2, "0")}</span><div><small>{row.title}</small><strong>{String(row.value).padStart(2, "0")}</strong></div><code>{row.value} × {row.weight} = {row.value * row.weight}</code></div>)}</div><div className="register-math"><div><small>Register A / weighted sum</small><strong>{registerA}</strong><code>{rows.map((row) => row.value * row.weight).join(" + ")} = {registerA}</code></div><label><span>XOR mask / decimal</span><div><span>DEC</span><input value={mask} onChange={(event) => setMask(event.target.value.replace(/\D/g, "").slice(0, 5))} inputMode="numeric" /></div><small>The mask is given in decimal; its binary representation is shown below</small></label><div><small>Register B / A XOR mask</small><strong>{String(registerB).padStart(3, "0")}</strong><code>{registerA.toString(2).padStart(10, "0")} ⊕ {numericMask.toString(2).padStart(10, "0")} = {registerB.toString(2).padStart(10, "0")}</code></div></div></div>
    <section className="verdict-section"><div className="verdict-heading"><Fingerprint /><div><span className="eyebrow">Part II / verdict</span><h3>Who built the route — and why?</h3><p>Cross-reference physical access to the archive, clearance II for phase, the R-88 forms, and the note at station ZERO.</p></div></div><div className="core-suspects">{SUSPECTS.map((person) => <button key={person.id} className={culprit === person.id ? "selected" : ""} onClick={() => setCulprit(person.id)} disabled={solved}><div><span className="suspect-monogram small">{person.name.split(" ").map((part) => part[0]).join("")}</span>{culprit === person.id && <Check />}</div><h4>{person.name}</h4><strong>{person.role}</strong><p>{person.access}</p><small>{person.shift}</small></button>)}</div><fieldset className="motive-list"><legend>Author's motive</legend>{MOTIVES.map((item) => <label key={item.id} className={motive === item.id ? "selected" : ""}><input type="radio" name="motive" value={item.id} checked={motive === item.id} onChange={() => setMotive(item.id)} disabled={solved} /><span>{motive === item.id && <Check />}</span>{item.label}</label>)}</fieldset></section>
    <div className="core-submit"><label className="field-label">Two-register code<input className="core-code-input" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" inputMode="numeric" disabled={solved} /></label><div><span>Code: {code.length}/6</span><span>Author: {culprit ? "chosen" : "not chosen"}</span><span>Motive: {motive ? "chosen" : "not chosen"}</span></div><PuzzleActions><button className="primary-button" disabled={pending || solved || code.length !== 6 || !culprit || !motive} onClick={() => void check({ code, culprit, motive })}>{pending ? "Opening the core…" : solved ? "Verdict accepted" : "Close the case"}<KeyRound /></button></PuzzleActions></div><SubmissionFeedback feedback={feedback} /><HintPanel stageId="core" />
    <AnimatePresence>{solved && <motion.div className="case-resolution" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}><span className="eyebrow">Decrypted epilogue / station ZERO</span><h3>She did not steal the archive.<br />She made it survive.</h3><div><p>Serafima Ro swapped six cards after management ordered the destruction of fund M-17. The originals were moved to immutable storage, and the false digital trail was meant to send the search team down empty shelves.</p><p>The route through the relay and atlas was a test of an independent witness. Only someone able to rebuild every link could obtain a copy without the right to silently erase it. Your verdict removed the last lock; the copy now exists outside the corporate loop.</p></div><div className="resolution-status"><ShieldCheck /><span><strong>Backup copy handed over</strong>Integrity hash NM17-570965 confirmed. The history no longer belongs to a single owner.</span></div></motion.div>}</AnimatePresence>
  </div></StageGate>;
}

export function CoreExperience() {
  const { state } = useCase();
  return <div className="core-page inner-page"><section className="inner-hero core-hero"><div className="core-hero-rings"><i /><i /><i /></div><div className="inner-hero-icon"><CircleDot /></div><motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}><span className="eyebrow">Final node / immutable storage</span><h1>CORE <em>ZERO</em></h1><p>The numbers confirm the integrity of the route. But the storage opens only after a human decision: who left this path, and why.</p></motion.div><div className="inner-hero-index">06<br /><span>FRAGMENTS</span></div></section><section className="inner-stage core-stage"><StageHeader id="core" /><CorePuzzle /></section><CompletionCertificate />{!state?.session.completedAt && <Reveal className="core-bottom-note"><FileCheck2 /><p>The final export will include all ten unlocked documents, the timing and your notes. Codes for unsolved stages are never written to the file.</p></Reveal>}<Reveal className="next-node"><span className="eyebrow">You can return to any piece of evidence</span><h2>A verdict is only as strong as its chain.</h2><a href="/">Open the central dossier <ChevronRight /></a></Reveal></div>;
}
