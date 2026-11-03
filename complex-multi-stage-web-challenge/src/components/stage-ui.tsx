"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, ChevronDown, Lightbulb, LockKeyhole, RotateCw, ShieldCheck } from "lucide-react";
import { STAGES } from "@/lib/case-data";
import type { StageId } from "@/lib/case-types";
import { useCase } from "./case-provider";

export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 48, clipPath: "inset(0 0 18% 0)" }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.75, delay, ease: [0.2, 0.75, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function StageGate({ id, children }: { id: StageId; children: ReactNode }) {
  const { state, loading } = useCase();
  if (loading) return <div className="stage-gate"><RotateCw className="spin" size={20} /> Connecting the secure loop…</div>;
  const stage = state?.stages.find((item) => item.id === id);
  if (!state?.session.startedAt) {
    return <div className="stage-gate"><LockKeyhole size={22} /><div><strong>The dossier is not accepted yet</strong><p>Return to the central node and register an observer.</p></div><Link href="/" className="text-link">Open the dossier <ArrowRight size={15} /></Link></div>;
  }
  if (!stage || (!stage.unlocked && !stage.solved)) {
    const definition = STAGES.find((item) => item.id === id);
    const previous = definition?.prerequisites.map((required) => STAGES.find((item) => item.id === required)?.title).join(", ");
    return <div className="stage-gate"><LockKeyhole size={22} /><div><strong>Loop locked</strong><p>You must first finish: {previous}.</p></div><Link href="/" className="text-link">Case map <ArrowRight size={15} /></Link></div>;
  }
  return children;
}

export function StageHeader({ id, children }: { id: StageId; children?: ReactNode }) {
  const { state } = useCase();
  const definition = STAGES.find((item) => item.id === id)!;
  const progress = state?.stages.find((item) => item.id === id);
  return (
    <header className="stage-heading">
      <div className="stage-number">{definition.number}</div>
      <div className="stage-heading-copy">
        <div className="eyebrow">{definition.siteLabel} <span>/</span> {definition.duration}</div>
        <h2>{definition.title}</h2>
        <p className="stage-subtitle">{definition.subtitle}</p>
        <p>{definition.brief}</p>
        {children}
      </div>
      <div className={`stage-status ${progress?.solved ? "is-solved" : ""}`}>
        {progress?.solved ? <Check size={16} /> : <span className="status-dot" />}
        {progress?.solved ? "Solved" : "Active"}
        <small>{progress?.attempts ?? 0} misses</small>
      </div>
    </header>
  );
}

export function useStageSubmission(stageId: StageId) {
  const { submit } = useCase();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const check = async (payload: unknown) => {
    setPending(true);
    setFeedback(null);
    try {
      const result = await submit(stageId, payload);
      setFeedback(result);
      return result;
    } finally {
      setPending(false);
    }
  };
  return { check, pending, feedback, clearFeedback: () => setFeedback(null) };
}

export function SubmissionFeedback({ feedback }: { feedback: { correct: boolean; message: string } | null }) {
  return (
    <AnimatePresence mode="wait">
      {feedback && (
        <motion.div key={feedback.message} className={`submission-feedback ${feedback.correct ? "correct" : "wrong"}`} initial={{ opacity: 0, y: 8, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} role="status">
          {feedback.correct ? <ShieldCheck size={19} /> : <span className="feedback-cross">×</span>}
          <span>{feedback.message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function HintPanel({ stageId }: { stageId: StageId }) {
  const { state, revealHint } = useCase();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const hints = state?.revealedHints[stageId] ?? [];
  const solved = state?.stages.find((item) => item.id === stageId)?.solved;
  const request = async () => {
    setPending(true);
    await revealHint(stageId);
    setPending(false);
    setOpen(true);
  };
  return (
    <div className="hint-panel">
      <div className="hint-actions">
        <button type="button" className="quiet-button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          <Lightbulb size={16} /> Hints <span>{hints.length}/3</span><ChevronDown size={15} className={open ? "rotate-180" : ""} />
        </button>
        {hints.length < 3 && !solved && <button type="button" className="hint-reveal" disabled={pending} onClick={() => void request()}>{pending ? "Opening…" : `Open level ${hints.length + 1}`}</button>}
      </div>
      <AnimatePresence initial={false}>
        {open && hints.length > 0 && (
          <motion.ol className="hint-list" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            {hints.map((hint, index) => <motion.li key={hint} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}><span>0{index + 1}</span>{hint}</motion.li>)}
          </motion.ol>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SolvedFragment({ stageId }: { stageId: StageId }) {
  const { state } = useCase();
  const fragment = state?.fragments[stageId];
  if (!fragment) return null;
  return <motion.div className="solved-fragment" initial={{ opacity: 0, scale: 0.8, rotate: -4 }} animate={{ opacity: 1, scale: 1, rotate: 0 }}><span>Integrity fragment</span><strong>{fragment}</strong><small>Saved to the shared dossier</small></motion.div>;
}

export function PuzzleActions({ children }: { children: ReactNode }) {
  return <div className="puzzle-actions">{children}</div>;
}
