// Chunav Saathi's hardcoded prompt-chip answers — Phase 3 step 12. This is
// deliberately NOT the RAG path (steps 13-14, later): every answer here is
// authored content, grounded in this project's own research the same way
// every card/form in this app is, not retrieved. The whole point of
// shipping chips-with-real-answers before RAG exists is that a chatbot slip
// later can't sink the demo (PRD §26) — this file has to stand on its own,
// permanently, as the fallback path even after RAG lands.
//
// Chip set matches the locked mockup (vote-sahayak-mockups-v1.html, screen
// 5b) exactly — same 5 questions, same order. Answers are new (the mockup
// only fully worked one example, the Aadhaar/hyphen question, which is
// reused here as chip 3), but every fact traces to this project's real
// research; see the `source_en`/`source_hi` on each entry.
//
// `id` doubles as: the chip's own key, the answer message's key, and the
// value passed to `trackChatAsked`'s payload — one vocabulary, matching the
// pattern already established for SIR outcomes (SirFlow.jsx) and card kinds.

/**
 * @typedef {object} ChatChip
 * @property {string} id
 * @property {string} question_en
 * @property {string} question_hi
 * @property {string} answer_en
 * @property {string} answer_hi
 * @property {string} [source_en] - shown as a small citation line under the answer, matching msg-bot's .src treatment. Omitted for answers that are this app's own already-reviewed content (nothing new to cite).
 * @property {string} [source_hi]
 */

/** @type {ChatChip[]} */
export const CHAT_CHIPS = [
  {
    id: 'not-ordinarily-resident',
    question_en: 'Am I a citizen if it says "not ordinarily resident"?',
    question_hi: 'अगर लिखा है "सामान्य निवासी नहीं", तो क्या मैं नागरिक नहीं हूं?',
    answer_en:
      'Yes — "not ordinarily resident" is about where you currently live, not about citizenship. It usually means the record shows you\'ve moved away from the address you\'re registered at, which is common for migrants and students. It is never a citizenship question. If this is your situation, Form 8 can update your address.',
    answer_hi:
      'हां — "सामान्य निवासी नहीं" का मतलब है कि आप अभी उस पते पर नहीं रहते जहां आप पंजीकृत हैं, यह नागरिकता का सवाल नहीं है। यह प्रवासी मज़दूरों और छात्रों के साथ आम है। अगर यह आपकी स्थिति है, तो Form 8 से पता अपडेट किया जा सकता है।',
    source_en: 'Research finding, Moderate Confidence — not an official ECI definition',
    source_hi: 'शोध निष्कर्ष, मध्यम विश्वसनीयता — यह ECI की आधिकारिक परिभाषा नहीं है',
  },
  {
    id: 'correction-time',
    question_en: 'How long does correction take?',
    question_hi: 'सुधार में कितना समय लगता है?',
    answer_en:
      "There's no official guarantee. Some corrections clear in a few weeks; others take longer with no update in between. Apply as early as you can, and follow up with your BLO if you don't hear back.",
    answer_hi:
      'कोई आधिकारिक गारंटी नहीं है। कुछ सुधार कुछ हफ्तों में हो जाते हैं, कुछ में ज़्यादा समय लगता है और बीच में कोई अपडेट नहीं मिलता। जितनी जल्दी हो सके आवेदन करें, और अगर जवाब न मिले तो अपने BLO से संपर्क करें।',
  },
  {
    id: 'aadhaar-mismatch',
    question_en: 'My name has a small difference from my Aadhaar, like a missing hyphen. Does that matter?',
    question_hi: 'मेरे नाम में आधार से थोड़ा फर्क है, जैसे हाइफ़न छूटा हुआ। क्या इससे फर्क पड़ता है?',
    answer_en:
      "Yes, it can — even a small mismatch can block your SIR registration. The Supreme Court has directed ECI to also accept Aadhaar, EPIC, and Ration Card as valid ID during SIR, but the name still has to match your voter roll entry.\n1. Compare your voter ID name to your Aadhaar name.\n2. If they differ, fill Form 8 on the NVSP website.",
    answer_hi:
      'हां, फर्क पड़ सकता है — छोटा सा मेल न होना भी SIR पंजीकरण में रुकावट डाल सकता है। सुप्रीम कोर्ट ने ECI को SIR के दौरान आधार, EPIC और राशन कार्ड को भी मान्य ID के रूप में स्वीकार करने का निर्देश दिया है, लेकिन नाम आपके वोटर रोल की एंट्री से मेल खाना चाहिए।\n1. अपने वोटर ID के नाम की तुलना आधार के नाम से करें।\n2. अगर फर्क है, तो NVSP वेबसाइट पर Form 8 भरें।',
    source_en: 'Association for Democratic Reforms v. ECI, 2026',
    source_hi: 'एसोसिएशन फॉर डेमोक्रेटिक रिफॉर्म्स बनाम ECI, 2026',
  },
  {
    id: 'panchayat',
    question_en: "Registered for Parliament — am I also registered for my local panchayat election?",
    question_hi: 'संसद के लिए पंजीकृत हूं — क्या मैं अपने पंचायत चुनाव के लिए भी पंजीकृत हूं?',
    answer_en:
      'Not automatically. Lok Sabha and Assembly elections everywhere share one national voter roll. But panchayat and municipal elections in Uttar Pradesh, Uttarakhand, Odisha, Assam, Madhya Pradesh, and Kerala use a separate roll, run by that state\'s own State Election Commission. If you live in one of these states, check with your local body separately — this app only covers the national roll.',
    answer_hi:
      'यह अपने आप नहीं होता। लोकसभा और विधानसभा चुनावों के लिए हर जगह एक ही राष्ट्रीय वोटर सूची होती है। लेकिन उत्तर प्रदेश, उत्तराखंड, ओडिशा, असम, मध्य प्रदेश और केरल में पंचायत और नगरपालिका चुनावों की सूची अलग होती है, जिसे उस राज्य का अपना राज्य निर्वाचन आयोग चलाता है। अगर आप इनमें से किसी राज्य में रहते हैं, तो अपने स्थानीय निकाय से अलग से जांच करें — यह ऐप सिर्फ राष्ट्रीय सूची को कवर करता है।',
  },
  {
    id: 'e-epic',
    question_en: 'Where do I download my voter ID card (E-EPIC)?',
    question_hi: 'मैं अपना वोटर ID कार्ड (E-EPIC) कहां से डाउनलोड करूं?',
    answer_en:
      "You can download your E-EPIC (digital voter ID) directly from the official portal: log in with your EPIC number or registered mobile, then look for the e-EPIC download option. This app doesn't host the download itself — it's pointing you to the real page.",
    answer_hi:
      'आप अपना E-EPIC (डिजिटल वोटर ID) सीधे आधिकारिक पोर्टल से डाउनलोड कर सकते हैं: अपने EPIC नंबर या पंजीकृत मोबाइल से लॉगिन करें, फिर e-EPIC डाउनलोड का विकल्प खोजें। यह ऐप खुद डाउनलोड नहीं करता — यह आपको असली पेज पर भेज रहा है।',
    source_en: 'Official portal: voters.eci.gov.in',
    source_hi: 'आधिकारिक पोर्टल: voters.eci.gov.in',
  },
  {
    id: 'what-is-sir',
    question_en: 'What is SIR? Does it affect me?',
    question_hi: 'SIR क्या है? क्या इसका मुझ पर असर है?',
    answer_en:
      "SIR (Special Intensive Revision) is a periodic recheck of the voter list. Phase II finished around April 2026 — net 5.2 crore names were removed across 12 states and 3 union territories, and that figure already accounts for about 2 crore names added back on appeal. If you're not sure whether it affected you, you can check your name directly from the home screen.",
    answer_hi:
      'SIR (विशेष गहन पुनरीक्षण) वोटर सूची की एक समय-समय पर होने वाली जांच है। चरण II लगभग अप्रैल 2026 में पूरा हुआ — 12 राज्यों और 3 केंद्र शासित प्रदेशों में अंत में 5.2 करोड़ नाम हटाए गए, और अपील पर वापस जोड़े गए लगभग 2 करोड़ नाम इस संख्या में पहले से घटाए जा चुके हैं। अगर आपको यकीन नहीं है कि इसका असर आप पर पड़ा, तो होम स्क्रीन से सीधे अपना नाम जांच सकते हैं।',
    source_en: 'Election Commission of India · verified 1 Sep 2026',
    source_hi: 'भारत निर्वाचन आयोग · सत्यापित 1 सितंबर 2026',
  },
]

/** Same chip content by id, for the awareness-briefing card's mini-act shortcuts. */
export const CHAT_CHIPS_BY_ID = Object.fromEntries(CHAT_CHIPS.map((c) => [c.id, c]))
