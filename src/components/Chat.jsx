import React from "react";
import { ArrowRight, CheckCircle, Sparkle } from "@phosphor-icons/react";
import { CHAT_AI_OFF_MESSAGE } from "../lib/chat";

// Chat tab: a message list + one input box. Every request becomes a
// proposal in the existing approval dialog — nothing the chat suggests
// lands without approval. Chat history is session-only: it is never
// saved to the draft, and the doc + evidence ledger are the memory.
export function ChatTab({ messages, input, setInput, onSend, sending, aiConsent, onEnableAi }) {
  return <div className="chat-pane">
    <span className="eyebrow">Chat</span>
    <h1>Ask for a change<br />in plain words.</h1>
    <p className="lead">“Make this bullet stronger.” “Lean into the launch — the company cares about it.” “Actually, I led that project.” Every suggestion comes back as a proposal for you to approve. Nothing lands on its own.</p>
    {!aiConsent && <div className="chat-ai-off" role="status">
      <p>{CHAT_AI_OFF_MESSAGE}</p>
      <button className="primary" type="button" onClick={onEnableAi}>Turn AI on</button>
    </div>}
    <div className="chat-messages" aria-live="polite">
      {messages.length === 0 && <p className="chat-empty">No messages yet. Try: <em>make my first bullet stronger</em></p>}
      {messages.map((message) => <div key={message.id} className={`chat-msg ${message.role === "user" ? "chat-you" : "chat-chief"}`}>
        <strong>{message.role === "user" ? "You" : "Career Chief"}</strong>
        <p>{message.text}</p>
        {message.approvedLine && <p className="chat-approved"><CheckCircle size={15} /> Now on your resume: “{message.approvedLine}”</p>}
      </div>)}
      {sending && <div className="chat-msg chat-chief"><strong>Career Chief</strong><p>Working on a proposal…</p></div>}
    </div>
    <form className="chat-form" onSubmit={(event) => { event.preventDefault(); onSend(); }}>
      <label htmlFor="chat-input">Your change request</label>
      <div className="chat-input-row">
        <input id="chat-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder={aiConsent ? "Make this bullet stronger…" : "Turn AI on to use chat"} disabled={!aiConsent || sending} />
        <button className="primary" type="submit" disabled={!aiConsent || sending || !input.trim()}>{sending ? "Working…" : <>Send <ArrowRight size={17} /></>}</button>
      </div>
      <small className="quiet"><Sparkle size={13} /> What you type here counts as your own words. Figures you state are kept; nothing new is invented.</small>
    </form>
  </div>;
}
