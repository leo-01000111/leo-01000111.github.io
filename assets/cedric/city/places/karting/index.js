// Karting minigame entry points. Two systems, because of the engine order: the race system runs
// before the camera and Cédric (so both see this frame's kart); the venue (hills, circuit mesh,
// tyre walls, rocks, lamps) is built after the buildings, once the ground height exists.
import { createVenue } from "./venue.js";
import { createRace } from "./race.js";

export const createKartRace = g => createRace(g);
export const createKartVenue = g => createVenue(g);
