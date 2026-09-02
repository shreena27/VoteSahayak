import { toPng } from 'html-to-image'

const RENDER_TIMEOUT_MS = 4000

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
  try {
    const dataUrl = await withTimeout(toPng(cardNode, { pixelRatio: 2 }), RENDER_TIMEOUT_MS)
    const blob = await (await fetch(dataUrl)).blob()
    return new File([blob], 'vote-sahayak-card.png', { type: 'image/png' })
  } catch {
    return null
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
