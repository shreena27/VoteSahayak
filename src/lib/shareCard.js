import { toPng } from 'html-to-image'

const RENDER_TIMEOUT_MS = 4000

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
 * Caller must remove the returned element from the DOM when done.
 * @param {HTMLElement} node
 * @returns {HTMLElement}
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
  clone.style.position = 'fixed'
  clone.style.top = '0'
  clone.style.left = '-99999px'
  document.body.appendChild(clone)
  return clone
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
 * Renders `cardNode` to a shareable PNG File, or null if rendering fails or
 * exceeds RENDER_TIMEOUT_MS. Safe to call ahead of time (e.g. in a
 * background effect) so a later `shareCard()` call already has a
 * `precomputedFile` ready and doesn't need to await a render itself.
 * @param {HTMLElement} cardNode
 * @returns {Promise<File|null>}
 */
export async function renderCardAsFile(cardNode) {
  const clone = prepareLightClone(cardNode)
  try {
    const dataUrl = await withTimeout(toPng(clone, { pixelRatio: 2 }), RENDER_TIMEOUT_MS)
    const blob = await (await fetch(dataUrl)).blob()
    return new File([blob], 'vote-sahayak-card.png', { type: 'image/png' })
  } catch {
    return null
  } finally {
    clone.remove()
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
