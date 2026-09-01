# Vote Sahayak

A plain-language PWA companion for India's National Voter Service Portal (NVSP): a guided SIR deletion-risk check, a 5-task form wizard, and a retrieval-only chatbot ("Chunav Saathi"), in Hindi and English.

Final Case Study, Government & Public Sector track.

## Stack

React 18 + Vite 5 + Tailwind CSS v4, deployed on Vercel as an installable PWA (`vite-plugin-pwa`). Chatbot: Gemini free tier (embeddings + flash), flat-file cosine similarity, served through a single `/api/ask` serverless function.

See `Downloads/Final Case study/` for the PRD, ERD, and Implementation Plan.

## Development

```sh
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill in `GEMINI_API_KEY` for chatbot work (Phase 3).

## Build

```sh
npm run build
```
