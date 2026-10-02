import React from "react";
import { CheckCircle, Info, Warning } from "@phosphor-icons/react";

const toneIcon = { ok: <CheckCircle size={16} weight="fill" />, note: <Info size={16} />, check: <Warning size={16} weight="fill" /> };

// Where every line on the resume came from. Informational: it never blocks,
// hides or edits anything. The resume belongs to the user.
export function EvidenceLedger({ ledger }) {
  const { counts, items, attention } = ledger;
  const sections = [...new Set(items.map((item) => item.section))];
  return <div className="ledger">
    <p className="ledger-intro">Every line on your resume, and where it came from. This is information, not a gate: you can keep any line you know is true.</p>
    <div className="ledger-counts">
      <span><b>{counts.answer}</b> from your answers</span><span><b>{counts.document}</b> from your documents</span>
      <span><b>{counts.template}</b> written by Career Chief</span><span><b>{counts.unsourced}</b> not traced</span>
      {attention.length > 0 && <span className="ledger-flag"><b>{attention.length}</b> to check</span>}
    </div>
    {sections.map((section) => <section key={section}><h4>{section}</h4>{items.filter((item) => item.section === section).map((item) => <article key={item.id} className={`ledger-row ${item.tone}`}>
      <p className="ledger-line">{item.line}</p>
      <div className="ledger-meta"><span className={`ledger-badge ${item.tone}`}>{toneIcon[item.tone]} {item.label}</span><small>{item.note}</small></div>
      {item.support && <small className="ledger-source"><b>{item.support.name}:</b> “{item.support.excerpt}”</small>}
      {item.unsupportedNumbers.length > 0 && <small className="ledger-figures"><Warning size={14} /> Figures not found in your answers or documents: <b>{item.unsupportedNumbers.join(", ")}</b>. Confirm them or remove them. Career Chief never adds numbers.</small>}
    </article>)}</section>)}
  </div>;
}

export function LedgerButton({ ledger, open }) {
  const n = ledger.attention.length;
  return <button className="text-action ledger-button" onClick={open}>{n > 0 ? <Warning size={16} weight="fill" /> : <CheckCircle size={16} />} Where each line came from{n > 0 ? ` · ${n} to check` : ""}</button>;
}
