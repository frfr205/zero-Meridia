"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Activity, AudioLines, ChevronDown, ChevronRight, Pause, Play, Radio, RotateCcw, Volume2 } from "lucide-react";
import { MORSE_MAP, SIGNAL_MORSE } from "@/lib/puzzle-data";
import { useCase } from "./case-provider";
import { usePersistentState } from "./use-persistent-state";
import { HintPanel, PuzzleActions, Reveal, SolvedFragment, StageGate, StageHeader, SubmissionFeedback, useStageSubmission } from "./stage-ui";

function Waveform({ frequency, phase, aligned }: { frequency: number; phase: number; aligned: boolean }) {
  const points = useMemo(() => {
    const error = Math.abs(frequency - 88.4) + Math.abs(phase - 270) / 180;
    return Array.from({ length: 241 }, (_, index) => {
      const x = index * 4;
      const carrier = Math.sin(index * 0.21 + phase * Math.PI / 180) * 34;
      const harmonic = Math.sin(index * 0.71 + frequency) * 12;
      const deterministicNoise = Math.sin(index * 12.9898 + frequency * 31.7) * Math.cos(index * 3.17) * Math.min(36, error * 32);
      const y = 90 + carrier + harmonic + deterministicNoise;
      return `${x},${y.toFixed(2)}`;
    }).join(" ");
  }, [frequency, phase]);
  return <div className={`oscilloscope ${aligned ? "aligned" : ""}`}><div className="scope-grid" /><svg viewBox="0 0 960 180" preserveAspectRatio="none" role="img" aria-label={aligned ? "Synchronized carrier" : "Unsynchronized carrier"}><polyline points={points} /></svg><div className="scope-readout"><span>CH–04</span><span>{aligned ? "LOCK / Q 0.998" : "NO LOCK / PHASE ERROR"}</span></div></div>;
}

function MorseEnvelope({ aligned }: { aligned: boolean }) {
  const groups = SIGNAL_MORSE.split(" / ");
  return <div className={`morse-envelope ${aligned ? "visible" : "jammed"}`}>
    <div className="envelope-label"><span>ENVELOPE / 620 Hz</span><span>{aligned ? "4 GROUPS" : "CARRIER NOT LOCKED"}</span></div>
    <div className="morse-groups">{aligned ? groups.map((group, index) => <motion.div key={index} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}><small>0{index + 1}</small><div>{group.split("").map((symbol, symbolIndex) => <span key={symbolIndex} className={symbol === "." ? "dot" : "dash"} />)}</div><code>{group}</code></motion.div>) : Array.from({ length: 4 }, (_, index) => <div key={index}><small>0{index + 1}</small><div className="jammed-bars"><span /><span /><span /></div><code>ERROR</code></div>)}</div>
    <p>Dots and dashes are shown two ways: by block length and by text code. The slash in the full message separates letters.</p>
  </div>;
}

function SignalPuzzle() {
  const { state } = useCase();
  const [frequency, setFrequency] = usePersistentState("signal-frequency", 88.1);
  const [phase, setPhase] = usePersistentState("signal-phase", 90);
  const [message, setMessage] = usePersistentState("signal-message", "");
  const [speed, setSpeed] = usePersistentState("signal-speed", 1);
  const [playing, setPlaying] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const aligned = Math.abs(frequency - 88.4) < 0.001 && phase === 270;
  const solved = state?.stages.find((stage) => stage.id === "signal")?.solved;
  const { check, pending, feedback } = useStageSubmission("signal");

  const stopAudio = () => {
    if (audioRef.current) void audioRef.current.close();
    audioRef.current = null;
    setPlaying(false);
  };
  useEffect(() => () => { if (audioRef.current) void audioRef.current.close(); }, []);
  useEffect(() => { if (!aligned) stopAudio(); }, [aligned]);

  const play = async () => {
    if (!aligned || playing) return;
    const context = new AudioContext();
    audioRef.current = context;
    await context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(620, context.currentTime);
    gain.gain.setValueAtTime(0, context.currentTime);
    oscillator.connect(gain).connect(context.destination);
    const unit = 0.12 / speed;
    let cursor = context.currentTime + 0.08;
    SIGNAL_MORSE.split("").forEach((symbol) => {
      if (symbol === "." || symbol === "-") {
        const length = symbol === "." ? unit : unit * 3;
        gain.gain.setValueAtTime(0, cursor);
        gain.gain.linearRampToValueAtTime(0.22, cursor + 0.006);
        gain.gain.setValueAtTime(0.22, cursor + Math.max(0.006, length - 0.006));
        gain.gain.linearRampToValueAtTime(0, cursor + length);
        cursor += length + unit;
      } else if (symbol === "/") cursor += unit * 2;
    });
    oscillator.start();
    oscillator.stop(cursor + 0.05);
    oscillator.onended = () => { setPlaying(false); if (audioRef.current === context) audioRef.current = null; void context.close(); };
    setPlaying(true);
  };

  return <StageGate id="signal"><div className="signal-workbench">
    <div className="receiver-console">
      <div className="receiver-top"><div><span className="live-dot" /> RECEIVER R-88 / ACTIVE</div><div>CARRIER <strong>{frequency.toFixed(1)}</strong> MHz</div></div>
      <Waveform frequency={frequency} phase={phase} aligned={aligned} />
      <div className="tuner-grid">
        <label className="tuner-control"><span><b>Carrier</b><output>{frequency.toFixed(1)} MHz</output></span><input type="range" min="87.8" max="89" step="0.1" value={frequency} onChange={(event) => setFrequency(Number(event.target.value))} disabled={solved} /><div><small>87.8</small><small>Step 0.1</small><small>89.0</small></div></label>
        <label className="tuner-control"><span><b>Phase</b><output>{phase}°</output></span><input type="range" min="0" max="330" step="30" value={phase} onChange={(event) => setPhase(Number(event.target.value))} disabled={solved} /><div><small>0°</small><small>Step 30°</small><small>330°</small></div></label>
      </div>
      <div className="receiver-status"><Activity /><span>{aligned ? "Phase lock achieved. The demodulator outputs a clean envelope." : "There is a signal, but the phase or carrier does not match the telegram parameters."}</span><button onClick={() => { setFrequency(88.1); setPhase(90); }} disabled={solved}><RotateCcw /> Reset</button></div>
    </div>
    <MorseEnvelope aligned={aligned} />
    <div className="audio-console"><div className="audio-main"><button className="audio-play" disabled={!aligned || solved} onClick={() => playing ? stopAudio() : void play()}>{playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button><div><span className="eyebrow">Synthesized audio path</span><h3>{playing ? "Transmitting…" : "Play the envelope"}</h3><p>620 Hz · dash length = 3 dots · inter-letter pause preserved</p></div></div><div className="speed-control"><span>Speed</span>{[0.75, 1, 1.5].map((value) => <button key={value} className={speed === value ? "active" : ""} onClick={() => { stopAudio(); setSpeed(value); }}>{value}×</button>)}</div><div className={`audio-bars ${playing ? "playing" : ""}`}>{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ height: `${18 + (index * 17) % 42}px`, animationDelay: `${index * -0.07}s` }} />)}</div></div>
    <div className="morse-reference"><button onClick={() => setReferenceOpen((value) => !value)} aria-expanded={referenceOpen}><Volume2 /> Morse code reference <ChevronDown className={referenceOpen ? "rotate-180" : ""} /></button>{referenceOpen && <motion.div className="morse-table" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>{Object.entries(MORSE_MAP).map(([letter, code]) => <div key={letter}><strong>{letter}</strong><code>{code}</code></div>)}</motion.div>}</div>
    <div className="answer-console"><div><span className="eyebrow">Demodulated message</span><p>Enter the four-letter word. Frequency and phase are sent with the answer and checked on the server.</p></div><label className="field-label">Message<input className="key-input" value={message} onChange={(event) => setMessage(event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))} placeholder="····" disabled={solved} /></label><PuzzleActions><button className="primary-button" disabled={pending || solved || message.length !== 4} onClick={() => void check({ frequency, phase, message })}>{pending ? "Receiving…" : solved ? "Message accepted" : "Confirm reception"}<AudioLines /></button></PuzzleActions></div>
    <SubmissionFeedback feedback={feedback} />
    {solved && <motion.div className="decoded-memo" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}><span className="eyebrow">Service addendum / recovered</span><p>MOON. Channel 04. Optical lunar observations only: cloud cover no higher than 20%, altitude above the horizon positive. Divide azimuth by 15; English alphabet, A = 0.</p></motion.div>}
    <SolvedFragment stageId="signal" /><HintPanel stageId="signal" />
  </div></StageGate>;
}

export function RelayExperience() {
  return <div className="relay-page inner-page"><section className="inner-hero relay-hero"><div className="inner-hero-icon"><Radio /></div><motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}><span className="eyebrow">Independent node 02 / channel 04</span><h1>RELAY <em>88.4</em></h1><p>The city service considers the frequency free. But every night at 00:41 a carrier with no callsign appears here — for exactly forty-four seconds.</p></motion.div><div className="inner-hero-index">620<br /><span>Hz / AUDIO</span></div></section><section className="inner-stage signal-stage" id="signal"><StageHeader id="signal" /><SignalPuzzle /></section><Reveal className="next-node"><span className="eyebrow">The next node opens after reception</span><h2>The word points to the sky.</h2><a href="/atlas">Open the lunar atlas <ChevronRight /></a></Reveal></div>;
}
