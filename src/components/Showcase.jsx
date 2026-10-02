import React from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { sampleTransformation } from "../lib/analyze";

// One real before/after, generated from the sample case and the same proposal
// logic the app uses, so it can only show what the app actually does.
export function Showcase() {
  const t = sampleTransformation();
  return <figure className="showcase" data-tour="showcase" aria-label="Example transformation">
    <figcaption><span className="eyebrow">WHAT A QUESTION DOES · FICTIONAL EXAMPLE</span></figcaption>
    <div className="showcase-step"><small>Her resume said</small><p>“{t.said.replace(/\.$/, "")}”</p></div>
    <ArrowRight size={18} className="showcase-arrow" aria-hidden="true" />
    <div className="showcase-step"><small>Career Chief asked</small><p>“{t.asked}”</p></div>
    <ArrowRight size={18} className="showcase-arrow" aria-hidden="true" />
    <div className="showcase-step win"><small>After she approved it, the resume said</small><p>{t.became}</p></div>
    <small className="quiet">Nothing was added that she didn't say. You approve every line.</small>
  </figure>;
}
