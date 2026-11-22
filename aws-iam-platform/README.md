# AWS IAM & Access Security — Student Builder

KYUBI, the AWS IAM assistant, is included in this app. It talks to Google Gemini through a small server-side proxy in `server/`, so the API key never reaches the browser and is never committed.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

That runs the whole site, KYUBI included. The only extra step is the team's Gemini key (next section) — without it the site still runs normally and KYUBI replies that it is not connected yet.

## KYUBI setup (one shared team key)

Do **not** create one key per teammate, and never commit the key.

1. One owner creates the key at <https://aistudio.google.com/apikey> and keeps it in the team password manager (1Password, Bitwarden, …).
2. Each teammate copies `.env.example` to `.env` and pastes the shared key:

   ```bash
   cp .env.example .env
   ```

   ```bash
   GEMINI_API_KEY=your-key-here
   GEMINI_MODEL=gemini-3.5-flash-lite
   ```

3. `npm run dev`. The key is read only by the Node/Vite server (`server/kyubi-api.mjs`) and is never sent to the browser.

`.env`, `.env.local` and `.env.*` are already git-ignored; only `.env.example` (no secret) is committed. If a key ever lands in a commit, revoke it in AI Studio and create a new one.

Optional: API keys can be restricted to the Generative Language API in Google Cloud Console, so a leaked key cannot be used for other Google services.

### Scripts

- `npm run dev` — app + KYUBI API at `http://localhost:5173`
- `npm run build` — type-check and build to `dist/`
- `npm run preview` — serve the build with the KYUBI API
- `npm run start` — production Node server for `dist/` + KYUBI API (`PORT`, default `4173`)
- `npm run lint` — Oxlint

### KYUBI files

| Path | Role |
| --- | --- |
| `src/kyubi/Kyubi.tsx` | Floating mascot button, chat window, greeting, states |
| `src/kyubi/MessageText.tsx` | Small Markdown renderer for answers |
| `src/kyubi/kyubi.css` | Isolated styles (`ky-` prefix) |
| `server/kyubi-api.mjs` | Gemini proxy: validation, same-origin check, rate limit, error mapping |
| `server/kyubi-system-prompt.mjs` | KYUBI's system instructions |
| `server/index.mjs` | Dependency-free production server |
| `public/kyubi/` | Original Kyubi avatar and greeting videos |

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
