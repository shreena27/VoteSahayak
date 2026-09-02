// Generates spelling-variation suggestions for the SIR name search — the
// real NVSP search is exact-match-sensitive (per this project's own live
// walkthrough history), so a citizen whose name is on the roll with slightly
// different spelling/formatting can still come back "not found" on their
// first try. This doesn't guess at what's actually on the roll; it just
// surfaces the handful of ways a full name commonly gets entered elsewhere,
// so the citizen can try more than one before concluding they're missing.

const DEVANAGARI_RE = /[ऀ-ॿ]/

// Each pair is checked case-insensitively as a substring swap within a
// single word — common inconsistencies in how the same Hindi/Indian-language
// sound gets Romanized across different official documents. Latin-script
// only: none of these are meaningful on Devanagari input.
const TRANSLITERATION_SWAPS = [
  ['v', 'w'],
  ['b', 'v'],
  ['sh', 's'],
  ['ph', 'f'],
  ['ee', 'i'],
  ['oo', 'u'],
  ['y', 'j'],
]

/**
 * @param {string} fullName - as typed by the user, e.g. "Ram Prasad Yadav"
 * @returns {string[]} de-duplicated variant suggestions, excluding the
 *   original name itself, capped at a small handful so the UI stays a chip
 *   row, not a wall of text. Transliteration swaps come first (the most
 *   likely real-world cause of a search miss), so they survive the cap on
 *   longer names rather than being crowded out by surname-drop/initials.
 *   A single-word name (nothing to slice or swap against) can legitimately
 *   return an empty array — that's a real "nothing to suggest" case, not a
 *   bug, and the UI must handle it gracefully rather than assuming a chip
 *   row always has content.
 */
export function generateNameVariants(fullName) {
  const trimmed = fullName.trim().replace(/\s+/g, ' ')
  if (!trimmed) return []

  const words = trimmed.split(' ')
  const isDevanagari = DEVANAGARI_RE.test(trimmed)
  const variants = new Set()

  // Transliteration swaps first, applied one word at a time (never across a
  // space) so a hit can't bleed into the next word, and with that word's
  // original capitalization preserved on the replaced letters. Not
  // meaningful for Devanagari input — there's no Romanization inconsistency
  // to correct for when the text is already in Devanagari.
  if (!isDevanagari) {
    for (let i = 0; i < words.length; i++) {
      if (words[i].replace(/\./g, '').length <= 1) continue // an initial, not a full syllable to swap within
      for (const [a, b] of TRANSLITERATION_SWAPS) {
        const swappedWord = swapWithinWord(words[i], a, b)
        if (swappedWord && swappedWord.toLowerCase() !== words[i].toLowerCase()) {
          const newWords = [...words]
          newWords[i] = swappedWord
          variants.add(newWords.join(' '))
        }
      }
    }
  }

  // Surname drop: just the first name/first two names, for anyone whose
  // official record only carries a shorter form. Skipped when the dropped
  // portion is already just an initial or two (e.g. "S" from "S Ramesh") —
  // that's not a usable alternative name, just noise.
  if (words.length > 1) {
    const dropLast1 = words.slice(0, -1).join(' ')
    if (dropLast1.replace(/[.\s]/g, '').length > 2) variants.add(dropLast1)
  }
  if (words.length > 2) {
    const dropLast2 = words.slice(0, -2).join(' ')
    if (dropLast2.replace(/[.\s]/g, '').length > 2) variants.add(dropLast2)
  }

  // Initials for every word except the last (surname spelled out) — e.g.
  // "Ram Prasad Yadav" -> "R. P. Yadav" and "R. Yadav". Latin-script only:
  // dotted Latin-style initials don't occur on real Devanagari voter-roll
  // entries. Also skipped when every non-surname word is already a single
  // letter (the name is already initials-shaped) — adding a period doesn't
  // create a genuinely new variant.
  if (!isDevanagari && words.length > 1) {
    const nonSurnameWords = words.slice(0, -1)
    const alreadyInitials = nonSurnameWords.every((w) => w.replace(/\./g, '').length === 1)
    if (!alreadyInitials) {
      const lastWord = words[words.length - 1]
      const initials = nonSurnameWords.map((w) => `${w[0].toUpperCase()}.`).join(' ')
      variants.add(`${initials} ${lastWord}`)
      variants.add(`${words[0][0].toUpperCase()}. ${lastWord}`)
    }
  }

  // Concatenated, no space — a common single-field-entry pattern on older
  // official records. Script-agnostic.
  if (words.length > 1) {
    variants.add(words.join(''))
  }

  variants.delete(trimmed)
  return [...variants].slice(0, 8)
}

/**
 * Case-insensitively replaces the first occurrence of `from` with `to`
 * within a single word (or vice versa if `from` isn't present but `to`
 * is). Case is matched to the original: if the matched text was entirely
 * uppercase (e.g. inside an ALL-CAPS name, as printed on a voter ID),
 * the replacement is uppercased in full rather than just its first
 * letter — otherwise a multi-letter swap (like "ee"/"i") inside an
 * all-caps word corrupts to mixed case (e.g. "VIJAY" -> "VEeJAY"
 * instead of "VEEJAY"). Title-Case input still gets only its first
 * letter capitalized, matching how the rest of the word is cased.
 * @returns {string|null} null when neither pattern is present in this word
 */
function swapWithinWord(word, from, to) {
  const lower = word.toLowerCase()
  let idx = lower.indexOf(from)
  let matchedLen = from.length
  let replacement = to
  if (idx === -1) {
    idx = lower.indexOf(to)
    if (idx === -1) return null
    matchedLen = to.length
    replacement = from
  }
  const matchedOriginal = word.slice(idx, idx + matchedLen)
  const isAllUpper = matchedOriginal === matchedOriginal.toUpperCase() && matchedOriginal !== matchedOriginal.toLowerCase()
  const wasUpper = /[A-Z]/.test(matchedOriginal[0] ?? '')
  const casedReplacement = isAllUpper
    ? replacement.toUpperCase()
    : wasUpper
      ? replacement.charAt(0).toUpperCase() + replacement.slice(1)
      : replacement
  return word.slice(0, idx) + casedReplacement + word.slice(idx + matchedLen)
}
