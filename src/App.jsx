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
const storageKey = "career-chief-local-draft-v1";
function readDraft() { try { return JSON.parse(localStorage.getItem(storageKey) || "null"); } catch { return null; } }
const initialDraft = readDraft();

export function App() {
  const [screen, setScreen] = useState(initialDraft?.screen || "intake");
  const [tab, setTab] = useState(initialDraft?.tab || "case");
  const [meta, setMeta] = useState(initialDraft?.meta || { ...blankMeta });
  const [resumeText, setResumeText] = useState(initialDraft?.resumeText || "");
  const [jobText, setJobText] = useState(initialDraft?.jobText || "");
  const [jobUrl, setJobUrl] = useState(initialDraft?.jobUrl || "");
  const [sources, setSources] = useState(initialDraft?.sources || []);
  const [analysis, setAnalysis] = useState(initialDraft?.analysis || null);
  const [doc, setDoc] = useState(initialDraft?.doc || null);
  const [history, setHistory] = useState(initialDraft?.history || []);
  const [questions, setQuestions] = useState(initialDraft?.questions || []);
  const [questionIndex, setQuestionIndex] = useState(initialDraft?.questionIndex || 0);
  const [questionStatus, setQuestionStatus] = useState(initialDraft?.questionStatus || {});
  const [answer, setAnswer] = useState("");
  const [answers, setAnswers] = useState(initialDraft?.answers || []);
  const [proposal, setProposal] = useState("");
  const [help, setHelp] = useState(false);
  const [modal, setModal] = useState(null);
  const [sourceDraft, setSourceDraft] = useState({ ...blankSource });
  const [selectedSource, setSelectedSource] = useState(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [manualEdit, setManualEdit] = useState(initialDraft?.manualEdit || false);
  const [projectName, setProjectName] = useState(initialDraft?.projectName || "primary");
  const [savedProjects, setSavedProjects] = useState(initialDraft?.savedProjects || {});
  const [careerBank, setCareerBank] = useState(initialDraft?.careerBank || []);
  const [newOpportunity, setNewOpportunity] = useState({ company: "", role: "", job: "" });
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiConsent, setAiConsent] = useState(initialDraft?.aiConsent || false);
  const [pendingFollowUp, setPendingFollowUp] = useState(null);
  const dialog = useRef(null);
  const priorFocus = useRef(null);

  useEffect(() => { fetch("/api/ai/status").then((result) => result.json()).then((value) => setAiEnabled(Boolean(value.enabled))).catch(() => {}); }, []);
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify({ screen, tab, meta, resumeText, jobText, jobUrl, sources, analysis, doc, history, questions, questionIndex, questionStatus, answers, manualEdit, projectName, savedProjects, careerBank, aiConsent })); }
    catch { /* Browser storage may be unavailable or full; the current session still works. */ }
  }, [screen, tab, meta, resumeText, jobText, jobUrl, sources, analysis, doc, history, questions, questionIndex, questionStatus, answers, manualEdit, projectName, savedProjects, careerBank, aiConsent]);

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
    const next = [...sources, source];
    setSources(next);
    if (analysis) {
      refreshAnalysis(next);
      if (analysis.researchMode === "ai" && aiConsent) {
        const combined = [...next];
        if (resumeText.trim()) combined.unshift({ id: "pasted-resume", kind: "resume", name: "Pasted resume", text: resumeText.trim() });
        if (jobText.trim()) combined.push({ id: "pasted-job", kind: "job", name: "Job description", text: jobText.trim() });
        runAiPlan(combined, meta, true);
      }
    }
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
    if (aiEnabled && aiConsent) runAiPlan(intakeSources);
  }

  async function runAiPlan(nextSources, targetMeta = meta, preserveProgress = false) {
    setBusy("Researching the company and rebuilding your hiring case…");
    try {
      const response = await fetch("/api/ai/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ meta: targetMeta, sources: nextSources }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "AI research could not complete.");
      setAnalysis((previous) => ({ ...previous, ...result, research: [...(previous?.research || []).filter((item) => !item.id?.startsWith("web-")), ...result.research], researchMode: "ai", doc: previous.doc }));
      if (preserveProgress) {
        const answered = questions.filter((item) => questionStatus[item.id] === "answered");
        setQuestions([...answered, ...result.questions.filter((item) => !answered.some((old) => old.id === item.id))]);
        setQuestionIndex(answered.length);
      } else {
        setQuestions(result.questions);
        setQuestionIndex(0);
        setQuestionStatus({});
      }
      setNotice("The researched hiring case is ready. Public findings have clickable source links.");
    } catch (error) { setNotice(`${error.message} The working draft and source-based interview remain available.`); }
    finally { setBusy(""); }
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

  async function reviewAnswer() {
    if (!currentQuestion || !answer.trim()) return;
    setPendingFollowUp(null);
    let proposed = proposeResumeUpdate(doc, currentQuestion, answer);
    if (analysis?.researchMode === "ai" && aiConsent) {
      setBusy("Checking your answer against the hiring case…");
      try {
        const response = await fetch("/api/ai/follow-up", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: meta.role, question: currentQuestion, answer, priorAnswers: answers, askedTopics: questions.slice(0, questionIndex + 1).map((item) => item.topic), pendingTopics: questions.slice(questionIndex + 1).map((item) => item.topic) }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "That answer could not be analyzed.");
        proposed = result.proposal;
        setPendingFollowUp(result.followUp);
      } catch (error) { setNotice(`${error.message} Review the editable draft wording below.`); }
      finally { setBusy(""); }
    }
    setProposal(proposed);
    setModal("proposal");
  }

  function applyProposal() {
    const question = currentQuestion;
    const savedAnswer = answer.trim();
    setHistory((items) => [...items, { ...doc }]);
    setDoc((value) => ({ ...value, tailored: answers.length ? `${value.tailored}\n${proposal.trim()}` : proposal.trim() }));
    setAnswers((items) => [...items, { id: uid(), questionId: question.id, topic: question.topic, question: question.prompt, text: savedAnswer, resumeLine: proposal.trim() }]);
    setCareerBank((items) => [...items, { id: uid(), topic: question.topic, question: question.prompt, text: savedAnswer, origin: `${meta.company || "Opportunity"} interview` }]);
    setQuestionStatus((state) => ({ ...state, [question.id]: "answered" }));
    if (pendingFollowUp || (question.id === "ownership" && !questions.some((item) => item.id === "ownership-detail"))) {
      const followUp = pendingFollowUp || { id: "ownership-detail", priority: "From your answer", topic: "Personal contribution", prompt: "Who else was involved, and which decisions or deliverables were specifically yours?", why: "Your answer shows a program. This follow-up separates collaboration from personal ownership.", tip: "Credit the team while being precise about what you drove." };
      setQuestions((items) => [...items.slice(0, questionIndex + 1), followUp, ...items.slice(questionIndex + 1)]);
    }
    setPendingFollowUp(null);
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

  function snapshot() { return { meta, doc, analysis, questions, answers, questionStatus, questionIndex, sources, resumeText, jobText, manualEdit }; }

  function openSavedProject(key) {
    const target = savedProjects[key];
    if (!target) return;
    setSavedProjects((saved) => ({ ...saved, [projectName]: snapshot() }));
    setProjectName(key);
    setMeta(target.meta); setDoc(target.doc); setAnalysis(target.analysis); setQuestions(target.questions);
    setAnswers(target.answers); setQuestionStatus(target.questionStatus); setQuestionIndex(target.questionIndex);
    setSources(target.sources); setResumeText(target.resumeText || ""); setJobText(target.jobText || ""); setManualEdit(target.manualEdit || false);
    setHistory([]); setTab("case"); setModal(null);
    setNotice("Opportunity opened. Its questions and resume are separate; confirmed career answers remain in your evidence bank.");
  }

  function createOpportunity() {
    if (!newOpportunity.role.trim() || newOpportunity.job.trim().length < 20) return;
    const key = uid();
    const nextMeta = { company: newOpportunity.company.trim(), role: newOpportunity.role.trim() };
    const shared = sources.filter((source) => source.id !== "career-bank" && ["resume", "current", "goals", "other"].includes(source.kind));
    const supplied = resumeText.trim() ? [{ id: "pasted-resume", kind: "resume", name: "Pasted resume", origin: "Pasted text", text: resumeText.trim(), status: "ready" }] : [];
    const interviewSource = careerBank.length ? [{ id: "career-bank", kind: "current", name: "Confirmed interview answers", origin: "User-supplied career evidence", text: careerBank.map((item) => `${item.topic}: ${item.text}`).join("\n"), status: "ready" }] : [];
    const roleSource = { id: uid(), kind: "job", name: `${nextMeta.role} brief`, origin: "Pasted job description", text: newOpportunity.job.trim(), status: "ready" };
    const nextSources = [...shared, ...supplied.filter((item) => !shared.some((source) => source.kind === "resume")), ...interviewSource, roleSource];
    const next = analyzeSources(nextSources, nextMeta);
    setSavedProjects((saved) => ({ ...saved, [projectName]: snapshot() }));
    setProjectName(key); setMeta(nextMeta); setSources(nextSources); setResumeText(""); setJobText("");
    setAnalysis(next); setDoc(next.doc); setQuestions(next.questions); setAnswers([]); setQuestionStatus({}); setQuestionIndex(0);
    setHistory([]); setManualEdit(false); setTab("case"); setScreen("workspace"); setModal(null);
    setNewOpportunity({ company: "", role: "", job: "" });
    setNotice("New opportunity created from your career evidence. Its hiring case and resume are ready to refine.");
    if (aiEnabled && aiConsent) runAiPlan(nextSources, nextMeta);
  }

  function clearLocalDraft() {
    localStorage.removeItem(storageKey);
    window.location.reload();
  }

  return <>
    <Header hasDraft={Boolean(doc)} finish={() => setModal("finish")} home={() => setModal("home")} />
    <div className="demo-strip"><strong>WORKING PROTOTYPE</strong><span>{analysis?.researchMode === "ai" ? "AI research active. Review cited findings and approve any resume change." : "Source analysis is rule-based. AI research is available when connected and selected."} Your draft is stored in this browser on this device.</span></div>
    {busy && <div className="busy" role="status"><LeafDrop /> {busy}</div>}
    {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice("")}><X size={17} /></button></div>}

    {screen === "intake" && <Intake
      meta={meta} setMeta={setMeta} resumeText={resumeText} setResumeText={setResumeText}
      jobText={jobText} setJobText={setJobText} jobUrl={jobUrl} setJobUrl={setJobUrl}
      sources={readySources} loadSample={loadSample} addFile={addFile} readJobLink={readJobLink}
      removeSource={(id) => setSources((items) => items.filter((item) => item.id !== id))}
      openSource={() => { setSourceDraft({ ...blankSource }); setModal("source-add"); }}
      begin={beginAnalysis} canBegin={hasResume && hasOpportunity} busy={Boolean(busy)} aiEnabled={aiEnabled} aiConsent={aiConsent} setAiConsent={setAiConsent} clear={clearLocalDraft}
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
          {tab === "interview" && <Interview questions={questions} index={questionIndex} status={questionStatus} answer={answer} setAnswer={setAnswer} review={reviewAnswer} skip={skipQuestion} help={help} setHelp={setHelp} sample={() => setAnswer(currentQuestion?.sample || "")} add={() => { setSourceDraft({ ...blankSource }); setModal("source-add"); }} finish={() => setModal("finish")} busy={busy} />}
          {tab === "career" && <CareerEvidence sources={intakeSources} answers={careerBank} inspect={(source) => { setSelectedSource(source); setModal("source-view"); }} add={() => { setSourceDraft({ ...blankSource }); setModal("source-add"); }} clear={() => setModal("clear")} />}
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
      {modal === "finish" && doc && <Finish doc={doc} completed={completed} total={questions.length} analysis={analysis} answers={answers} download={downloadResume} edit={() => setModal("editor")} />}
      {modal === "opportunity" && <Opportunity meta={meta} projects={savedProjects} openProject={openSavedProject} create={() => setModal("new-opportunity")} />}
      {modal === "new-opportunity" && <><h2>Another company, same career.</h2><p>Add the role and job description. Your confirmed career answers will come along; the resume and questions will be tailored separately.</p><label>Company<input value={newOpportunity.company} onChange={(e) => setNewOpportunity({ ...newOpportunity, company: e.target.value })} placeholder="Company name" /></label><label>Target role<input value={newOpportunity.role} onChange={(e) => setNewOpportunity({ ...newOpportunity, role: e.target.value })} placeholder="Role title" /></label><label>Job description<textarea value={newOpportunity.job} onChange={(e) => setNewOpportunity({ ...newOpportunity, job: e.target.value })} placeholder="Paste the role or application questions. Add other files and links afterward." /></label><button className="primary" disabled={!newOpportunity.role.trim() || newOpportunity.job.trim().length < 20} onClick={createOpportunity}>Build this opportunity <ArrowRight size={18} /></button></>}
      {modal === "home" && <><h2>Return to your source stack?</h2><p>Your current session stays here unless the page is refreshed.</p><button className="primary" onClick={() => { setScreen("intake"); setModal(null); }}>Return to sources</button></>}
      {modal === "clear" && <><h2>Clear this device’s draft?</h2><p>This deletes the saved career material, sources, answers, and resume from this browser. Download anything you need first.</p><button className="secondary" onClick={() => setModal(null)}>Keep my draft</button><button className="primary" onClick={clearLocalDraft}>Clear draft</button></>}
    </dialog>
  </>;
}

// The brand leaf, drifting as if it just came off the tree. Used wherever the
// app is thinking, so waiting feels like part of the product.
function LeafDrop({ size = 21 }) {
  return <span className="leaf-drop" aria-hidden="true"><Leaf size={size} weight="fill" /></span>;
}

function Header({ hasDraft, finish, home }) {
  return <header><button className="brand" onClick={home}><Leaf size={31} weight="duotone" />Career Chief</button><div className="header-right"><span className="thought">Thoughtful careers. Brighter tomorrows.</span>{hasDraft && <button className="primary" onClick={finish}>Finish my resume now</button>}</div></header>;
}

function Intake({ meta, setMeta, resumeText, setResumeText, jobText, setJobText, jobUrl, setJobUrl, sources, loadSample, addFile, readJobLink, removeSource, openSource, begin, canBegin, busy, aiEnabled, aiConsent, setAiConsent, clear }) {
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
      {aiEnabled ? <label className="ai-consent"><input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} /><span><strong>Research the company with AI</strong><small>Your resume, job details, and added source text will be sent to OpenAI for analysis. Public findings will include clickable sources.</small></span></label> : <p className="form-hint">AI research is not connected yet. This version analyzes the material you provide and shows its limits.</p>}
      <button className="primary wide" disabled={!canBegin || busy} type="submit">Analyze the full picture <ArrowRight size={19} /></button>
      {!canBegin && <p className="form-hint">Add a resume, target role, and job description or job file to begin.</p>}
      <p className="form-hint">This browser saves your draft on this device. <button type="button" className="text-action" onClick={clear}>Clear saved draft</button></p>
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
  return <main className="analysis-page"><span className="eyebrow">The homework comes first</span><h1>Your starting point is ready.</h1><p>I read the documents together, built a first hiring case, and identified the questions most likely to improve it.</p><div className="analysis-grid">{steps.map(([title, detail], index) => <div className="analysis-step" key={title}><span>{index + 1}</span><div><strong>{title}</strong><small>{detail}</small></div><CheckCircle size={22} weight="fill" /></div>)}</div><div className="analysis-summary"><Target size={29} /><div><small>Working thesis</small><strong>{analysis.thesis}</strong></div></div><button className="primary" onClick={open}>Open my hiring case <ArrowRight size={19} /></button><p className="quiet">{analysis.researchMode === "ai" ? "AI research is active. Review public source links and confirm personal career claims before use." : "This starting point uses the supplied material. AI web research is available when connected and selected."}</p></main>;
}

function HiringCase({ analysis, questions, sources, start, research }) {
  return <><span className="status"><CheckCircle size={17} /> Working resume and question plan ready</span><h1>A hiring case built<br/>from the whole picture.</h1><p className="lead">{analysis.thesis}</p><div className="fit-card"><Target size={30} /><div><small>Strongest apparent fit</small><strong>{analysis.strongestFit}</strong></div></div><div className="evidence-columns"><section><span className="eyebrow">SUPPORTED SO FAR</span>{analysis.known.length ? analysis.known.map((item) => <p key={item}><CheckCircle size={16} /> {item}</p>) : <p><Circle size={15} /> Resume experience and target role loaded</p>}</section><section><span className="eyebrow">NEEDS CLARITY</span>{analysis.gaps.length ? analysis.gaps.slice(0, 4).map((item) => <p key={item}><MagnifyingGlass size={16} /> {item}</p>) : <p><MagnifyingGlass size={16} /> Personal ownership and outcomes</p>}</section></div><div className="case-section"><h3>What I would test before strengthening the claim</h3><p>{analysis.caution}</p><button className="text-action" onClick={research}>See every source and inference <ArrowRight size={16} /></button></div><div className="case-section"><div className="section-title"><div><h3>{questions.length} questions—not an endless interview</h3><p>Ordered by how much each answer can change the resume or hiring case.</p></div><span className="count-pill">{sources.length} sources</span></div><ol className="question-preview">{questions.slice(0, 4).map((question, index) => <li key={question.id}><span>{index + 1}</span><div><strong>{question.topic}</strong><small>{question.priority}</small></div></li>)}{questions.length > 4 && <li className="more"><span>+</span><div><strong>{questions.length - 4} more purposeful questions</strong><small>Finish anytime</small></div></li>}</ol></div><button className="primary" onClick={start}>Start with the highest-value question <ArrowRight size={19} /></button></>;
}

function Research({ analysis, sources, inspect, add }) {
  return <><span className="eyebrow">Research with receipts</span><h1>What the sources say.<br/>What it changes.</h1><p className="lead">Resume evidence, role requirements, company direction, leadership context, and uncertainty stay visibly separate.</p><div className="research-stats"><div><strong>{sources.length}</strong><span>supplied sources</span></div><div><strong>{analysis.requirements.length}</strong><span>role priorities</span></div><div><strong>{analysis.gaps.length}</strong><span>open questions</span></div></div><section className="source-library"><div className="section-title"><div><h3>Source library</h3><p>Open any item to see the extracted text.</p></div><button className="text-action" onClick={add}><Plus size={17} /> Add source</button></div>{sources.map((source) => <button className="source-button" key={source.id} onClick={() => inspect(source)}><span className="source-type">{sourceLabels[source.kind]}</span><strong>{source.name}</strong><small>{source.origin}</small><ArrowSquareOut size={16} /></button>)}</section><div className="research-list">{analysis.research.map((item) => <article key={item.id}><span className="eyebrow">{item.label} · {item.origin}</span><h3>{item.title}</h3><p>{item.finding}</p><div className="implication"><strong>What this changes</strong><p>{item.implication}</p></div>{item.url ? <a className="text-action" href={item.url} target="_blank" rel="noreferrer">Read public source <ArrowSquareOut size={16} /></a> : <button className="text-action" onClick={() => inspect(sources.find((source) => source.id === item.id))}>View extracted evidence <ArrowSquareOut size={16} /></button>}</article>)}</div></>;
}

function Interview({ questions, index, status, answer, setAnswer, review, skip, help, setHelp, sample, add, finish, busy }) {
  const q = questions[index];
  const answered = Object.values(status).filter((value) => value === "answered").length;
  if (!q) return <><span className="status"><CheckCircle size={17} /> Interview plan complete</span><h1>You’ve answered the<br/>highest-value questions.</h1><p className="lead">The resume is still yours to edit. Anything unresolved stays out of the claims.</p><button className="primary" onClick={finish}>Finish my resume now <ArrowRight size={18} /></button></>;
  return <><div className="interview-head"><div><span className="status"><CheckCircle size={17} /> Working resume ready · finish anytime</span><h1>One useful question<br/>at a time.</h1></div><div className="progress-copy"><strong>{answered} of {questions.length}</strong><span>answered</span></div></div><div className="progress-track"><span style={{ width: `${Math.max(5, (answered / questions.length) * 100)}%` }} /></div><div className="interview-layout"><aside className="question-plan"><span className="eyebrow">YOUR QUESTION PLAN</span>{questions.map((item, itemIndex) => <button key={item.id} className={itemIndex === index ? "current" : ""} disabled={itemIndex > index || status[item.id] === "answered"}><span>{status[item.id] === "answered" ? <Check size={13} /> : itemIndex + 1}</span><div><strong>{item.topic}</strong><small>{status[item.id] || item.priority}</small></div></button>)}</aside><section className="question-card"><div className="question-meta"><span className="eyebrow">{q.priority}</span><span>Question {index + 1} of {questions.length}</span></div><h2>{q.prompt}</h2><details><summary>Why this can change your case</summary><p>{q.why}</p></details><label>Your answer<textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Tell me what you remember. Rough notes are perfect." /></label>{q.sample && <button className="text-action sample-answer" onClick={sample}>Use a fictional sample answer</button>}<div className="question-actions"><button className="text-action" onClick={() => setHelp(!help)}>I don’t know yet</button><button className="text-action" onClick={skip}>Skip for now</button><button className="primary" disabled={!answer.trim() || Boolean(busy)} onClick={review}>Review resume update <ArrowRight size={18} /></button></div>{busy && <div className="thinking-inline" role="status"><LeafDrop size={19} /><span><strong>{busy}</strong></span></div>}{help && <div className="help-panel"><h3>Let’s make it easier.</h3><p>{q.tip}</p><div className="search-task"><MagnifyingGlass size={20} /><div><strong>Evidence search worth your time</strong><p>Search permitted email, documents, or notes for the project name plus “launch,” “results,” “approved,” or “team.” Add an excerpt only if you are allowed to share it.</p></div></div><button className="text-action" onClick={add}><Plus size={16} /> Add what I find</button></div>}</section></div></>;
}

function CareerEvidence({ sources, answers, inspect, add, clear }) {
  const career = sources.filter((source) => ["resume", "current", "goals", "other"].includes(source.kind));
  return <><span className="eyebrow">Your reusable career record</span><h1>Remember it once.<br/>Use it thoughtfully.</h1><p className="lead">Career evidence can support more than one application. Each company still gets its own strategy and resume draft.</p><div className="section-title"><div><h3>Career sources</h3><p>Documents and context you supplied.</p></div><button className="text-action" onClick={add}><Plus size={17} /> Add context</button></div>{career.map((source) => <button className="evidence-card" key={source.id} onClick={() => inspect(source)}><span className="badge">{sourceLabels[source.kind]} · supplied</span><strong>{source.name}</strong><p>{source.text.slice(0, 180)}{source.text.length > 180 ? "…" : ""}</p></button>)}<div className="section-title answer-title"><div><h3>Evidence gathered in the interview</h3><p>These answers are user-supplied, not independently verified.</p></div><span className="count-pill">{answers.length}</span></div>{answers.length ? answers.map((item) => <article className="answer-evidence" key={item.id}><span className="badge">{item.topic}</span><p>{item.text}</p><small>Resume wording: {item.resumeLine}</small></article>) : <div className="empty-card">Useful answers will collect here as you work through the question plan.</div>}<button className="text-action" onClick={clear}>Clear saved draft from this device</button></>;
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

function Finish({ completed, total, analysis, answers, download, edit }) { return <><span className="status"><CheckCircle size={18} /> Ready to use as a working draft</span><h2>Finish now means finish now.</h2><p>You answered {completed} of {total} questions. Unanswered questions remain visible gaps; they do not block the resume.</p><div className="finish-summary"><div><strong>{analysis.sourceCount}</strong><span>sources used</span></div><div><strong>{completed}</strong><span>answers added</span></div><div><strong>{analysis.gaps.length}</strong><span>open themes</span></div></div><div className="caution"><strong>Review before submitting</strong><p>{analysis.caution} No unsupported metric has been added automatically.</p></div><div className="export-grid"><button className="primary" onClick={() => download("docx")}><FileDoc size={19} /> Word</button><button className="primary" onClick={() => download("pdf")}><FilePdf size={19} /> PDF</button><button className="secondary" onClick={() => download("html")}><FileHtml size={19} /> HTML</button><button className="secondary" onClick={() => download("txt")}><DownloadSimple size={19} /> Plain text</button></div><button className="text-action" onClick={edit}>Review and edit the full resume first</button><details><summary>Hiring case and interview preparation</summary><p><strong>Core narrative:</strong> {analysis.thesis}</p><p><strong>Reasons to interview you:</strong> {analysis.known?.slice(0, 5).join(" · ") || "Confirm the most relevant strengths."}</p><p><strong>Likely concern:</strong> {analysis.caution}</p>{answers?.length > 0 && <><h3>Interview stories to develop</h3>{answers.map((item) => <p key={item.id}><strong>{item.topic}:</strong> {item.text}</p>)}</>}</details>{analysis.applicationDrafts?.length > 0 && <details><summary>Draft answers to the actual application questions</summary>{analysis.applicationDrafts.map((item, index) => <div key={index} className="application-draft"><strong>{item.question}</strong><p>{item.draft}</p>{item.needsConfirmation && <small>Check before using: {item.needsConfirmation}</small>}</div>)}</details>}<p className="quiet">These exports create new files from the approved draft. Exact original-document formatting is not preserved in this prototype.</p></>; }

function Opportunity({ meta, projects, openProject, create }) { return <><span className="eyebrow">SEPARATE APPLICATION WORKSPACE</span><h2>One career. A different case for every company.</h2><p>Career evidence can be reused. Company research, the interview plan, and resume wording stay attached to their opportunity.</p><div className="opportunity-card current"><span>Current</span><strong>{meta.company || "Current opportunity"}</strong><p>{meta.role}</p></div>{Object.entries(projects).map(([id, project]) => <button className="opportunity-card switch" key={id} onClick={() => openProject(id)}><span>Open saved opportunity</span><strong>{project.meta.company || "Target company"}</strong><p>{project.meta.role}</p><ArrowRight size={19} /></button>)}<button className="primary" onClick={create}><Plus size={18} /> Add another company</button></>; }
