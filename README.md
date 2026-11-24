# Prompt Evaluator

Test a prompt across multiple LLM providers and auto-grade the output against a rubric.

Write a prompt template with `{{variables}}`, define a grading rubric, add test cases, and run. Each run calls the model, then asks a model to score the output against your rubric — so you get a number and a reason, not just raw text to eyeball. Run history tracks scores across runs so you can compare quality across providers and models.

<img width="1440" height="835" alt="image" src="https://github.com/user-attachments/assets/d1bd2943-f7bc-424f-b1f7-7828b244854e" />


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

The "Custom / self-hosted" provider is **local-only by default**: it lets the browser choose a URL for the server to fetch, which is fine on your own machine but would make a public deployment an open proxy (SSRF). In production it's hidden and rejected unless you set both `ALLOW_CUSTOM_PROVIDER=true` and `VITE_ENABLE_CUSTOM_PROVIDER=true`.

## Security

A public deployment spends **your** API keys on every request, so `/api/complete` is hardened:

- **Keys stay server-side.** Provider keys are read only in `server/` and `api/`, never bundled into the client. The Gemini key is sent as a header, not in the URL.
- **Strict request validation** (`server/validate.js`). Only `model`, `system`, `messages` and `max_tokens` are forwarded; anything else (tools, `n`, streaming, ...) is dropped. Model IDs are pattern-checked (Anthropic models must be in the app's curated list), `max_tokens` is capped at 2000, and message count, message size and total body size are bounded.
- **Rate limiting** (`server/rateLimit.js`). 10 requests/minute per IP by default (`RATE_LIMIT_PER_MINUTE`). This is per serverless instance, so it's a guard against casual abuse, not a global quota.
- **No SSRF.** The custom provider is disabled in production by default, and its URL is validated (http/https only, no embedded credentials).
- **Timeouts and clean errors.** Provider calls time out after 60s; provider failures return `502` with the provider's message, and unexpected errors never leak internals.

**Also recommended:** set a monthly spend limit in each provider's console. It's the only true hard cap on cost.

## Tests

```bash
npm test        # Vitest: request validation, rate limiting, provider adapters, API handler
npm run lint
```

CI (GitHub Actions) runs lint, tests and the production build on every push and pull request.

## Architecture

- **Frontend** — React + Vite. `src/components/PromptEvaluator` is the main UI; `src/lib/llm.js` calls the local API; `src/lib/history.js` persists run history to `localStorage`.
- **Backend** — `server/complete.js` holds the provider dispatch/validation logic, shared by two thin entry points: `server/router.js` (a Vite dev-server middleware, used by `npm run dev`) and `api/complete.js` (a Vercel serverless function, used in production). Both receive `POST /api/complete`, keep provider API keys server-side, and dispatch to a per-provider adapter in `server/providers/`.
- **Adding a provider** — add a new file in `server/providers/` that exports `call(body, apiKey) -> { text, model }`, wire it into the `switch` in `server/complete.js`, and add it to the `PROVIDERS` list in `src/lib/llm.js`.

## Tech stack

React 19, Vite, vanilla `fetch` for API calls (no backend framework, no state library) — the whole app is client + a thin dev-server middleware.
