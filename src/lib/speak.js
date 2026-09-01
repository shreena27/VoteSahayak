/** @returns {boolean} whether this browser has any TTS support at all */
export function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * Reads text aloud in the given language. Cancels anything already
 * speaking first so repeated taps on Listen don't queue/overlap. `onEnd`
 * fires when playback finishes naturally, errors, or is cancelled (by a new
 * `speak()` call or `stopSpeaking()`), so a caller can reset a Listen/Stop
 * toggle button without polling.
 * @param {string} text
 * @param {'en'|'hi'} lang
 * @param {() => void} [onEnd]
 * @returns {boolean}
 */
export function speak(text, lang, onEnd) {
  if (!isSpeechSupported()) return false
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
  if (onEnd) {
    utterance.onend = onEnd
    utterance.onerror = onEnd
  }
  window.speechSynthesis.speak(utterance)
  return true
}

/** Stops any in-progress speech — e.g. a second tap on a Listen/Stop toggle. */
export function stopSpeaking() {
  if (isSpeechSupported()) window.speechSynthesis.cancel()
}
