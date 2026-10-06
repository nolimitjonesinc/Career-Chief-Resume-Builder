# Lemon Squeezy setup — Career Chief Pro

The code is done and on `main`. What remains is dashboard work only — about
20 minutes, no code changes. The app reads everything from env vars and
rebuilds pick them up automatically.

## What was built

A license-key **Pro** unlock with no accounts (the app has none by design):

- **Free:** intake, analysis, interview, on-screen resume preview, direct
  editing, evidence ledger, coverage, parse check. Untouched.
- **Pro:** finished resume exports — Word, PDF, HTML, plain text. Clicking an
  export while free opens the Pro dialog instead of downloading.
- Buying opens Lemon Squeezy's hosted checkout in a new tab. The license key
  from the purchase email is pasted into the app and activated via the public
  License API (`activate` / `validate` / `deactivate`) — called from the
  browser, no API secret anywhere in the client.
- Three purchase tiers (30-Day $29 / 1-Year $79 / Lifetime $149), all
  one-time payments with license keys (activation limit 3). The Pro dialog
  lists every tier from the `VITE_LS_TIERS` env var; any tier's key activates
  Pro. The old single-variant env vars still work as a one-tier fallback.
- The license (key + instance id) lives in browser localStorage next to the
  draft. Validation runs on app load, cached for 24h. Any failure fails closed
  to the free tier with a plain-English notice — the free tier can never be
  locked out.
- Deactivation is in the Pro dialog ("Deactivate on this browser").

Code map: `shared/lemonsqueezy.mjs` (API + gating logic + tests),
`src/lib/license.js` (browser store), `src/components/Pro.jsx` (UI),
`src/App.jsx` (`downloadResume` is the single gate), tests in
`tests/license.test.mjs` + `tests/license-store.test.mjs`.

## Dashboard checklist

1. **Store.** If you don't have one: app.lemonsqueezy.com → create a store.
   Complete **business verification and payout details before live selling** —
   test mode works without them, live checkout does not.
2. **Product.** Products → New product → name it **Career Chief Pro**.
   One-time payment (a subscription also works with license keys, but the app
   treats Pro as buy-once).
3. **License keys ON.** In the product/variant settings, enable
   **"Generate license keys"**. Set the activation limit to **3** (laptop,
   desktop, one spare) — each browser activation burns one seat.
4. **Price.** Set the real price on the variant.
5. **Copy the IDs.** You need three values from the dashboard:
   - Store ID (Store → Settings)
   - Product ID (the product page URL or product list)
   - **Variant ID** — the variant's UUID. The buy link is
     `https://app.lemonsqueezy.com/checkout/buy/{variant-uuid}`.
6. **Paste into `.env`** (copy `.env.example` first). The dialog reads its
   tiers from `VITE_LS_TIERS` — a JSON array of
   `{name, price, variant, url, term}`; see `.env.example` for the three
   live tiers. The legacy `VITE_LS_VARIANT_ID` / `VITE_LS_CHECKOUT_URL` /
   `VITE_LS_PRICE_LABEL` vars still work as a single-tier fallback:
   ```bash
   VITE_LS_TIERS=[{"name":"30-Day","price":"$29","variant":"<uuid>","url":"<checkout>","term":"full Pro for 30 days"},...]
   ```
   Until at least one tier (or the legacy variant) is set, the buy buttons
   stay hidden and the dialog says checkout isn't configured — activation
   still works.
7. **Rebuild + redeploy** (`npm run build`; Vercel picks up `.env` /
   dashboard env vars on the next deploy).

## Test mode vs live mode (read this before the first real sale)

- Lemon Squeezy has a **Test mode** toggle in the dashboard. Make a test
  purchase there and activate with the **test key** to prove the whole loop.
- **Test keys only validate against test data; live keys only against live
  data.** A test key will always fail validation once you switch to live —
  that is expected, not a bug.
- License keys are emailed to the buyer automatically after purchase. Make
  sure the product's confirmation email actually contains the key (check the
  email template in test mode).
- Do the first live purchase yourself with a real card before announcing.

## Honest limits (deliberate, not oversights)

- **The gate is client-side.** A technical user can bypass it in the browser.
  It is an honest paywall for honest users, not DRM. Server-side enforcement
  would need accounts + webhook verification — out of scope for this pass.
- **One browser per seat.** Like the draft, the license does not follow the
  user across devices. Deactivating here frees the seat for activation there.
- **No subscriptions logic in the app.** If you later sell Pro as a
  subscription, add an expiry check on the `license_key` status/date fields
  returned by `validate` (the parser already surfaces them).
