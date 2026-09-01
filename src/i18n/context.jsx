import { createContext, useCallback, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'voteSahayak.lang'

// The real language-picker screen (a later build step) is what should set this for
// real. Until then, "no choice made yet" must stay a distinct, honest state rather
// than silently guessing from the browser locale.
function getStoredLanguage() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'en' || stored === 'hi' ? stored : null
  } catch {
    return null
  }
}

export const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(getStoredLanguage)

  const setLang = useCallback((next) => {
    if (next !== 'en' && next !== 'hi') return
    setLangState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // localStorage can be unavailable (private mode, quota); language still
      // works for the current session, it just won't persist across reloads.
    }
  }, [])

  // Screen readers pick a voice from the document's declared language, so this
  // has to track the active language, not stay hardcoded to index.html's "en".
  useEffect(() => {
    if (lang) document.documentElement.lang = lang
  }, [lang])

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
