"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Archive, ArrowDownUp, Calculator, Check, ChevronRight, FileKey2, Search } from "lucide-react";
import { CATALOG_RECORDS, CIPHER_ALPHABET, CIPHER_TEXT } from "@/lib/puzzle-data";
import { useCase } from "./case-provider";
import { usePersistentState } from "./use-persistent-state";
import { HintPanel, PuzzleActions, Reveal, SolvedFragment, StageGate, StageHeader, SubmissionFeedback, useStageSubmission } from "./stage-ui";

function CataloguePuzzle() {
  const { state } = useCase();
  const [selected, setSelected] = usePersistentState<string[]>("catalogue-selected", []);
  const [keyword, setKeyword] = usePersistentState("catalogue-keyword", "");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"shelf" | "year">("shelf");
  const [onlySelected, setOnlySelected] = useState(false);
  const [calc, setCalc] = useState({ year: "1968", box: "4", pages: "28" });
  const { check, pending, feedback } = useStageSubmission("catalogue");
  const solved = state?.stages.find((stage) => stage.id === "catalogue")?.solved;
  const records = useMemo(() => CATALOG_RECORDS.filter((record) => {
    const matches = `${record.title} ${record.year} ${record.shelf}`.toLowerCase().includes(query.toLowerCase());
    return matches && (!onlySelected || selected.includes(record.id));
  }).sort((a, b) => sort === "year" ? a.year - b.year : a.shelf.localeCompare(b.shelf, "en")), [query, onlySelected, selected, sort]);
  const remainder = ((Number(calc.year) + Number(calc.box) * 7 + Number(calc.pages) * 3) % 17 + 17) % 17;
  const toggle = (id: string) => {
    if (solved) return;
    setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  };

  return <StageGate id="catalogue"><div className="catalogue-workbench">
    <div className="archive-formula"><span>ARCHIVAL STANDARD M-17 / REVISION 6</span><code>R = (YEAR + 7 × BOX + 3 × PAGES) mod 17</code><p>If R does not equal the card's control digit, the card was forged. Find <strong>every</strong> such record. Then order only their titles by ascending year and take the first letters.</p></div>
    <div className="catalogue-layout">
      <div className="catalogue-browser">
        <div className="browser-tools"><label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, year or shelf" /></label><button className={sort === "year" ? "active" : ""} onClick={() => setSort((value) => value === "year" ? "shelf" : "year")}><ArrowDownUp size={15} />{sort === "year" ? "By year" : "By shelf"}</button><button className={onlySelected ? "active" : ""} onClick={() => setOnlySelected((value) => !value)}><Check size={15} />Selected <span>{selected.length}</span></button></div>
        <div className="record-head"><span>Card</span><span>Year</span><span>Box</span><span>Pages</span><span>R on card</span></div>
        <div className="record-list">{records.map((record) => <motion.article layout key={record.id} className={`catalog-record ${selected.includes(record.id) ? "selected" : ""}`}>
          <button className="record-select" onClick={() => toggle(record.id)} aria-pressed={selected.includes(record.id)} aria-label={`Select ${record.title}`}><span>{selected.includes(record.id) && <Check />}</span></button>
          <div className="record-main"><small>{record.shelf} · stamp {record.stamp}</small><h3>{record.title}</h3><p>{record.note}</p><button onClick={() => setCalc({ year: String(record.year), box: String(record.box), pages: String(record.pages) })}>To calculator <ChevronRight size={13} /></button></div>
          <dl><div><dt>Year</dt><dd>{record.year}</dd></div><div><dt>Box</dt><dd>{record.box}</dd></div><div><dt>Pages</dt><dd>{record.pages}</dd></div><div className="record-check"><dt>R on card</dt><dd>{String(record.check).padStart(2, "0")}</dd></div></dl>
        </motion.article>)}</div>
        {records.length === 0 && <div className="empty-filter">No cards match this filter. Clear the query or show more than just the selected.</div>}
      </div>
      <aside className="checksum-calculator"><div className="calculator-title"><Calculator /><div><span className="eyebrow">Tool 01</span><h3>Remainder calculator</h3></div></div><p>Enter the three card fields. Compare the result with its control digit.</p><div className="calc-fields"><label>Year<input type="number" value={calc.year} onChange={(event) => setCalc({ ...calc, year: event.target.value })} /></label><label>Box<input type="number" value={calc.box} onChange={(event) => setCalc({ ...calc, box: event.target.value })} /></label><label>Pages<input type="number" value={calc.pages} onChange={(event) => setCalc({ ...calc, pages: event.target.value })} /></label></div><div className="calc-equation">({calc.year || 0} + 7×{calc.box || 0} + 3×{calc.pages || 0}) mod 17</div><div className="calc-result"><span>R</span><strong>{Number.isFinite(remainder) ? String(remainder).padStart(2, "0") : "—"}</strong></div><small>mod 17 is the remainder after dividing by 17. For example, 2080 = 17×122 + 6, so R = 6.</small></aside>
    </div>
    <div className="answer-console"><div><span className="eyebrow">Catalogue verdict</span><p>Cards marked: <strong>{selected.length} / 6</strong>. You can change the selection until you check.</p></div><label className="field-label">Callsign<input value={keyword} onChange={(event) => setKeyword(event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6))} placeholder="6 LETTERS" disabled={solved} /></label><PuzzleActions><button className="primary-button" disabled={pending || solved || selected.length !== 6 || keyword.length !== 6} onClick={() => void check({ selected, keyword })}>{pending ? "Checking…" : solved ? "Catalogue accepted" : "Check the catalogue"}<FileKey2 /></button></PuzzleActions></div>
    <SubmissionFeedback feedback={feedback} /><SolvedFragment stageId="catalogue" /><HintPanel stageId="catalogue" />
  </div></StageGate>;
}

function decryptColumnar(ciphertext: string, rawKey: string): { output: string; order: number[] } {
  const key = rawKey.toUpperCase().replace(/[^A-Z]/g, "");
  if (key.length !== 6 || ciphertext.length % key.length !== 0) return { output: "A key of exactly six letters is required.", order: [] };
  const order = key.split("").map((letter, index) => ({ letter, index })).sort((a, b) => {
    const difference = CIPHER_ALPHABET.indexOf(a.letter) - CIPHER_ALPHABET.indexOf(b.letter);
    return difference || a.index - b.index;
  }).map((item) => item.index);
  const rows = ciphertext.length / key.length;
  const columns = Array.from({ length: key.length }, () => "");
  let cursor = 0;
  order.forEach((columnIndex) => {
    columns[columnIndex] = ciphertext.slice(cursor, cursor + rows);
    cursor += rows;
  });
  let output = "";
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < key.length; column += 1) output += columns[column][row];
  return { output, order };
}

function CipherPuzzle() {
  const { state } = useCase();
  const [key, setKey] = usePersistentState("cipher-key", "");
  const [carrier, setCarrier] = usePersistentState("cipher-carrier", "");
  const [phase, setPhase] = usePersistentState("cipher-phase", "");
  const { check, pending, feedback } = useStageSubmission("cipher");
  const solved = state?.stages.find((stage) => stage.id === "cipher")?.solved;
  const decrypted = useMemo(() => decryptColumnar(CIPHER_TEXT, key), [key]);
  const columns = Array.from({ length: 6 }, (_, index) => CIPHER_TEXT.slice(index * 7, index * 7 + 7));
  return <StageGate id="cipher"><div className="cipher-workbench">
    <div className="cipher-document"><div className="document-stamp">R-88<br /><small>RELAY SHIFT</small></div><span className="eyebrow">Intercepted telegram / 42 signs</span><h3>Columnar transposition</h3><p>The text was written into a table by rows, using the six key letters as column headers. The columns were then read in the alphabetical order of the key letters.</p><div className="ciphertext-blocks">{columns.map((column, index) => <div key={index}><small>STREAM {index + 1}</small><code>{column}</code></div>)}</div></div>
    <div className="decryptor"><div className="decryptor-head"><FileKey2 /><div><span className="eyebrow">Tool 02</span><h3>Transposition decryptor</h3></div></div><label className="field-label">Key from the dead catalogue<input className="key-input" value={key} onChange={(event) => setKey(event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6))} placeholder="······" /></label><div className="key-columns">{key.split("").map((letter, index) => <motion.div layout key={`${letter}-${index}`}><span>{letter}</span><small>column {index + 1}</small></motion.div>)}</div>{decrypted.order.length > 0 && <div className="column-order">Reading order: {decrypted.order.map((index) => index + 1).join(" → ")}</div>}<div className={`decrypt-output ${decrypted.order.length ? "active" : ""}`}><span>REBUILT ROWS</span><code>{decrypted.output || "Enter a six-letter key"}</code></div><small className="tool-note">This is a genuine inverse algorithm: a wrong key gives a different transposition and a meaningless result.</small></div>
    <div className="answer-console"><div><span className="eyebrow">Parameters for the relay</span><p>The decimal part of the carrier is written as the word "and": eighty eight and four = 88.4.</p></div><label className="field-label">Carrier, MHz<input value={carrier} onChange={(event) => setCarrier(event.target.value.slice(0, 5))} placeholder="00.0" inputMode="decimal" disabled={solved} /></label><label className="field-label">Phase, °<input value={phase} onChange={(event) => setPhase(event.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="000" inputMode="numeric" disabled={solved} /></label><PuzzleActions><button className="primary-button" disabled={pending || solved || !carrier || !phase} onClick={() => void check({ carrier, phase })}>{pending ? "Sending…" : solved ? "Parameters accepted" : "Send parameters"}<ChevronRight /></button></PuzzleActions></div>
    <SubmissionFeedback feedback={feedback} /><SolvedFragment stageId="cipher" /><HintPanel stageId="cipher" />
  </div></StageGate>;
}

export function ArchiveExperience() {
  return <div className="archive-page inner-page">
    <section className="inner-hero archive-hero"><div className="inner-hero-icon"><Archive /></div><motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}><span className="eyebrow">Independent node 01 / fund M-17</span><h1>ARCHIVE <em>17</em></h1><p>Here a lie does not look like a lie. It looks like a tidy card with the right year, a familiar stamp and one wrong digit.</p></motion.div><div className="inner-hero-index">12<br /><span>CARDS</span></div></section>
    <section className="inner-stage paper-stage" id="catalogue"><StageHeader id="catalogue" /><CataloguePuzzle /></section>
    <section className="inner-stage cipher-stage" id="cipher"><StageHeader id="cipher" /><CipherPuzzle /></section>
    <Reveal className="next-node"><span className="eyebrow">The next node opens after the telegram</span><h2>The parameters have a voice.</h2><a href="/relay">Go to relay 88.4 <ChevronRight /></a></Reveal>
  </div>;
}
