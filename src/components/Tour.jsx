import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowCounterClockwise, Play, X } from "@phosphor-icons/react";

// A guided tour of the REAL first screen. A soft ring pulses on each real field
// in order, the page scrolls to it, one thin arrow draws from the last stop to
// this one, and a caption bar narrates. It stops the instant the visitor touches
// anything; nothing here blocks the form.
const STEPS = [
  { key: "resume", text: "Start with your resume. Any format, no cleanup.", ms: 2800 },
  { key: "job", text: "Add the job you want: a posting, a link, or the application questions.", ms: 2800 },
  { key: "more", text: "Optional: decks, notes, anything that shows what you've really done.", ms: 2800 },
  { key: "go", text: "Career Chief studies the role and the company.", ms: 2800 },
  { key: "showcase", text: "Then it asks sharp questions about your own words. You approve every line.", ms: 5200 },
];

const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const target = (key) => document.querySelector(`[data-tour="${key}"]`);
// The page already has a 3-step list ("Bring what you have / Answer a few questions /
// Download your resume"). The tour lights it up in sync, so there is one route map.
const stageFor = (phase) => (phase === "done" ? "3" : typeof phase === "number" ? (STEPS[phase].key === "showcase" ? "2" : "1") : "");
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

// `autoplay`: only for someone who has not started yet. The chip to replay stays
// for the whole intake screen; choosing the sample dismisses the tour for good.
export function Tour({ autoplay, onSample }) {
  const active = true;
  const [dismissed, setDismissed] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | 0..n-1 | done | stopped
  const [arrow, setArrow] = useState(null);
  const timers = useRef([]);
  const reduced = useRef(false);

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  const unfocus = () => document.querySelectorAll(".tour-focus").forEach((el) => el.classList.remove("tour-focus"));

  const stop = useCallback(() => { clear(); unfocus(); setArrow(null); setPhase((p) => (typeof p === "number" ? "stopped" : p)); }, []);
  const play = useCallback((index = 0) => { clear(); setArrow(null); setPhase(index); }, []);

  useEffect(() => {
    if (!active) return undefined;
    reduced.current = reducedMotion();
    const params = new URLSearchParams(window.location.search);
    if (autoplay && !reduced.current && params.get("tour") !== "off") later(() => play(0), 1000);
    return () => { clear(); unfocus(); setStage(""); setArrow(null); };
  }, [active, autoplay, play]);

  // Any real interaction ends the tour at once.
  useEffect(() => {
    if (typeof phase !== "number") return undefined;
    const events = ["pointerdown", "wheel", "keydown", "touchstart"];
    events.forEach((name) => window.addEventListener(name, stop, { passive: true }));
    return () => events.forEach((name) => window.removeEventListener(name, stop));
  }, [phase, stop]);

  // Drive one step: scroll to it, ring it, draw the arrow from the last stop, schedule the next.
  useEffect(() => {
    if (typeof phase !== "number") return undefined;
    const step = STEPS[phase];
    const el = target(step.key);
    if (!el) { setPhase("done"); return undefined; }
    unfocus();
    el.scrollIntoView({ behavior: reduced.current ? "auto" : "smooth", block: "center" });
    el.classList.add("tour-focus");
    setArrow(null);
    const previous = phase > 0 ? target(STEPS[phase - 1].key) : null;
    if (previous && !reduced.current) later(() => setArrow(connector(previous, el)), 700);
    later(() => setPhase(phase + 1 < STEPS.length ? phase + 1 : "done"), step.ms);
    return () => clear();
  }, [phase]);

  // Keep the 3-step list in sync, and release the ring when the route ends.
  useEffect(() => { setStage(stageFor(phase)); if (phase === "done") { unfocus(); setArrow(null); } }, [phase]);

  if (dismissed) return null;
  const running = typeof phase === "number";
  const caption = running ? STEPS[phase].text : phase === "done" ? "That's the whole route. Want to see it run?" : "";

  return <>
    {arrow && <svg className="tour-arrow" aria-hidden="true"><path d={arrow.d} pathLength="1" /><polygon points={arrow.head} /></svg>}
    <div className={`tour-pill ${running || phase === "done" ? "open" : "closed"}`} role="status" aria-live="polite">
      {running || phase === "done" ? <>
        <div className="tour-dots" aria-hidden="true">{STEPS.map((s, i) => <span key={s.key} className={running && i === phase ? "on" : phase === "done" || (running && i < phase) ? "past" : ""} />)}</div>
        <p key={String(phase)}>{caption}</p>
        <div className="tour-actions">
          {phase === "done"
            ? <><button className="tour-primary" onClick={() => { setDismissed(true); clear(); unfocus(); setStage(""); setArrow(null); onSample(); }}>Try it with a sample <ArrowRight size={16} /></button><button className="tour-quiet" onClick={() => play(0)}><ArrowCounterClockwise size={15} /> Replay</button></>
            : <button className="tour-quiet" aria-label="Skip the tour" onClick={stop}><X size={16} /> Skip</button>}
        </div>
      </> : <button className="tour-chip" onClick={() => play(0)}><Play size={14} weight="fill" /> {phase === "stopped" ? "Replay the tour" : "See how it works · 20 sec"}</button>}
    </div>
  </>;
}
