// Shared core for `npm run embed` (scripts/embed.mjs) and the RAG corpus
// build used at /api/ask review-time. Kept as one module so both call sites
// embed the exact same corpus the exact same way — a drift between them
// would mean the CLI script and the live endpoint disagree on what's in the
// knowledge base.
//
// Locked architecture (this project's own Implementation Plan + ERD):
// Gemini embeddings, flat-file cosine similarity, no vector DB. One vector
// per QA_PAIR (ERD's EMBEDDING_ROW shape: {qa_id, vector}), embedding a
// combined EN+HI text so a single vector can match a free-text query in
// either language without needing two rows per entry.

const EMBED_MODEL = 'models/gemini-embedding-001';
const EMBED_ENDPOINT = (model, apiKey) =>
  `https://generativelanguage.googleapis.com/v1beta/${model}:embedContent?key=${apiKey}`;

/**
 * Merges CHAT_CHIPS (Phase 3 step 12, hardcoded_fallback = true — also
 * embedded here so a free-text question near a chip's own question still
 * gets a real answer) and QA_BANK (step 13's new RAG-only real-question
 * bank) into one corpus, each entry carrying everything /api/ask needs to
 * build a response: the id, which source array it came from (for a11y/debug,
 * not required at query time), and the bilingual answer + source line.
 * @param {import('../src/content/chatContent.js').ChatChip[]} chips
 * @param {import('../src/content/qaBank.js').QaBankEntry[]} qaBank
 */
export function buildCorpus(chips, qaBank) {
  const fromChips = chips.map((c) => ({
    qa_id: c.id,
    is_chip: true,
    embed_text: `${c.question_en}\n${c.question_hi}`,
    answer_en: c.answer_en,
    answer_hi: c.answer_hi,
    source_en: c.source_en ?? null,
    source_hi: c.source_hi ?? null,
  }));
  const fromBank = qaBank.map((q) => ({
    qa_id: q.id,
    is_chip: false,
    embed_text: `${q.question_en}\n${q.question_hi}`,
    answer_en: q.answer_en,
    answer_hi: q.answer_hi,
    source_en: q.source_en,
    source_hi: q.source_hi,
  }));
  return [...fromChips, ...fromBank];
}

/**
 * Embeds one piece of text via Gemini's embedding API. The one place that
 * actually talks to the embedding endpoint — both the batch corpus embed and
 * /api/ask's query-time embed call through here, so a model/endpoint change
 * only happens in one place.
 * @param {string} text
 * @param {string} apiKey
 * @param {string} [label] - for a clearer error message on failure
 * @returns {Promise<number[]>}
 */
export async function embedText(text, apiKey, label = text) {
  const res = await fetch(EMBED_ENDPOINT(EMBED_MODEL, apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: { parts: [{ text }] } }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Gemini embed failed for "${label}" (${res.status}): ${JSON.stringify(body)}`);
  }
  const vector = body?.embedding?.values;
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error(`Gemini embed for "${label}" returned no vector: ${JSON.stringify(body)}`);
  }
  return vector;
}

/**
 * Calls Gemini's embedding API once per corpus entry. Sequential, not
 * parallel — this corpus is tiny (a dozen entries) and this only runs when
 * content changes, so simplicity beats throughput here.
 * @param {ReturnType<typeof buildCorpus>} corpus
 * @param {string} apiKey
 * @returns {Promise<{qa_id: string, vector: number[]}[]>}
 */
export async function embedCorpus(corpus, apiKey) {
  const rows = [];
  for (const entry of corpus) {
    const vector = await embedText(entry.embed_text, apiKey, entry.qa_id);
    rows.push({ qa_id: entry.qa_id, vector });
  }
  return rows;
}

/** Cosine similarity between two equal-length vectors. */
export function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export { EMBED_MODEL, EMBED_ENDPOINT };
