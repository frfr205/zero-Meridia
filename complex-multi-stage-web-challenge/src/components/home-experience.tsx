"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowDown, ArrowRight, ArrowUp, Check, ChevronRight, Clock3, FileLock2, Fingerprint, Network, Play, ShieldCheck, X } from "lucide-react";
import { STAGES, SUSPECTS } from "@/lib/case-data";
import { PROTOCOL_EVENTS } from "@/lib/puzzle-data";
import { useCase } from "./case-provider";
import { usePersistentState } from "./use-persistent-state";
import { HintPanel, PuzzleActions, Reveal, SolvedFragment, StageGate, StageHeader, SubmissionFeedback, useStageSubmission } from "./stage-ui";

function StartDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { start } = useCase();
  const [alias, setAlias] = useState("");
  const [pending, setPending] = useState(false);
  const accept = async () => {
    setPending(true);
    const ok = await start(alias);
    setPending(false);
    if (ok) {
      onClose();
      window.setTimeout(() => document.getElementById("protocol")?.scrollIntoView({ behavior: "smooth" }), 250);
    }
  };
  return <AnimatePresence>{open && <>
    <motion.button className="modal-backdrop" aria-label="Close" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
    <motion.section className="start-dialog" role="dialog" aria-modal="true" aria-labelledby="start-title" initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.98 }} transition={{ type: "spring", damping: 25 }}>
      <button className="dialog-close" onClick={onClose} aria-label="Close"><X /></button>
      <span className="eyebrow">Observer agreement / NM–17</span>
      <h2 id="start-title">You answer<br />for the chain.</h2>
      <p>From this moment the timer runs continuously and every decision is saved. You can close the tab and return in the same browser. Hints never block progress, but they enter the final protocol.</p>
      <ul className="dialog-rules"><li><Check />Every answer is checked on the server</li><li><Check />No external programs are needed to finish</li><li><Check />Sound can be replaced by a visual envelope</li></ul>
      <label className="field-label">Observer callsign<input value={alias} onChange={(event) => setAlias(event.target.value)} maxLength={40} placeholder="e.g. Night Operator" onKeyDown={(event) => { if (event.key === "Enter") void accept(); }} /></label>
      <button className="primary-button wide" disabled={pending} onClick={() => void accept()}>{pending ? "Opening the loop…" : "Accept the case and start the timer"}<ArrowRight /></button>
      <small className="dialog-foot">Difficulty 9/10 · roughly 4–8 hours · playable across several sessions</small>
    </motion.section>
  </>}</AnimatePresence>;
}

function Hero() {
  const { state } = useCase();
  const [dialogOpen, setDialogOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const sceneScale = useTransform(scrollYProgress, [0, 1], [1, 1.65]);
  const sceneRotate = useTransform(scrollYProgress, [0, 1], [0, 72]);
  const sceneOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.05]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, 160]);
  const line = { hidden: { y: "115%" }, visible: { y: 0 } };
  const started = Boolean(state?.session.startedAt);

  return <>
    <section className="hero" ref={ref}>
      <motion.div className="hero-scene" style={reduced ? undefined : { scale: sceneScale, rotate: sceneRotate, opacity: sceneOpacity }}>
        <div className="meridian-orbit orbit-a"><span /><span /><span /></div>
        <div className="meridian-orbit orbit-b"><span /><span /></div>
        <div className="meridian-axis" />
        <div className="meridian-core"><i />17</div>
        <div className="scene-label label-a">00:41 / LAST SIGNAL</div>
        <div className="scene-label label-b">88.4 MHz / CARRIER</div>
      </motion.div>
      <div className="hero-grid" />
      <motion.div className="hero-copy" style={reduced ? undefined : { y: copyY }}>
        <motion.div className="hero-kicker" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}><span className="live-dot" /> CASE NM–17 OPEN <span>4 NODES · 7 ACTS</span></motion.div>
        <h1 aria-label="Zero Meridian">
          <span className="headline-mask"><motion.span variants={line} initial="hidden" animate="visible" transition={{ duration: 0.9, delay: 0.08, ease: [0.2, 0.8, 0.2, 1] }}>ZERO</motion.span></span>
          <span className="headline-mask outline"><motion.span variants={line} initial="hidden" animate="visible" transition={{ duration: 0.9, delay: 0.18, ease: [0.2, 0.8, 0.2, 1] }}>MERIDIAN</motion.span></span>
        </h1>
        <motion.div className="hero-lower" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65, duration: 0.7 }}>
          <p>Overnight an archive vanished — one nobody was meant to know about. Rebuild the keeper's route through false catalogues, a dead frequency and a network with no way back.</p>
          <div className="hero-actions">
            {started ? <a className="primary-button" href="#case-map"><span>Continue: {state?.stats.solved}/7</span><ArrowDown /></a> : <button className="primary-button" onClick={() => setDialogOpen(true)}><Play size={17} fill="currentColor" /><span>Accept the case</span></button>}
            <a href="#briefing" className="secondary-button">Read the briefing <ArrowDown size={16} /></a>
          </div>
        </motion.div>
      </motion.div>
      <div className="hero-side-meta"><span>DIFFICULTY</span><strong>09<span>/10</span></strong><i /><span>4–8 HOURS</span></div>
      <div className="hero-bottom"><span>ARCHIVE</span><i /><span>RELAY</span><i /><span>ATLAS</span><i /><span>CORE</span></div>
    </section>
    <StartDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
  </>;
}

function ProtocolPuzzle() {
  const { state } = useCase();
  const [order, setOrder] = usePersistentState<string[]>("protocol-order", PROTOCOL_EVENTS.map((event) => event.id));
  const [code, setCode] = usePersistentState("protocol-code", "");
  const { check, pending, feedback } = useStageSubmission("protocol");
  const solved = state?.stages.find((stage) => stage.id === "protocol")?.solved;
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= order.length || solved) return;
    setOrder((items) => {
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };
  return <StageGate id="protocol"><div className="protocol-workbench">
    <div className="protocol-instruction"><span className="eyebrow">Method / causality over sorting</span><p>Place the cards from cause to effect. Time helps you check the chain, but the links inside the text are decisive. The code is the hour of the backup-loop activation.</p></div>
    <div className="timeline-list">
      {order.map((id, index) => {
        const event = PROTOCOL_EVENTS.find((item) => item.id === id)!;
        return <motion.article layout key={event.id} transition={{ type: "spring", stiffness: 380, damping: 32 }} className="timeline-card">
          <div className="timeline-position">{String(index + 1).padStart(2, "0")}</div><time>{event.time}</time>
          <div><span>{event.source}</span><p>{event.text}</p></div>
          <div className="order-controls"><button disabled={index === 0 || solved} onClick={() => move(index, -1)} aria-label="Move up"><ArrowUp /></button><button disabled={index === order.length - 1 || solved} onClick={() => move(index, 1)} aria-label="Move down"><ArrowDown /></button></div>
        </motion.article>;
      })}
    </div>
    <div className="protocol-submit"><label className="field-label">Intrusion code<input className="code-input" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" placeholder="··" disabled={solved} /></label><PuzzleActions><button className="primary-button" disabled={pending || solved || code.length !== 2} onClick={() => void check({ order, code })}>{pending ? "Checking…" : solved ? "Timeline accepted" : "Check the chain"}<Fingerprint /></button></PuzzleActions></div>
    <SubmissionFeedback feedback={feedback} /><SolvedFragment stageId="protocol" /><HintPanel stageId="protocol" />
  </div></StageGate>;
}

function StageMap() {
  const { state } = useCase();
  return <div className="stage-map-list">{STAGES.map((stage, index) => {
    const progress = state?.stages.find((item) => item.id === stage.id);
    return <Reveal key={stage.id} delay={Math.min(index * 0.04, 0.2)}><Link href={stage.href} className={`stage-map-row ${progress?.solved ? "solved" : ""} ${progress?.unlocked ? "unlocked" : "locked"}`}>
      <span className="map-number">{stage.number}</span><div className="map-title"><span>{stage.siteLabel}</span><h3>{stage.title}</h3></div><p>{stage.objective}</p><div className="map-meta"><Clock3 size={14} />{stage.duration}</div><div className="map-state">{progress?.solved ? <><Check /> Solved</> : progress?.unlocked ? <><span className="live-dot" /> Open</> : <><FileLock2 /> Locked</>}<ChevronRight /></div>
    </Link></Reveal>;
  })}</div>;
}

function NetworkScene() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const leftX = useTransform(scrollYProgress, [0.1, 0.55, 0.9], [-170, 0, 120]);
  const rightX = useTransform(scrollYProgress, [0.1, 0.55, 0.9], [170, 0, -120]);
  const centerScale = useTransform(scrollYProgress, [0.1, 0.55, 0.9], [0.65, 1, 0.75]);
  const rotation = useTransform(scrollYProgress, [0, 1], [-18, 18]);
  return <div className="network-scene" ref={ref}>
    <div className="network-lines"><i /><i /><i /></div>
    <motion.div className="network-node node-left" style={reduced ? undefined : { x: leftX, rotate: rotation }}><small>01–02</small><strong>ARCHIVE</strong><span>KEY → CIPHER</span></motion.div>
    <motion.div className="network-node node-center" style={reduced ? undefined : { scale: centerScale }}><Network /><small>06</small><strong>CORE</strong><span>ONE VERDICT</span></motion.div>
    <motion.div className="network-node node-right" style={reduced ? undefined : { x: rightX, rotate: rotation }}><small>03–05</small><strong>RELAY + ATLAS</strong><span>SIGNAL → ROUTE</span></motion.div>
    <div className="network-caption">Every answer reshapes the next node.<br />The fragments converge only at the end.</div>
  </div>;
}

export function HomeExperience() {
  return <div className="home-page">
    <Hero />
    <section className="briefing-section content-section" id="briefing">
      <Reveal className="section-intro"><div className="section-index">01 / BRIEFING</div><h2>This is not a quiz.<br /><em>It is a chain of evidence.</em></h2></Reveal>
      <div className="briefing-grid"><Reveal><p className="lead">At 00:41 the research station "Meridian" transmitted four letters and dropped off the network. By morning fund M-17 was sealed, six catalogue cards were swapped, and the backup copy was locked behind an independent-witness procedure.</p></Reveal><Reveal delay={0.1}><p>The route's author assumed it would be solved without outside programs. Inside you'll find a remainder calculator, a transposition decryptor, synthesized Morse, observation filters and an interactive graph. External search engines give no ready answer: every material belongs to this case.</p><div className="briefing-callout"><ShieldCheck /><span><strong>Honest difficulty</strong>Each act has three hint levels. The third nearly names the solution, but you still have to apply it and complete the check yourself.</span></div></Reveal></div>
      <div className="case-facts"><div><strong>07</strong><span>linked acts</span></div><div><strong>16</strong><span>stations in the final graph</span></div><div><strong>12+12</strong><span>cards and observations</span></div><div><strong>21</strong><span>levels of help</span></div></div>
    </section>

    <section className="protocol-section content-section" id="protocol"><StageHeader id="protocol" /><ProtocolPuzzle /></section>

    <section className="map-section content-section" id="case-map"><Reveal className="section-intro horizontal"><div><div className="section-index">02 / CASE ROUTE</div><h2>Seven locks.<br />Not one optional.</h2></div><p>Stages open only after the server confirms the previous one. You can move freely among the nodes already available and return to the materials.</p></Reveal><StageMap /></section>

    <section className="interlock-section"><Reveal className="section-intro centered"><div className="section-index">03 / ARCHITECTURE</div><h2>Three sites. One clue<br />always on another node.</h2><p>Move between the case nodes: no outside internet and no ready answers are required.</p></Reveal><NetworkScene /></section>

    <section className="suspects-section content-section"><Reveal className="section-intro horizontal"><div><div className="section-index">04 / PEOPLE</div><h2>Four had a motive.<br />One had the whole access.</h2></div><p>The statements are available immediately. Do not rush to a conclusion: the decisive evidence appears at the relay, in the archive and at station ZERO.</p></Reveal><div className="suspect-grid">{SUSPECTS.map((person, index) => <Reveal key={person.id} delay={index * 0.06}><article className="suspect-card"><div className="suspect-monogram">{person.name.split(" ").map((part) => part[0]).join("")}</div><span className="eyebrow">Person of interest 0{index + 1}</span><h3>{person.name}</h3><strong>{person.role}</strong><dl><div><dt>Shift</dt><dd>{person.shift}</dd></div><div><dt>Access</dt><dd>{person.access}</dd></div></dl><blockquote>{person.statement}</blockquote><p>{person.detail}</p></article></Reveal>)}</div></section>

    <section className="closing-cta"><Reveal><span className="eyebrow">The observer channel is open</span><h2>The archive remembers<br />what people erased.</h2><a href="#protocol" className="primary-button">Start with the timeline <ArrowRight /></a></Reveal></section>
  </div>;
}
