import { toPng } from 'html-to-image'

/**
 * Shares a rendered card. Prefers the Web Share API with an image (so the
 * card looks like itself when it lands in WhatsApp), falls back to a plain
 * WhatsApp intent link when Web Share isn't available or the image render
 * fails — matching this project's own distribution thesis (screenshot/
 * share-to-WhatsApp is the real channel, so the fallback must always work
 * even with zero API support).
 *
 * @param {HTMLElement} cardNode - the DOM node to render as an image
 * @param {{ headline: string, waText: string }} content
 * @returns {Promise<'shared'|'whatsapp-fallback'|'failed'>}
 */
export async function shareCard(cardNode, { headline, waText }) {
  if (navigator.share) {
    try {
      const file = await renderCardAsFile(cardNode)
      const canShareFile = file && navigator.canShare && navigator.canShare({ files: [file] })
      if (canShareFile) {
        await navigator.share({ files: [file], title: headline, text: headline })
        return 'shared'
      }
      await navigator.share({ title: headline, text: waText })
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

/** @returns {Promise<File|null>} */
async function renderCardAsFile(cardNode) {
  try {
    const dataUrl = await toPng(cardNode, { pixelRatio: 2 })
    const blob = await (await fetch(dataUrl)).blob()
    return new File([blob], 'vote-sahayak-card.png', { type: 'image/png' })
  } catch {
    return null
  }
}

function openWhatsAppFallback(text) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
}
