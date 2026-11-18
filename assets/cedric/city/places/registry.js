// Places: what Space does at a door. One hook per place, enter(place, g); the generic panel is
// the stand-in until each place gets its real content (arcade and karting minigames, the notice
// board at the Hôtel de Ville). "basile" and its roof twin run the elevator.
import { createElevator } from "./elevator.js";
import { createBoard } from "./board.js";
import { createStation } from "./station.js";
import { createPortPlace } from "./port/index.js"; // --- port ---
import { createSerrePlace } from "./serre/index.js"; // --- serre ---

const panel = (place, g) => g.ui && g.ui.panel(place);

export const PLACES = {
  mairie:  { enter: (place, g) => g.places.board.open(place) },   // the notice board (places/board.js)
  arcade:  { enter: panel },   // later: minigames
  karting: { enter: (place, g) => (g.kart ? g.kart.open(place) : panel(place, g)) }, // --- karting --- the race menu (places/karting/)
  basile:        { enter: (place, g) => g.places.elevator.rideUp() },
  "basile-down": { enter: (place, g) => g.places.elevator.rideDown() },
  port: { enter: (place, g) => g.places.port.enter() }, // --- port ---
};

// --- serre --- the greenhouse: the door, then what Space does on a bed or at the way out
PLACES.serre = { enter: (place, g) => g.places.serre.enter() };
for (const id of ["serre-out", "serre-bed-free", "serre-bed-grow", "serre-bed-dry", "serre-bed-ready"]) PLACES[id] = { enter: (place, g) => g.places.serre.interact(place) };
// --- end serre ---
// --- aerodrome ---
PLACES.aerodrome = { enter: (place, g) => g.flight && g.flight.openPanel(place) };
// --- end aerodrome ---

export function createPlaces(g) {
  let off = null, elevator = null, board = null, station = null;
  const api = {
    name: "places",
    init() {
      elevator = createElevator(g);
      board = createBoard(g); board.init();
      station = createStation(g); station.init();
      g.places = { elevator, board, station, enter: place => { const h = place && PLACES[place.id]; if (h && !elevator.busy && !station.busy && !(g.places.serre && g.places.serre.busy)) h.enter(place, g); } }; // serre.busy: mid-fade
      g.places.port = createPortPlace(g); g.places.port.init(); // --- port ---
      g.places.serre = g.serre = createSerrePlace(g); g.places.serre.init(); // --- serre ---
      off = g.events.on("enter", place => g.places.enter(place));
    },
    update(dt, t) { elevator.update(dt); station.update(dt); g.places.port.update(dt, t); /* --- port --- */ g.places.serre.update(dt, t); /* --- serre --- */ },
    late() { station.late(); g.places.port.late(); /* --- port --- */ g.places.serre.late(); /* --- serre --- */ },
    dispose() { if (off) off(); elevator.dispose(); board.dispose(); station.dispose(); g.places.port.dispose(); /* --- port --- */ g.places.serre.dispose(); delete g.serre; /* --- serre --- */ delete g.places; },
  };
  return api;
}
