import React, { useEffect, useRef, useState } from "react";
import { exportView, foldedHighlightCount, previewFieldValue, resumeBodyHtml } from "../lib/resume-view.js";

// Letter page at 96dpi: 612pt wide. The preview renders the page at true
// size and scales it to the pane, so line breaks match the PDF export.
const PAGE_WIDTH_PX = 816;

// The working resume as the export will look: same markup as the HTML
// export, styled to the PDF's metrics. Click any line to edit it in place —
// Enter or clicking away saves, Escape cancels. Saving goes through onEdit
// (the parent marks it a manual edit and persists the draft).
// changedLines: resume lines added or reworded from the user's approved
// answers, oldest first. They are marked on screen only (exports never see
// it), and the newest is scrolled into view, so a change is never hunted for.
const norm = (text) => String(text || "").replace(/\s+/g, " ").trim();

export function ResumePreview({ doc, onEdit, changedLines = [] }) {
  const [editing, setEditing] = useState(null);
  const editingRef = useRef(null);
  const draftRef = useRef("");
  const wrapRef = useRef(null);
  const pageRef = useRef(null);
  const [scale, setScale] = useState(0.6);
  const [pageHeight, setPageHeight] = useState(1056);

  const view = exportView(doc);
  const highlightCount = foldedHighlightCount(doc);

  useEffect(() => { editingRef.current = editing; }, [editing]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const page = pageRef.current;
    if (!wrap || !page) return undefined;
    const measure = () => {
      setScale(Math.min(1, wrap.clientWidth / PAGE_WIDTH_PX));
      setPageHeight(page.offsetHeight);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [doc, editing]);

  useEffect(() => {
    if (!editing) return;
    const input = wrapRef.current?.querySelector("[data-edit-input]");
    if (input) {
      input.focus();
      if (input.select) input.select();
    }
  }, [editing]);

  const commit = () => {
    const current = editingRef.current;
    if (!current) return;
    setEditing(null);
    editingRef.current = null;
    const value = draftRef.current;
    if (value !== current.original) onEdit({ ...current, value });
  };

  const handleClick = (event) => {
    if (editingRef.current) return; // finish the current edit first
    const el = event.target.closest("[data-edit]");
    if (!el) return;
    const field = el.dataset.edit;
    const descriptor = { key: field, field, original: "" };
    if (field === "bullet") {
      descriptor.roleIndex = Number(el.dataset.role);
      descriptor.bulletIndex = Number(el.dataset.bullet);
      descriptor.source = el.dataset.source;
      descriptor.index = Number(el.dataset.index);
      descriptor.key = `bullet:${descriptor.roleIndex}:${descriptor.bulletIndex}`;
    } else if (field === "roleHead") {
      descriptor.roleIndex = Number(el.dataset.role);
      descriptor.key = `roleHead:${descriptor.roleIndex}`;
    } else if (field === "education") {
      descriptor.index = Number(el.dataset.index);
      descriptor.key = `education:${descriptor.index}`;
    }
    descriptor.original = previewFieldValue(doc, descriptor);
    draftRef.current = descriptor.original;
    setEditing(descriptor);
  };

  const changedKey = changedLines.map(norm).filter(Boolean).join("\n");
  // Starts at the newest line on load, so only a change made now scrolls.
  const lastScrolled = useRef(null);
  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    const wanted = changedKey ? changedKey.split("\n") : [];
    let newest = null;
    page.querySelectorAll("[data-edit]").forEach((el) => {
      const at = wanted.indexOf(norm(el.textContent));
      el.classList.toggle("line-changed", at >= 0);
      if (at >= 0 && at === wanted.length - 1) newest = el;
    });
    const newestLine = wanted[wanted.length - 1] || "";
    if (lastScrolled.current === null) { lastScrolled.current = newestLine; return; }
    if (newest && newestLine !== lastScrolled.current) {
      lastScrolled.current = newestLine;
      newest.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  });

  const handleInput = (event) => {
    if (event.target.matches("[data-edit-input]")) draftRef.current = event.target.value;
  };

  const handleBlur = (event) => {
    if (event.target.matches("[data-edit-input]")) commit();
  };

  const handleKeyDown = (event) => {
    if (!event.target.matches("[data-edit-input]")) return;
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      editingRef.current = null;
      setEditing(null);
    }
  };

  return <div className="resume-preview">
    <div className="resume-preview-wrap" ref={wrapRef} style={{ height: pageHeight * scale }}>
      <div
        className="resume-page"
        ref={pageRef}
        style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}
        onClick={handleClick}
        onInput={handleInput}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        dangerouslySetInnerHTML={{ __html: resumeBodyHtml(view, { editMode: true, editing, highlightCount }) }}
      />
    </div>
    <p className="resume-preview-hint">{changedKey ? <><span className="line-changed-key">Green</span> lines were added or changed from your answers. </> : null}Click any line to edit it in place.</p>
  </div>;
}
