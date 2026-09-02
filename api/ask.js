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
// guess. This is a hard trust-architecture requirement, not a soft one: the
// system prompt alone is not sufficient protection against off-scope/
// adversarial generation, this threshold is.
//
// 0.55 (the original value) was wrong — it sat barely above the ~0.50 noise
// floor unrelated English text scores against this corpus, so 5 of 6 tested
// adversarial questions (including a prompt-injection attempt) crossed it
// and reached the generation model.
//
// There is no single threshold that cleanly separates "adversarial" from
// "legitimate" in this corpus — measured directly against gemini-embedding-
// 001: near-verbatim legitimate questions score 0.88-0.90, but *realistic
// paraphrases* a real user would actually type range 0.67-0.85, and the
// worst adversarial question found (0.7044) scores HIGHER than the worst
// realistic legitimate paraphrase tested (0.6741). No cutoff admits every
// genuine paraphrase while excluding every adversarial question; that
// overlap is real, not a measurement error.
//
// Given that overlap, this threshold is deliberately set high (0.78),
// trading recall for safety: a wrongly-gated legitimate question just gets
// the honest "I don't know" fallback (harmless, and exactly what this app's
// trust architecture already treats as a correct outcome for anything it's
// unsure about) — an ungated adversarial question reaching generation is not
// harmless. This is consistent with the Implementation Plan's own framing
// (RAG is additive, never load-bearing; the prompt chips are the reliable
// primary path) — free-text answers close paraphrases well, and honestly
// declines everything else rather than guessing.
const SIMILARITY_THRESHOLD = 0.78;
const TOP_K = 3;
const MAX_QUERY_LENGTH = 500;

const corpus = buildCorpus(CHAT_CHIPS, QA_BANK);
const corpusById = new Map(corpus.map((entry) => [entry.qa_id, entry]));

// Simple in-memory per-IP rate limit. Gemini's free-tier generation quota
// is shared across every visitor (20 calls/day, project-wide, accepted as a
// real constraint for this 9-day build rather than upgraded) — without this,
// one person repeatedly hitting the endpoint (by hand or a stray double-tap)
// can silently exhaust the day's quota for everyone else. Deliberately not
// sophisticated: an in-memory Map resets on cold start and isn't shared
// across concurrent serverless instances, which is fine here — the goal is
// blunting accidental/casual abuse during a small case-study demo, not
// production-grade protection.
//
// Two constraints, not one: a short burst window stops rapid-fire/double-tap
// abuse, and a longer hourly window is what actually protects the 20/day
// budget — the original 3-per-60s (180/hr) didn't meaningfully bound a
// single IP's share of a 20-per-*day* quota.
const BURST_WINDOW_MS = 15_000;
const BURST_MAX_REQUESTS = 1;
const HOURLY_WINDOW_MS = 60 * 60_000;
const HOURLY_MAX_REQUESTS = 8;
const requestLog = new Map(); // ip -> array of request timestamps (ms)

// Sweep the whole map periodically (not on every call) so an IP that never
// comes back doesn't sit in memory forever on a warm instance.
const SWEEP_INTERVAL_MS = 10 * 60_000;
let lastSweep = Date.now();

function sweepStaleEntries(now) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [ip, timestamps] of requestLog) {
    const fresh = timestamps.filter((t) => now - t < HOURLY_WINDOW_MS);
    if (fresh.length === 0) {
      requestLog.delete(ip);
    } else if (fresh.length !== timestamps.length) {
      requestLog.set(ip, fresh);
    }
  }
}

function isRateLimited(ip) {
  const now = Date.now();
  sweepStaleEntries(now);

  const timestamps = (requestLog.get(ip) ?? []).filter((t) => now - t < HOURLY_WINDOW_MS);
  timestamps.push(now);
  requestLog.set(ip, timestamps);

  const inBurstWindow = timestamps.filter((t) => now - t < BURST_WINDOW_MS).length;
  const inHourWindow = timestamps.length;
  return inBurstWindow > BURST_MAX_REQUESTS || inHourWindow > HOURLY_MAX_REQUESTS;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .toString()
    .split(',')[0]
    .trim();
  if (isRateLimited(ip)) {
    // Same honest-fallback shape as a below-threshold miss — the citizen
    // sees "I don't know" either way, never a rate-limit error message.
    res.status(200).json({ matched: false });
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

    // Every passage handed to the generation model must individually clear
    // the threshold, not just the top one — the top-K slice above is a
    // candidate list, not a vetted one. A prior version fed all TOP_K
    // candidates into generation while only threshold-checking the first;
    // caught in review (measured real intra-corpus similarity up to 0.86
    // between differently-sourced entries), since an unvetted passage could
    // both leak into the generated answer and get misattributed to
    // retrieved[0]'s source.
    const retrieved = scored
      .filter((s) => s.score >= SIMILARITY_THRESHOLD)
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
