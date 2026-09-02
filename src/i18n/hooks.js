import { useCallback, useContext } from 'react'
import { LanguageContext } from './context.jsx'
import en from '../content/strings.en.json'
import hi from '../content/strings.hi.json'

const STRINGS = { en, hi }

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider')
  return ctx
}

export function useTranslation() {
  const { lang } = useLanguage()

  const t = useCallback(
    (key) => {
      const active = lang ? STRINGS[lang] : null
      if (active && Object.hasOwn(active, key)) return active[key]
      if (Object.hasOwn(STRINGS.en, key)) return STRINGS.en[key]
      return key
    },
    [lang],
  )

  return { t }
}
