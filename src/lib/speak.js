/** @returns {boolean} whether this browser has any TTS support at all */
export function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * Reads text aloud in the given language. Cancels anything already
 * speaking first so repeated taps on Listen don't queue/overlap.
 * @param {string} text
 * @param {'en'|'hi'} lang
 */
export function speak(text, lang) {
  if (!isSpeechSupported()) return false
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
  return true
}
