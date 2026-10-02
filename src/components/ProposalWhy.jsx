import React, { useMemo, useState } from "react";
import { ArrowRight, Warning } from "@phosphor-icons/react";
import { explainProposal } from "../lib/explain";

// Under every proposed line: why this wording, whether any figure was added, and
// (only when AI research is on) a box to ask for a change. Updates as you type.
export function ProposalWhy({ answer, proposal, requirements, supports, canRevise, revise }) {
  const why = useMemo(() => explainProposal({ answer, proposal, requirements, supports }), [answer, proposal, requirements, supports]);
  const [request, setRequest] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  return <div className="why-box">
    <span className="eyebrow">WHY THIS WORDING</span>
    <ul>{why.points.map((point) => <li key={point} className={/not found/.test(point) ? "why-warn" : ""}>{/not found/.test(point) && <Warning size={15} weight="fill" />}{point}</li>)}</ul>
    {canRevise
      ? <form className="revise-row" onSubmit={async (event) => { event.preventDefault(); if (!request.trim() || working) return; setWorking(true); setMessage(""); setMessage(await revise(request.trim())); setRequest(""); setWorking(false); }}>
          <input value={request} onChange={(event) => setRequest(event.target.value)} placeholder="Ask for a change: shorter, plainer, lead with the team…" aria-label="Ask for a change to this wording" disabled={working} />
          <button className="secondary compact" disabled={!request.trim() || working} type="submit">{working ? "Revising…" : <>Revise <ArrowRight size={16} /></>}</button>
        </form>
      : <small className="quiet">Rewrite it yourself above any time. Asking for an AI rewrite appears here when AI research is on.</small>}
    {message && <small className="quiet" role="status">{message}</small>}
  </div>;
}
