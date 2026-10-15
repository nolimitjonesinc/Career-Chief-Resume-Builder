import React, { useEffect, useRef } from "react";
import { ArrowRight, CaretDown, CaretUp, Leaf } from "@phosphor-icons/react";

// The persistent concierge dock: pinned to the bottom of the screen, visible
// on EVERY screen from first load. It is the product's face — the master
// delegator that narrates what it did, names the one next step, and asks the
// single highest-value question when one is needed. The old Chat tab is gone;
// this IS the chat.
//
// The input is the answer box during the interview: the question lives in the
// main pane, the answer goes here, and the focus ring points at this input.
// Approval still happens in the proposal dialog, never in this dock.
export function ConciergeDock({
  messages = [],
  input,
  setInput,
  onSend,
  sending = false,
  stage = "intake",
  placeholder = "Ask me anything…",
  readiness = { pct: 0 },
  nextStep = "",
  actions = [],
  onAction = () => {},
  aiEnabled = false,
  aiConsent = false,
  onToggleAi = () => {},
  canFinish = false,
  onFinish = () => {},
  collapsed = false,
  onToggleCollapse = () => {},
}) {
  const threadRef = useRef(null);
  useEffect(() => {
    const node = threadRef.current;
    if (node && !collapsed) node.scrollTop = node.scrollHeight;
  }, [messages, collapsed]);

  const disabled = sending || stage === "analyzing";
  return (
    <aside className="concierge-dock" aria-label="Career Chief concierge">
      <div className="concierge-bar">
        <span className="concierge-name">
          <Leaf size={19} weight="fill" /> Career Chief
        </span>
        <div className="concierge-readiness" title="Resume readiness">
          <span className="concierge-pct">{readiness.pct}% ready</span>
          <span className="concierge-meter" aria-hidden="true">
            <span style={{ width: `${readiness.pct}%` }} />
          </span>
        </div>
        <span className="concierge-next">{nextStep}</span>
        {aiEnabled && (
          <label className="ai-toggle concierge-ai-toggle">
            <input
              type="checkbox"
              checked={aiConsent}
              onChange={(event) => onToggleAi(event.target.checked)}
            />
            <span>AI {aiConsent ? "on" : "off"}</span>
          </label>
        )}
        {canFinish && (
          <button type="button" className="primary concierge-finish" onClick={onFinish}>
            Finish my resume now
          </button>
        )}
        <button
          type="button"
          className="text-action concierge-collapse"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand the concierge" : "Collapse the concierge"}
        >
          {collapsed ? <CaretUp size={17} /> : <CaretDown size={17} />}
        </button>
      </div>

      {!collapsed && (
        <div className="concierge-thread" ref={threadRef} aria-live="polite">
          {messages.length === 0 && (
            <p className="concierge-empty">Ask me anything — or follow the highlighted box.</p>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`concierge-msg ${message.role === "user" ? "concierge-you" : "concierge-chief"}`}
            >
              <strong>{message.role === "user" ? "You" : "Career Chief"}</strong>
              <p>{message.text}</p>
              {message.approvedLine && (
                <p className="concierge-approved">Now on your resume: “{message.approvedLine}”</p>
              )}
              {message.actions?.length > 0 && (
                <div className="concierge-msg-actions">
                  {message.actions.map((action) => (
                    <button
                      key={action.action + action.label}
                      type="button"
                      className="secondary compact"
                      onClick={() => onAction(action.action, action.payload)}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="concierge-msg concierge-chief">
              <strong>Career Chief</strong>
              <p>Working on that…</p>
            </div>
          )}
        </div>
      )}

      {!collapsed && actions.length > 0 && (
        <div className="concierge-chips">
          {actions.map((action) => (
            <button
              key={action.action + action.label}
              type="button"
              className="concierge-chip"
              data-focus={action.action === "back-to-question" ? "back-to-question" : undefined}
              onClick={() => onAction(action.action, action.payload)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      <form
        className="concierge-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <label htmlFor="concierge-input" className="concierge-input-label">
          Message Career Chief
        </label>
        <div className="concierge-input-row">
          <input
            id="concierge-input"
            data-focus="concierge-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
          />
          <button className="primary" type="submit" disabled={disabled || !input.trim()}>
            {sending ? "Working…" : <>Send <ArrowRight size={17} /></>}
          </button>
        </div>
        <small className="quiet">
          What you type here counts as your own words. Nothing lands on your resume without your approval.
        </small>
      </form>
    </aside>
  );
}
