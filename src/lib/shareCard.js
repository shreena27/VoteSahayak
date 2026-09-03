import { toCanvas } from 'html-to-image'

const RENDER_TIMEOUT_MS = 4000

// The page background the card sits on in the live app (tokens.css --bg).
// The rendered PNG is flattened onto this so it has no alpha channel at
// all: WhatsApp re-encodes shared images to JPEG and composites every
// transparent pixel to solid black (confirmed on a real received file),
// which would otherwise turn the card's rounded corners and torn bottom
// edge into black artifacts — or, when the whole capture was transparent
// (the bug below), into an entirely black image.
const SHARE_BACKDROP = '#F7F2E7'

// The exact light-theme values from src/tokens.css's base :root block —
// every custom property the Action Card and its buttons actually consume.
// Keep in sync with tokens.css if that palette changes.
//
// Why duplicate them here: a shared card is viewed by whoever it's shared
// with, on their own device, not the sender's — its appearance shouldn't
// depend on the sender's current OS/browser theme (a real paper receipt
// doesn't have a dark mode). Forcing these directly onto a detached clone
// before rendering also sidesteps relying on html-to-image to correctly
// resolve :root-level dark-mode overrides during its own style pass, which
// is a known source of capture bugs in this class of library (confirmed:
// a real-device share came back dark-themed with unreadable text).
const LIGHT_CARD_TOKENS = {
  '--surface': '#FFFFFF',
  '--surface-alt': '#EFE7D3',
  '--ink': '#211C15',
  '--ink-secondary': '#57503E',
  '--ink-muted': '#6E6752',
  '--border': '#E0D4B4',
  '--border-strong': '#CBBB8E',
  '--accent': '#4A2E8C',
  '--accent-ink': '#3A2470',
  '--accent-soft': '#ECE6F7',
  '--on-accent': '#FFFFFF',
  '--amber-soft': '#F7EDD8',
  '--amber-ink': '#8C6018',
  '--ok': '#3E7A57',
  '--on-ok': '#FFFFFF',
  '--radius': '14px',
  '--shadow-lift': '0 2px 4px rgba(33,28,21,.08), 0 16px 32px -16px rgba(33,28,21,.28)',
}

/**
 * Clones `node`, pins it to the light palette regardless of the live page's
 * current theme, and lays it out off-screen (not display:none/
 * visibility:hidden — html-to-image needs a real layout box to measure).
 * Returns the clone to capture plus the wrapper the caller must remove from
 * the DOM when done.
 * @param {HTMLElement} node
 * @returns {{ clone: HTMLElement, wrapper: HTMLElement }}
 */
function prepareLightClone(node) {
  const clone = node.cloneNode(true)
  for (const [prop, value] of Object.entries(LIGHT_CARD_TOKENS)) {
    clone.style.setProperty(prop, value)
  }
  // The custom-property overrides above only change what var(--x) resolves
  // to *inside* the clone's own subtree. .receipt itself never declares its
  // own `color` — on the real page it's inherited from `body { color:
  // var(--ink) }`. A clone appended under document.body inherits color from
  // the live, currently-themed body instead, so the --ink override above
  // alone silently does nothing for text color. Setting `color` explicitly
  // here is what actually breaks that inherited chain (confirmed: without
  // this line, the clone's background correctly forced to light while its
  // text stayed the live theme's color — invisible on a light background).
  clone.style.color = 'var(--ink)'

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
  //
  // This runs before the interactive-controls strip below, but the two
  // selectors don't target each other's matches (neither depends on
  // `hidden` state), so the two calls are order-independent — swapping them
  // would produce the same clone.
  clone.querySelectorAll('[hidden]').forEach((el) => el.removeAttribute('hidden'))

  // Strip interactive-only controls — same exclusion list the print
  // stylesheet already uses (ActionCard.css's `@media print`), reused here
  // rather than invented fresh: Listen/Open/Save/Share buttons do nothing
  // in a static image and shouldn't appear in one (confirmed live: a real
  // share came back with the full "Open ↗ / Save / Share on WhatsApp"
  // button stack baked into the picture). `.card-steps-header .back` is
  // included for the same reason: before Screen 2 was un-hidden above, its
  // "‹" back button never reached a capture (Screen 2 was always hidden at
  // the pre-render effect's mount-time call), so this is the first render
  // where it would otherwise show up baked into the middle of the image.
  // The `<h1>` "Steps" heading in the same header is intentionally left in
  // place — it reads as a legitimate section label, not a dead control.
  clone
    .querySelectorAll('.listen-btn, .step-act, .receipt-actions, .card-steps-header .back')
    .forEach((el) => el.remove())

  // .receipt's paper-grain texture is an SVG data-URL whose <rect> has no
  // fill and relies on filter="url(#n)" to become faint noise. Inside
  // html-to-image's own SVG-as-image render that filter reference does not
  // resolve, so the rect paints with SVG's default fill — solid black —
  // tiled over the whole card, hiding the dark ink text (confirmed in a
  // headless Chrome capture in *light* colour scheme: 1.46M near-black
  // pixels with the grain, 102 without). Drop it for the share render,
  // exactly as the print stylesheet already does; at 4.5% alpha it is
  // invisible after WhatsApp's JPEG re-encode anyway.
  clone.style.backgroundImage = 'none'

  // Off-screen placement goes on a WRAPPER, never on the clone itself.
  // html-to-image copies every *computed* style of the captured node onto
  // its internal copy inside an SVG <foreignObject>, so `position: fixed;
  // left: -99999px` set directly on the clone was carried into the capture
  // and laid the card out 99999px outside the SVG viewport — a fully
  // transparent PNG (confirmed: 0 opaque pixels, identical byte size to a
  // blank canvas of the same dimensions). The wrapper is not part of the
  // capture, so the clone keeps .receipt's own `position: relative` and
  // renders at 0,0.
  const wrapper = document.createElement('div')
  wrapper.style.position = 'fixed'
  wrapper.style.top = '0'
  wrapper.style.left = '-99999px'
  wrapper.style.width = `${node.getBoundingClientRect().width}px`
  wrapper.appendChild(clone)
  document.body.appendChild(wrapper)
  return { clone, wrapper }
}

/**
 * Races `promise` against a timeout. html-to-image's `toPng` can hang
 * indefinitely in some environments rather than reject (confirmed live: a
 * real click left it unsettled 70+ seconds with no error and no UI
 * feedback) — a plain try/catch does not catch a promise that never
 * settles, so every caller of a render needs this guard.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('render-timeout')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

/**
 * Waits for webfonts to finish loading and for the browser to paint at
 * least one frame before capturing. Capturing before `document.fonts.ready`
 * settles is a documented way to get an incomplete canvas from this library
 * (bubkoo/html-to-image issues #488, #155), and `renderCardAsFile` fires
 * from a `useEffect` on the card's mount — the earliest possible moment,
 * racing the self-hosted Devanagari webfont's load. Cheap insurance, kept.
 *
 * Note: this was NOT the cause of the real-device "solid black image"
 * report — that was a fully transparent capture (see prepareLightClone)
 * that WhatsApp's JPEG re-encode turned black. Also: requestAnimationFrame
 * never fires in a hidden/background tab, so this (and html-to-image's own
 * internal rAF) can stall there — which is exactly what RENDER_TIMEOUT_MS
 * guards against.
 * @returns {Promise<void>}
 */
async function waitForPaintReady() {
  if (document.fonts?.ready) {
    await document.fonts.ready
  }
  // Two rAFs: the first callback runs before the next paint, the second
  // runs only after that paint has actually happened.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

/**
 * Renders `cardNode` to a shareable PNG File, or null if rendering fails or
 * exceeds RENDER_TIMEOUT_MS. Safe to call ahead of time (e.g. in a
 * background effect) so a later `shareCard()` call already has a
 * `precomputedFile` ready and doesn't need to await a render itself.
 * @param {HTMLElement} cardNode
 * @returns {Promise<File|null>}
 */
export async function renderCardAsFile(cardNode) {
  const { clone, wrapper } = prepareLightClone(cardNode)
  try {
    const rendered = await withTimeout(
      waitForPaintReady().then(() => toCanvas(clone, { pixelRatio: 2 })),
      RENDER_TIMEOUT_MS,
    )
    // Flatten onto an opaque backdrop (see SHARE_BACKDROP). Not done via
    // html-to-image's own `backgroundColor` option: that also overwrites the
    // captured node's background-color, which would repaint the card's
    // white paper surface as the page colour.
    const flat = document.createElement('canvas')
    flat.width = rendered.width
    flat.height = rendered.height
    const ctx = flat.getContext('2d')
    ctx.fillStyle = SHARE_BACKDROP
    ctx.fillRect(0, 0, flat.width, flat.height)
    ctx.drawImage(rendered, 0, 0)
    const blob = await new Promise((resolve, reject) =>
      flat.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob-null'))), 'image/png'),
    )
    return new File([blob], 'vote-sahayak-card.png', { type: 'image/png' })
  } catch {
    return null
  } finally {
    wrapper.remove()
  }
}

/**
 * Shares a card. Prefers the Web Share API with an image (so the card looks
 * like itself when it lands in WhatsApp), falls back to a plain WhatsApp
 * intent link when Web Share isn't available, the image isn't ready, or
 * sharing fails — matching this project's own distribution thesis
 * (screenshot/share-to-WhatsApp is the real channel, so the fallback must
 * always work even with zero API support).
 *
 * `precomputedFile` must already be resolved (from an earlier,
 * non-blocking `renderCardAsFile()` call) — this function does not render
 * or await anything before its first `navigator.share()`/fallback call, by
 * design: iOS Safari revokes the click's user-activation gesture across an
 * `await`, so rendering an image *inside* this function would silently
 * break sharing on iOS. When no image is ready yet, this shares text-only
 * immediately rather than waiting, so Share always responds instantly.
 *
 * @param {{ headline: string, waText: string, precomputedFile?: File|null }} content
 * @returns {Promise<'shared'|'whatsapp-fallback'>}
 */
export async function shareCard({ headline, waText, precomputedFile = null }) {
  if (navigator.share) {
    try {
      if (precomputedFile && navigator.canShare?.({ files: [precomputedFile] })) {
        await navigator.share({ files: [precomputedFile], title: headline, text: headline })
      } else {
        await navigator.share({ title: headline, text: waText })
      }
      return 'shared'
    } catch (err) {
      // AbortError = the person just cancelled the native share sheet; not a failure.
      if (err?.name === 'AbortError') return 'shared'
      // Otherwise fall through to the WhatsApp link below.
    }
  }

  openWhatsAppFallback(waText)
  return 'whatsapp-fallback'
}

function openWhatsAppFallback(text) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
}
