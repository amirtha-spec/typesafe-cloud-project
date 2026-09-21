# TypeSafe Cloud Project

A minimal TypeScript example of calling [TypeSafe AI](https://typesafe.ai)'s
Jev model, set up to run in Claude Code cloud sessions.

Jev is a "System One" model: rather than free-form text, you give it state plus
typed questions (`choice`, `score`, `noul`) and get back typed answers with
calibrated probabilities.

## What's here

| Path             | Purpose                                                  |
| ---------------- | -------------------------------------------------------- |
| `src/example.ts` | Minimal example: classify a support ticket with Jev       |
| `.env.example`   | Template for local development (real `.env` is gitignored) |

Dependencies: [`@typesafe-ai/sdk`](https://github.com/typesafe-ai/typesafe-sdk-js)
(the official JS/TS SDK), plus `typescript`, `tsx`, and `@types/node` for dev.
Requires Node.js 20 or newer.

## Where to put your API key

**Never put the key in the code, and never commit it.** `.env` is gitignored;
the SDK reads the key from the `TYPESAFE_API_KEY` environment variable.

### In a Claude Code cloud session (this repo's main use)

1. Go to [claude.ai/code](https://claude.ai/code) and select the cloud icon
   showing the current environment's name, in the row above the message box.
2. Hover over the environment and select the settings (gear) icon, or select
   **Add cloud environment** to create one.
3. In the **Environment variables** box, add one line:

   ```text
   TYPESAFE_API_KEY=your-real-key-here
   ```

4. Set **Network access** to **Custom** and add `api.typesafe.ai` to
   **Allowed domains** — one domain per line. TypeSafe is not on the default
   **Trusted** allowlist, so without this the SDK fails with
   `403 Host not in allowlist: api.typesafe.ai`.
5. Save. Sessions copy environment variables once at startup, so **start a new
   session** for the key to take effect — running sessions keep their old values.

Note: anyone who uses that cloud environment can read its environment
variables. On Pro and Max plans you can instead store the key as an
**API credential** on the environment (added from the environment's editor,
below **Environment variables**), where Anthropic's proxy attaches it to
requests after they leave the session and Claude never sees the value. That
route suits direct `curl`/HTTP calls to `api.typesafe.ai`; this SDK refuses to
construct a client unless `TYPESAFE_API_KEY` is also set locally, so the
environment-variable route above is the straightforward one for `src/example.ts`.

### Locally

```sh
cp .env.example .env    # then paste your key into .env
npm install
node --env-file=.env --import tsx src/example.ts
```

### In GitHub Actions

Add it as a repository secret (**Settings > Secrets and variables > Actions >
New repository secret**), then reference it in the workflow:

```yaml
env:
  TYPESAFE_API_KEY: ${{ secrets.TYPESAFE_API_KEY }}
```

## Run it

```sh
npm install
npm run example     # needs TYPESAFE_API_KEY in the environment
npm run typecheck   # works without a key
```

Expected output shape:

```text
model:      jev-latest
category:   billing (confidence 0.97)
urgent:     84.0% likely
tokens:     ...
-> route to the billing queue
```

## Other environment variables

All optional; defaults shown.

| Variable                 | Default                    |
| ------------------------ | -------------------------- |
| `TYPESAFE_BASE_URL`      | `https://api.typesafe.ai`  |
| `TYPESAFE_DEFAULT_MODEL` | `jev-latest`               |
| `TYPESAFE_LOG_LEVEL`     | `warn`                     |
