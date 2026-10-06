import React, { useEffect, useState } from "react";
import { Leaf, LockKey } from "@phosphor-icons/react";
import { checkAccess, installAccessHeader, onAccessLost, tryCode } from "../lib/access";

installAccessHeader();

// Shows a code screen when the server asks for one; otherwise the app, as before.
export function AccessGate({ children }) {
  const [state, setState] = useState("checking");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { checkAccess().then(setState); return onAccessLost(() => setState("locked")); }, []);

  async function submit(event) {
    event.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError("");
    try { await tryCode(code); setState("open"); setCode(""); }
    catch (problem) { setError(problem.message); }
    finally { setBusy(false); }
  }

  if (state === "open") return children;
  if (state === "checking") return <div className="gate-wrap" aria-busy="true"><span className="brand"><Leaf size={31} weight="duotone" />Career Chief</span></div>;
  return (
    <main className="gate-wrap">
      <form className="gate-card" onSubmit={submit}>
        <span className="brand"><Leaf size={31} weight="duotone" />Career Chief</span>
        <span className="eyebrow"><LockKey size={14} /> PRIVATE PREVIEW</span>
        <h1>Friends and testers only, for now.</h1>
        <p>Career Chief is being tried out by a small group. Enter the access code you were given.</p>
        <label>Access code<input autoFocus autoComplete="off" autoCapitalize="none" spellCheck="false" value={code} onChange={(e) => setCode(e.target.value)} aria-invalid={Boolean(error)} /></label>
        {error && <p className="gate-error" role="alert">{error}</p>}
        <button className="primary wide" disabled={!code.trim() || busy}>{busy ? "Checking…" : "Come in"}</button>
        <small>No code? Ask the person who invited you.</small>
      </form>
    </main>
  );
}
