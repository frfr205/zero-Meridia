import "server-only";

import {
  CATALOG_RECORDS,
  expectedCatalogCheck,
  findNetworkEdge,
  isCleanLunarObservation,
  NETWORK_NODES,
  OBSERVATIONS,
} from "./puzzle-data";
import type { StageId } from "./case-types";

export const HINTS: Record<StageId, string[]> = {
  protocol: [
    "Do not start from the time on a card: find the event that nothing precedes. Then use the links 'nine minutes later' and 'six minutes later'.",
    "The first three links: power loss → incoming call → backup loop. Opening the archive comes right after the loop.",
    "Full source order: Power room, Exchange, Watchman, Seal sensor, Storage, Transmitter. The code is the two hour-digits of the 00:17 event, i.e. 17.",
  ],
  catalogue: [
    "The control digit is not a plain sum. For each card compute (year + 7·box + 3·pages) mod 17 and compare with the last field.",
    "There are exactly six forged cards. Do not pick by stamp color: that is a clue for the finale, not the mathematical criterion.",
    "The remainder fails for the titles starting F, A, L, C, O, N. Order only those titles by ascending year, not by shelf.",
  ],
  cipher: [
    "The key FALCON sets not a letter shift but the reading order of six columns. The telegram has 42 signs: seven rows of six letters.",
    "The key letters sort A, C, F, L, N, O; so the original columns are read in the order 2, 4, 1, 3, 6, 5.",
    "The built-in decryptor performs the whole transposition. Enter FALCON and read the result by rows: carrier eighty-eight and four (88.4), phase two seven zero (270).",
  ],
  signal: [
    "The telegram parameters belong to two different controls: carrier 88.4, phase 270°. There is no tolerance on frequency.",
    "After synchronization, play the sound or expand the text envelope. A slash separates letters; the symbols inside a group belong to one letter.",
    "The groups -- / --- / --- / -. are the letters M, O, O, N. Enter MOON in the message field.",
  ],
  atlas: [
    "Apply all five conditions at once: object Moon, optics, channel 4, cloud ≤ 20%, altitude strictly greater than zero.",
    "The valid rows are at 01:10, 01:40, 02:15, 02:50 and 03:25. For each compute azimuth ÷ 15 and use A=0, B=1, … Z=25.",
    "Series indices: 17, 8, 6, 4, 11. That is R, I, G, E, L. Enter RIGEL and all five selected records.",
  ],
  network: [
    "Exactly 15 legs and 16 stations without repeats means the route must visit every station exactly once. The white squares are four mandatory gateways.",
    "Between sensors, look for the branches with gateways: after PORT you need TOWER, after ARCHIVE — PIER, after BEACON — WELL, after LENS — GLASS.",
    "One valid route: RIGEL → NORTH → PORT → TOWER → SHADE → ARCHIVE → PIER → CHANNEL → BEACON → WELL → ASH → LENS → GLASS → ORBIT → VECTOR → ZERO.",
  ],
  core: [
    "Register A is the weighted sum of fragments in chronological order: multiply the first by 1, the second by 2, and so on. Register B is the XOR of that result with mask 511.",
    "A = 17·1 + 6·2 + 88·3 + 4·4 + 15·5 + 31·6 = 570. For B use binary XOR: 570 XOR 511 = 965.",
    "The code joins the registers: 570965. The author is Serafima Ro; the motive is to preserve the materials and hand them to an independent witness. Clearance II, the R-88 forms, and the note at station ZERO confirm it.",
  ],
};

function text(value: unknown): string {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

function stringSet(value: unknown): string[] {
  return Array.isArray(value) ? Array.from(new Set(value.map(String))).sort() : [];
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function nodeName(id: string): string {
  return NETWORK_NODES.find((node) => node.id === id)?.name ?? id;
}

function verifyNetwork(payload: Record<string, unknown>): { correct: boolean; message: string } {
  const path = Array.isArray(payload.path) ? payload.path.map(String) : [];
  const nodeIds = new Set(NETWORK_NODES.map((node) => node.id));
  if (path.length !== 16) return { correct: false, message: `The route has ${Math.max(0, path.length - 1)} legs. You need exactly 15 — all 16 stations.` };
  if (path[0] !== "zen" || path[path.length - 1] !== "nul") return { correct: false, message: "The route must start at RIGEL and end at ZERO." };
  if (new Set(path).size !== path.length || path.some((id) => !nodeIds.has(id))) return { correct: false, message: "Stations cannot be revisited; unknown nodes are not allowed." };

  const lines: string[] = [];
  for (let index = 1; index < path.length; index += 1) {
    const edge = findNetworkEdge(path[index - 1], path[index]);
    if (!edge) return { correct: false, message: `There is no leg between ${nodeName(path[index - 1])} and ${nodeName(path[index])}.` };
    lines.push(edge.line);
    if (lines.length >= 3 && lines.slice(-3).every((line) => line === edge.line)) {
      return { correct: false, message: "Three legs in a row on one line: the relay fuse opens the route." };
    }
  }

  const sensors = path.map((id) => NETWORK_NODES.find((node) => node.id === id)?.sensor).filter((value): value is number => value !== undefined);
  if (sensors.join("-") !== "17-6-88-4-15") return { correct: false, message: `Sensor order ${sensors.join(" → ") || "empty"}. Required: 17 → 6 → 88 → 4 → 15.` };
  return { correct: true, message: "All 16 stations crossed. Sensors, gateways and line fuses are consistent." };
}

export function verifyStage(stageId: StageId, payload: unknown): { correct: boolean; message: string } {
  const data = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  switch (stageId) {
    case "protocol": {
      const expected = ["power", "call", "backup", "archive", "storage", "relay"];
      const order = Array.isArray(data.order) ? data.order.map(String) : [];
      if (!sameSet([...order].sort(), [...expected].sort()) || order.some((id, i) => id !== expected[i])) {
        return { correct: false, message: "The causal chain breaks. Check every '… minutes later' against the previous event." };
      }
      if (text(data.code) !== "17") return { correct: false, message: "The order is right, but the code does not match the hour of the backup-loop activation." };
      return { correct: true, message: "Timeline rebuilt. Fragment 17 accepted." };
    }
    case "catalogue": {
      const forged = CATALOG_RECORDS.filter((record) => expectedCatalogCheck(record) !== record.check).map((record) => record.id).sort();
      if (!sameSet(stringSet(data.selected), forged)) return { correct: false, message: "The card set failed the check. Verify the arithmetic of all twelve rows, including the early and late years." };
      if (text(data.keyword) !== "FALCON") return { correct: false, message: "The six cards are right, but not the callsign. Take the first letters of the titles in ascending year order." };
      return { correct: true, message: "Callsign FALCON confirmed. Fragment 06 accepted." };
    }
    case "cipher": {
      const carrier = text(data.carrier).replace(",", ".");
      if (carrier !== "88.4" || text(data.phase) !== "270") return { correct: false, message: "Parameters do not match the telegram. Check the column order and read the rebuilt table by rows." };
      return { correct: true, message: "Carrier 88.4 and phase 270° sent to the relay. Fragment 88 accepted." };
    }
    case "signal": {
      const frequency = Number(data.frequency);
      const phase = Number(data.phase);
      if (Math.abs(frequency - 88.4) > 0.001 || phase !== 270) return { correct: false, message: "The receiver is not synchronized: first set both parameters from the telegram." };
      if (text(data.message) !== "MOON") return { correct: false, message: "The tuning is right, but the decoded message differs. Split the four Morse groups by the slash." };
      return { correct: true, message: "MOON received without errors. The atlas instruction is recovered; fragment 04 accepted." };
    }
    case "atlas": {
      const clean = OBSERVATIONS.filter(isCleanLunarObservation).map((item) => item.id).sort();
      if (!sameSet(stringSet(data.selected), clean)) return { correct: false, message: "The series differs. Check strictness: altitude 0 is not positive, cloud 21 is already above the threshold." };
      if (text(data.keyword) !== "RIGEL") return { correct: false, message: "The five records are chosen correctly. Convert azimuths to indices and read the letters by observation time." };
      return { correct: true, message: "Point RIGEL found. The 15° disk step becomes the fifth fragment." };
    }
    case "network":
      return verifyNetwork(data);
    case "core": {
      if (text(data.code).replace(/[^0-9]/g, "") !== "570965") return { correct: false, message: "The registers do not agree. Check weights 1…6, mask 511, and joining A with B without a separator." };
      if (text(data.culprit) !== "RO" || text(data.motive) !== "PRESERVE") return { correct: false, message: "The code is right, but the verdict is not confirmed by the whole chain: you need night clearance, physical access, and the motive from the ZERO note." };
      return { correct: true, message: "Verdict accepted. The backup copy has been handed to an independent witness." };
    }
  }
}
