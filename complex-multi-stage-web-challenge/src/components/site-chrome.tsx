"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Archive, ArrowDownToLine, BookOpen, Check, ChevronRight, CircleDot, Copy, FileJson, Menu, NotebookPen, Radio, RotateCcw, Route, Shield, X } from "lucide-react";
import { EVIDENCE, RESET_PHRASE, STAGES } from "@/lib/case-data";
import { useCase } from "./case-provider";
import { clearPersistentDrafts } from "./use-persistent-state";

const NAV = [
  { href: "/", label: "Dossier", icon: CircleDot },
  { href: "/archive", label: "Archive 17", icon: Archive },
  { href: "/relay", label: "Relay", icon: Radio },
  { href: "/atlas", label: "Atlas", icon: Route },
  { href: "/core", label: "Core", icon: Shield },
];

type DrawerTab = "evidence" | "notes" | "system";

function LiveTimer() {
  const { state } = useCase();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!state?.session.startedAt || state.session.completedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [state?.session.startedAt, state?.session.completedAt]);
  if (!state?.session.startedAt) return <span>NOT STARTED</span>;
  const end = state.session.completedAt ? new Date(state.session.completedAt).getTime() : now;
  const seconds = Math.max(0, Math.floor((end - new Date(state.session.startedAt).getTime()) / 1000));
  const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return <span>{h}:{m}:{s}</span>;
}

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const { state, error, refresh, toasts, saveNotes, reset, notify } = useCase();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tab, setTab] = useState<DrawerTab>("evidence");
  const [notes, setNotes] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [resetText, setResetText] = useState("");
  const initializedNotes = useRef(false);

  useEffect(() => {
    if (state && !initializedNotes.current) {
      setNotes(state.notes);
      initializedNotes.current = true;
    }
  }, [state]);

  useEffect(() => {
    if (!state || notes === state.notes || !initializedNotes.current) return;
    setSaveStatus("saving");
    const timer = window.setTimeout(() => {
      void saveNotes(notes).then(() => setSaveStatus("saved")).catch(() => setSaveStatus("idle"));
    }, 850);
    return () => window.clearTimeout(timer);
  }, [notes, state, saveNotes]);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const solvedIds = useMemo(() => state?.stages.filter((stage) => stage.solved).map((stage) => stage.id) ?? [], [state]);
  const visibleEvidence = EVIDENCE.filter((item) => solvedIds.includes(item.stageId));
  const progress = state?.stats.solved ?? 0;

  const copyEntrance = async () => {
    await navigator.clipboard.writeText(window.location.origin);
    notify("Entry link copied. Progress stays in this browser session.", "info");
  };

  return (
    <>
      <header className="site-header">
        <Link href="/" className="brand" aria-label="Zero Meridian — home">
          <span className="brand-mark"><i /><i /><i /></span>
          <span><strong>ZERO MERIDIAN</strong><small>NM–17 / OBSERVER NETWORK</small></span>
        </Link>
        <nav className="desktop-nav" aria-label="Case nodes">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return <Link key={item.href} href={item.href} className={active ? "active" : ""}>{item.label}{active && <motion.span layoutId="nav-dot" />}</Link>;
          })}
        </nav>
        <div className="header-tools">
          <div className="header-timer"><small>IN THE LOOP</small><LiveTimer /></div>
          <button type="button" className="dossier-button" onClick={() => setDrawerOpen(true)}><BookOpen size={16} /><span>Dossier</span><b>{progress}/7</b></button>
          <button type="button" className="mobile-menu-button" onClick={() => setMenuOpen((value) => !value)} aria-label="Menu">{menuOpen ? <X /> : <Menu />}</button>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && <motion.nav className="mobile-nav" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} aria-label="Mobile navigation">
          {NAV.map((item, index) => <Link key={item.href} href={item.href}><span>0{index}</span>{item.label}<ChevronRight size={18} /></Link>)}
        </motion.nav>}
      </AnimatePresence>

      {error && <div className="connection-error" role="alert"><span>Connection to the dossier lost: {error}</span><button onClick={() => void refresh()}>Reconnect</button></div>}
      <main>{children}</main>

      <footer className="site-footer">
        <div><span className="brand-mark small"><i /><i /><i /></span><strong>ZERO MERIDIAN</strong></div>
        <p>Self-contained investigation · answers checked on the server · progress saved in PostgreSQL</p>
        <button type="button" onClick={() => { setTab("system"); setDrawerOpen(true); }}>Data &amp; export <ArrowDownToLine size={14} /></button>
      </footer>

      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.button aria-label="Close dossier" className="drawer-backdrop" onClick={() => setDrawerOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.aside className="case-drawer" initial={reduced ? { opacity: 0 } : { x: "100%" }} animate={reduced ? { opacity: 1 } : { x: 0 }} exit={reduced ? { opacity: 0 } : { x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 280 }} aria-label="Personal dossier">
              <div className="drawer-head"><div><span className="eyebrow">Personal loop</span><h2>{state?.session.alias ?? "Observer"}</h2></div><button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close"><X /></button></div>
              <div className="drawer-tabs">
                <button className={tab === "evidence" ? "active" : ""} onClick={() => setTab("evidence")}>Evidence <span>{visibleEvidence.length}</span></button>
                <button className={tab === "notes" ? "active" : ""} onClick={() => setTab("notes")}>Notebook</button>
                <button className={tab === "system" ? "active" : ""} onClick={() => setTab("system")}>System</button>
              </div>
              <div className="drawer-content">
                {tab === "evidence" && <>
                  <div className="fragment-rack">
                    {STAGES.slice(0, 6).map((stage) => <div key={stage.id} className={state?.fragments[stage.id] ? "found" : ""}><span>{stage.number}</span><strong>{state?.fragments[stage.id] ?? "··"}</strong></div>)}
                  </div>
                  {visibleEvidence.length === 0 ? <div className="empty-drawer"><NotebookPen /><p>No evidence yet.</p><span>Solve the Watch Protocol — the first documents will appear here automatically.</span></div> : <div className="evidence-list">{visibleEvidence.map((item, index) => <motion.article key={item.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.03, 0.25) }}><div><span>{item.tag}</span><Check size={14} /></div><h3>{item.title}</h3><small>{item.source}</small><p>{item.body}</p></motion.article>)}</div>}
                </>}
                {tab === "notes" && <div className="notes-tab"><div><span>Autosaved on the server</span><small>{saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : "No changes"}</small></div><textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={20000} placeholder="Jot down remainders, column order, azimuths and route candidates…" /><small>{notes.length} / 20,000</small></div>}
                {tab === "system" && <div className="system-tab">
                  <section><span className="eyebrow">Export of actual progress</span><h3>Take the dossier with you</h3><p>The file includes only solved stages, unlocked evidence, fragments and your notes. Unsolved answers are never revealed.</p><a href="/api/case/export?format=md" className="system-action"><ArrowDownToLine /> Markdown dossier <ChevronRight /></a><a href="/api/case/export?format=json" className="system-action"><FileJson /> JSON snapshot <ChevronRight /></a><button className="system-action" onClick={() => void copyEntrance()}><Copy /> Entry link <ChevronRight /></button></section>
                  <section className="danger-zone"><span className="eyebrow">Irreversible action</span><h3>Restart the investigation</h3><p>Deletes attempts, evidence, fragments, notes and the timer for this session. Type {RESET_PHRASE}.</p><input value={resetText} onChange={(event) => setResetText(event.target.value)} placeholder={RESET_PHRASE} /><button disabled={resetText !== RESET_PHRASE} onClick={() => void reset(resetText).then((ok) => { if (ok) { clearPersistentDrafts(); setNotes(""); setResetText(""); setDrawerOpen(false); window.setTimeout(() => window.location.assign("/"), 350); } })}><RotateCcw size={15} /> Reset everything</button></section>
                </div>}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="toast-stack" aria-live="polite">
        <AnimatePresence>{toasts.map((toast) => <motion.div key={toast.id} className={`toast ${toast.tone}`} initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 40 }} layout>{toast.tone === "success" ? <Check size={17} /> : <CircleDot size={17} />}<span>{toast.message}</span></motion.div>)}</AnimatePresence>
      </div>
    </>
  );
}
