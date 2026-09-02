import { useEffect, useRef, useState } from 'react'
import { useLanguage, useTranslation } from '../i18n/hooks.js'
import { formatDisplayDate } from '../content/schema.js'
import { trackChatOpened, trackChatAsked, trackChatFallback, trackOfficialLinkTapped } from '../lib/analytics.js'
import { CHAT_CHIPS, CHAT_CHIPS_BY_ID } from '../content/chatContent.js'
import updates from '../content/updates.json'
import './shared.css'
import './Chat.css'

// Chunav Saathi — Phase 3 step 12. Retrieval-only over a fixed set of
// hardcoded chip answers (steps 13-14 add real RAG over free text later;
// this step's whole point, per the Implementation Plan's risk mitigation,
// is that the bot has to be demo-complete on chips alone BEFORE RAG exists
// at all). So free text and voice input are honest here on purpose: since
// there is no matching capability yet, submitting either always produces
// the same honest "I don't know, call 1950" fallback a real RAG miss would
// also produce later — never a guess, and never something that looks
// smarter than it is.
//
// `id` is the one vocabulary across chip content (chatContent.js), the
// message log's own keys, and `trackChatAsked`'s payload — same pattern
// SirFlow.jsx already established for outcome ids.

let messageSeq = 0
function nextMessageId() {
  messageSeq += 1
  return `m${messageSeq}`
}

/** @returns {typeof window.SpeechRecognition | null} the browser's SpeechRecognition constructor, feature-detected (only Chrome/Edge ship it unprefixed or as webkit-prefixed; Firefox has none) */
function getSpeechRecognition() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

/**
 * @param {{ onClose: () => void, onOpenSir: () => void }} props
 */
export function Chat({ onClose, onOpenSir }) {
  const { lang } = useLanguage()
  const { t } = useTranslation()
  const activeLang = lang ?? 'en'
  const update = updates[0] ?? null

  const headingRef = useRef(null)
  const msgsRef = useRef(null)
  const inputRef = useRef(null)
  const [messages, setMessages] = useState(() => buildInitialMessages(update))
  const [inputValue, setInputValue] = useState('')
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)

  useEffect(() => {
    trackChatOpened()
    headingRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once on mount only, not on every language toggle
  }, [])

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight
  }, [messages])

  useEffect(() => {
    // Stop any in-flight recognition on unmount so a closed chat panel
    // doesn't keep the microphone listening in the background.
    return () => recognitionRef.current?.abort()
  }, [])

  function askChip(chipId) {
    const chip = CHAT_CHIPS_BY_ID[chipId]
    if (!chip) return
    trackChatAsked({ chip: chipId })
    setMessages((prev) => [
      ...prev,
      { id: nextMessageId(), type: 'user-chip', chipId },
      { id: nextMessageId(), type: 'bot-chip', chipId },
    ])
  }

  async function askFreeText(rawText) {
    const text = rawText.trim()
    if (!text) return
    trackChatAsked({ chip: null })
    setInputValue('')
    const userMsgId = nextMessageId()
    const pendingId = nextMessageId()
    setMessages((prev) => [...prev, { id: userMsgId, type: 'user-text', text }, { id: pendingId, type: 'pending' }])

    let result
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text, lang: activeLang }),
      })
      result = res.ok ? await res.json() : { matched: false }
    } catch {
      // Network/endpoint failure behaves exactly like a genuine below-
      // threshold miss — RAG is additive, never load-bearing (Implementation
      // Plan's own risk mitigation), so this must never surface as an error
      // state, only the same honest fallback a real miss produces.
      result = { matched: false }
    }

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== pendingId) return m
        if (result.matched) {
          return { id: pendingId, type: 'rag-answer', answer: result.answer, source: result.source }
        }
        trackChatFallback()
        return { id: pendingId, type: 'honest' }
      }),
    )
  }

  function handleSubmit(e) {
    e.preventDefault()
    askFreeText(inputValue)
  }

  function handleMic() {
    const Recognition = getSpeechRecognition()
    if (!Recognition) return // feature-detected away in the render below; defensive no-op if somehow reachable
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const recognition = new Recognition()
    recognition.lang = activeLang === 'hi' ? 'hi-IN' : 'en-IN'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript
      if (transcript) setInputValue(transcript)
      inputRef.current?.focus()
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
  }

  const micSupported = Boolean(getSpeechRecognition())

  return (
    <div className="chat-screen">
      <div className="chat-panel">
        <div className="hd">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="chat-hd-avi" aria-hidden="true">
              🗳️
            </div>
            <div className="chat-hd-txt">
              <h1 className="chat-hd-title" ref={headingRef} tabIndex={-1}>
                {t('chat.headerName')}
              </h1>
              <div className="sub">{t('chat.headerSub')}</div>
            </div>
          </div>
          <button type="button" className="x" onClick={onClose} aria-label={t('chat.close')}>
            ✕
          </button>
        </div>

        <div className="chat-msgs" ref={msgsRef} aria-live="polite">
          {messages.map((m) => (
            <ChatMessage key={m.id} message={m} onMiniAct={(action) => (action === 'sir' ? onOpenSir() : askChip('what-is-sir'))} />
          ))}
        </div>

        <div className="prompt-chips">
          {CHAT_CHIPS.map((chip) => (
            <button type="button" key={chip.id} className="prompt-chip" onClick={() => askChip(chip.id)}>
              {activeLang === 'hi' ? chip.question_hi : chip.question_en}
            </button>
          ))}
        </div>

        <form className="chat-input" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            className="box"
            placeholder={t('chat.inputPlaceholder')}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            aria-label={t('chat.inputLabel')}
          />
          {micSupported && (
            <button
              type="button"
              className="mic-btn"
              onClick={handleMic}
              aria-pressed={listening}
              aria-label={listening ? t('chat.micStop') : t('chat.micStart')}
            >
              <MicIcon />
            </button>
          )}
          <button type="submit" className="send-btn" aria-label={t('chat.send')} disabled={!inputValue.trim()}>
            <SendIcon />
          </button>
        </form>
      </div>
    </div>
  )
}

// Messages store language-independent references (chip ids, the raw update
// object, or the user's own typed text) rather than pre-resolved strings —
// ChatMessage resolves display text from the CURRENT active language at
// render time, so toggling language mid-session re-renders the whole
// transcript correctly instead of leaving earlier turns stuck in whichever
// language was active when they were first added.
function buildInitialMessages(update) {
  const msgs = [{ id: nextMessageId(), type: 'greeting' }]
  if (update) {
    msgs.push({ id: nextMessageId(), type: 'update', update })
  }
  return msgs
}

function ChatMessage({ message, onMiniAct }) {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const activeLang = lang ?? 'en'

  if (message.type === 'user-text') return <div className="msg-user">{message.text}</div>

  if (message.type === 'user-chip') {
    const chip = CHAT_CHIPS_BY_ID[message.chipId]
    if (!chip) return null
    return <div className="msg-user">{activeLang === 'hi' ? chip.question_hi : chip.question_en}</div>
  }

  if (message.type === 'greeting') {
    return <div className="msg-bot">{t('chat.greeting')}</div>
  }

  if (message.type === 'update') {
    const { update } = message
    const headline = activeLang === 'hi' ? update.headline_hi : update.headline_en
    const text = activeLang === 'hi' ? update.text_hi : update.text_en
    return (
      <div className="msg-update">
        <b>{headline}</b>
        {text}
        {update.verified_on && (
          <span className="verified-mini">
            {t('card.verified')} {formatDisplayDate(update.verified_on, activeLang)}
          </span>
        )}
        <div>
          <button type="button" className="mini-act" onClick={() => onMiniAct('sir')}>
            {t('chat.miniActCheck')}
          </button>{' '}
          <button type="button" className="mini-act" onClick={() => onMiniAct('whatIsSir')}>
            {t('chat.miniActWhatIsSir')}
          </button>
        </div>
      </div>
    )
  }

  if (message.type === 'honest') {
    return (
      <div className="msg-honest">
        {t('chat.honestFallback')}
        <span className="src honest-note">{t('chat.honestFallbackNote')}</span>
      </div>
    )
  }

  if (message.type === 'pending') {
    return (
      <div className="msg-bot msg-pending" role="status" aria-label={t('chat.thinking')}>
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
    )
  }

  if (message.type === 'rag-answer') {
    return (
      <div className="msg-bot">
        {message.answer}
        {message.source && (
          <span className="src">
            {t('chat.sourcePrefix')} {message.source}
          </span>
        )}
      </div>
    )
  }

  // 'bot-chip'
  const chip = CHAT_CHIPS_BY_ID[message.chipId]
  if (!chip) return null
  const text = activeLang === 'hi' ? chip.answer_hi : chip.answer_en
  const source = activeLang === 'hi' ? chip.source_hi : chip.source_en
  return (
    <div className="msg-bot">
      {text.split('\n').map((line, i) => (
        <span key={i}>
          {i > 0 && <br />}
          {line}
        </span>
      ))}
      {chip.link_url && (
        <div>
          <a
            className="step-act"
            href={chip.link_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackOfficialLinkTapped(chip.id)}
          >
            {t('card.open')}
          </a>
        </div>
      )}
      {source && (
        <span className="src">
          {t('chat.sourcePrefix')} {source}
          {chip.verified_on && <> · {t('card.verified')} {formatDisplayDate(chip.verified_on, activeLang)}</>}
        </span>
      )}
    </div>
  )
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3z" />
      <path d="M17 11a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M2.5 12l18-8-6 8 6 8-18-8z" />
    </svg>
  )
}
