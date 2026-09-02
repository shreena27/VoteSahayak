# ActionCard & Wizard UI Refresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the approved ActionCard and Wizard mockups (`mockups/actioncard-refresh-v1.html`, `mockups/wizard-refresh-v1.html`) into the live React components, without regressing the WhatsApp share-image capture, print output, offline saved-card rendering, or accessibility.

**Architecture:** ActionCard gains three pieces of local, non-persisted component state (`detailsOpen`, `checkedDocs`, `screen`) and a restructured render split into two `hidden`-toggled DOM regions instead of one continuous block. The underlying DOM keeps both regions mounted at all times (never conditionally unmounted) specifically so the existing share-image/print pipelines — which read the live DOM — keep seeing the whole card; only their *visibility* is toggled. `shareCard.js`'s existing clone-before-capture step gets one more line to un-hide anything hidden. Wizard gets a small, isolated accessibility fix with no structural change.

**Tech Stack:** React 19 (no router, plain `useState`), plain CSS with custom-property design tokens (`src/tokens.css`), `html-to-image` for the share capture, `oxlint`, Vite build. No unit test framework is installed in this repo (confirmed: no vitest/jest, no `*.test.*` files, no Playwright devDependency) — this plan follows that established convention rather than introducing one. Verification is `npm run build` + `npm run lint` + manual interaction checks via the Chrome browser tool against the local dev server, plus one ad-hoc `npx playwright` script (not committed) reused from this project's own precedent for regression-checking `renderCardAsFile()` pixel output.

## Global Constraints

- No new colors/tokens — every value pulled from `src/tokens.css`'s existing custom properties.
- No persistence for `detailsOpen`, `checkedDocs`, or `screen` — all three reset to their defaults whenever `card.id` changes (existing pattern: see the current `useEffect(() => { headlineRef.current?.focus() }, [card.id])` in `ActionCard.jsx`).
- Never conditionally unmount screen-1-only or screen-2-only JSX — use the `hidden` attribute so the full DOM subtree always exists under `cardRef`. This is required for the share-image capture and print output to keep showing the complete card (see Task 4).
- Content-string edits are scoped to exactly the one card reviewed in the mockup (`card-address-update` in `src/content/cards.json`) — do not rewrite other cards' copy as a side effect.
- Never author or edit Hindi (`_hi`) content strings directly in this plan's tasks — add the new/changed English strings, then add a line to `SecondBrain/Efforts/Personal/Vote Sahayak - Hindi Proofing Checklist.md` so the project's existing native-speaker review process covers them (per this project's established workflow — do not bypass it).
- Match this project's locked workflow rule: nothing merges to `master` automatically. Every task's commit lands on a feature branch; a PR is opened at the end (Task 7) and the user merges on their own schedule.
- No new dependencies. `html-to-image`, React, and the existing build tooling are already sufficient.

---

### Task 1: ActionCard — progressive disclosure and copy trims

**Files:**
- Modify: `src/components/ActionCard.jsx`
- Modify: `src/components/ActionCard.css`
- Modify: `src/content/cards.json` (the `card-address-update` entry only)
- Modify: `src/content/strings.en.json`, `src/content/strings.hi.json`
- Modify: `SecondBrain/Efforts/Personal/Vote Sahayak - Hindi Proofing Checklist.md`

**Interfaces:**
- Produces: a `detailsOpen` boolean state and a `<div id="details-panel" className="panel" hidden={!detailsOpen}>` region inside `ActionCard`, containing the meta block (`.receipt-meta`) and rejection tags. Task 3 renders this panel *inside* Screen 1.
- Produces: CSS classes `.disclose`, `.panel`, `.receipt-meta`, `.num`, `.reject-note` in `ActionCard.css`, reused as-is by later tasks.

- [ ] **Step 1: Read the current component so line numbers match**

Open `src/components/ActionCard.jsx` and confirm the current structure matches what this plan assumes: a `receipt-row.stack` for timeline, then rejection tags, then the document checklist, then steps, then stamp, then footer, then `.receipt-actions`. If a prior edit has changed this shape, stop and re-read this plan's assumptions before continuing.

- [ ] **Step 2: Add the new translation keys**

In `src/content/strings.en.json`, add these two lines right after `"card.timeline": "Timeline",`:

```json
  "card.showDetails": "Show details",
  "card.hideDetails": "Hide details",
  "card.ready": "ready",
```

In `src/content/strings.hi.json`, add the matching lines right after `"card.timeline": "समय",`:

```json
  "card.showDetails": "विवरण देखें",
  "card.hideDetails": "विवरण छुपाएं",
  "card.ready": "तैयार",
```

(`card.ready` is used by Task 2, added here since it's the same edit location.)

- [ ] **Step 3: Trim the address-update card's copy in content**

In `src/content/cards.json`, find the `card-address-update` entry (`kind: "wizard-result"`, `form_id: "form-8"`). Make exactly these two edits, English only:

Change `timeline_en` from:
```
"Usually a few weeks. In one documented case (a former diplomat's public account) it took up to 6 months — treat that as a possibility, not a guarantee, and apply as early as you can."
```
to:
```
"Usually a few weeks. In one documented case, a former diplomat reported it took up to 6 months. Treat this as possible, not certain. Apply as early as you can."
```

Change the `doc-existing-epic` document requirement's `label_en` from:
```
"Your existing Voter ID (EPIC) card, if you have one"
```
to:
```
"Your Voter ID (EPIC) card, if you have one"
```

Do not touch `timeline_hi` or `doc-existing-epic`'s `label_hi` — they still say the old wording, which is a temporary, acceptable mismatch until the Hindi proofing pass (Step 7 below) catches up.

- [ ] **Step 4: Add local disclosure state and a reset-on-card-change effect**

In `src/components/ActionCard.jsx`, inside `ActionCard()`, right after the existing `const [speaking, setSpeaking] = useState(false)` line, add:

```js
  const [detailsOpen, setDetailsOpen] = useState(false)
```

Find the existing effect:
```js
  useEffect(() => {
    headlineRef.current?.focus()
  }, [card.id])
```

Change it to also reset the new state (Tasks 2 and 3 will extend this same effect further — don't add a second effect):
```js
  useEffect(() => {
    headlineRef.current?.focus()
    setDetailsOpen(false)
  }, [card.id])
```

- [ ] **Step 5: Replace the always-visible timeline/rejections block with the disclosure**

Find this block in the JSX (the timeline row, immediately followed by the rejection tags block):
```jsx
        <div className="receipt-row stack">
          <span className="k">{t('card.timeline')}</span>
          <span className="v">{timeline}</span>
        </div>

        {card.rejection_tags.length > 0 && (
          <>
            <div className="doclist-heading">{t('card.rejectionsHeading')}</div>
            <div className="receipt-rejects">
              {card.rejection_tags.map((tagItem) => (
                <span key={tagItem.id} className="reject-tag">
                  {activeLang === 'hi' ? tagItem.label_hi : tagItem.label_en}
                </span>
              ))}
            </div>
          </>
        )}
```

Replace it with:
```jsx
        <button
          type="button"
          className="disclose"
          aria-expanded={detailsOpen}
          aria-controls={`details-panel-${card.id}`}
          onClick={() => setDetailsOpen((v) => !v)}
        >
          <span className="disclose-label">{detailsOpen ? t('card.hideDetails') : t('card.showDetails')}</span>
          <svg className="chev" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 5.5l4 4 4-4" />
          </svg>
        </button>
        <div id={`details-panel-${card.id}`} className="panel" hidden={!detailsOpen}>
          <div className="receipt-meta">
            <div className="receipt-row stack">
              <span className="k">{t('card.timeline')}</span>
              <span className="v">{timeline}</span>
            </div>
            <div className="receipt-row">
              <span className="k">{t('card.verified')}</span>
              <span className="v num">{formatDisplayDate(card.verified_on, activeLang)}</span>
            </div>
            <div className="receipt-row stack">
              <span className="v">{activeLang === 'hi' ? card.source_line_hi : card.source_line}</span>
            </div>
          </div>

          {card.rejection_tags.length > 0 && (
            <>
              <div className="doclist-heading">{t('card.rejectionsHeading')}</div>
              <div className="receipt-rejects">
                {card.rejection_tags.map((tagItem) => (
                  <span key={tagItem.id} className="reject-tag">
                    {activeLang === 'hi' ? tagItem.label_hi : tagItem.label_en}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
```

Note: the "Source" row deliberately has no `.k` label — `card.source_line`/`card.source_line_hi` already carry a "Source:" / "स्रोत:" prefix baked into the content string (confirmed: `"source_line": "Source: Election Commission of India"`), so adding a second "Source" label would duplicate it. This is a deliberate deviation from the mockup's literal markup (which used unprefixed placeholder copy) to avoid manipulating localized content strings — do not try to strip the prefix at render time.

- [ ] **Step 6: Add the CSS for the disclosure, meta block, and bolder figures**

In `src/components/ActionCard.css`, add after the existing `.receipt-rejects` / `.reject-tag` rules:

```css
.receipt-meta {
  border: 1px dashed var(--border-strong);
  border-radius: 10px;
  padding: 2px 13px;
  margin: 2px 0 0;
}
.receipt-meta .receipt-row {
  padding: 9px 0;
}
.receipt-meta .receipt-row .v {
  font-weight: 600;
}
.receipt-meta .receipt-row.stack .v {
  font-weight: 500;
  line-height: 1.5;
}

.num {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.disclose {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin: 12px 0 0;
  padding: 11px 0;
  background: transparent;
  border: 0;
  border-top: 1px dashed var(--border-strong);
  color: var(--accent-ink);
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
}
.disclose .disclose-label {
  flex: 1;
}
.disclose .chev {
  width: 14px;
  height: 14px;
  flex: none;
  transition: transform 0.2s ease-out;
}
.disclose[aria-expanded='true'] .chev {
  transform: rotate(180deg);
}
.panel {
  padding-bottom: 4px;
}
.panel .doclist-heading {
  margin-top: 12px;
}

.reject-tag {
  padding: 6px 11px 7px;
  border-radius: 12px;
  line-height: 1.45;
}
.reject-note {
  display: block;
  font-size: 10px;
  font-weight: 500;
  color: var(--ink-muted);
  margin-top: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .disclose .chev {
    transition: none;
  }
}
```

Then find the existing `.doclist-heading` rule and leave it as-is (Task 2 extends it). Find `.receipt-row .k` and leave it as-is — do not change its base weight; boldness is applied via the new `.receipt-meta`/`.num` rules above, scoped to the meta block only, not every row in the card (footer rows on Screen 2 stay at their current weight, matching the mockup).

- [ ] **Step 7: Demote the rejection caveat to a footnote, in JSX**

Find where `card.rejection_tags` are mapped (now inside the new disclosure panel from Step 5). The current content strings bake the caveat into one string (e.g. `"Not \"ordinarily resident\" — about 12–15% of cases (research estimate, not an official figure)"`). Rather than editing content strings to split this in the source data (which would require touching every rejection tag across every card, out of this task's scope), split it at render time using a regex that isolates a trailing parenthetical, which is how every current rejection tag in `cards.json` is structured:

Replace:
```jsx
                {card.rejection_tags.map((tagItem) => (
                  <span key={tagItem.id} className="reject-tag">
                    {activeLang === 'hi' ? tagItem.label_hi : tagItem.label_en}
                  </span>
                ))}
```
with:
```jsx
                {card.rejection_tags.map((tagItem) => {
                  const label = activeLang === 'hi' ? tagItem.label_hi : tagItem.label_en
                  const match = label.match(/^(.*)(\([^)]+\))\s*$/)
                  return (
                    <span key={tagItem.id} className="reject-tag">
                      {match ? match[1].trim() : label}
                      {match && <span className="reject-note">{match[2]}</span>}
                    </span>
                  )
                })}
```
This degrades safely: if a tag has no trailing parenthetical, `match` is `null` and the whole label renders exactly as it does today, unchanged.

- [ ] **Step 8: Add the two Hindi proofing checklist lines**

Open `SecondBrain/Efforts/Personal/Vote Sahayak - Hindi Proofing Checklist.md` and add two new checklist lines (matching the file's existing format — read the top of the file for the exact bullet/checkbox style already in use) covering:
1. `card-address-update`'s `doc-existing-epic.label_hi` still says "मौजूदा" ("existing") — English was trimmed to drop "existing," Hindi should get the equivalent trim once a native speaker confirms natural phrasing.
2. `card-address-update`'s `timeline_hi` still reads the old four-clause sentence — English was split into four short sentences (STE-style); Hindi needs the equivalent split once phrasing is confirmed natural in Hindi (word-for-word translation of the English split may not read naturally).

- [ ] **Step 9: Verify with a build and lint**

Run: `npm run build`
Expected: builds clean, no errors.

Run: `npm run lint`
Expected: no new warnings/errors in `ActionCard.jsx` or `ActionCard.css`.

- [ ] **Step 10: Commit**

```bash
git add src/components/ActionCard.jsx src/components/ActionCard.css src/content/cards.json src/content/strings.en.json src/content/strings.hi.json "SecondBrain/Efforts/Personal/Vote Sahayak - Hindi Proofing Checklist.md"
git commit -m "Add progressive disclosure and copy trims to ActionCard"
```

---

### Task 2: ActionCard — interactive, non-persistent document checklist

**Files:**
- Modify: `src/components/ActionCard.jsx`
- Modify: `src/components/ActionCard.css`

**Interfaces:**
- Consumes: `detailsOpen` state and reset effect from Task 1 (extends the same `useEffect`).
- Produces: a `checkedDocs` `Set<string>` state (keyed by `doc.id`), and a `.doclist-heading.has-progress` / `.ready` ring in `ActionCard.css`, both consumed as-is by Task 3 (no changes needed there).

- [ ] **Step 1: Add checklist state and extend the reset effect**

In `src/components/ActionCard.jsx`, add near the other `useState` calls:
```js
  const [checkedDocs, setCheckedDocs] = useState(() => new Set())
```

Extend the effect from Task 1 Step 4 to also reset this (final shape of that effect after this task):
```js
  useEffect(() => {
    headlineRef.current?.focus()
    setDetailsOpen(false)
    setCheckedDocs(new Set())
  }, [card.id])
```

Add a small toggle function near the other handlers (e.g. after `handleSave`):
```js
  function toggleDocChecked(docId) {
    setCheckedDocs((prev) => {
      const next = new Set(prev)
      if (next.has(docId)) next.delete(docId)
      else next.add(docId)
      return next
    })
  }
```

- [ ] **Step 2: Replace the "Documents needed" heading with the progress-ring version**

Find:
```jsx
        {card.document_requirements.length > 0 && (
          <>
            <div className="doclist-heading">{t('card.documentsNeeded')}</div>
            <ul className="receipt-doclist">
              {card.document_requirements.map((doc) => (
                <li key={doc.id}>
                  <span className="box" />
                  <span>
                    {activeLang === 'hi' ? doc.label_hi : doc.label_en}
                    {doc.any_one_of && <span className="any-one-of">{t('card.documentsAnyOneOf')}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
```

Replace with:
```jsx
        {card.document_requirements.length > 0 && (
          <>
            <div className="doclist-heading has-progress">
              <span>{t('card.documentsNeeded')}</span>
              <DocProgressRing total={card.document_requirements.length} checked={checkedDocs.size} label={t('card.ready')} />
            </div>
            <ul className="receipt-doclist">
              {card.document_requirements.map((doc) => {
                const labelId = `doc-label-${card.id}-${doc.id}`
                return (
                  <li key={doc.id}>
                    <input
                      type="checkbox"
                      id={`doc-check-${card.id}-${doc.id}`}
                      className="box"
                      checked={checkedDocs.has(doc.id)}
                      onChange={() => toggleDocChecked(doc.id)}
                      aria-labelledby={labelId}
                    />
                    <span id={labelId}>
                      {activeLang === 'hi' ? doc.label_hi : doc.label_en}
                      {doc.any_one_of && <span className="any-one-of">{t('card.documentsAnyOneOf')}</span>}
                    </span>
                  </li>
                )
              })}
            </ul>
          </>
        )}
```

Note this uses a real `<input type="checkbox">` rather than the mockup's custom `<button role="checkbox">` — native checkboxes get keyboard and screen-reader semantics for free, which is more robust than re-implementing `aria-checked` handling by hand for a genuinely interactive control. It's styled via `appearance: none` in Step 4 below to keep the exact same square-box visual the mockup and the current app already use.

- [ ] **Step 3: Add the `DocProgressRing` component**

At the bottom of `src/components/ActionCard.jsx`, after the existing `WhatsAppIcon` function, add:

```js
const RING_RADIUS = 7.5
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function DocProgressRing({ total, checked, label }) {
  const offset = RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * checked) / total
  return (
    <span className="ready">
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <circle className="track" cx="10" cy="10" r={RING_RADIUS} fill="none" strokeWidth="2.4" />
        <circle
          className="fill"
          cx="10"
          cy="10"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
      </svg>
      <span aria-live="polite">
        <span className="num">{checked}</span>/<span className="num">{total}</span> {label}
      </span>
    </span>
  )
}
```

(This renders "1/2 ready" rather than the mockup's "1 of 2 ready" — deliberately, so the Hindi string doesn't need English word order. See the plan's Global Constraints.)

- [ ] **Step 4: Add the CSS for the ring and the styled checkbox**

In `src/components/ActionCard.css`, add:

```css
.doclist-heading.has-progress {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.ready {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-transform: none;
  letter-spacing: 0;
  font-size: 12px;
  color: var(--ink-secondary);
  font-weight: 500;
}
.ready svg {
  width: 20px;
  height: 20px;
  display: block;
  transform: rotate(-90deg);
}
.ready .track {
  stroke: var(--border-strong);
}
.ready .fill {
  stroke: var(--accent);
  transition: stroke-dashoffset 0.25s ease-out;
}

.receipt-doclist input.box {
  appearance: none;
  -webkit-appearance: none;
  width: 15px;
  height: 15px;
  border: 1.5px solid var(--border-strong);
  border-radius: 4px;
  flex: none;
  margin: 2px 0 0;
  padding: 0;
  cursor: pointer;
  background: transparent;
  position: relative;
}
.receipt-doclist input.box:checked {
  background: var(--accent);
  border-color: var(--accent);
}
.receipt-doclist input.box:checked::after {
  content: '';
  position: absolute;
  left: 3px;
  top: 0px;
  width: 5px;
  height: 8px;
  border: solid var(--on-accent);
  border-width: 0 1.8px 1.8px 0;
  transform: rotate(40deg);
}

@media (prefers-reduced-motion: reduce) {
  .ready .fill {
    transition: none;
  }
}
```

The existing `.receipt-doclist .box` rule (for the old decorative `<span class="box" />`) can stay in the file even though it's now dead for this component — check whether anything else in the app renders a bare `.box` span before removing it; if nothing else does, delete the old rule instead of leaving unused CSS.

- [ ] **Step 5: Verify with a build and lint**

Run: `npm run build`
Expected: builds clean.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/ActionCard.jsx src/components/ActionCard.css
git commit -m "Make ActionCard's document checklist interactive with a progress ring"
```

---

### Task 3: ActionCard — two-screen split (prepare → steps)

**Files:**
- Modify: `src/components/ActionCard.jsx`
- Modify: `src/components/ActionCard.css`

**Interfaces:**
- Consumes: the reset effect from Tasks 1–2 (extends it once more).
- Produces: a `screen` state (`'prepare' | 'steps'`), and two `hidden`-toggled wrapper elements around the existing JSX. Task 4 depends on these `hidden` attributes existing.

- [ ] **Step 1: Add screen state, extend the reset effect, and a screen-change focus effect**

Add:
```js
  const [screen, setScreen] = useState('prepare')
```

Extend the Task 1/2 reset effect to its final shape:
```js
  useEffect(() => {
    headlineRef.current?.focus()
    setDetailsOpen(false)
    setCheckedDocs(new Set())
    setScreen('prepare')
  }, [card.id])
```

Add a new effect, right after it, that moves focus to whichever screen becomes active (mirrors the existing headline-focus pattern, but fires on `screen` changes, not `card.id` changes):
```js
  const stepsHeadingRef = useRef(null)
  useEffect(() => {
    if (screen === 'steps') stepsHeadingRef.current?.focus()
    else headlineRef.current?.focus()
  }, [screen])
```

- [ ] **Step 2: Wrap Screen 1's content and add the Continue button**

Everything from the `receipt-tag` span through the end of the document checklist `<ul>` (i.e., everything already in the component before the `<ol className="receipt-steps">`) gets wrapped in a `hidden`-controlled `<div>`, with a Continue button appended at the end. Find the opening of the return JSX:

```jsx
  return (
    <div className="receipt" ref={cardRef}>
      <div className="receipt-inner">
        <span className="receipt-tag">{tagSuffix ? `${tag} · ${tagSuffix}` : tag}</span>
```

Change to:
```jsx
  return (
    <div className="receipt" ref={cardRef}>
      <div className="receipt-inner">
      <div hidden={screen !== 'prepare'}>
        <span className="receipt-tag">{tagSuffix ? `${tag} · ${tagSuffix}` : tag}</span>
```

Then find the end of the document checklist (the closing of the `card.document_requirements.length > 0 && (...)` block from Task 2), and immediately after it, before the `<ol className="receipt-steps">` line, insert:
```jsx
        <div className="receipt-actions">
          <button type="button" className="btn-primary" onClick={() => setScreen('steps')}>
            {t('wizard.continue')}
          </button>
        </div>
      </div>
```
(closing the `hidden` wrapper div opened in this step).

- [ ] **Step 3: Wrap Screen 2's content with its own back header**

Immediately after the closing `</div>` from Step 2, before `<ol className="receipt-steps">`, open the screen-2 wrapper:
```jsx
      <div hidden={screen !== 'steps'}>
        <div className="app-header card-steps-header">
          <button type="button" className="back" onClick={() => setScreen('prepare')} aria-label={t('wizard.back')}>
            ‹
          </button>
          <h1 className="title" ref={stepsHeadingRef} tabIndex={-1}>
            {t('card.steps')}
          </h1>
        </div>
        <ol className="receipt-steps">
```

Then find the closing `</ol>` and everything after it up to (and including) the existing `.receipt-actions` block at the very end of the component (the WhatsApp share button), and close the screen-2 wrapper right after that block's closing `</div>`:
```jsx
        <div className="receipt-actions">
          <button type="button" className="btn-wa" onClick={handleShare}>
            <WhatsAppIcon />
            {t('card.shareWhatsapp')}
          </button>
        </div>
      </div>
```

The stamp-row and `.receipt-footer` blocks (between `</ol>` and this final `.receipt-actions`) stay exactly where they are today — inside this screen-2 wrapper, unchanged.

- [ ] **Step 4: Add the new `card.steps` translation key**

In `src/content/strings.en.json`, add after `card.shareWhatsapp`:
```json
  "card.steps": "Steps",
```
In `src/content/strings.hi.json`, add after `card.shareWhatsapp`:
```json
  "card.steps": "चरण",
```

- [ ] **Step 5: Add print-safety CSS for hidden content**

The existing `@media print` block in `ActionCard.css` hides everything except `.receipt` and its children via `visibility: visible`, but `visibility` does not override an element's own `hidden` attribute (which sets `display: none`). Without a fix, printing a card open to Screen 2 would print a blank Screen 1 region and vice versa. Add this rule inside the existing `@media print { ... }` block, right after the `.receipt, .receipt * { visibility: visible; }` rule:

```css
  .receipt [hidden] {
    display: block !important;
  }
```

- [ ] **Step 6: Add CSS for the screen-2 header and Continue button spacing**

Add to `ActionCard.css`:
```css
.card-steps-header {
  margin: -4px 0 4px;
}
```
(`.btn-primary` and `.app-header`/`.back`/`.title` styles already exist in `shared.css`, imported by `ActionCard.jsx`'s sibling components — confirm `ActionCard.jsx` already imports `./shared.css`; if not, add `import './shared.css'` alongside the existing `import './ActionCard.css'` line, since `.btn-primary` and `.app-header` are defined there, not in `ActionCard.css`.)

- [ ] **Step 7: Verify with a build and lint**

Run: `npm run build`
Expected: builds clean.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/ActionCard.jsx src/components/ActionCard.css src/content/strings.en.json src/content/strings.hi.json
git commit -m "Split ActionCard into a two-screen prepare/steps flow"
```

---

### Task 4: Share-image capture and offline snapshot safety for hidden content

**Files:**
- Modify: `src/lib/shareCard.js`

**Interfaces:**
- Consumes: the `hidden` attributes introduced in Task 3.
- Produces: no change to `renderCardAsFile`'s exported signature — same `(cardNode) => Promise<File|null>`.

**Why this task exists:** `renderCardAsFile` captures whatever is in the live DOM under `cardRef`. After Task 3, the DOM always contains both screens' content (never conditionally unmounted — see Global Constraints) but one of them has the `hidden` attribute, which `html-to-image` respects (a hidden element has no box to capture). Without this fix, a share triggered while on Screen 1 would produce an image missing the steps/seal/footer, and one triggered from Screen 2 would be missing the headline/meaning. The shared "parchi" must always be the complete card, matching its pre-refresh behavior — this project has a documented history of exactly this class of bug (see the comments already in `shareCard.js` about the transparent-capture and black-image incidents), so this needs care, not a quick patch.

- [ ] **Step 1: Un-hide hidden content in the clone before capture**

In `src/lib/shareCard.js`, inside `prepareLightClone`, find:

```js
  // Strip interactive-only controls — same exclusion list the print
  // stylesheet already uses (ActionCard.css's `@media print`), reused here
  // rather than invented fresh: Listen/Open/Save/Share buttons do nothing
  // in a static image and shouldn't appear in one (confirmed live: a real
  // share came back with the full "Open ↗ / Save / Share on WhatsApp"
  // button stack baked into the picture).
  clone.querySelectorAll('.listen-btn, .step-act, .receipt-actions').forEach((el) => el.remove())
```

Add immediately before it:
```js
  // ActionCard now keeps both its "prepare" and "steps" screens (and the
  // "Show details" panel) permanently in the DOM and toggles visibility via
  // the `hidden` attribute, rather than conditionally unmounting either —
  // specifically so this function always has the complete card to capture,
  // regardless of which screen or disclosure state the live UI is showing.
  // html-to-image respects `hidden` (a hidden element has no layout box), so
  // without this, a share triggered on Screen 1 would silently omit the
  // steps/seal/footer, and one triggered on Screen 2 would omit the
  // headline/meaning. Un-hide everything on the clone only — the live page
  // is untouched.
  clone.querySelectorAll('[hidden]').forEach((el) => el.removeAttribute('hidden'))
```

The `.receipt-actions` removal line right after this already strips the Continue button (Screen 1) and the WhatsApp/Save/Share buttons — no change needed there, it already covers the new Continue button since it's inside a `.receipt-actions` div per Task 3 Step 2.

- [ ] **Step 2: Check `savedCards.js` for the same assumption**

Read `src/lib/savedCards.js`. It stores `payload_snapshot` (the raw card data object, not a DOM snapshot) and `App.jsx` re-renders a live `<ActionCard card={activeSavedCard.payload_snapshot} forms={forms} />` from it — so a re-rendered saved card gets a fresh `ActionCard` instance with `screen`/`detailsOpen`/`checkedDocs` all at their defaults (Screen 1, collapsed, unchecked), exactly like any other card. Confirm this by reading the component: there's no DOM-snapshot logic to fix here, only data. No code change needed for this step — it's a verification step, not an edit. If `savedCards.js` turns out to store anything DOM- or screen-state-related (it shouldn't, based on the current schema), stop and flag it before continuing.

- [ ] **Step 3: Manual verification of the capture fix**

This is the one place in this plan where a manual, real-browser check is required before moving on — the project's own history shows this exact function has broken in ways that only show up in an actual rendered capture, not in code review. Run:

```bash
npm run dev
```

Using the Chrome browser tool (`claude-in-chrome`), navigate to the local dev server, walk into the "Correct my details" or "Update my address" wizard flow to reach an ActionCard, and:
1. On Screen 1 (default), open the browser's console and run the app's own share path indirectly by clicking "Continue" then "Share on WhatsApp" is not testable end-to-end without a real WhatsApp target — instead use `javascript_tool` to call `renderCardAsFile` directly against the live `cardRef` DOM node (it's the `.receipt` element) while the UI is sitting on Screen 1, save the resulting blob, and inspect it (non-transparent, contains recognizable steps/seal text, not just headline/meaning).
2. Repeat with the UI sitting on Screen 2, and again with "Show details" expanded.
3. Confirm all three captures are visually identical (same complete card), regardless of which screen/disclosure state was active when capture was triggered.

Expected: all three renders show the complete card (headline, meaning, checklist, steps, seal, footer) — none are missing a section.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shareCard.js
git commit -m "Keep WhatsApp share image complete regardless of ActionCard's screen/disclosure state"
```

---

### Task 5: Wizard — accessible check glyph on selected multi-select chips

**Files:**
- Modify: `src/components/Wizard.jsx`
- Modify: `src/components/Wizard.css`

**Interfaces:** None — fully self-contained, no state changes, touches only the multi-select chip's rendered markup.

**Why:** confirmed via the Wizard mockup review — today a selected multi-select chip is signaled by fill color and a font-weight bump only, which fails WCAG 1.4.1 (color/weight alone is not a sufficient non-text cue). Single-select chips auto-advance on tap and are never shown in a "selected" resting state, so they don't need this.

- [ ] **Step 1: Add the check glyph to selected multi-select chips**

In `src/components/Wizard.jsx`, find:
```jsx
      <div className={`chip-row${!currentQuestion.multi_select && currentOptions.length === 2 ? ' stacked' : ''}`}>
        {currentOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`chip${selected.includes(option.id) ? ' sel' : ''}`}
            aria-pressed={currentQuestion.multi_select ? selected.includes(option.id) : undefined}
            onClick={() => (currentQuestion.multi_select ? toggleMultiSelect(option.id) : handleSingleChoice(option))}
          >
            {activeLang === 'hi' ? option.label_hi : option.label_en}
          </button>
        ))}
      </div>
```

Replace the button's children with:
```jsx
          >
            {currentQuestion.multi_select && selected.includes(option.id) && (
              <svg className="chip-check" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 5.2l2.2 2.2L8.2 3" />
              </svg>
            )}
            {activeLang === 'hi' ? option.label_hi : option.label_en}
          </button>
```

- [ ] **Step 2: Add the CSS**

In `src/components/Wizard.css`, add after the `.chip.sel` rule:
```css
.chip-check {
  width: 10px;
  height: 10px;
  display: inline-block;
  vertical-align: -1px;
  margin-right: 5px;
}
```

- [ ] **Step 3: Verify with a build and lint**

Run: `npm run build`
Expected: builds clean.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/Wizard.jsx src/components/Wizard.css
git commit -m "Add a non-color check glyph to selected Wizard multi-select chips"
```

---

### Task 6: Cross-call-site verification

**Files:** none modified — this task only verifies Tasks 1–5 across every real place `ActionCard` is rendered.

**Why a separate task:** `ActionCard` is rendered from three different parents (`Wizard.jsx`, `SirFlow.jsx`, `App.jsx`'s saved-card view), each of which already renders its own `.app-header` with a back button above `ActionCard`. Task 3 adds a *second*, inner `.app-header` (the "‹ Steps" header) that only appears once the user reaches Screen 2 — this is the approved mockup design, but stacking two headers is worth eyeballing for real across all three call sites before calling this done, plus RTL/light/dark are all real production surfaces for this app.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (leave running for this whole task)

- [ ] **Step 2: Walk the Wizard call site**

Using the Chrome browser tool, drive the "Correct my details" flow (2 questions) or "Update my address" (1 question) through to its ActionCard. Verify:
- Screen 1 shows tag/headline/meaning/"Show details"/checklist/Continue.
- Tapping "Show details" expands the meta block and rejection tags in place, without layout jump elsewhere.
- Tapping a document checkbox updates the ring and the "n/2 ready" count live.
- Tapping Continue moves to Screen 2; focus lands on the "Steps" heading (check via the browser tool's accessibility read, not just visually).
- The outer Wizard header ("‹ [Task title]") and the inner "‹ Steps" header both render, stacked, without visual collision.
- Tapping the inner back arrow returns to Screen 1 with the checklist state preserved (still shows what was checked); tapping the outer Wizard back arrow instead revises the previous answer, as before.

- [ ] **Step 3: Walk the SirFlow call site**

Reach a SIR outcome ActionCard (`extraRows`/`tagSuffix` populated) via the SIR-check flow. Verify the same points as Step 2, plus: the `extraRows` (name checked / state checked) still render on Screen 1, positioned right after the meaning paragraph and before "Show details", exactly as in the pre-refresh layout.

- [ ] **Step 4: Walk the saved-card (App.jsx) call site**

From Home, go offline (or use a previously saved card) to reach the `view === 'savedCard'` path in `App.jsx`. Verify the same Screen 1/Screen 2 behavior renders correctly here too, including the double-header stacking (App.jsx's own header says "Saved Cards" or similar, plus the inner "Steps" header on Screen 2).

- [ ] **Step 5: Theme and language check**

Toggle dark mode (OS-level or however this project's dev environment forces it) and confirm the disclosure button, meta block border, progress ring, and checkbox all use theme-correct colors (no hardcoded light-only values slipped through). Switch the app to Hindi and confirm: the new UI labels (`card.showDetails`, `card.hideDetails`, `card.ready`, `card.steps`) render their Hindi strings; the untouched `timeline_hi`/`doc-existing-epic.label_hi` still read the old (pre-trim) Hindi wording, which is expected until the Hindi proofing pass.

- [ ] **Step 6: Re-run the share-image regression check across all three kinds**

This project has prior precedent for exactly this kind of check (see this repo's git history around the "cross-flow verification" work). Using `javascript_tool` against the running dev server, call `renderCardAsFile()` against one card of each kind (`wizard-result`, `sir-outcome`, `sir-notice`) with the live UI in a mix of screen/disclosure states, and confirm each output PNG is non-transparent and visually complete (not blank, not missing a section). This does not need to be a formal committed script — an ad-hoc `javascript_tool` snippet run against the live page is sufficient and matches how this exact check was done previously in this project.

- [ ] **Step 7: Stop the dev server**

- [ ] **Step 8: Report findings**

If everything in Steps 2–6 passed, note that in the PR description (Task 7). If anything failed, fix it as part of the relevant earlier task (Task 1–5) — do not patch it ad hoc in this task — then re-run the affected verification steps here before proceeding.

---

### Task 7: Open the PR

**Files:** none modified.

Per this project's locked workflow rule (confirmed in project memory): nothing merges to `master` automatically. This task only opens a PR; the user merges on their own schedule, same as every prior step of this project's build.

- [ ] **Step 1: Push the branch**

```bash
git push -u origin <branch-name>
```

(Use whatever branch name was created when this plan's execution started — see the chosen execution approach's branch-naming convention.)

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "ActionCard progressive disclosure, two-screen split, and Wizard chip accessibility fix" --body "$(cat <<'EOF'
## Summary
- ActionCard: "Show details" disclosure for timeline/verified/source/rejection reasons (collapsed by default), an interactive non-persisted document checklist with a progress ring, and a two-screen prepare/steps split — all reviewed first as static HTML mockups (mockups/actioncard-refresh-v1.html) before this port.
- ActionCard: STE-style copy trim on the address-update card's timeline text and one document label; the ordinarily-resident rejection caveat is now visually demoted to a footnote rather than equal-weight text.
- shareCard.js: the WhatsApp share-image capture now always un-hides the full card before rendering, so the shared image stays complete regardless of which screen/disclosure state was showing live — this project has a documented history of capture bugs in exactly this function, see the code comments.
- Wizard: selected multi-select chips get a non-color check glyph (WCAG 1.4.1 fix); no structural change — confirmed with the user that a step-progress indicator was NOT wanted, since real flows are only 1-2 questions and the codebase has a standing, deliberate decision against a progress bar.
- Two Hindi proofing checklist items added for the English-only copy trims in this PR.

## Test plan
- [ ] `npm run build` and `npm run lint` clean
- [ ] Manually walked all three ActionCard call sites (Wizard, SirFlow, saved-card view) in the browser, both themes, both languages
- [ ] Verified the WhatsApp share-image capture is complete regardless of screen/disclosure state, for all three card kinds
- [ ] Verified focus moves correctly between Screen 1 and Screen 2

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Report the PR URL back to the user.** Do not merge.
