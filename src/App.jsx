import React, { useEffect, useMemo, useRef, useState } from "react";
import "./career.css";
import {
  ArrowCounterClockwise, ArrowRight, ArrowSquareOut, CaretDown, Check, CheckCircle,
  Circle, DownloadSimple, FileDoc, FileHtml, FilePdf, FileText, Globe, Leaf, Link,
  MagnifyingGlass, Paperclip, Plus, ShieldCheck, Sparkle, Target, UploadSimple, X,
} from "@phosphor-icons/react";
import { acceptedFiles, extractFile, extractUrl } from "./lib/ingest";
import { analyzeSources, proposeResumeUpdate, sampleSources, sourceLabels } from "./lib/analyze";
import { exportResume } from "./lib/exporters";

const blankMeta = { company: "", role: "" };
const blankSource = { kind: "current", mode: "text", name: "", text: "", url: "", parsedFile: null };
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function App() {
  const [screen, setScreen] = useState("intake");
  const [tab, setTab] = useState("case");
  const [meta, setMeta] = useState({ ...blankMeta });
  const [resumeText, setResumeText] = useState("");
  const [jobText, setJobText] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [sources, setSources] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [doc, setDoc] = useState(null);
  const [history, setHistory] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionStatus, setQuestionStatus] = useState({});
  const [answer, setAnswer] = useState("");
  const [answers, setAnswers] = useState([]);
  const [proposal, setProposal] = useState("");
  const [help, setHelp] = useState(false);
  const [modal, setModal] = useState(null);
  const [sourceDraft, setSourceDraft] = useState({ ...blankSource });
  const [selectedSource, setSelectedSource] = useState(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [manualEdit, setManualEdit] = useState(false);
  const [projectName, setProjectName] = useState("primary");
  const [savedProjects, setSavedProjects] = useState({});
  const dialog = useRef(null);
  const priorFocus = useRef(null);

  const currentQuestion = questions[questionIndex];
  const completed = Object.values(questionStatus).filter((value) => value === "answered").length;
  const readySources = sources.filter((source) => source.status === "ready");
  const hasResume = readySources.some((source) => source.kind === "resume") || resumeText.trim().length > 20;
  const hasOpportunity = meta.role.trim() && (jobText.trim().length > 20 || readySources.some((source) => ["job", "application"].includes(source.kind)));

  useEffect(() => {
    if (modal) {
      priorFocus.current = document.activeElement;
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
      priorFocus.current?.focus?.();
    }
  }, [modal]);

  const intakeSources = useMemo(() => {
    const next = [...readySources];
    if (resumeText.trim()) next.unshift({ id: "pasted-resume", kind: "resume", name: "Pasted resume", origin: "Pasted text", text: resumeText.trim(), status: "ready" });
    if (jobText.trim()) next.push({ id: "pasted-job", kind: "job", name: `${meta.role || "Target role"} details`, origin: "Pasted text", text: jobText.trim(), status: "ready" });
    return next;
  }, [readySources, resumeText, jobText, meta.role]);

  function loadSample() {
    setMeta({ company: "Nestwell", role: "Senior Director, Content & Community" });
    setResumeText("");
    setJobText("");
    setSources(sampleSources.map((source) => ({ ...source })));
    setNotice("Seven fictional sources loaded: resume, job, company, leadership, current work, and application questions.");
  }

  async function addFile(file, kind) {
    if (!file) return;
    setBusy(`Reading ${file.name}…`);
    try {
      const extracted = await extractFile(file);
      const source = { id: uid(), kind, name: extracted.name, origin: `${file.name.split(".").pop().toUpperCase()} upload · ${extracted.characters.toLocaleString()} characters`, text: extracted.text, status: "ready" };
      addSource(source);
      setNotice(`${file.name} was read and added to the analysis.`);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy("");
    }
  }

  async function readJobLink() {
    if (!jobUrl.trim()) return;
    setBusy("Reading the job link…");
    try {
      const result = await extractUrl(jobUrl.trim());
      addSource({ id: uid(), kind: "job", name: result.title, origin: `Public link · read ${new Date(result.fetchedAt).toLocaleDateString()}`, url: result.url, text: result.text, status: "ready" });
      setJobUrl("");
      setNotice("The public page was read and added as job evidence.");
    } catch (error) {
      setNotice(`${error.message} You can download the page or paste its text instead.`);
    } finally {
      setBusy("");
    }
  }

  function addSource(source) {
    setSources((current) => {
      const next = [...current, source];
      if (analysis) refreshAnalysis(next);
      return next;
    });
  }

  function refreshAnalysis(nextSources) {
    const combined = [...nextSources];
    if (resumeText.trim()) combined.unshift({ id: "pasted-resume", kind: "resume", name: "Pasted resume", origin: "Pasted text", text: resumeText.trim(), status: "ready" });
    if (jobText.trim()) combined.push({ id: "pasted-job", kind: "job", name: "Pasted job details", origin: "Pasted text", text: jobText.trim(), status: "ready" });
    const next = analyzeSources(combined, meta);
    setAnalysis((old) => ({ ...next, doc: old?.doc || next.doc }));
    setQuestions((old) => {
      const seen = new Set(old.map((item) => item.id));
      return [...old, ...next.questions.filter((item) => !seen.has(item.id))];
    });
    setNotice("New context analyzed. The evidence map and question plan were refreshed.");
  }

  function beginAnalysis(event) {
    event?.preventDefault();
    const next = analyzeSources(intakeSources, meta);
    setAnalysis(next);
    setDoc(next.doc);
    setQuestions(next.questions);
    setQuestionStatus({});
    setAnswers([]);
    setQuestionIndex(0);
    setScreen("analysis");
    setNotice("");
  }

  async function saveSourceDraft() {
    setBusy("Adding context…");
    try {
      let source;
      if (sourceDraft.mode === "link") {
        const result = await extractUrl(sourceDraft.url.trim());
        source = { id: uid(), kind: sourceDraft.kind, name: sourceDraft.name || result.title, origin: `Public link · read ${new Date(result.fetchedAt).toLocaleDateString()}`, url: result.url, text: result.text, status: "ready" };
      } else if (sourceDraft.mode === "file") {
        if (!sourceDraft.parsedFile) throw new Error("Choose a readable file first.");
        source = { ...sourceDraft.parsedFile, id: uid(), kind: sourceDraft.kind, name: sourceDraft.name || sourceDraft.parsedFile.name, status: "ready" };
      } else {
        if (sourceDraft.text.trim().length < 10) throw new Error("Add a little more context first.");
        source = { id: uid(), kind: sourceDraft.kind, name: sourceDraft.name || sourceLabels[sourceDraft.kind], origin: "User-supplied text", text: sourceDraft.text.trim(), status: "ready" };
      }
      addSource(source);
      setSourceDraft({ ...blankSource });
      setModal(null);
    } catch (error) {
      setNotice(`${error.message} Paste the relevant text or upload an HTML, PDF, or DOCX copy instead.`);
    } finally {
      setBusy("");
    }
  }

  async function prepareDraftFile(file) {
    if (!file) return;
    setBusy(`Reading ${file.name}…`);
    try {
      const extracted = await extractFile(file);
      setSourceDraft((value) => ({ ...value, name: value.name || extracted.name, parsedFile: { name: extracted.name, origin: `${file.name.split(".").pop().toUpperCase()} upload · ${extracted.characters.toLocaleString()} characters`, text: extracted.text } }));
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy("");
    }
  }

  function reviewAnswer() {
    if (!currentQuestion || !answer.trim()) return;
    setProposal(proposeResumeUpdate(doc, currentQuestion, answer));
    setModal("proposal");
  }

  function applyProposal() {
    const question = currentQuestion;
    const savedAnswer = answer.trim();
    setHistory((items) => [...items, { ...doc }]);
    setDoc((value) => ({ ...value, tailored: proposal.trim() }));
    setAnswers((items) => [...items, { id: uid(), questionId: question.id, topic: question.topic, question: question.prompt, text: savedAnswer, resumeLine: proposal.trim() }]);
    setQuestionStatus((state) => ({ ...state, [question.id]: "answered" }));
    if (question.id === "ownership" && !questions.some((item) => item.id === "ownership-detail")) {
      const followUp = { id: "ownership-detail", priority: "From your answer", topic: "Personal contribution", prompt: "Who else was involved, and which decisions or deliverables were specifically yours?", why: "Your answer shows a program. This follow-up separates collaboration from personal ownership.", tip: "Credit the team while being precise about what you drove." };
      setQuestions((items) => [...items.slice(0, questionIndex + 1), followUp, ...items.slice(questionIndex + 1)]);
    }
    setAnswer("");
    setHelp(false);
    setModal(null);
    setQuestionIndex((value) => Math.min(value + 1, questions.length));
    setNotice("Answer saved as evidence and the working resume was updated. Undo is available.");
  }

  function skipQuestion() {
    if (!currentQuestion) return;
    setQuestionStatus((state) => ({ ...state, [currentQuestion.id]: "skipped" }));
    setQuestionIndex((value) => Math.min(value + 1, questions.length));
    setAnswer("");
    setHelp(false);
  }

  function undoResume() {
    if (!history.length) return;
    setDoc(history.at(-1));
    setHistory((items) => items.slice(0, -1));
    setNotice("The previous resume wording was restored. Your evidence stays in the career record.");
  }

  function saveEditor(value) {
    setHistory((items) => [...items, { ...doc }]);
    setDoc(value);
    setManualEdit(true);
    setModal(null);
    setNotice("Your direct edits are saved. Future suggestions still require your approval.");
  }

  async function downloadResume(format) {
    setBusy(`Creating ${format.toUpperCase()}…`);
    try {
      await exportResume(doc, format);
      setNotice(`${format.toUpperCase()} resume created from the current approved draft.`);
    } catch (error) {
      setNotice(`That export could not be created: ${error.message}`);
    } finally {
      setBusy("");
    }
  }

  function switchSampleProject() {
    const currentKey = projectName;
    const nextKey = projectName === "primary" ? "harbor" : "primary";
    setSavedProjects((saved) => ({ ...saved, [currentKey]: { meta, doc, analysis, questions, answers, questionStatus, questionIndex, sources } }));
    const saved = savedProjects[nextKey];
    if (saved) {
      setMeta(saved.meta); setDoc(saved.doc); setAnalysis(saved.analysis); setQuestions(saved.questions); setAnswers(saved.answers); setQuestionStatus(saved.questionStatus); setQuestionIndex(saved.questionIndex); setSources(saved.sources);
    } else {
      const harborMeta = { company: "Harbor Studio", role: "Head of Brand" };
      const shared = sources.filter((source) => ["resume", "current", "goals"].includes(source.kind));
      const harborJob = { id: "harbor-job", kind: "job", name: "Head of Brand brief", origin: "Fictional second opportunity", text: "Lead brand strategy, creative direction, and an in-house team. Build a consistent brand across consumer launches and executive communications.", status: "ready" };
      const nextSources = [...shared, harborJob];
      const next = analyzeSources(nextSources, harborMeta);
      setMeta(harborMeta); setSources(nextSources); setAnalysis(next); setDoc(next.doc); setQuestions(next.questions); setAnswers([]); setQuestionStatus({}); setQuestionIndex(0);
    }
    setProjectName(nextKey);
    setHistory([]);
    setTab("case");
    setModal(null);
    setNotice("A separate opportunity opened. Career evidence is shared; the hiring case, questions, and resume stay separate.");
  }

  return <>
    <Header hasDraft={Boolean(doc)} finish={() => setModal("finish")} home={() => setModal("home")} />
    <div className="demo-strip"><strong>WORKING PROTOTYPE</strong><span>Files are extracted in this session. Public links are read through a limited page reader. Interpretation uses a transparent prototype analyzer—not live AI.</span></div>
    {busy && <div className="busy" role="status"><Sparkle size={17} weight="fill" /> {busy}</div>}
    {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice("")}><X size={17} /></button></div>}

    {screen === "intake" && <Intake
      meta={meta} setMeta={setMeta} resumeText={resumeText} setResumeText={setResumeText}
      jobText={jobText} setJobText={setJobText} jobUrl={jobUrl} setJobUrl={setJobUrl}
      sources={readySources} loadSample={loadSample} addFile={addFile} readJobLink={readJobLink}
      removeSource={(id) => setSources((items) => items.filter((item) => item.id !== id))}
      openSource={() => { setSourceDraft({ ...blankSource }); setModal("source-add"); }}
      begin={beginAnalysis} canBegin={hasResume && hasOpportunity} busy={Boolean(busy)}
    />}

    {screen === "analysis" && analysis && <AnalysisReady analysis={analysis} sources={intakeSources} open={() => { setScreen("workspace"); setTab("case"); }} />}

    {screen === "workspace" && analysis && doc && <>
      <div className="opportunity-bar">
        <button className="opportunity-name" onClick={() => setModal("opportunity")}><span className="eyebrow">WORKING TOWARD</span><strong>{meta.company || "Target company"} <span>/ {meta.role}</span></strong><CaretDown size={16} /></button>
        <div className="opportunity-actions"><span>{analysis.sourceCount} sources analyzed</span><button className="text-action" onClick={() => { setSourceDraft({ ...blankSource }); setModal("source-add"); }}><Plus size={18} /> Add context</button></div>
      </div>
      <nav className="workspace-nav" aria-label="Workspace">
        {[['case','Your hiring case'],['research','Company & role'],['interview',`Interview plan · ${completed}/${questions.length}`],['career','Career evidence']].map(([id, label]) => <button key={id} className={tab === id ? "active" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>{label}</button>)}
      </nav>
      <div className="workspace">
        <main className="main-pane">
          {tab === "case" && <HiringCase analysis={analysis} questions={questions} sources={intakeSources} start={() => setTab("interview")} research={() => setTab("research")} />}
          {tab === "research" && <Research analysis={analysis} sources={intakeSources} inspect={(source) => { setSelectedSource(source); setModal("source-view"); }} add={() => { setSourceDraft({ ...blankSource }); setModal("source-add"); }} />}
          {tab === "interview" && <Interview questions={questions} index={questionIndex} status={questionStatus} answer={answer} setAnswer={setAnswer} review={reviewAnswer} skip={skipQuestion} help={help} setHelp={setHelp} sample={() => setAnswer(currentQuestion?.sample || "")} add={() => { setSourceDraft({ ...blankSource }); setModal("source-add"); }} finish={() => setModal("finish")} />}
          {tab === "career" && <CareerEvidence sources={intakeSources} answers={answers} inspect={(source) => { setSelectedSource(source); setModal("source-view"); }} add={() => { setSourceDraft({ ...blankSource }); setModal("source-add"); }} />}
        </main>
        <aside className="resume-pane">
          <div className="resume-top"><div><span>Working resume</span><small>Available from the start</small></div><button className="text-action" onClick={() => setModal("editor")}><ArrowSquareOut size={17} /> Open & edit</button></div>
          <Resume doc={doc} answered={answers.length} />
          <div className="resume-foot"><span>{manualEdit ? "Your manual wording is protected." : "All proposed changes require approval."}</span><button className="text-action" disabled={!history.length} onClick={undoResume}><ArrowCounterClockwise size={16} /> Undo</button></div>
        </aside>
      </div>
    </>}

    <dialog ref={dialog} onCancel={() => setModal(null)} className={modal === "editor" ? "editor-dialog" : ""}>
      <div className="dialog-top"><span className="eyebrow">Career Chief</span><button autoFocus aria-label="Close panel" onClick={() => setModal(null)}><X size={23} /></button></div>
      {modal === "source-add" && <SourceForm draft={sourceDraft} setDraft={setSourceDraft} prepareFile={prepareDraftFile} save={saveSourceDraft} busy={Boolean(busy)} />}
      {modal === "source-view" && selectedSource && <SourceView source={selectedSource} />}
      {modal === "proposal" && currentQuestion && <Proposal doc={doc} question={currentQuestion} answer={answer} proposal={proposal} setProposal={setProposal} apply={applyProposal} manual={manualEdit} />}
      {modal === "editor" && <ResumeEditor doc={doc} save={saveEditor} />}
      {modal === "finish" && doc && <Finish doc={doc} completed={completed} total={questions.length} analysis={analysis} download={downloadResume} edit={() => setModal("editor")} />}
      {modal === "opportunity" && <Opportunity meta={meta} projectName={projectName} switchProject={switchSampleProject} />}
      {modal === "home" && <><h2>Return to your source stack?</h2><p>Your current session stays here unless the page is refreshed.</p><button className="primary" onClick={() => { setScreen("intake"); setModal(null); }}>Return to sources</button></>}
    </dialog>
  </>;
}

function Header({ hasDraft, finish, home }) {
  return <header><button className="brand" onClick={home}><Leaf size={31} weight="duotone" />Career Chief</button><div className="header-right"><span className="thought">Thoughtful careers. Brighter tomorrows.</span>{hasDraft && <button className="primary" onClick={finish}>Finish my resume now</button>}</div></header>;
}

function Intake({ meta, setMeta, resumeText, setResumeText, jobText, setJobText, jobUrl, setJobUrl, sources, loadSample, addFile, readJobLink, removeSource, openSource, begin, canBegin, busy }) {
  return <main className="intake-page">
    <section className="intake-intro"><span className="eyebrow">A little less overwhelm. A clearer next chapter.</span><h1>Give me the messy pile.<br/>I’ll find the story.</h1><p>Bring the resume, the role, and anything else that could change the hiring case. You do not have to organize it first.</p><button className="text-action sample-link" onClick={loadSample}>Load Jordan’s complete fictional case <ArrowRight size={18} /></button><div className="promise"><ShieldCheck size={25} /><p><strong>Useful context can come from anywhere.</strong><br/>PDF, Word, HTML, pasted notes, application questions, or a public link.</p></div></section>
    <form className="source-builder" onSubmit={begin}>
      <div className="builder-head"><div><span className="step-number">1</span><h2>Start with what you have.</h2></div><span className="source-count">{sources.length + (resumeText.trim() ? 1 : 0) + (jobText.trim() ? 1 : 0)} sources ready</span></div>
      <SourceBlock icon={<FileText size={22} />} title="Your resume" required note="PDF, Word, HTML, TXT or pasted text">
        <textarea value={resumeText} onChange={(event) => setResumeText(event.target.value)} placeholder="Paste the resume here, or upload the original file below." />
        <label className="upload-control"><UploadSimple size={17} /> Upload resume<input type="file" accept={acceptedFiles} onChange={(event) => addFile(event.target.files[0], "resume")} /></label>
      </SourceBlock>
      <div className="two-fields"><label>Target company<input value={meta.company} onChange={(event) => setMeta({ ...meta, company: event.target.value })} placeholder="Company name" /></label><label>Target role<input value={meta.role} onChange={(event) => setMeta({ ...meta, role: event.target.value })} placeholder="Role title" required /></label></div>
      <SourceBlock icon={<Target size={22} />} title="The opportunity" required note="Job posting, application questions, or role brief">
        <textarea value={jobText} onChange={(event) => setJobText(event.target.value)} placeholder="Paste the job description or application questions." />
        <div className="link-row"><input type="url" value={jobUrl} onChange={(event) => setJobUrl(event.target.value)} placeholder="https://company.com/job" aria-label="Public job link" /><button type="button" className="secondary compact" disabled={!jobUrl.trim() || busy} onClick={readJobLink}><Link size={16} /> Read link</button></div>
        <label className="upload-control"><Paperclip size={17} /> Upload job or application file<input type="file" accept={acceptedFiles} onChange={(event) => addFile(event.target.files[0], "job")} /></label>
      </SourceBlock>
      {sources.length > 0 && <div className="source-stack"><div className="source-stack-head"><strong>Source stack</strong><span>These will be analyzed together.</span></div>{sources.map((source) => <SourceRow key={source.id} source={source} remove={() => removeSource(source.id)} />)}</div>}
      <button type="button" className="add-source" onClick={openSource}><Plus size={19} /> Add current responsibilities, company research, CEO context, goals, or another document</button>
      <button className="primary wide" disabled={!canBegin || busy} type="submit">Analyze the full picture <ArrowRight size={19} /></button>
      {!canBegin && <p className="form-hint">Add a resume, target role, and job description or job file to begin.</p>}
    </form>
  </main>;
}

function SourceBlock({ icon, title, required, note, children }) { return <section className="source-block"><div className="source-block-title"><span>{icon}</span><div><strong>{title}{required && " *"}</strong><small>{note}</small></div></div>{children}</section>; }

function SourceRow({ source, remove }) {
  const Icon = source.name?.toLowerCase().endsWith("pdf") ? FilePdf : source.name?.toLowerCase().match(/docx?$/) ? FileDoc : source.url ? Globe : source.name?.toLowerCase().match(/html?$/) ? FileHtml : FileText;
  return <div className="source-row"><Icon size={21} /><div><strong>{source.name}</strong><small>{sourceLabels[source.kind]} · {source.origin}</small></div><span className="ready"><Check size={14} /> Ready</span>{remove && <button type="button" aria-label={`Remove ${source.name}`} onClick={remove}><X size={16} /></button>}</div>;
}

function AnalysisReady({ analysis, sources, open }) {
  const steps = [
    ["Extracted the source material", `${analysis.sourceCount} sources · ${analysis.characterCount.toLocaleString()} characters`],
    ["Separated facts from inference", `${sources.filter((source) => ["resume","current","goals"].includes(source.kind)).length} career sources · ${sources.filter((source) => !["resume","current","goals"].includes(source.kind)).length} opportunity sources`],
    ["Mapped the role requirements", `${analysis.requirements.length || "Core"} priorities found`],
    ["Built the hiring case", `${analysis.known.length} supported themes · ${analysis.gaps.length} themes to clarify`],
    ["Created the interview plan", `${analysis.questions.length} questions, ordered by value`],
    ["Generated an early resume", "Editable now · no need to finish the interview"],
  ];
  return <main className="analysis-page"><span className="eyebrow">The homework comes first</span><h1>Your starting point is ready.</h1><p>I read the documents together, built a first hiring case, and identified the questions most likely to improve it.</p><div className="analysis-grid">{steps.map(([title, detail], index) => <div className="analysis-step" key={title}><span>{index + 1}</span><div><strong>{title}</strong><small>{detail}</small></div><CheckCircle size={22} weight="fill" /></div>)}</div><div className="analysis-summary"><Target size={29} /><div><small>Working thesis</small><strong>{analysis.thesis}</strong></div></div><button className="primary" onClick={open}>Open my hiring case <ArrowRight size={19} /></button><p className="quiet">This prototype uses deterministic text analysis. Production would add live AI reasoning and deeper source verification.</p></main>;
}

function HiringCase({ analysis, questions, sources, start, research }) {
  return <><span className="status"><CheckCircle size={17} /> Working resume and question plan ready</span><h1>A hiring case built<br/>from the whole picture.</h1><p className="lead">{analysis.thesis}</p><div className="fit-card"><Target size={30} /><div><small>Strongest apparent fit</small><strong>{analysis.strongestFit}</strong></div></div><div className="evidence-columns"><section><span className="eyebrow">SUPPORTED SO FAR</span>{analysis.known.length ? analysis.known.map((item) => <p key={item}><CheckCircle size={16} /> {item}</p>) : <p><Circle size={15} /> Resume experience and target role loaded</p>}</section><section><span className="eyebrow">NEEDS CLARITY</span>{analysis.gaps.length ? analysis.gaps.slice(0, 4).map((item) => <p key={item}><MagnifyingGlass size={16} /> {item}</p>) : <p><MagnifyingGlass size={16} /> Personal ownership and outcomes</p>}</section></div><div className="case-section"><h3>What I would test before strengthening the claim</h3><p>{analysis.caution}</p><button className="text-action" onClick={research}>See every source and inference <ArrowRight size={16} /></button></div><div className="case-section"><div className="section-title"><div><h3>{questions.length} questions—not an endless interview</h3><p>Ordered by how much each answer can change the resume or hiring case.</p></div><span className="count-pill">{sources.length} sources</span></div><ol className="question-preview">{questions.slice(0, 4).map((question, index) => <li key={question.id}><span>{index + 1}</span><div><strong>{question.topic}</strong><small>{question.priority}</small></div></li>)}{questions.length > 4 && <li className="more"><span>+</span><div><strong>{questions.length - 4} more purposeful questions</strong><small>Finish anytime</small></div></li>}</ol></div><button className="primary" onClick={start}>Start with the highest-value question <ArrowRight size={19} /></button></>;
}

function Research({ analysis, sources, inspect, add }) {
  return <><span className="eyebrow">Research with receipts</span><h1>What the sources say.<br/>What it changes.</h1><p className="lead">Resume evidence, role requirements, company direction, leadership context, and uncertainty stay visibly separate.</p><div className="research-stats"><div><strong>{sources.length}</strong><span>sources</span></div><div><strong>{analysis.requirements.length}</strong><span>role priorities</span></div><div><strong>{analysis.gaps.length}</strong><span>open questions</span></div></div><section className="source-library"><div className="section-title"><div><h3>Source library</h3><p>Open any item to see the extracted text.</p></div><button className="text-action" onClick={add}><Plus size={17} /> Add source</button></div>{sources.map((source) => <button className="source-button" key={source.id} onClick={() => inspect(source)}><span className="source-type">{sourceLabels[source.kind]}</span><strong>{source.name}</strong><small>{source.origin}</small><ArrowSquareOut size={16} /></button>)}</section><div className="research-list">{analysis.research.map((item) => <article key={item.id}><span className="eyebrow">{item.label} · {item.origin}</span><h3>{item.title}</h3><p>{item.finding}</p><div className="implication"><strong>What this changes</strong><p>{item.implication}</p></div><button className="text-action" onClick={() => inspect(sources.find((source) => source.id === item.id))}>View extracted evidence <ArrowSquareOut size={16} /></button></article>)}</div></>;
}

function Interview({ questions, index, status, answer, setAnswer, review, skip, help, setHelp, sample, add, finish }) {
  const q = questions[index];
  const answered = Object.values(status).filter((value) => value === "answered").length;
  if (!q) return <><span className="status"><CheckCircle size={17} /> Interview plan complete</span><h1>You’ve answered the<br/>highest-value questions.</h1><p className="lead">The resume is still yours to edit. Anything unresolved stays out of the claims.</p><button className="primary" onClick={finish}>Finish my resume now <ArrowRight size={18} /></button></>;
  return <><div className="interview-head"><div><span className="status"><CheckCircle size={17} /> Working resume ready · finish anytime</span><h1>One useful question<br/>at a time.</h1></div><div className="progress-copy"><strong>{answered} of {questions.length}</strong><span>answered</span></div></div><div className="progress-track"><span style={{ width: `${Math.max(5, (answered / questions.length) * 100)}%` }} /></div><div className="interview-layout"><aside className="question-plan"><span className="eyebrow">YOUR QUESTION PLAN</span>{questions.map((item, itemIndex) => <button key={item.id} className={itemIndex === index ? "current" : ""} disabled={itemIndex > index || status[item.id] === "answered"}><span>{status[item.id] === "answered" ? <Check size={13} /> : itemIndex + 1}</span><div><strong>{item.topic}</strong><small>{status[item.id] || item.priority}</small></div></button>)}</aside><section className="question-card"><div className="question-meta"><span className="eyebrow">{q.priority}</span><span>Question {index + 1} of {questions.length}</span></div><h2>{q.prompt}</h2><details><summary>Why this can change your case</summary><p>{q.why}</p></details><label>Your answer<textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Tell me what you remember. Rough notes are perfect." /></label>{q.sample && <button className="text-action sample-answer" onClick={sample}>Use a fictional sample answer</button>}<div className="question-actions"><button className="text-action" onClick={() => setHelp(!help)}>I don’t know yet</button><button className="text-action" onClick={skip}>Skip for now</button><button className="primary" disabled={!answer.trim()} onClick={review}>Review resume update <ArrowRight size={18} /></button></div>{help && <div className="help-panel"><h3>Let’s make it easier.</h3><p>{q.tip}</p><div className="search-task"><MagnifyingGlass size={20} /><div><strong>Evidence search worth your time</strong><p>Search permitted email, documents, or notes for the project name plus “launch,” “results,” “approved,” or “team.” Add an excerpt only if you are allowed to share it.</p></div></div><button className="text-action" onClick={add}><Plus size={16} /> Add what I find</button></div>}</section></div></>;
}

function CareerEvidence({ sources, answers, inspect, add }) {
  const career = sources.filter((source) => ["resume", "current", "goals", "other"].includes(source.kind));
  return <><span className="eyebrow">Your reusable career record</span><h1>Remember it once.<br/>Use it thoughtfully.</h1><p className="lead">Career evidence can support more than one application. Each company still gets its own strategy and resume draft.</p><div className="section-title"><div><h3>Career sources</h3><p>Documents and context you supplied.</p></div><button className="text-action" onClick={add}><Plus size={17} /> Add context</button></div>{career.map((source) => <button className="evidence-card" key={source.id} onClick={() => inspect(source)}><span className="badge">{sourceLabels[source.kind]} · supplied</span><strong>{source.name}</strong><p>{source.text.slice(0, 180)}{source.text.length > 180 ? "…" : ""}</p></button>)}<div className="section-title answer-title"><div><h3>Evidence gathered in the interview</h3><p>These answers are user-supplied, not independently verified.</p></div><span className="count-pill">{answers.length}</span></div>{answers.length ? answers.map((item) => <article className="answer-evidence" key={item.id}><span className="badge">{item.topic}</span><p>{item.text}</p><small>Resume wording: {item.resumeLine}</small></article>) : <div className="empty-card">Useful answers will collect here as you work through the question plan.</div>}</>;
}

function Resume({ doc, answered }) {
  return <article className="resume"><h2>{doc.name}</h2><div className="resume-title">{doc.title}</div><p className="contact">{doc.contact}</p><p>{doc.summary}</p><h4>Experience</h4><p className="prewrap">{doc.current}</p><p className={answered ? "tailored updated" : "tailored"}>{doc.tailored}{answered > 0 && <span className="resume-tag">Updated from your answers</span>}</p><h4>Earlier experience</h4><p className="prewrap">{doc.earlier}</p><h4>Education</h4><p>{doc.education}</p><h4>Capabilities</h4><p>{doc.skills}</p><p className="demo-doc">WORKING DRAFT · REVIEW BEFORE USE</p></article>;
}

function SourceForm({ draft, setDraft, prepareFile, save, busy }) {
  return <><h2>Add context from anywhere.</h2><p>Paste rough notes, upload a document, or bring in a public webpage. It will be analyzed with the rest of the case.</p><label>What kind of context is this?<select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value })}>{Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><div className="mode-tabs">{[['text','Paste text'],['file','Upload file'],['link','Public link']].map(([value,label]) => <button key={value} className={draft.mode === value ? "active" : ""} onClick={() => setDraft({ ...draft, mode: value })}>{label}</button>)}</div><label>Source name <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Optional label" /></label>{draft.mode === "text" && <label>Notes or evidence<textarea value={draft.text} onChange={(event) => setDraft({ ...draft, text: event.target.value })} placeholder="Paste anything useful. You do not have to organize it." /></label>}{draft.mode === "file" && <label className="drop-upload"><UploadSimple size={25} /><strong>Choose PDF, DOCX, HTML, TXT, Markdown, or RTF</strong><span>{draft.parsedFile ? `${draft.parsedFile.name} is ready` : "The text is extracted in this session."}</span><input type="file" accept={acceptedFiles} onChange={(event) => prepareFile(event.target.files[0])} /></label>}{draft.mode === "link" && <label>Public HTTPS link<input type="url" value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} placeholder="https://…" /></label>}<p className="quiet">Only share information you are permitted to use. A source is evidence—not automatic proof that every statement is true.</p><button className="primary" disabled={busy} onClick={save}>Add and analyze this source <ArrowRight size={18} /></button></>;
}

function SourceView({ source }) { return <><span className="badge">{sourceLabels[source.kind]} · {source.origin}</span><h2>{source.name}</h2>{source.url && <a className="source-url" href={source.url} target="_blank" rel="noreferrer">{source.url} <ArrowSquareOut size={15} /></a>}<h3>Extracted text</h3><div className="extracted-text">{source.text}</div><p className="quiet">This is the text used by the prototype analyzer. Production should retain source URL, retrieval date, excerpt, and verification status.</p></>; }

function Proposal({ doc, question, answer, proposal, setProposal, apply, manual }) { return <><span className="badge">Based on your answer · {question.topic}</span><h2>Review the change before it lands.</h2><p>Your answer becomes career evidence. Only the approved wording enters the resume.</p>{manual && <div className="caution">You have edited this resume manually. Nothing will overwrite that wording without this approval.</div>}<span className="eyebrow">YOUR ANSWER</span><p className="answer-quote">{answer}</p><span className="eyebrow">CURRENT RESUME LINE</span><p className="old-copy">{doc.tailored}</p><label>Proposed wording<textarea value={proposal} onChange={(event) => setProposal(event.target.value)} /></label><p className="quiet">Adjust anything that overstates your role. Unsupported metrics are not added.</p><button className="primary" disabled={!proposal.trim()} onClick={apply}>Approve and continue <CheckCircle size={18} /></button></>; }

function ResumeEditor({ doc, save }) { const [value, setValue] = useState({ ...doc }); const fields = { name: "Name", title: "Professional title", contact: "Contact details", summary: "Professional summary", current: "Current experience", tailored: "Tailored achievement", earlier: "Earlier experience", education: "Education", skills: "Capabilities" }; return <><h2>Your words. Your resume.</h2><p>Edit every section directly. Suggested changes still require your approval.</p>{Object.entries(fields).map(([key,label]) => <label key={key}>{label}{["summary","current","tailored","earlier","skills"].includes(key) ? <textarea value={value[key]} onChange={(event) => setValue({ ...value, [key]: event.target.value })} /> : <input value={value[key]} onChange={(event) => setValue({ ...value, [key]: event.target.value })} />}</label>)}<button className="primary" onClick={() => save(value)}>Save my wording <Check size={18} /></button></>; }

function Finish({ completed, total, analysis, download, edit }) { return <><span className="status"><CheckCircle size={18} /> Ready to use as a working draft</span><h2>Finish now means finish now.</h2><p>You answered {completed} of {total} questions. Unanswered questions remain visible gaps; they do not block the resume.</p><div className="finish-summary"><div><strong>{analysis.sourceCount}</strong><span>sources used</span></div><div><strong>{completed}</strong><span>answers added</span></div><div><strong>{analysis.gaps.length}</strong><span>open themes</span></div></div><div className="caution"><strong>Review before submitting</strong><p>{analysis.caution} No unsupported metric has been added automatically.</p></div><div className="export-grid"><button className="primary" onClick={() => download("docx")}><FileDoc size={19} /> Word</button><button className="primary" onClick={() => download("pdf")}><FilePdf size={19} /> PDF</button><button className="secondary" onClick={() => download("html")}><FileHtml size={19} /> HTML</button><button className="secondary" onClick={() => download("txt")}><DownloadSimple size={19} /> Plain text</button></div><button className="text-action" onClick={edit}>Review and edit the full resume first</button><details><summary>Hiring case and interview preparation</summary><p><strong>Core narrative:</strong> {analysis.thesis}</p><p><strong>Likely concern:</strong> {analysis.caution}</p><p><strong>Interview structure:</strong> describe the problem, your specific role, the operating choices, and only the results you can support.</p></details><p className="quiet">These exports create new files from the approved draft. Exact original-document formatting is not preserved in this prototype.</p></>; }

function Opportunity({ meta, projectName, switchProject }) { return <><span className="eyebrow">SEPARATE APPLICATION WORKSPACE</span><h2>One career. A different case for every company.</h2><p>Career evidence can be reused. Company research, the interview plan, and resume wording stay attached to their opportunity.</p><div className="opportunity-card current"><span>Current</span><strong>{meta.company}</strong><p>{meta.role}</p></div><button className="opportunity-card switch" onClick={switchProject}><span>Open sample</span><strong>{projectName === "primary" ? "Harbor Studio" : "Nestwell"}</strong><p>{projectName === "primary" ? "Head of Brand" : "Senior Director, Content & Community"}</p><ArrowRight size={19} /></button><p className="quiet">The second sample keeps its own document, questions, and progress for this session.</p></>; }
