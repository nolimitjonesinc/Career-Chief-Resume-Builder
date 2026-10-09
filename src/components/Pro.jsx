// Pro (license-key) UI: the header control and the license dialog content.
// Presentational only — App.jsx owns the license state and the API calls.
import React from "react";

export function ProHeaderControl({ pro, onOpen }) {
  if (pro === "pro") {
    return <span className="badge pro-badge">PRO</span>;
  }
  if (pro === "checking") return null;
  return <button type="button" className="secondary compact" onClick={onOpen}>Go Pro</button>;
}

export function ProDialog({
  pro, config, maskedKey, keyInput, setKeyInput,
  busy, error, success, onActivate, onDeactivate, onBack,
}) {
  const isPro = pro === "pro";
  return <>
    <span className="eyebrow">CAREER CHIEF PRO</span>
    <h2>{isPro ? "Pro is active on this browser." : "Finish with the finished file."}</h2>
    {!isPro && <>
      <p>Pro unlocks the finished resume files: <strong>Word, PDF, HTML, and plain text</strong> exports of your approved draft.</p>
      <p className="quiet">The interview, the on-screen preview, editing, and every analysis stay free — no account, no sign-up. Your license lives in this browser only.</p>
      {config.configured ? <>
        <div className="tier-list">
          {config.tiers.map((tier) => (
            <a key={tier.name} className="tier-option" href={tier.url} target="_blank" rel="noreferrer">
              <strong>{tier.name}</strong>
              <span>{[tier.price, tier.term].filter(Boolean).join(" · ")}</span>
            </a>
          ))}
        </div>
        <p className="quiet">Checkout opens in a new tab. Your license key arrives by email — any tier's key activates Pro. Buying means you agree to the <a href="/terms-of-service.html" target="_blank" rel="noreferrer">Terms</a> and <a href="/refund-policy.html" target="_blank" rel="noreferrer">Refund Policy</a>.</p>
      </> : <div className="caution"><strong>Checkout is not configured yet.</strong><p>The store still needs its product and IDs — see LEMON_SQUEEZY_SETUP.md.</p></div>}
      <h3>Have a license key?</h3>
      <p className="quiet">Each key works on up to 3 browsers — deactivate on an old one to free a seat.</p>
      <div className="license-row">
        <input
          value={keyInput}
          onChange={(event) => setKeyInput(event.target.value)}
          placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX"
          aria-label="License key"
          autoComplete="off"
          spellCheck={false}
        />
        <button type="button" className="secondary compact" disabled={!keyInput.trim() || Boolean(busy)} onClick={() => onActivate(keyInput)}>
          {busy ? "Checking…" : "Activate"}
        </button>
      </div>
    </>}
    {isPro && <>
      <p>Finished resume exports are unlocked on this browser.</p>
      <p className="quiet">License {maskedKey} · tied to this browser only. Moving to a new device? Deactivate here first, then activate there.</p>
      <button type="button" className="secondary" disabled={Boolean(busy)} onClick={onDeactivate}>
        {busy ? "Working…" : "Deactivate on this browser"}
      </button>
    </>}
    {error && <div className="caution" role="alert"><strong>{error}</strong></div>}
    {success && <p className="pro-success" role="status">{success}</p>}
    <p className="quiet"><button type="button" className="text-action" onClick={onBack}>Back to my resume</button></p>
  </>;
}
