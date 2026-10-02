import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowCounterClockwise, ArrowRight, Play, X } from "@phosphor-icons/react";
import "@fontsource/caveat/latin-700.css";

// A guided tour of the REAL first screen. A soft ring pulses on each real field
// in order, the page scrolls to it, one thin arrow draws from the last stop to
// this one, and a hand-lettered speech bubble beside the field says what it is
// for. The bubble writes itself in, then pops away as the tour moves on. It
// stops the instant the visitor touches anything; nothing here blocks the form.
const STEPS = [
  { key: "goal", text: "One resume per job.", ms: 3000 },
  { key: "resume", text: "Drop in your resume. No cleanup.", ms: 2800 },
  { key: "job", text: "Add the job you want.", ms: 2800 },
  { key: "more", text: "Add decks and notes. Optional.", ms: 2800 },
  { key: "go", text: "It matches the role to your evidence.", ms: 2800 },
  { key: "showcase", text: "Sharp questions. You approve every line.", ms: 5200 },
];

const FINALE = "That's all you have to do! We'll do the rest.";
const TILT = [-2.2, 1.6, -1.2, 2, -1.7, 1.3, -1.9];

const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const target = (key) => document.querySelector(`[data-tour="${key}"]`);
// The page already has a 3-step list ("Bring what you have / Answer a few questions /
// Download your resume"). The tour lights it up in sync, so there is one route map.
const stageFor = (phase) => (phase === "done" ? "3" : typeof phase === "number" ? (STEPS[phase].key === "goal" ? "" : STEPS[phase].key === "showcase" ? "2" : "1") : "");
const setStage = (stage) => { if (stage) document.body.dataset.tourStage = stage; else delete document.body.dataset.tourStage; };
const visible = (rect) => rect.bottom > 70 && rect.top < window.innerHeight - 90 && rect.right > 0 && rect.left < window.innerWidth;

// A curved connector between two on-screen rectangles, in viewport coordinates.
function connector(from, to) {
  const f = from.getBoundingClientRect();
  const t = to.getBoundingClientRect();
  if (!visible(f) || !visible(t)) return null;
  const fx = f.left + f.width / 2, tx = t.left + t.width / 2;
  const sideBySide = Math.abs(fx - tx) > Math.max(f.width, t.width) * 0.6;
  let s, e, c1, c2;
  if (sideBySide) {
    const leftward = tx < fx;
    s = { x: leftward ? f.left : f.right, y: f.top + f.height / 2 };
    e = { x: leftward ? t.right : t.left, y: t.top + t.height / 2 };
    c1 = { x: s.x + (e.x - s.x) / 2, y: s.y }; c2 = { x: s.x + (e.x - s.x) / 2, y: e.y };
  } else {
    const down = t.top > f.top;
    s = { x: f.right - 30, y: down ? f.bottom : f.top };
    e = { x: t.right - 30, y: down ? t.top : t.bottom };
    const bulge = 46;
    c1 = { x: s.x + bulge, y: s.y + (e.y - s.y) / 3 }; c2 = { x: e.x + bulge, y: e.y - (e.y - s.y) / 3 };
  }
  const angle = Math.atan2(e.y - c2.y, e.x - c2.x);
  const head = (a) => `${e.x - 11 * Math.cos(angle + a)},${e.y - 11 * Math.sin(angle + a)}`;
  return { d: `M${s.x},${s.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${e.x},${e.y}`, head: `${e.x},${e.y} ${head(0.45)} ${head(-0.45)}` };
}

// Where the bubble goes, in viewport coordinates: above the field if there is
// room (the usual case on a phone), else below, else beside it, else tucked
// inside its top corner. `side` is the edge the tail points toward.
function place(rect, size) {
  const vw = window.innerWidth, vh = window.innerHeight, m = 12, gap = 24, topEdge = 86;
  const anchorX = rect.left + Math.min(rect.width / 2, 170);
  const clampX = (x) => Math.min(vw - size.w - m, Math.max(m, x));
  const clampY = (y) => Math.min(vh - size.h - m, Math.max(topEdge, y));
  if (rect.top - size.h - gap >= topEdge) { const left = clampX(anchorX - size.w * 0.32); return { side: "top", left, top: rect.top - size.h - gap, tail: Math.min(size.w - 30, Math.max(30, anchorX - left)) }; }
  if (rect.bottom + size.h + gap <= vh - m) { const left = clampX(anchorX - size.w * 0.32); return { side: "bottom", left, top: rect.bottom + gap, tail: Math.min(size.w - 30, Math.max(30, anchorX - left)) }; }
  if (rect.right + size.w + gap <= vw - m) { const top = clampY(rect.top + 16); return { side: "right", left: rect.right + gap, top, tail: Math.min(size.h - 24, Math.max(24, rect.top + 40 - top)) }; }
  if (rect.left - size.w - gap >= m) { const top = clampY(rect.top + 16); return { side: "left", left: rect.left - size.w - gap, top, tail: Math.min(size.h - 24, Math.max(24, rect.top + 40 - top)) }; }
  return { side: "in", left: clampX(rect.right - size.w - 14), top: clampY(rect.top + 14), tail: 0 };
}

// One speech bubble. It measures itself, places itself once, writes its words
// in like handwriting, and keeps its place while it pops away.
function Bubble({ bubble, onCta }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !bubble.el) return;
    setPos(place(bubble.el.getBoundingClientRect(), { w: node.offsetWidth, h: node.offsetHeight }));
  }, [bubble.el]);
  const words = bubble.text.split(" ");
  const origin = !pos ? "50% 50%" : pos.side === "top" ? `${pos.tail}px 100%` : pos.side === "bottom" ? `${pos.tail}px 0` : pos.side === "right" ? `0 ${pos.tail}px` : pos.side === "left" ? `100% ${pos.tail}px` : "50% 50%";
  return <div ref={ref} className={`tour-bubble side-${pos?.side || "none"} ${bubble.out ? "out" : "in"} ${pos ? "placed" : ""}`}
    style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, "--tail": `${pos?.tail ?? 0}px`, "--rot": `${TILT[bubble.tilt % TILT.length]}deg`, transformOrigin: origin }}>
    <p className="tour-text" aria-hidden="true">{words.map((word, i) => <React.Fragment key={i}><span className="tour-word" style={{ "--i": i }}>{word}</span>{" "}</React.Fragment>)}</p>
    <svg className="tour-scribble" viewBox="0 0 120 14" aria-hidden="true" style={{ "--d": `${0.3 + words.length * 0.15}s` }}><path d="M3 9 C 24 3, 46 13, 70 7 S 104 4, 117 8" pathLength="1" /></svg>
    {bubble.cta && <button className="tour-cta" onClick={onCta}>Try it with a sample <ArrowRight size={18} weight="bold" /></button>}
    <span className="tour-tail" aria-hidden="true" />
  </div>;
}

// `autoplay`: only for someone who has not started yet. The replay chip stays
// for the whole intake screen; choosing the sample dismisses the tour for good.
export function Tour({ autoplay, onSample }) {
  const [dismissed, setDismissed] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | 0..n-1 | done | stopped
  const [arrow, setArrow] = useState(null);
  const [armed, setArmed] = useState(false);
  const [bubbles, setBubbles] = useState([]);
  const timers = useRef([]);
  const serial = useRef(0);
  const reduced = useRef(false);

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  const unfocus = () => document.querySelectorAll(".tour-focus").forEach((el) => el.classList.remove("tour-focus"));
  const dropBubbles = () => setBubbles((list) => list.map((b) => ({ ...b, out: true })));
  const showBubble = (text, el, cta = false) => setBubbles((list) => [...list.map((b) => ({ ...b, out: true })), { id: ++serial.current, tilt: serial.current, text, el, cta, out: false }]);

  const stop = useCallback(() => { clear(); unfocus(); setArrow(null); setArmed(false); dropBubbles(); setPhase((p) => (typeof p === "number" ? "stopped" : p)); }, []);
  const play = useCallback((index = 0) => { clear(); setArrow(null); setArmed(false); dropBubbles(); setPhase(index); }, []);

  // Bubbles that have popped away are removed once their exit finishes.
  useEffect(() => {
    if (!bubbles.some((b) => b.out)) return undefined;
    const t = setTimeout(() => setBubbles((list) => list.filter((b) => !b.out)), 360);
    return () => clearTimeout(t);
  }, [bubbles]);

  useEffect(() => {
    reduced.current = reducedMotion();
    const params = new URLSearchParams(window.location.search);
    if (autoplay && !reduced.current && params.get("tour") !== "off") { setArmed(true); later(() => play(0), 1000); }
    return () => { clear(); unfocus(); setStage(""); setArrow(null); };
  }, [autoplay, play]);

  // Any real interaction ends the tour at once.
  useEffect(() => {
    if (typeof phase !== "number") return undefined;
    // The tour's own buttons are excluded: Skip and the Replay chip share a corner,
    // so stopping on the first touch would swap the chip under the finger and the
    // click would land on Replay, restarting the tour. Skip stops on its click.
    const onInput = (event) => { if (event.target instanceof Element && event.target.closest(".tour-controls")) return; stop(); };
    const events = ["pointerdown", "wheel", "keydown", "touchstart"];
    events.forEach((name) => window.addEventListener(name, onInput, { passive: true }));
    return () => events.forEach((name) => window.removeEventListener(name, onInput));
  }, [phase, stop]);

  // Drive one stop: scroll to it, ring it, draw the arrow from the last stop,
  // let the bubble speak once the page has settled, schedule the next stop.
  useEffect(() => {
    const finale = phase === "done";
    if (typeof phase !== "number" && !finale) return undefined;
    const step = finale ? { key: "sample", text: FINALE } : STEPS[phase];
    const el = target(step.key);
    if (!el) { if (!finale) setPhase("done"); return undefined; }
    unfocus();
    setArrow(null);
    // A tall target (the example card) is scrolled so its top sits low enough for
    // the bubble to fit above it, instead of the bubble covering its contents.
    const tall = el.getBoundingClientRect().height > window.innerHeight * 0.5;
    el.scrollIntoView({ behavior: reduced.current ? "auto" : "smooth", block: tall ? "start" : "center" });
    el.classList.add("tour-focus");
    const previous = finale ? target(STEPS[STEPS.length - 1].key) : phase > 0 ? target(STEPS[phase - 1].key) : null;
    if (previous && !reduced.current) later(() => setArrow(connector(previous, el)), 700);
    later(() => showBubble(step.text, el, finale), reduced.current ? 0 : 450);
    if (!finale) later(() => setPhase(phase + 1 < STEPS.length ? phase + 1 : "done"), step.ms);
    return () => clear();
  }, [phase]);

  useEffect(() => { setStage(stageFor(phase)); }, [phase]);

  if (dismissed) return null;
  const running = typeof phase === "number";
  const caption = running ? STEPS[phase].text : phase === "done" ? FINALE : "";
  const choose = () => { setDismissed(true); clear(); unfocus(); setStage(""); setArrow(null); setBubbles([]); onSample(); };
  return <div className="tour-root">
    {arrow && <svg className="tour-arrow" aria-hidden="true"><path d={arrow.d} pathLength="1" /><polygon points={arrow.head} /></svg>}
    {bubbles.map((b) => <Bubble key={b.id} bubble={b} onCta={choose} />)}
    <span className="tour-sr" role="status" aria-live="polite">{caption}</span>
    <div className="tour-controls">
      {running ? <button className="tour-chip" aria-label="Skip the tour" onClick={stop}><X size={15} /> Skip</button>
        : phase === "done" ? <button className="tour-chip" onClick={() => play(0)}><ArrowCounterClockwise size={15} /> Replay</button>
        : armed && phase === "idle" ? null
        : <button className="tour-chip" onClick={() => play(0)}><Play size={14} weight="fill" /> {phase === "stopped" ? "Replay the tour" : "See how it works · 20 sec"}</button>}
    </div>
  </div>;
}
