# AWS IAM Student Builder

An interactive learning website that introduces AWS Identity and Access Management (IAM) through visual explanations and browser-based examples.

## What’s inside

- IAM users, groups, roles, and policies explained with a NovaShop example
- Interactive access-request and allow/deny demonstrations
- A guided walkthrough of how policies are evaluated
- A short IAM knowledge check
- An animated AWS cloud hero

The examples run in the browser and do not send requests to AWS or require AWS credentials. The IAM Lab section describes practice missions and a sandbox, but is not connected to a live AWS account.

## Run locally

Requirements: Node.js and npm. Teammates: see **[ONBOARDING.md](ONBOARDING.md)** for the step-by-step guide (French) including the shared Gemini key for KYUBI.

```powershell
cd aws-iam-platform
npm install
npm run dev
```

Open the local URL printed by Vite.

### KYUBI, the AI assistant (one shared Gemini key)

The site runs without any configuration. KYUBI needs a server-side Gemini key to answer; it is never in the frontend code and never committed to this repository.

1. Get the team key from the team password manager (one shared key, no per-person keys).
2. Create the local env file:

   ```bash
   cd aws-iam-platform
   cp .env.example .env
   ```

3. Paste the key into `.env`:

   ```bash
   GEMINI_API_KEY=the-team-key
   GEMINI_MODEL=gemini-3.5-flash-lite
   ```

4. Nothing to restart: the Vite/Node server re-reads `.env` on every request, so a key added before or after `npm run dev` is picked up on the next KYUBI message. The browser only talks to `/api/kyubi`.

`.env` and `.env.*` are git-ignored (only `.env.example` is committed). Without a key the website still works and KYUBI replies that it is not connected yet.

## Build and lint

Run these commands from `aws-iam-platform`:

```powershell
npm run build
npm run lint
```

To serve the production build locally:

```powershell
npm run preview
```