// Phase 3 step 14: /api/ask — the RAG endpoint. Embed query -> cosine top-k
// against the precomputed corpus -> below-threshold means an honest fallback
// with NO generation call at all -> above threshold, Gemini flash answers
// strictly from the retrieved text, source line passed through.
//
// This is the one place GEMINI_API_KEY is used at request time. It never
// reaches the client: this file only ever sends the key server-side to
// Google's API, and the response this function returns never echoes it back.
//
// RAG is explicitly additive here, never load-bearing (Implementation Plan's
// own risk mitigation for "the riskiest element of the whole build") — the
// chat UI's hardcoded chips (chatContent.js) work with zero calls to this
// endpoint, and if this endpoint is ever down or errors, the client already
// falls back to the same honest "I don't know" message a genuine below-
// threshold miss produces.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildCorpus, embedText, cosineSimilarity } from '../scripts/embed-core.mjs';
import { CHAT_CHIPS } from '../src/content/chatContent.js';
import { QA_BANK } from '../src/content/qaBank.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const embeddings = JSON.parse(readFileSync(path.join(__dirname, '..', 'src', 'content', 'embeddings.json'), 'utf8'));

// gemini-2.5-flash (this project's originally-researched model, per the
// Implementation Plan's stack table) is no longer available to new API keys
// as of this build — Gemini's own 404 error names gemini-3.6-flash as the
// direct replacement; confirmed available for this project's key via a live
// models.list call before switching.
const GENERATION_MODEL = 'models/gemini-3.6-flash';
const GENERATE_ENDPOINT = (apiKey) =>
  `https://generativelanguage.googleapis.com/v1beta/${GENERATION_MODEL}:generateContent?key=${apiKey}`;

// Cosine similarity threshold below which we never call the generation model
// at all — a genuine "we don't have this" is a fallback, not a low-confidence
// guess. Gemini's embedding model puts a real semantic match comfortably
// above this for short civic Q&A text; tuned empirically against this
// project's own corpus during step 14's verification pass (see the PR
// description for the actual test questions/scores this was checked
// against), not picked arbitrarily.
const SIMILARITY_THRESHOLD = 0.55;
const TOP_K = 3;
const MAX_QUERY_LENGTH = 500;

const corpus = buildCorpus(CHAT_CHIPS, QA_BANK);
const corpusById = new Map(corpus.map((entry) => [entry.qa_id, entry]));

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || /^placeholder/i.test(apiKey)) {
    // No real key configured (e.g. a fork of this repo without one set) —
    // this is not the citizen's problem to see as a 500; behave exactly like
    // a below-threshold miss so the UI's existing honest-fallback path
    // handles it the same way.
    res.status(200).json({ matched: false });
    return;
  }

  const { query, lang } = req.body ?? {};
  if (typeof query !== 'string' || !query.trim() || query.length > MAX_QUERY_LENGTH) {
    res.status(400).json({ error: 'query must be a non-empty string under 500 characters' });
    return;
  }
  const activeLang = lang === 'hi' ? 'hi' : 'en';

  try {
    const queryVector = await embedText(query.trim(), apiKey, 'query');

    const scored = embeddings
      .map((row) => ({ qa_id: row.qa_id, score: cosineSimilarity(queryVector, row.vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_K);

    if (scored.length === 0 || scored[0].score < SIMILARITY_THRESHOLD) {
      res.status(200).json({ matched: false });
      return;
    }

    const retrieved = scored
      .map((s) => corpusById.get(s.qa_id))
      .filter(Boolean)
      .map((entry) => ({
        answer: activeLang === 'hi' ? entry.answer_hi : entry.answer_en,
        source: activeLang === 'hi' ? entry.source_hi : entry.source_en,
      }));

    if (retrieved.length === 0) {
      res.status(200).json({ matched: false });
      return;
    }

    const generated = await generateFromRetrieved(query.trim(), retrieved, activeLang, apiKey);
    if (!generated) {
      // The model itself decided the retrieved text doesn't actually answer
      // this question — an extra honesty check beyond the similarity score.
      res.status(200).json({ matched: false });
      return;
    }

    res.status(200).json({
      matched: true,
      answer: generated,
      source: retrieved[0].source,
    });
  } catch (err) {
    // Never leak the error/stack (could reference the key or an internal
    // path) to the client; log server-side, behave like an honest fallback.
    console.error('/api/ask error:', err);
    res.status(200).json({ matched: false });
  }
}

/**
 * Gemini flash, strictly constrained to the retrieved curated text. Returns
 * null (treated as a fallback) if the model itself reports the context
 * doesn't cover the question, rather than ever inventing an answer.
 */
async function generateFromRetrieved(query, retrieved, lang, apiKey) {
  const contextBlock = retrieved.map((r, i) => `[${i + 1}] ${r.answer}`).join('\n\n');
  const languageName = lang === 'hi' ? 'Hindi' : 'English';

  const systemInstruction = [
    'You are Chunav Saathi, a plain-language assistant for an Indian voter-registration help app.',
    'You may ONLY use the numbered context passages below to answer. Never use outside knowledge, never guess, never state a legal or civic fact that is not directly supported by the context.',
    'Never give an opinion on any political party, candidate, or election outcome, and never comment on whether any law or process is fair, constitutional, or correct — restate only what the context says.',
    `Answer in ${languageName}, in the same plain, calm, clerk-plain register as the context passages — short sentences, no jargon.`,
    'If the context passages do not actually answer the question, respond with exactly the single token NO_MATCH and nothing else.',
    '',
    'Context:',
    contextBlock,
  ].join('\n');

  const res = await fetch(GENERATE_ENDPOINT(apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: query }] }],
      // A `thinkingConfig.thinkingBudget: 0` attempt to disable reasoning
      // tokens for this model returned 400 INVALID_ARGUMENT (confirmed live
      // during this step's verification) — this model/API version doesn't
      // accept that field shape. Absorbing the reasoning-token overhead with
      // a generous maxOutputTokens budget instead.
      generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Gemini generate failed (${res.status}): ${JSON.stringify(body)}`);
  }
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text || text === 'NO_MATCH' || text.includes('NO_MATCH')) return null;
  return text;
}
