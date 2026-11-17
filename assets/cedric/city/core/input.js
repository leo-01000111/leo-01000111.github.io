// Keyboard + pointer state. Listeners only live while the city is open.
const GAME_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);
// Keys the page behind may scroll with (the home page's corridor mode steps levels on them)
const PAGE_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", "Space"]);

export function createInput(events) {
  const down = new Set();
  const pressed = new Set();
  const input = { fwd: 0, turn: 0, px: 0, py: 0, inside: false, down, consume, update, dispose };

  function typing(e) {
    const t = e.target;
    return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable || (t.closest && t.closest("[data-typing]")));
  }
  const onKeyDown = e => {
    if (e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
    // Space / Enter on a focused button belongs to the button
    if ((e.code === "Space" || e.code === "Enter") && e.target && e.target.closest && e.target.closest("button, a, [role=button]")) return;
    if (PAGE_KEYS.has(e.code)) e.stopPropagation(); // we listen first (capture): the page behind never sees these
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    down.add(e.code);
    if (e.code === "Escape" && !e.repeat) events.emit("escape");
  };
  const onKeyUp = e => down.delete(e.code);
  const onBlur = () => { down.clear(); input.inside = false; };
  const onMove = e => {
    input.px = Math.max(-1, Math.min(1, (e.clientX / innerWidth) * 2 - 1));
    input.py = Math.max(-1, Math.min(1, (e.clientY / innerHeight) * 2 - 1));
    input.inside = true;
  };
  const onOut = e => { if (!e.relatedTarget) input.inside = false; };

  addEventListener("keydown", onKeyDown, true);
  addEventListener("keyup", onKeyUp);
  addEventListener("blur", onBlur);
  addEventListener("pointermove", onMove);
  document.addEventListener("pointerout", onOut);

  function consume(code) { return pressed.delete(code); }
  function update() {
    input.fwd = (down.has("KeyW") || down.has("ArrowUp") ? 1 : 0) - (down.has("KeyS") || down.has("ArrowDown") ? 1 : 0);
    input.turn = (down.has("KeyD") || down.has("ArrowRight") ? 1 : 0) - (down.has("KeyA") || down.has("ArrowLeft") ? 1 : 0);
  }
  function dispose() {
    removeEventListener("keydown", onKeyDown, true);
    removeEventListener("keyup", onKeyUp);
    removeEventListener("blur", onBlur);
    removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerout", onOut);
    down.clear(); pressed.clear();
  }
  return input;
}
