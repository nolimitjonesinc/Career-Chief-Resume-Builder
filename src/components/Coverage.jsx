import React from "react";
import { CheckCircle, Circle, MagnifyingGlass } from "@phosphor-icons/react";

const strengthNote = { solid: "backed more than once", thin: "backed once" };

// Role coverage: which of the role's priorities your own material backs up, and
// with what. Replaces the idea of an ATS score; it is evidence, not a number.
// Live: it moves as you approve answers. In AI mode the model's lists are shown.
export function EvidenceColumns({ analysis, coverage }) {
  const live = analysis.researchMode !== "ai" && coverage.length > 0;
  if (!live) return <div className="evidence-columns"><section><span className="eyebrow">SUPPORTED SO FAR</span>{analysis.known.length ? analysis.known.map((item) => <p key={item}><CheckCircle size={16} /> {item}</p>) : <p><Circle size={15} /> Resume experience and target role loaded</p>}</section><section><span className="eyebrow">NEEDS CLARITY</span>{analysis.gaps.length ? analysis.gaps.slice(0, 4).map((item) => <p key={item}><MagnifyingGlass size={16} /> {item}</p>) : <p><MagnifyingGlass size={16} /> Personal ownership and outcomes</p>}</section></div>;
  const supported = coverage.filter((item) => item.supported);
  const open = coverage.filter((item) => !item.supported);
  const solid = coverage.filter((item) => item.strength === "solid").length;
  return <>
    <div className="evidence-columns">
      <section><span className="eyebrow">SUPPORTED SO FAR</span>{supported.length ? supported.map((item) => <p key={item.key}><CheckCircle size={16} /> <span>{item.label} <small>· {strengthNote[item.strength]}</small>{item.evidence && <small className="coverage-proof">“{item.evidence}”</small>}</span></p>) : <p><Circle size={15} /> Nothing yet matches this role's stated priorities</p>}</section>
      <section><span className="eyebrow">NEEDS CLARITY</span>{open.length ? open.slice(0, 5).map((item) => <p key={item.key}><MagnifyingGlass size={16} /> {item.label}</p>) : <p><CheckCircle size={16} /> Every stated priority has some support</p>}</section>
    </div>
    <p className="quiet coverage-note">Role coverage: {supported.length} of {coverage.length} priorities backed by your material, {solid} of them solidly. It updates as you answer. This isn't an ATS score; it's what your own words support.</p>
  </>;
}
