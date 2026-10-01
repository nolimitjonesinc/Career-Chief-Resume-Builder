import React from "react";
import { CheckCircle, MagnifyingGlass, Plus, X } from "@phosphor-icons/react";
import { MAX_JOBS } from "../lib/compare";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// One career record, up to three jobs: what to lead with for each, and why.
export function CompareJobs({ jobs, setJobs, result, currentJob }) {
  const update = (id, patch) => setJobs(jobs.map((job) => (job.id === id ? { ...job, ...patch } : job)));
  const best = result.jobs.find((job) => job.id === result.bestId);
  return <>
    <span className="eyebrow">One career, several jobs</span>
    <h1>What to lead with<br/>for each one.</h1>
    <p className="lead">Paste up to {MAX_JOBS} postings. Career Chief compares them against everything you've told it and shows what to emphasize for each, with the line of yours that backs it up. It reorders your evidence; it doesn't invent any.</p>
    <div className="compare-inputs">
      {jobs.map((job, index) => <div className="compare-job" key={job.id}>
        <div className="compare-job-head"><input value={job.title} onChange={(event) => update(job.id, { title: event.target.value })} placeholder={`Job ${index + 1} title`} aria-label={`Job ${index + 1} title`} /><button aria-label={`Remove job ${index + 1}`} onClick={() => setJobs(jobs.filter((item) => item.id !== job.id))}><X size={16} /></button></div>
        <textarea value={job.text} onChange={(event) => update(job.id, { text: event.target.value })} placeholder="Paste the job description" aria-label={`Job ${index + 1} description`} />
      </div>)}
      <div className="compare-actions">
        {jobs.length < MAX_JOBS && <button className="secondary" onClick={() => setJobs([...jobs, { id: uid(), title: "", text: "" }])}><Plus size={17} /> Add a job</button>}
        {currentJob && jobs.length < MAX_JOBS && !jobs.some((job) => job.text === currentJob.text) && <button className="text-action" onClick={() => setJobs([...jobs, { id: uid(), ...currentJob }])}>Add the job I'm working on</button>}
      </div>
    </div>
    {result.jobs.length === 0 && <div className="empty-card">Add a job description (a few sentences at least) and the comparison appears here.</div>}
    {best && <div className="fit-card compare-best"><CheckCircle size={28} /><div><small>Strongest match on the evidence you have</small><strong>{best.title}</strong></div></div>}
    {result.sharedLabels.length > 0 && <p className="quiet">Strong in all of them: <b>{result.sharedLabels.join(", ")}</b>. That belongs near the top of every version.</p>}
    <div className="compare-results">{result.jobs.map((job) => <article className="compare-card" key={job.id}>
      <h3>{job.title}</h3>
      {job.requirements.length === 0 ? <p className="quiet">No recognizable requirements found. Paste more of the posting.</p> : <>
        <span className="eyebrow">LEAD WITH</span>
        {job.leadWith.length ? job.leadWith.map((item) => <div className="lead-item" key={item.key}><strong><CheckCircle size={16} weight="fill" /> {item.label}{item.strength === "thin" ? " (thin)" : ""}</strong>{item.evidence && <small>Because you wrote: “{item.evidence}”</small>}</div>) : <p className="quiet">Nothing in your record supports this post's priorities yet. The interview is where that changes.</p>}
        {job.distinct.length > 0 && <p className="quiet">Unlike your other jobs, this one rewards: <b>{job.distinct.map((item) => item.label).join(", ")}</b>.</p>}
        {job.thin.length > 0 && <p className="quiet"><b>Supported once:</b> {job.thin.map((item) => item.label).join(", ")}. A fuller answer would make these solid.</p>}
        {job.gaps.length > 0 && <p className="quiet gap-line"><MagnifyingGlass size={14} /><span><b>Not in your record yet:</b> {job.gaps.map((item) => item.label).join(", ")}. Only claim these if you have evidence. The interview is where you add it.</span></p>}
      </>}
    </article>)}</div>
  </>;
}
