// Where the trains go. One list, one hook.
//   { id, name, blurb, exists }
// `exists: false` means no such environment has been built yet: the train makes a loop and comes
// back to the same station (places/station.js). When an environment exists, set `exists: true`,
// give the entry an `enter(g)` that swaps the world, and `travel()` below hands the game over to it.
// The names and one-line descriptions live in text.js (T.station.dest).
import { T } from "../text.js";

const d = (id, exists = false) => ({ id, name: T.station.dest[id].name, blurb: T.station.dest[id].blurb, exists });

// The city we are in: listed at the till as "vous êtes ici", never selectable.
export const HERE = Object.assign(d("here", true), { here: true });

// Future environments, invented for now: a mountain village, a desert observatory, an island port,
// an orbital station, a lantern forest.
export const DESTINATIONS = [d("val-brume"), d("sables"), d("cormorans"), d("alba"), d("lanternes")];

// Called by the cutscene when the train goes into the tunnel. Return true if a real environment
// took over (the loop is then skipped); false plays the "comes back to the same station" ride.
export function travel(dest, g) {
  if (dest && dest.exists && typeof dest.enter === "function") { dest.enter(g); return true; }
  return false;
}
