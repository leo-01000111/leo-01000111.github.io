// Tiny emitter.
export function createEvents() {
  const map = new Map();
  return {
    on(name, fn) {
      let set = map.get(name);
      if (!set) map.set(name, (set = new Set()));
      set.add(fn);
      return () => set.delete(fn);
    },
    off(name, fn) { const set = map.get(name); if (set) set.delete(fn); },
    emit(name, a, b) { const set = map.get(name); if (set) for (const fn of set) fn(a, b); },
    clear() { map.clear(); },
  };
}
