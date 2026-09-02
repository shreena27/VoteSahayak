import { todayIsoDateIST } from '../content/schema.js'

// Device-local "keep this card" storage — the ERD's SAVED_CARD entity.
// Deliberately a distinct localStorage key from the language preference
// (voteSahayak.lang) so the two features can't clobber each other.
const SAVED_CARDS_KEY = 'voteSahayak.savedCards'

/**
 * @param {object} cardPayload - the full CARD_PAYLOAD, snapshotted as-is per
 *   the ERD's rule: "SAVED_CARD stores a full snapshot, not a reference, so
 *   a later content update never silently rewrites a card the citizen
 *   already relied on."
 * @returns {boolean} whether the save succeeded
 */
export function saveCard(cardPayload) {
  try {
    const existing = readSavedCards()
    const withoutDupe = existing.filter((entry) => entry.id !== cardPayload.id)
    const snapshot = {
      id: cardPayload.id,
      payload_snapshot: cardPayload,
      // IST calendar date, not raw UTC — this app's real users are IST-based,
      // and a raw new Date().toISOString() would show "yesterday" for up to
      // 5.5 hours of every IST day (UTC midnight lands 5:30 before IST
      // midnight).
      saved_on: todayIsoDateIST(),
    }
    window.localStorage.setItem(SAVED_CARDS_KEY, JSON.stringify([...withoutDupe, snapshot]))
    return true
  } catch {
    // localStorage can be unavailable (private mode, quota) — the card just
    // won't persist; the rest of the app keeps working.
    return false
  }
}

/** @returns {Array<{id: string, payload_snapshot: object, saved_on: string}>} */
export function readSavedCards() {
  try {
    const raw = window.localStorage.getItem(SAVED_CARDS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** @param {string} cardId */
export function isCardSaved(cardId) {
  return readSavedCards().some((entry) => entry.id === cardId)
}
