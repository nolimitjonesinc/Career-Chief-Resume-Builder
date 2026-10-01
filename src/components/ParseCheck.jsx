import React, { useMemo, useState } from "react";
import { CheckCircle, Warning } from "@phosphor-icons/react";
import { roundTripChecks, staticChecks, summarize } from "../lib/parsecheck";
import { browserRuntime } from "../lib/parse-runtime";

const Row = ({ item }) => <li className={item.ok ? "pc-ok" : "pc-bad"}>{item.ok ? <CheckCircle size={17} weight="fill" /> : <Warning size={17} weight="fill" />}<div><strong>{item.label}</strong>{!item.ok && <small>{item.hint}</small>}</div></li>;

// "Can a machine read this?" A checklist, deliberately not a score.
export function ParseCheck({ doc }) {
  const checks = useMemo(() => staticChecks(doc), [doc]);
  const [trip, setTrip] = useState(null);
  const [state, setState] = useState("idle");
  async function run() {
    setState("running");
    try { setTrip(await roundTripChecks(doc, browserRuntime)); setState("done"); }
    catch (error) { setTrip(null); setState("error"); }
  }
  const failed = summarize(checks).failed.length + (trip ? summarize(trip).failed.length : 0);
  return <details className="parse-check" open={failed > 0}>
    <summary>Can a recruiting system read this? {failed ? `${failed} thing${failed === 1 ? "" : "s"} to look at` : "Looks readable"}</summary>
    <p className="quiet">A checklist, not a score. Scores like “87/100” are made-up precision.</p>
    <ul>{checks.map((item) => <Row key={item.id} item={item} />)}{trip && trip.map((item) => <Row key={item.id} item={item} />)}</ul>
    {state !== "done" && <button className="secondary compact" disabled={state === "running"} onClick={run}>{state === "running" ? "Reading it back…" : "Test it with a real document reader"}</button>}
    {state === "error" && <p className="quiet">The read-back test couldn't run in this browser. The checklist above still applies.</p>}
    {state === "done" && <p className="quiet">We built your Word file and read it back with a document parser, the same kind of reading applicant systems do.</p>}
  </details>;
}
