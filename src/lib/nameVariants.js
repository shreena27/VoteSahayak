// Generates spelling-variation suggestions for the SIR name search — the
// real NVSP search is exact-match-sensitive (per this project's own live
// walkthrough history), so a citizen whose name is on the roll with slightly
// different spelling/formatting can still come back "not found" on their
// first try. This doesn't guess at what's actually on the roll; it just
// surfaces the handful of ways a full name commonly gets entered elsewhere,
// so the citizen can try more than one before concluding they're missing.

const TRANSLITERATION_SWAPS = [
  // Each pair is checked case-insensitively as a whole-word swap in either
  // direction — common inconsistencies in how the same Hindi/Indian-language
  // sound gets Romanized across different official documents.
  ['v', 'w'],
  ['b', 'v'],
  ['sh', 's'],
  ['ph', 'f'],
  ['ee', 'i'],
  ['oo', 'u'],
  ['th', 't'],
  ['kr', 'kar'],
]

/**
 * @param {string} fullName - as typed by the user, e.g. "Ram Prasad Yadav"
 * @returns {string[]} de-duplicated variant suggestions, excluding the
 *   original name itself, capped at a small handful so the UI stays a chip
 *   row, not a wall of text
 */
export function generateNameVariants(fullName) {
  const trimmed = fullName.trim().replace(/\s+/g, ' ')
  if (!trimmed) return []

  const words = trimmed.split(' ')
  const variants = new Set()

  // Surname drop: just the first name/first two names, for anyone whose
  // official record only carries a shorter form.
  if (words.length > 1) {
    variants.add(words.slice(0, -1).join(' '))
  }
  if (words.length > 2) {
    variants.add(words.slice(0, -2).join(' '))
  }

  // Initials for every word except the last (surname spelled out) — e.g.
  // "Ram Prasad Yadav" -> "R. P. Yadav" and "R. Yadav".
  if (words.length > 1) {
    const lastWord = words[words.length - 1]
    const initials = words
      .slice(0, -1)
      .map((w) => `${w[0].toUpperCase()}.`)
      .join(' ')
    variants.add(`${initials} ${lastWord}`)
    variants.add(`${words[0][0].toUpperCase()}. ${lastWord}`)
  }

  // Concatenated, no space — a common single-field-entry pattern on older
  // official records.
  if (words.length > 1) {
    variants.add(words.join(''))
  }

  // Common transliteration swaps, applied to the full name as typed.
  for (const [a, b] of TRANSLITERATION_SWAPS) {
    const swapped = swapWholeWordPart(trimmed, a, b)
    if (swapped && swapped.toLowerCase() !== trimmed.toLowerCase()) variants.add(swapped)
  }

  variants.delete(trimmed)
  return [...variants].slice(0, 6)
}

/**
 * Case-insensitively replaces the first occurrence of `from` with `to`
 * (or vice versa if `from` isn't present but `to` is), preserving the
 * surrounding text's original case pattern as closely as a simple
 * substring swap can.
 * @returns {string|null} null when neither pattern is present
 */
function swapWholeWordPart(text, from, to) {
  const lower = text.toLowerCase()
  const fromIdx = lower.indexOf(from)
  if (fromIdx !== -1) {
    return text.slice(0, fromIdx) + to + text.slice(fromIdx + from.length)
  }
  const toIdx = lower.indexOf(to)
  if (toIdx !== -1) {
    return text.slice(0, toIdx) + from + text.slice(toIdx + to.length)
  }
  return null
}
