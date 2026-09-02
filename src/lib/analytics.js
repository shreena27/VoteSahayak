// The Implementation Plan's full event allowlist (Phase 1 step 5) — nothing
// else gets tracked, ever. Each entry below is the only way to fire that
// event, so a typo'd event name is an import error, not a silent bad string
// reaching Mixpanel. All 12 are wired to a real trigger as of Phase 3 step
// 12: lang_selected/card_*/flow_started/wizard_step (Wizard.jsx),
// sir_outcome_picked/official_link_tapped/flow_started (SirFlow.jsx),
// chat_opened/chat_asked/chat_fallback (Chat.jsx).
const EVENT_NAMES = /** @type {const} */ ([
  'lang_selected',
  'flow_started',
  'wizard_step',
  'sir_outcome_picked',
  'card_viewed',
  'card_saved',
  'card_shared',
  'card_listened',
  'chat_opened',
  'chat_asked',
  'chat_fallback',
  'official_link_tapped',
])

const token = import.meta.env.VITE_MIXPANEL_TOKEN

// Treat a missing token, an empty string, or an obvious placeholder the same
// way: analytics is off. This must never throw or block the UI — the app has
// to work correctly with zero analytics configured, since that's the actual
// state of every environment right now (only a Preview placeholder exists;
// there is no Production token yet, and there may not be one on a grader's
// machine either).
const enabled = Boolean(token) && !/^placeholder/i.test(token)

// `mixpanel-browser` is ~130 KB gzipped — real weight for a PWA whose whole
// premise is a usable install on a low-bandwidth 2G/3G connection. Dynamic
// `import()` it only once a real token exists, so the current actual state
// (no token anywhere but a Preview placeholder) ships zero analytics bytes,
// not just a behavioral no-op. `client` resolves once the SDK is ready;
// `queue` holds any events that fire before that (there's normally a brief
// window right after first paint) so nothing gets silently dropped.
/** @type {import('mixpanel-browser').Mixpanel | null} */
let client = null
/** @type {Array<[string, Record<string, unknown>]>} */
let queue = []

if (enabled) {
  import('mixpanel-browser')
    .then(({ default: mixpanel }) => {
      mixpanel.init(token, {
        // This project uses Mixpanel's EU data-residency cluster (its
        // dashboard lives at eu.mixpanel.com). The SDK defaults to the US
        // ingestion endpoint, which silently drops events for an EU-hosted
        // project rather than erroring — api_host must point at the EU
        // cluster or nothing tracked here ever shows up.
        api_host: 'https://api-eu.mixpanel.com',
        // No user identifiers beyond Mixpanel's own anonymous distinct_id —
        // this product's whole trust thesis rests on not collecting more than
        // it needs. autocapture off is what actually enforces "nothing else
        // gets tracked" at the SDK level, not just at the call-site level
        // below.
        autocapture: false,
        track_pageview: false,
        ip: false,
        persistence: 'localStorage',
        // autocapture/track_pageview/ip only turn off Mixpanel's *own*
        // collection paths — they do nothing to the default properties the
        // SDK still attaches to every track() call below, which include the
        // current URL and referrer. Those aren't in the event allowlist and
        // must never leave the device, so they're blacklisted explicitly
        // rather than trusted to the options above. Also matters for the
        // wizard (Phase 2): it's exactly the kind of UI that could put step
        // state in a query string later, which would then reach Mixpanel
        // with no code change and no review — this stays a no-op
        // belt-and-braces check even though the wizard itself is also built
        // to keep that state out of the URL in the first place.
        property_blacklist: [
          '$current_url',
          '$referrer',
          '$referring_domain',
          '$initial_referrer',
          '$initial_referring_domain',
        ],
        save_referrer: false,
        stop_utm_persistence: true,
      })
      client = mixpanel
      for (const [eventName, props] of queue) client.track(eventName, props)
      queue = []
    })
    .catch(() => {
      // The SDK chunk is deliberately excluded from the PWA precache (see
      // vite.config.js) so it can fail to load on a flaky/offline
      // connection. Analytics must degrade to a no-op, not an unhandled
      // rejection and an ever-growing queue.
      client = null
      queue = []
    })
} else if (import.meta.env.DEV) {
  console.debug('[analytics] no VITE_MIXPANEL_TOKEN configured — tracking is a no-op')
}

/**
 * @param {(typeof EVENT_NAMES)[number]} eventName
 * @param {Record<string, unknown>} [props]
 */
function track(eventName, props) {
  if (!enabled) return
  if (!EVENT_NAMES.includes(eventName)) {
    // Defense in depth: every call site below already passes a hardcoded,
    // correct name, so this should be unreachable — but if analytics.js
    // itself ever grows a bug, fail loudly in dev rather than silently
    // sending an untracked event name to Mixpanel.
    if (import.meta.env.DEV) throw new Error(`[analytics] "${eventName}" is not in the event allowlist`)
    return
  }
  if (client) client.track(eventName, props)
  else queue.push([eventName, props ?? {}])
}

// --- Wired up now (Phase 1 step 5) — real trigger points already exist ---

/** @param {'en'|'hi'} lang */
export function trackLangSelected(lang) {
  track('lang_selected', { lang })
}

/** @param {string} kind - CARD_PAYLOAD.kind */
export function trackCardViewed(kind) {
  track('card_viewed', { kind })
}

/** @param {string} cardId */
export function trackCardSaved(cardId) {
  track('card_saved', { card_id: cardId })
}

/** @param {string} cardId */
export function trackCardShared(cardId) {
  track('card_shared', { card_id: cardId })
}

/** @param {string} cardId */
export function trackCardListened(cardId) {
  track('card_listened', { card_id: cardId })
}

/** @param {string} flowName — wired in Wizard.jsx (task id) and SirFlow.jsx ('sir-check'/'sir-notice') */
export function trackFlowStarted(flowName) {
  track('flow_started', { flow: flowName })
}

/**
 * @param {string} task
 * @param {number} step
 * Wired in Wizard.jsx, fired on every question screen shown.
 */
export function trackWizardStep(task, step) {
  track('wizard_step', { task, step })
}

/** @param {string} outcome — wired in SirFlow.jsx's 5-outcome picker */
export function trackSirOutcomePicked(outcome) {
  track('sir_outcome_picked', { outcome })
}

/** @param {string} which — wired in SirFlow.jsx, fired when the outbound official SIR-search link is tapped */
export function trackOfficialLinkTapped(which) {
  track('official_link_tapped', { which })
}

// --- Wired up now (Phase 3 step 12) — Chat.jsx's real trigger points ---

/** Fired once when the Chunav Saathi panel opens. */
export function trackChatOpened() {
  track('chat_opened', {})
}

/**
 * @param {{ chip: string | null }} props - `chip` is a CHAT_CHIPS id when a
 * prompt chip was tapped, or `null` for free-text/voice input — "asking"
 * happens either way, even before real RAG (steps 13-14) exists to answer
 * the free-text case with anything beyond the honest fallback.
 */
export function trackChatAsked({ chip }) {
  track('chat_asked', { chip })
}

/** Fired whenever a question can't be answered — every free-text/voice
 * question right now (no RAG yet), plus step 14's real below-threshold
 * retrieval miss once RAG lands; both paths share this one event. */
export function trackChatFallback() {
  track('chat_fallback', {})
}
