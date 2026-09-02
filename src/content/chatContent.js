// Chunav Saathi's hardcoded prompt-chip answers — Phase 3 step 12. This is
// deliberately NOT the RAG path (steps 13-14, later): every answer here is
// authored content, grounded in this project's own research the same way
// every card/form in this app is, not retrieved. The whole point of
// shipping chips-with-real-answers before RAG exists is that a chatbot slip
// later can't sink the demo (PRD §26) — this file has to stand on its own,
// permanently, as the fallback path even after RAG lands.
//
// Chip set is based on the locked mockup (vote-sahayak-mockups-v1.html,
// screen 5b), same order, plus one addition: the mockup only fully worked
// one example — the Aadhaar/hyphen question — and this file promotes it to
// its own chip (id `aadhaar-mismatch`, position 3), so there are 6 chips
// here, not the mockup's 5. Every fact traces to this project's real
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
 * @property {string} [link_url] - when set, renders a real tappable outbound link (matching ActionCard's step-act treatment, with the same trackOfficialLinkTapped tracking) instead of just naming the destination in prose.
 * @property {string} [verified_on] - ISO date; set only when the answer states an as-of fact (e.g. current SIR figures) that can actually go stale, so it gets the same malformed/future/stale checks as a card's verified_on via validateChatChips. Answers whose source is a citation (a law, a permanent portal) rather than a point-in-time fact don't need this.
 */

/** @type {ChatChip[]} */
export const CHAT_CHIPS = [
  {
    id: 'not-ordinarily-resident',
    question_en: 'Am I a citizen if it says "not ordinarily resident"?',
    question_hi: 'अगर लिखा है "सामान्य निवासी नहीं", तो क्या मैं नागरिक हूं?',
    answer_en:
      'It\'s not about citizenship — "not ordinarily resident" is about where you currently live, not who you are. It usually means the record shows you\'ve moved away from the address you\'re registered at, which is common for migrants and students. If this is your situation, Form 8 can update your address.',
    answer_hi:
      'यह नागरिकता का सवाल नहीं है — "सामान्य निवासी नहीं" इस बारे में है कि आप अभी कहां रहते हैं, यह इस बारे में नहीं है कि आप कौन हैं। आमतौर पर इसका मतलब है कि रिकॉर्ड के अनुसार आप उस पते से जा चुके हैं जहां आप पंजीकृत हैं, जो प्रवासी मज़दूरों और छात्रों के साथ आम है। अगर यह आपकी स्थिति है, तो Form 8 से पता अपडेट किया जा सकता है।',
    source_en: 'Research finding, Moderate Confidence — not an official ECI definition',
    source_hi: 'शोध निष्कर्ष, मध्यम विश्वसनीयता — यह ECI की आधिकारिक परिभाषा नहीं है',
  },
  {
    id: 'correction-time',
    question_en: 'How long does correction take?',
    question_hi: 'सुधार में कितना समय लगता है?',
    answer_en:
      "There's no official guarantee. Some applicants report their status stays \"Submitted\" for a month or more with no update in between. Apply as early as you can, and follow up with your BLO if you don't hear back.",
    answer_hi:
      'कोई आधिकारिक गारंटी नहीं है। कुछ आवेदकों के अनुसार स्थिति एक महीने या उससे ज़्यादा समय तक "Submitted" ही दिखती रहती है, बीच में कोई अपडेट नहीं मिलता। जितनी जल्दी हो सके आवेदन करें, और अगर जवाब न मिले तो अपने BLO से संपर्क करें।',
    source_en: 'Reported citizen experience — not an official processing time',
    source_hi: 'नागरिकों द्वारा बताया गया अनुभव — यह कोई आधिकारिक प्रक्रिया समय नहीं है',
  },
  {
    id: 'aadhaar-mismatch',
    question_en: 'My name has a small difference from my Aadhaar, like a missing hyphen. Does that matter?',
    question_hi: 'मेरे नाम में आधार से थोड़ा फर्क है, जैसे हाइफ़न छूटा हुआ। क्या इससे फर्क पड़ता है?',
    answer_en:
      "Yes, it can — even a small mismatch can block your SIR registration. The Supreme Court has pushed ECI to also consider Aadhaar, EPIC, and Ration Card as ID during SIR, but ECI hasn't guaranteed it accepts them, and the name still has to match your voter roll entry.\n1. Compare your voter ID name to your Aadhaar name.\n2. If they differ, fill Form 8 on the NVSP website.",
    answer_hi:
      'हां, फर्क पड़ सकता है — छोटा सा मेल न होना भी SIR पंजीकरण में रुकावट डाल सकता है। सुप्रीम कोर्ट ने ECI से आधार, EPIC और राशन कार्ड को भी ID के रूप में मानने पर विचार करने को कहा है, पर ECI ने इन्हें स्वीकार करने की गारंटी नहीं दी है, और नाम आपके वोटर रोल की एंट्री से मेल खाना चाहिए।\n1. अपने वोटर ID के नाम की तुलना आधार के नाम से करें।\n2. अगर फर्क है, तो NVSP वेबसाइट पर Form 8 भरें।',
    source_en: 'Supreme Court urged ECI to consider (not a binding acceptance mandate), Association for Democratic Reforms v. ECI',
    source_hi: 'सुप्रीम कोर्ट ने ECI से विचार करने को कहा (मानने की बाध्यता नहीं), एसोसिएशन फॉर डेमोक्रेटिक रिफॉर्म्स बनाम ECI',
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
    link_url: 'https://voters.eci.gov.in/',
  },
  {
    id: 'what-is-sir',
    question_en: 'What is SIR? Does it affect me?',
    question_hi: 'SIR क्या है? क्या इसका मुझ पर असर है?',
    answer_en:
      "SIR (Special Intensive Revision) is a periodic recheck of the voter list. Phase II finished around April 2026 — net 5.2 crore names were removed across 12 states and 3 union territories, and that figure already accounts for about 2 crore names added back on appeal. If you're not sure whether it affected you, you can check your name directly from the home screen.",
    answer_hi:
      'SIR (विशेष गहन पुनरीक्षण) वोटर सूची की एक समय-समय पर होने वाली जांच है। चरण II लगभग अप्रैल 2026 में पूरा हुआ — 12 राज्यों और 3 केंद्र शासित प्रदेशों में अंत में 5.2 करोड़ नाम हटाए गए, और अपील पर वापस जोड़े गए लगभग 2 करोड़ नाम इस संख्या में पहले से घटाए जा चुके हैं। अगर आपको यकीन नहीं है कि इसका असर आप पर पड़ा, तो होम स्क्रीन से सीधे अपना नाम जांच सकते हैं।',
    source_en: 'Press reporting of ECI SIR Phase II figures (OpIndia, Deccan Herald)',
    source_hi: 'ECI के SIR चरण II आंकड़ों की मीडिया रिपोर्टिंग (OpIndia, Deccan Herald)',
    verified_on: '2026-09-01',
  },
]

/** Same chip content by id, for the awareness-briefing card's mini-act shortcuts. */
export const CHAT_CHIPS_BY_ID = Object.fromEntries(CHAT_CHIPS.map((c) => [c.id, c]))
