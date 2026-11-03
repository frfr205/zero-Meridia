"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { Check, ChevronRight, CircleDot, Compass, Filter, LocateFixed, RotateCcw, Route, Sigma, Undo2 } from "lucide-react";
import { CIPHER_ALPHABET, findNetworkEdge, NETWORK_EDGES, NETWORK_NODES, OBSERVATIONS } from "@/lib/puzzle-data";
import { useCase } from "./case-provider";
import { usePersistentState } from "./use-persistent-state";
import { HintPanel, PuzzleActions, Reveal, SolvedFragment, StageGate, StageHeader, SubmissionFeedback, useStageSubmission } from "./stage-ui";

type FilterKey = "moon" | "optics" | "channel" | "clear" | "above";
const FILTER_LABELS: { id: FilterKey; label: string; detail: string }[] = [
  { id: "moon", label: "Moon only", detail: "object = Moon" },
  { id: "optics", label: "Optics", detail: "not radio" },
  { id: "channel", label: "Channel 04", detail: "channel = 4" },
  { id: "clear", label: "Clear", detail: "cloud ≤ 20%" },
  { id: "above", label: "Above horizon", detail: "altitude > 0°" },
];

function AtlasPuzzle() {
  const { state } = useCase();
  const [filters, setFilters] = usePersistentState<Record<FilterKey, boolean>>("atlas-filters", { moon: false, optics: false, channel: false, clear: false, above: false });
  const [selected, setSelected] = usePersistentState<string[]>("atlas-selected", []);
  const [keyword, setKeyword] = usePersistentState("atlas-keyword", "");
  const { check, pending, feedback } = useStageSubmission("atlas");
  const solved = state?.stages.find((stage) => stage.id === "atlas")?.solved;
  const visible = useMemo(() => OBSERVATIONS.filter((item) => {
    if (filters.moon && item.object !== "Moon") return false;
    if (filters.optics && item.instrument !== "optics") return false;
    if (filters.channel && item.channel !== 4) return false;
    if (filters.clear && item.clouds > 20) return false;
    if (filters.above && item.altitude <= 0) return false;
    return true;
  }).sort((a, b) => a.time.localeCompare(b.time)), [filters]);
  const selectedObservations = OBSERVATIONS.filter((item) => selected.includes(item.id)).sort((a, b) => a.time.localeCompare(b.time));
  const toggle = (id: string) => { if (!solved) setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]); };

  return <StageGate id="atlas"><div className="atlas-workbench">
    <div className="atlas-brief"><Compass /><div><span className="eyebrow">Disk rule / A = 0</span><p>Select the clean lunar series by the relay message. For each record divide the azimuth by 15. The quotient is a letter index in the alphabet, A = 0. Read by observation time.</p></div><div className="atlas-count"><strong>{visible.length}</strong><span>rows visible</span></div></div>
    <div className="observation-filters"><div><Filter /><span>Combinable filters</span></div>{FILTER_LABELS.map((filter) => <button key={filter.id} className={filters[filter.id] ? "active" : ""} onClick={() => setFilters({ ...filters, [filter.id]: !filters[filter.id] })}><span>{filter.label}</span><small>{filter.detail}</small></button>)}<button className="filter-reset" onClick={() => setFilters({ moon: false, optics: false, channel: false, clear: false, above: false })}><RotateCcw /> Reset</button></div>
    <div className="observation-table-wrap"><div className="observation-table-head"><span>Time / object</span><span>Instrument</span><span>Channel</span><span>Cloud</span><span>Altitude</span><span>Azimuth</span><span>Pick</span></div><div className="observation-list">{visible.map((item) => <motion.article layout key={item.id} className={`observation-row ${selected.includes(item.id) ? "selected" : ""}`}>
      <div><time>{item.time}</time><strong>{item.object}</strong><small>{item.operator} · {item.note}</small></div><span data-label="Instrument">{item.instrument}</span><span data-label="Channel">CH–{String(item.channel).padStart(2, "0")}</span><span data-label="Cloud" className={item.clouds > 20 ? "bad-value" : ""}>{item.clouds}%</span><span data-label="Altitude" className={item.altitude <= 0 ? "bad-value" : ""}>{item.altitude > 0 ? "+" : ""}{item.altitude}°</span><span data-label="Azimuth" className="azimuth-value">{item.azimuth}°</span><button className="observation-select" onClick={() => toggle(item.id)} aria-pressed={selected.includes(item.id)}>{selected.includes(item.id) ? <Check /> : <span />}</button>
    </motion.article>)}</div>{visible.length === 0 && <div className="empty-filter">No record passes the current combination of filters.</div>}</div>
    <div className="azimuth-desk"><div className="alphabet-disk"><div className="disk-title"><span className="eyebrow">Tool 03</span><h3>The fifteen-degree disk</h3><p>Azimuth ÷ 15 → index → letter. Indices start at zero.</p></div><div className="alphabet-ribbon">{CIPHER_ALPHABET.split("").map((letter, index) => <div key={letter}><strong>{letter}</strong><small>{index}</small></div>)}</div></div><div className="azimuth-tape"><div className="tape-head"><span>Selected series / by time</span><strong>{selected.length} / 5</strong></div>{selectedObservations.length === 0 ? <p>Pick records in the table — their quotients will appear here.</p> : selectedObservations.map((item, index) => <div key={item.id}><span>0{index + 1} · {item.time}</span><code>{item.azimuth} ÷ 15 = {item.azimuth / 15}</code><i>{Number.isInteger(item.azimuth / 15) ? "whole index" : "fraction"}</i></div>)}</div></div>
    <div className="answer-console"><div><span className="eyebrow">Route entry point</span><p>Select five records and enter the word read on the disk.</p></div><label className="field-label">Keyword<input className="key-input" value={keyword} onChange={(event) => setKeyword(event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5))} placeholder="·····" disabled={solved} /></label><PuzzleActions><button className="primary-button" disabled={pending || solved || selected.length !== 5 || keyword.length !== 5} onClick={() => void check({ selected, keyword })}>{pending ? "Checking the sky…" : solved ? "Series accepted" : "Fix the series"}<LocateFixed /></button></PuzzleActions></div>
    <SubmissionFeedback feedback={feedback} /><SolvedFragment stageId="atlas" /><HintPanel stageId="atlas" />
  </div></StageGate>;
}

const LINE_NAMES = { cyan: "Cyan", amber: "Amber", green: "Green" } as const;

function NetworkPuzzle() {
  const { state, notify } = useCase();
  const [path, setPath] = usePersistentState<string[]>("network-path", ["zen"]);
  const { check, pending, feedback } = useStageSubmission("network");
  const solved = state?.stages.find((stage) => stage.id === "network")?.solved;
  const current = path[path.length - 1];
  const sensors = path.map((id) => NETWORK_NODES.find((node) => node.id === id)?.sensor).filter((value): value is number => value !== undefined);
  const gateways = path.filter((id) => NETWORK_NODES.find((node) => node.id === id)?.gateway).length;
  const lines = path.slice(1).map((id, index) => findNetworkEdge(path[index], id)?.line ?? "cyan");
  const currentLine = lines[lines.length - 1];
  const runLength = lines.slice().reverse().findIndex((line) => line !== currentLine);
  const sameLineRun = currentLine ? (runLength === -1 ? lines.length : runLength) : 0;

  const addNode = (id: string) => {
    if (solved) return;
    if (id === current) return;
    if (path.includes(id)) { notify("This station is already visited. Undo the last moves to change the route.", "error"); return; }
    const edge = findNetworkEdge(current, id);
    if (!edge) { notify("There is no direct leg. Pick a station connected by a line to the current one.", "error"); return; }
    if (path.length >= 16) { notify("The limit of 15 legs is reached.", "error"); return; }
    if (lines.length >= 2 && lines.slice(-2).every((line) => line === edge.line)) { notify("A third leg in a row on this line is forbidden by the fuse.", "error"); return; }
    setPath([...path, id]);
  };
  const nodeById = (id: string) => NETWORK_NODES.find((node) => node.id === id)!;
  return <StageGate id="network"><div className="network-workbench">
    <div className="route-rules"><div><span className="rule-index">01</span><p>Start <strong>RIGEL</strong>, end <strong>ZERO</strong>.</p></div><div><span className="rule-index">02</span><p>Exactly <strong>15 legs</strong>, 16 stations, no repeats.</p></div><div><span className="rule-index">03</span><p>Sensors <strong>17 → 6 → 88 → 4 → 15</strong>.</p></div><div><span className="rule-index">04</span><p>All <strong>4 white gateways</strong>; no more than two legs in a row on one line.</p></div></div>
    <div className="route-dashboard"><div><small>Legs</small><strong>{path.length - 1}<span>/15</span></strong></div><div><small>Sensors</small><strong>{sensors.join(" · ") || "—"}</strong></div><div><small>Gateways</small><strong>{gateways}<span>/4</span></strong></div><div><small>Current line</small><strong>{currentLine ? LINE_NAMES[currentLine] : "—"}<span> ×{sameLineRun}</span></strong></div><div className="route-buttons"><button onClick={() => setPath((items) => items.length > 1 ? items.slice(0, -1) : items)} disabled={path.length === 1 || solved}><Undo2 /> Undo move</button><button onClick={() => setPath(["zen"])} disabled={path.length === 1 || solved}><RotateCcw /> Restart</button></div></div>
    <div className="network-map-scroll"><div className="network-map">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{NETWORK_EDGES.map((edge) => {
        const a = nodeById(edge.a); const b = nodeById(edge.b);
        const traveled = path.some((id, index) => index > 0 && ((path[index - 1] === edge.a && id === edge.b) || (path[index - 1] === edge.b && id === edge.a)));
        return <line key={`${edge.a}-${edge.b}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`edge-${edge.line} ${traveled ? "traveled" : ""}`} vectorEffect="non-scaling-stroke" />;
      })}</svg>
      {NETWORK_NODES.map((node) => {
        const visited = path.includes(node.id); const active = current === node.id; const adjacent = Boolean(findNetworkEdge(current, node.id));
        return <button key={node.id} className={`map-node ${visited ? "visited" : ""} ${active ? "current" : ""} ${adjacent && !visited ? "adjacent" : ""} ${node.gateway ? "gateway" : ""} ${node.sensor ? "sensor" : ""}`} style={{ left: `${node.x}%`, top: `${node.y}%` }} onClick={() => addNode(node.id)} aria-label={`${node.name}${node.sensor ? `, sensor ${node.sensor}` : ""}${node.gateway ? ", gateway" : ""}`}><span className="node-shape">{node.sensor ? node.sensor : node.gateway ? "□" : ""}</span><strong>{node.name}</strong>{visited && <small>{path.indexOf(node.id) + 1}</small>}</button>;
      })}
      <div className="map-legend"><span><i className="cyan" />Cyan</span><span><i className="amber" />Amber</span><span><i className="green" />Green</span><span>□ mandatory gateway</span></div>
    </div></div>
    <div className="route-tape"><span>Built route</span><div>{path.map((id, index) => <span key={id}>{index > 0 && <ChevronRight />}{nodeById(id).name}</span>)}</div></div>
    <div className="route-submit"><p>The server re-checks every edge, the sensor order, station uniqueness and line alternation. Any route satisfying all the rules is accepted.</p><PuzzleActions><button className="primary-button" disabled={pending || solved || path.length !== 16} onClick={() => void check({ path })}>{pending ? "Checking the network…" : solved ? "Route accepted" : "Run the route"}<Route /></button></PuzzleActions></div>
    <SubmissionFeedback feedback={feedback} /><SolvedFragment stageId="network" />{solved && <div className="decoded-memo"><Sigma /><p>Checksum: (17 + 6 + 88 + 4 + 15) mod 99 = 130 mod 99 = <strong>31</strong>. The last fragment is saved.</p></div>}<HintPanel stageId="network" />
  </div></StageGate>;
}

export function AtlasExperience() {
  return <div className="atlas-page inner-page"><section className="inner-hero atlas-hero"><div className="inner-hero-icon"><CircleDot /></div><motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}><span className="eyebrow">Independent node 03 / optics + network</span><h1>ATLAS <em>ZERO</em></h1><p>First the sky becomes a word. Then the word becomes a station. On this map the shortest path is not always the only admissible one.</p></motion.div><div className="inner-hero-index">16<br /><span>STATIONS</span></div></section><section className="inner-stage atlas-stage" id="atlas"><StageHeader id="atlas" /><AtlasPuzzle /></section><section className="inner-stage network-stage" id="network"><StageHeader id="network" /><NetworkPuzzle /></section><Reveal className="next-node"><span className="eyebrow">The final node opens after the route</span><h2>Six numbers. One verdict.</h2><a href="/core">Enter the core <ChevronRight /></a></Reveal></div>;
}
