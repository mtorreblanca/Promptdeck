# Prompt Evaluator

Test a prompt across multiple LLM providers and auto-grade the output against a rubric.

Write a prompt template with `{{variables}}`, define a grading rubric, add test cases, and run. Each run calls the model, then asks a model to score the output against your rubric — so you get a number and a reason, not just raw text to eyeball. Run history tracks scores across runs so you can compare quality across providers and models.

## Setup

```bash
npm install
cp .env.example .env
```

Add at least one API key to `.env` (only the providers you actually plan to use need a key — see comments in `.env.example`):

```
ANTHROPIC_API_KEY=sk-ant-...
```

```bash
npm run dev
```

Open the printed local URL. Restart `npm run dev` any time you change `.env` — it's only read at server startup.

## How it works

1. **Prompt template** — write text with `{{variable}}` placeholders (e.g. `Summarize this ticket:\n\n{{ticket}}`).
2. **Rubric** — describe what a good response looks like (tone, length, accuracy requirements).
3. **Test cases** — fill in values for each variable. Add as many as you want.
4. **Run** — the app fills the template, sends it to the selected model, then sends the output + rubric to a model for scoring. Score and reasoning show up on the case card.
5. **Provider / model** — pick a provider (Anthropic, OpenAI, Gemini, DeepSeek, or a self-hosted/custom OpenAI-compatible endpoint) and model from the header. Every run is logged to the history table below, so you can switch models and compare scores on the same test case.

## Providers

| Provider | Model field | Requires |
|---|---|---|
| Anthropic (Claude) | dropdown (curated list) | `ANTHROPIC_API_KEY` |
| OpenAI (GPT) | free text | `OPENAI_API_KEY` |
| Google Gemini | free text | `GEMINI_API_KEY` |
| DeepSeek | free text | `DEEPSEEK_API_KEY` |
| Custom / self-hosted (Ollama, vLLM, LM Studio, ...) | free text | Base URL entered in-app; API key optional |

GPT/Gemini/DeepSeek model IDs change often, so those are free-text fields — check the provider's docs for the current model name. Anthropic keeps a curated dropdown.

## Deploying (Vercel)

The `/api/complete` proxy has two implementations sharing the same logic (`server/complete.js`):

- **`server/router.js`** — a Vite dev-server middleware, used by `npm run dev`.
- **`api/complete.js`** — a Vercel serverless function, used in production.

To deploy:

1. Push the repo to GitHub and import it in [Vercel](https://vercel.com/new) — it auto-detects the Vite framework, no `vercel.json` needed.
2. In the Vercel project's **Settings → Environment Variables**, add whichever provider keys you use (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`) — same names as `.env.example`. They're only read server-side inside `api/complete.js`, never bundled into the client.
3. Deploy. Vercel builds the static frontend (`vite build` → `dist/`) and deploys `api/complete.js` as a serverless function automatically.

The "Custom / self-hosted" provider still works after deploying, but only if the endpoint you point it at (e.g. Ollama) is itself publicly reachable — `localhost` on your machine isn't reachable from Vercel's servers.

## Architecture

- **Frontend** — React + Vite. `src/components/PromptEvaluator` is the main UI; `src/lib/llm.js` calls the local API; `src/lib/history.js` persists run history to `localStorage`.
- **Backend** — `server/complete.js` holds the provider dispatch/validation logic, shared by two thin entry points: `server/router.js` (a Vite dev-server middleware, used by `npm run dev`) and `api/complete.js` (a Vercel serverless function, used in production). Both receive `POST /api/complete`, keep provider API keys server-side, and dispatch to a per-provider adapter in `server/providers/`.
- **Adding a provider** — add a new file in `server/providers/` that exports `call(body, apiKey) -> { text, model }`, wire it into the `switch` in `server/complete.js`, and add it to the `PROVIDERS` list in `src/lib/llm.js`.

## Tech stack

React 19, Vite, vanilla `fetch` for API calls (no backend framework, no state library) — the whole app is client + a thin dev-server middleware.
