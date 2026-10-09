# Privacy Policy — Career Chief

**Effective:** October 9, 2026
**Operator:** Career Chief, operated by Danny Jones (sole proprietor), Los Angeles, California
**Contact:** support@dannyjones.ai

Career Chief is an AI resume builder. Short version: your resume is yours, we keep as little as possible, and we never see your payment details.

## 1. What stays in your browser

Career Chief saves your work on your own device (browser local storage) so you can pick up where you left off. That includes your resume text and drafts, the job descriptions you add, documents you upload (including their extracted text), your interview answers, the analysis, your saved applications — and your Pro license key.

- Nothing is synced between devices or browsers. Each browser holds its own copy.
- This storage has no password or encryption from us — anyone using the same browser profile can read it. Don't work with material you need to keep private on a shared computer.
- "Clear saved draft" in the app deletes this local data. It does not cancel your Pro license or delete files you already downloaded.

## 2. What goes to our server, and when

**Without AI (the default):** nothing you type or upload leaves your browser. Files are read and parsed locally.

**With AI enabled (opt-in):** when you turn AI on and use an AI feature, the text needed for that request is sent to our server, which forwards it to the AI provider. Depending on what you're doing, that can include your resume and job text, your interview answers, rewrite instructions, resume sections, and newly added sources. Company research also sends search terms (company name, job title, and related terms) to the provider's web search.

- The AI provider is named in the consent box before anything is sent — either OpenAI or Anthropic (Claude), depending on configuration. Only the named provider receives your content, for that request only.
- Turning AI off stops future requests. It cannot pull back anything already sent.
- AI is only available when a provider key is configured for the site. Without one, the app works locally and says so.

**Link reader:** if you paste a web address, the URL is sent to our server, which fetches the page on your behalf. That request reaches the destination website and passes through normal DNS lookups. Use public links only — never paste URLs containing private access tokens — and don't submit confidential employer or client material without permission.

**Document readers:** our Word, PDF, PowerPoint, HTML, and text readers extract everything readable in the file — including PowerPoint speaker notes and hidden slides. Assume anything in the file is read.

## 3. AI data handling and retention

We set OpenAI's `store: false` option, which instructs OpenAI not to retain API inputs and outputs. That is not zero retention: OpenAI retains limited data for abuse monitoring as described in their documentation. Anthropic generally deletes API inputs and outputs within 30 days, subject to the exceptions in their policy.

- OpenAI API data usage: https://developers.openai.com/api/docs/guides/your-data
- Anthropic data retention: https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data

Under both providers' commercial/API terms, API data is not used to train models by default.

## 4. Operational data

We run no analytics and no advertising trackers. (Do Not Track: there is nothing to turn off — we don't track browsing in the first place.) We do handle limited operational data:

- **Rate limiting:** to protect the AI endpoints and access-code checks from abuse, we derive a rate-limit identifier from request metadata such as IP-derived values. Failed access attempts may be logged against that identifier.
- **Hosting:** the site runs on Vercel, which processes requests to serve the site and keeps standard server logs.
- **Support email:** if you write to support@dannyjones.ai, we keep the correspondence needed to help you.
- **Purchases:** handled by Lemon Squeezy (section 5).

## 5. Purchases and license validation

Payments are handled entirely by Lemon Squeezy, our merchant of record. They collect your name, email address, and payment details and handle sales tax. **We never see or store your card number.** See [Lemon Squeezy's privacy policy](https://www.lemonsqueezy.com/privacy).

There are no accounts: license validation runs in your browser, directly against Lemon Squeezy's public license API. What happens with the response:

- **Used to validate:** the API response includes your license status plus order and product details (such as the name and email Lemon Squeezy holds for the purchase, the product and variant, and activation counts). We use these only to decide whether Pro unlocks, and to show your tier and expiry.
- **Kept:** only your license key and its activation ID, saved in your browser (section 1). We do not keep a copy of your name, order details, or purchase history on our systems.

## 6. What we don't do

- No user accounts. There is nothing to sign up for and no profile to maintain.
- No analytics or advertising trackers.
- We do not sell your personal information, and we do not share your resume content with anyone except the AI provider you consented to, for the sole purpose of generating your requested results.

## 7. Your rights and deletion

- **Data on your device:** use "Clear saved draft" in the app at any time.
- **Data we hold:** to request access to, correction of, or deletion of personal information we hold about you (for example, support correspondence), write to support@dannyjones.ai. We keep support and purchase-related records only as long as needed to provide support, comply with legal obligations, or resolve disputes, then delete them.
- **California residents:** this policy describes our practices in plain language. Whether specific California privacy statutes apply depends on statutory thresholds (revenue, data volume, data selling), which a small sole-proprietor operation typically does not meet. We honor access and deletion requests from everyone regardless.

## 8. Children

Career Chief is not directed at children under 13, and we do not knowingly collect information from them.

## 9. Security

We use HTTPS everywhere and minimize what we retain — the data we don't keep can't leak. Browser storage is only as private as the device it's on. No system is perfectly secure, and we can't guarantee absolute security.

## 10. Changes

If we change this policy in a way that affects how your data is handled, we'll update this page and note the new effective date at the top.
