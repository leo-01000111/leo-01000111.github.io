// Places: what Space does at a door. One hook per place, enter(place, g); the generic panel is
// the stand-in until each place gets its real content (arcade and karting minigames, the notice
// board at the Hôtel de Ville). "basile" and its roof twin run the elevator.
import { createElevator } from "./elevator.js";
import { createBoard } from "./board.js";
import { createStation } from "./station.js";
import { createPortPlace } from "./port/index.js"; // --- port ---

const panel = (place, g) => g.ui && g.ui.panel(place);

export const PLACES = {
  mairie:  { enter: (place, g) => g.places.board.open(place) },   // the notice board (places/board.js)
  arcade:  { enter: panel },   // later: minigames
  karting: { enter: (place, g) => (g.kart ? g.kart.open(place) : panel(place, g)) }, // --- karting --- the race menu (places/karting/)
  basile:        { enter: (place, g) => g.places.elevator.rideUp() },
  "basile-down": { enter: (place, g) => g.places.elevator.rideDown() },
  port: { enter: (place, g) => g.places.port.enter() }, // --- port ---
};

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
      g.places = { elevator, board, station, enter: place => { const h = place && PLACES[place.id]; if (h && !elevator.busy && !station.busy) h.enter(place, g); } };
      g.places.port = createPortPlace(g); g.places.port.init(); // --- port ---
      off = g.events.on("enter", place => g.places.enter(place));
    },
    update(dt, t) { elevator.update(dt); station.update(dt); g.places.port.update(dt, t); /* --- port --- */ },
    late() { station.late(); g.places.port.late(); /* --- port --- */ },
    dispose() { if (off) off(); elevator.dispose(); board.dispose(); station.dispose(); g.places.port.dispose(); /* --- port --- */ delete g.places; },
  };
  return api;
}
