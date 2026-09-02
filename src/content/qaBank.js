// Chunav Saathi's RAG-retrieved knowledge base — Phase 3 steps 13-14. This is
// the ERD's QA_PAIR bucket "real-questions": the real-question bank from this
// project's own primary research (PRD §"Key evidence", tracker NVSP Deep Dive
// row 19, bucket 6) — "the one net-new content source, not available to any
// competitor because it's not scraped, it's from people the author actually
// talked to."
//
// Unlike chatContent.js's CHAT_CHIPS (hardcoded_fallback = true — rendered
// directly, no API call), these entries are NOT prompt chips. They only
// surface through /api/ask's embed -> cosine -> retrieve pipeline, so a
// free-text question close in meaning to one of these can still get a real,
// sourced answer even though there's no button for it. `npm run embed`
// embeds these alongside CHAT_CHIPS into the same corpus.
//
// 7 real interview-sourced cases exist in this project's research (tracker
// row 19, bucket 6); the 7th — the Aadhaar/hyphen mismatch testimonial — was
// already promoted into its own chip (chatContent.js's `aadhaar-mismatch`,
// added in Phase 3 step 12) rather than duplicated here.
//
// English copy is the tracker's own already-tightened wording (run through
// the Simplify_Tech_lang skill 2026-09-01 — crisp, one instruction per
// sentence, active voice) with only the ADR v. ECI citation corrected to
// match this app's already-established citation style (no year; WP(C)
// 640/2025 per PRD line 386, not the tracker's own looser "2026" phrasing —
// same drift class the PR #8 review caught once already on chatContent.js).
// Hindi is a first-pass translation by this same process, matching the
// established "clerk-plain" register — like every other Hindi string in this
// app, it still needs the project's own native-speaker proofing pass (step
// 15) before Friday's test, not a substitute for it.

/**
 * @typedef {object} QaBankEntry
 * @property {string} id
 * @property {string} bucket_id - matches the ERD's BUCKET id vocabulary; all 6 entries here are "real-questions"
 * @property {string} question_en
 * @property {string} question_hi
 * @property {string} answer_en
 * @property {string} answer_hi
 * @property {string} source_en - every entry has one, per the ERD's "every QA_PAIR answer must carry a source_line" integrity rule: either an external authority (a statute, a court case, a documented public account) or, for the purely procedural answers, this project's own primary research.
 * @property {string} source_hi
 */

/** @type {QaBankEntry[]} */
export const QA_BANK = [
  {
    id: 'kanchan-address',
    bucket_id: 'real-questions',
    question_en: 'I moved to a new city. Which form do I use to update my address?',
    question_hi: 'मैं नए शहर में शिफ्ट हो गया/गई हूं। पता अपडेट करने के लिए कौन सा फॉर्म भरूं?',
    answer_en:
      'Use Form 8 — it updates your address on the electoral roll.\n1. Fill Form 8 on the NVSP website.\n2. Attach proof of your new address.\n3. Submit it.',
    answer_hi:
      'Form 8 भरें — यह आपका पता वोटर सूची में अपडेट करता है।\n1. NVSP वेबसाइट पर Form 8 भरें।\n2. अपने नए पते का प्रमाण जोड़ें।\n3. इसे जमा करें।',
    source_en: "This project's own primary research (real interview)",
    source_hi: 'इस प्रोजेक्ट का अपना प्राथमिक शोध (असली इंटरव्यू)',
  },
  {
    id: 'ram-double-mismatch',
    bucket_id: 'real-questions',
    question_en: "My name and my father's name are both wrong on my voter ID. What do I do?",
    question_hi: 'मेरे वोटर ID में मेरा नाम और मेरे पिता का नाम, दोनों गलत हैं। मैं क्या करूं?',
    answer_en:
      "Use one Form 8 for both corrections. Form 8 fixes your name and your father's name together.\n1. Fill Form 8 on the NVSP website.\n2. Attach proof for each correction.\n3. Submit it once.",
    answer_hi:
      'दोनों सुधार के लिए एक ही Form 8 भरें। Form 8 आपका नाम और आपके पिता का नाम, दोनों एक साथ ठीक करता है।\n1. NVSP वेबसाइट पर Form 8 भरें।\n2. हर सुधार के लिए प्रमाण जोड़ें।\n3. इसे एक बार जमा करें।',
    source_en: "This project's own primary research (real interview)",
    source_hi: 'इस प्रोजेक्ट का अपना प्राथमिक शोध (असली इंटरव्यू)',
  },
  {
    id: 'wrong-name-blocks-voting',
    bucket_id: 'real-questions',
    question_en: 'Can a wrong name on my voter ID actually stop me from voting?',
    question_hi: 'क्या वोटर ID में गलत नाम होने से मुझे वोट डालने से रोका जा सकता है?',
    answer_en:
      'A wrong name can stop you from voting. Do not wait for election day.\n1. Fill Form 8 now on the NVSP website.\n2. Attach proof of your correct name.\n3. Submit it before the next election.',
    answer_hi:
      'गलत नाम होने से आपको वोट डालने से रोका जा सकता है। चुनाव के दिन का इंतज़ार न करें।\n1. अभी NVSP वेबसाइट पर Form 8 भरें।\n2. अपने सही नाम का प्रमाण जोड़ें।\n3. अगले चुनाव से पहले इसे जमा करें।',
    source_en: "This project's own primary research (real citizen account)",
    source_hi: 'इस प्रोजेक्ट का अपना प्राथमिक शोध (असली नागरिक का अनुभव)',
  },
  {
    id: 'correction-timeline-real-case',
    bucket_id: 'real-questions',
    question_en: 'How long will fixing my name/DOB actually take?',
    question_hi: 'नाम/जन्मतिथि ठीक कराने में असल में कितना समय लगेगा?',
    answer_en:
      "There's no official guarantee. Usually a few weeks — but in one documented case (a former diplomat's public account) it took up to 6 months. Apply as early as you can, especially before a SIR deadline, and track your status on NVSP.",
    answer_hi:
      'कोई आधिकारिक गारंटी नहीं है। आमतौर पर कुछ हफ्तों में हो जाता है — लेकिन एक दर्ज मामले में (एक पूर्व राजनयिक के सार्वजनिक बयान के अनुसार) इसमें 6 महीने तक लग गए। जितनी जल्दी हो सके आवेदन करें, खासकर SIR की समय-सीमा से पहले, और NVSP पर अपनी स्थिति ट्रैक करें।',
    source_en: "Documented case: former diplomat Navdeep Suri's public account (WION) · Moderate Confidence",
    source_hi: 'दर्ज मामला: पूर्व राजनयिक नवदीप सूरी का सार्वजनिक बयान (WION) · मध्यम विश्वसनीयता',
  },
  {
    id: 'correction-not-always-reliable',
    bucket_id: 'real-questions',
    question_en: 'Is the correction process itself reliable?',
    question_hi: 'क्या सुधार की प्रक्रिया खुद भरोसेमंद है?',
    answer_en:
      'Not always — some corrections come back with an error still on them.\n1. Check every field after you submit, not just the one you fixed.\n2. If a field is still wrong, submit a new Form 8.\n3. Follow up with your local BLO if there\'s no update.',
    answer_hi:
      'हमेशा नहीं — कुछ सुधार वापस आते हैं और उनमें अब भी कोई गलती रह जाती है।\n1. जमा करने के बाद हर फील्ड जांचें, सिर्फ वह नहीं जो आपने ठीक किया था।\n2. अगर कोई फील्ड अब भी गलत है, तो नया Form 8 जमा करें।\n3. अगर कोई अपडेट न मिले तो अपने BLO से संपर्क करें।',
    source_en: 'Reported citizen experience — not an official failure rate',
    source_hi: 'नागरिक द्वारा बताया गया अनुभव — यह कोई आधिकारिक विफलता दर नहीं है',
  },
  {
    id: 'spelling-mistake-rpa',
    bucket_id: 'real-questions',
    question_en: 'Will a small spelling mistake get my vote rejected outright?',
    question_hi: 'क्या स्पेलिंग की छोटी गलती से मेरा वोट पूरी तरह खारिज हो जाएगा?',
    answer_en:
      "Not necessarily. Election law (Representation of the People Act 1951, Section 61) lets officials accept your identity another way for a small spelling mistake. The Supreme Court has also directed the Election Commission to avoid unfairly excluding eligible voters over this kind of issue. This isn't guaranteed — it depends on the polling officer.\n1. Fill Form 8 now to fix it anyway.\n2. Don't rely on this rule alone.",
    answer_hi:
      'ज़रूरी नहीं। चुनाव कानून (जन प्रतिनिधित्व अधिनियम 1951, धारा 61) अधिकारियों को छोटी स्पेलिंग गलती पर आपकी पहचान किसी और तरह से स्वीकार करने देता है। सुप्रीम कोर्ट ने चुनाव आयोग को इस तरह के मामलों में योग्य मतदाताओं को गलत तरीके से बाहर न करने का निर्देश भी दिया है। यह गारंटी नहीं है — यह पोलिंग अधिकारी पर निर्भर करता है।\n1. फिर भी इसे ठीक करने के लिए अभी Form 8 भरें।\n2. सिर्फ इस नियम पर भरोसा न करें।',
    source_en: 'Representation of the People Act 1951, Section 61 (The Hindu); Supreme Court directive, Association for Democratic Reforms v. ECI, WP(C) 640/2025',
    source_hi: 'जन प्रतिनिधित्व अधिनियम 1951, धारा 61 (The Hindu); सुप्रीम कोर्ट का निर्देश, एसोसिएशन फॉर डेमोक्रेटिक रिफॉर्म्स बनाम ECI, WP(C) 640/2025',
  },
]
