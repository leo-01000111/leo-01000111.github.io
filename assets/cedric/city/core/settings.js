// Persisted settings. Storage can throw (private window, blocked data): every access is guarded.
const KEY = "cedric:city";
const DEFAULTS = { cam: 0.3, volume: 0.7, music: 0.6, ambience: 0.7, mute: 0, kartBest: 0 }; // kartBest (karting): best lap in seconds, 0 = none

export function createSettings(events) {
  const data = Object.assign({}, DEFAULTS);
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw && typeof raw === "object") for (const k in DEFAULTS) if (typeof raw[k] === "number") data[k] = raw[k];
  } catch (e) { /* no storage: defaults */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ } };
  return {
    get: k => data[k],
    // persist=false keeps the value for this session only (URL overrides)
    set(k, v, persist = true) {
      data[k] = v;
      if (persist) save();
      events.emit("setting", k, v);
    },
  };
}
