# Activate the Abstraction Foundry

The public website stays on GitHub Pages. The Cloudflare Worker calls Gemini privately. D1 stores only quota counters. The feature starts in sample mode and makes no API requests until you configure its public endpoint.

## 1. Create the Worker

In Cloudflare, open **Workers & Pages → Create application** and create a basic Hello World Worker named **harwood-foundry-api**. Open its code editor, replace the starter module with the complete contents of `worker/worker.mjs` from this branch, then deploy.

The file has no imports or dependencies. Keep the module's default export. Its endpoint will be:

`https://harwood-foundry-api.YOUR-SUBDOMAIN.workers.dev/api/foundry`

A normal browser visit is intentionally rejected; this endpoint accepts POST requests from the configured website origin.

## 2. Create the tiny usage database

Open Cloudflare **Storage & databases → D1** and create **harwood-foundry-usage**. Open the database console and execute the two statements in `worker/schema.sql` (one at a time if the console requires it).

Return to the Worker and add a **D1 database binding**:

- Binding name: `DB` (capital letters)
- Database: `harwood-foundry-usage`

Apply/deploy the binding change.

## 3. Add settings and the private key

Under the Worker's **Settings → Variables and Secrets**, add these text values:

| Name | Value |
|---|---|
| `ALLOWED_ORIGINS` | `https://thomas-harwood.com` |
| `GEMINI_MODEL` | `gemini-2.5-flash-lite` |
| `DAILY_LIMIT` | `50` |
| `PER_IP_HOURLY_LIMIT` | `3` |
| `LIVE_ENABLED` | `true` |

Add **`GEMINI_API_KEY` as a Secret**, with the API key from Google AI Studio. Do not put it in the repository, frontend configuration, screenshots, or chat. Deploy the settings.

If visitors also use a working www hostname without redirecting, explicitly add it to `ALLOWED_ORIGINS`, separated by a comma. Do not use `*`.

## 4. Connect the page

In the repository's `foundry-config.js`, replace the empty `apiUrl` with the full public Worker endpoint from step 1. That URL is not a secret. Example:

```js
window.HARWOOD_FOUNDRY_CONFIG = Object.freeze({
  apiUrl: 'https://harwood-foundry-api.YOUR-SUBDOMAIN.workers.dev/api/foundry'
});
```

Merge the feature branch after reviewing it. GitHub Pages deploys the interface. The live button enables when the endpoint is configured. Use a nonconfidential test workflow from the actual site and confirm an **AI-generated concept** appears. This costs one request.

You can share the public Worker URL with the assistant to complete the page configuration. The key stays in Cloudflare.

## Limits and operating behavior

- Default maximum: **50 model attempts per UTC day** for the whole site and **3 attempts per hour per IP address**. Shared networks share the hourly allowance.
- The SQL reservation is atomic, not an in-memory counter. Parallel requests cannot exceed the daily model-call cap. Reservations happen before the model call and are not refunded on provider errors or client disconnects.
- Configured limits are clamped to a maximum of 100/day and 10/hour/IP. These are request limits, not a dollar-budget guarantee. Model prices, token usage, and account/provider allowances determine AI costs.
- Only one provider request per accepted submission; no automatic retries. Input: 20–1,200 characters, at most 6,000 encoded request bytes. Output: at most 1,000 tokens. Provider timeout: 20 seconds.
- The client cannot choose the model, API URL, system prompt, or output budget.
- Origin checks constrain browser use, but **CORS is not authentication**. A non-browser client can spoof Origin. The atomic global allowance remains the cost backstop. Add Turnstile if abuse becomes an issue.
- Set `LIVE_ENABLED` to `false` and deploy to stop new AI requests. Requests already in flight can complete. Samples remain available. Rotate/revoke the Google key if needed.
- D1 stores expiry timestamps, counters, and hourly keyed hashes of IP addresses—not raw IPs or workflow descriptions. Old counters are deleted on accepted requests; expiry does not itself trigger deletion. Google receives the workflow and processes it under the terms of the selected API tier. Infrastructure providers may retain their own operational metadata.
- No prompt/response logging is implemented. The Wrangler configuration disables Worker observability; check dashboard logging settings if deploying manually.
- The visible sample is static and explicitly labeled. Provider failure never silently substitutes a sample for an AI answer.

## Optional CLI deployment

Use a recent Wrangler CLI through `npx wrangler` (requires Node.js and your Cloudflare login). From `worker/`:

```sh
npx wrangler login
npx wrangler d1 create harwood-foundry-usage
```

Copy the returned database ID into `wrangler.jsonc`, replacing `REPLACE_WITH_YOUR_D1_DATABASE_ID`.

```sh
npx wrangler d1 execute harwood-foundry-usage --remote --file=schema.sql
npx wrangler secret put GEMINI_API_KEY
```

Change `LIVE_ENABLED` to `true` in `wrangler.jsonc`, then:

```sh
npx wrangler deploy
```

The secret command prompts privately. Never insert the key directly into a shell command or configuration file. Later CLI deployments apply the variables in `wrangler.jsonc`, so keep them in sync with dashboard settings.

## Verification

From the repository root, with Node.js 22.13+ or 24:

```sh
node --test tests/worker.test.mjs tests/frontend.test.mjs
```

Worker tests use real in-memory SQLite with the same schema/reservation SQL and a mocked Gemini response. They cover concurrent daily limits, per-IP limits, malformed requests, provider failures, missing config, and bounded output settings. Frontend tests exercise sample/live/error/copy behavior in a small mocked DOM. These do not prove Cloudflare deployment, real Gemini account access, or browser layout; complete the live smoke check above before announcing activation.

## Official references

- [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)
- [Gemini 2.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-lite)
- [Gemini generateContent API](https://ai.google.dev/api/generate-content)

The selected stable model supports structured output. Its identifier is configurable if your Google account uses a different compatible model; verify support and pricing before switching.
