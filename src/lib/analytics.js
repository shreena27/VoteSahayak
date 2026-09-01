// The Implementation Plan's full event allowlist (Phase 1 step 5) — nothing
// else gets tracked, ever. Each entry below is the only way to fire that
// event, so a typo'd event name is an import error, not a silent bad string
// reaching Mixpanel. Some of these have no real trigger point yet (the
// wizard, SIR flow, and chat don't exist until Phase 2/3) — see the
// "not yet wired" comment on each for exactly which later step wires it up.
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
  import('mixpanel-browser').then(({ default: mixpanel }) => {
    mixpanel.init(token, {
      // No user identifiers beyond Mixpanel's own anonymous distinct_id —
      // this product's whole trust thesis rests on not collecting more than
      // it needs. autocapture off is what actually enforces "nothing else
      // gets tracked" at the SDK level, not just at the call-site level
      // below.
      autocapture: false,
      track_pageview: false,
      ip: false,
      persistence: 'localStorage',
      // `autocapture:false`/`ip:false` alone don't stop Mixpanel's default
      // super-properties ($current_url, $referrer, etc.) from riding along
      // on every event — confirmed on the wire in the Phase 1 step 5 review.
      // Harmless while the app is a single "/" route, but the wizard this
      // step adds is exactly the kind of UI that could put state in a query
      // string later, which would then reach Mixpanel with no code change
      // and no review. Blacklisted here as defense in depth (the wizard
      // itself is also built to keep step/answer state out of the URL in
      // the first place, so this should stay a no-op belt-and-braces check,
      // not the only thing standing between user state and analytics).
      property_blacklist: ['$current_url', '$referrer', '$referring_domain', '$initial_referrer', '$initial_referring_domain'],
    })
    client = mixpanel
    for (const [eventName, props] of queue) client.track(eventName, props)
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

// --- Defined now, not yet wired — each function below is fully correct and
// ready to call, but has no real caller yet: the UI it belongs to (wizard,
// SIR flow, chat) doesn't exist in the codebase until the listed later step
// builds it. Import and call these directly when that step lands, rather
// than re-defining the event. ---

/** @param {string} flowName — Phase 2 step 9 (SIR flow) / step 7 (wizard engine) */
export function trackFlowStarted(flowName) {
  track('flow_started', { flow: flowName })
}

/**
 * @param {string} task
 * @param {number} step
 * Phase 2 step 11 (wizard funnel events).
 */
export function trackWizardStep(task, step) {
  track('wizard_step', { task, step })
}

/** @param {string} outcome — Phase 2 step 9 (SIR flow's 5-outcome picker) */
export function trackSirOutcomePicked(outcome) {
  track('sir_outcome_picked', { outcome })
}

/** Phase 3 step 12 (Chunav Saathi chat UI). */
export function trackChatOpened() {
  track('chat_opened', {})
}

/** Phase 3 step 14 (/api/ask). */
export function trackChatAsked() {
  track('chat_asked', {})
}

/** Phase 3 step 14 (/api/ask's below-threshold fallback path). */
export function trackChatFallback() {
  track('chat_fallback', {})
}

/** @param {string} which — Phase 2 step 9, wherever the SIR flow's outbound official link lands */
export function trackOfficialLinkTapped(which) {
  track('official_link_tapped', { which })
}
