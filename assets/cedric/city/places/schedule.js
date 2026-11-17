// The in-game clock (derived from the evening phase) and the departures board data.
// Pure functions: no DOM, no THREE.
import { DESTINATIONS } from "./destinations.js";

const KEYS = [17 * 60 + 30, 19 * 60 + 40, 21 * 60 + 30, 23 * 60 + 30]; // clock minutes at golden / sunset / blue / night
const pad = n => (n < 10 ? "0" : "") + n;

export function clockMinutes(phase) {
  const i = Math.max(0, Math.min(2, Math.floor(phase))), f = Math.max(0, Math.min(1, phase - i));
  return Math.round(KEYS[i] + (KEYS[i + 1] - KEYS[i]) * f);
}
export const fmt = m => pad(Math.floor(m / 60) % 24) + ":" + pad(((m % 60) + 60) % 60);

// Rows of the board: { min, dest, voie, note: "ok"|"late"|"yours", mine }. Others are a function of
// the ten-minute slot, so the board is stable while the clock runs.
export function rows(now, ticket) {
  const out = [];
  const base = Math.ceil((now - 3) / 10) * 10;
  for (let i = 0; i < 5; i++) {
    const min = base + i * 10, slot = Math.floor(min / 10);
    const dest = DESTINATIONS[(slot * 3 + 1) % DESTINATIONS.length];
    let voie = (slot % 3) + 1;
    if (ticket && Math.abs(min - ticket.min) < 5 && voie === ticket.voie) voie = (voie % 3) + 1; // never two trains on one voie at once
    out.push({ min, dest, voie, note: slot % 4 === 2 ? "late" : "ok", mine: false });
  }
  if (ticket) {
    out.push({ min: ticket.min, dest: ticket.dest, voie: ticket.voie, note: "yours", mine: true });
    out.sort((a, b) => a.min - b.min);
  }
  return out.slice(0, ticket ? 6 : 5);
}

// A signature that changes only when the board's visible content does.
export function signature(list, seen) {
  let s = seen ? "s" : "u";
  for (const r of list) s += "|" + r.min + r.dest.id + r.voie + r.note;
  return s;
}
