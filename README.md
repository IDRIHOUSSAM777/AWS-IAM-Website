# AWS IAM Student Builder

An interactive learning website that introduces AWS Identity and Access Management (IAM) through visual explanations and browser-based examples — plus **KYUBI**, an AI assistant, a saved-visitor-name feature, and a short quiz with a leaderboard.

---

## ⚠️ Important: the database runs in a VM — the owner must turn it on first

This project is not only static files. It has a **frontend**, a **backend** (`server/`), and a **MySQL/MariaDB database that runs inside a virtual machine**. The database is **not** stored in this repository.

Before you run the project, understand this:

- **The VM must be powered on by the owner of the project.** If the VM is off, the site still opens, but saving a name / the quiz / the leaderboard will not work.
- The VM is on a **private network** (`192.168.59.128`). Your computer must be on the **same network or VPN** to reach it.
- **Ask the owner (IDRIHOUSSAM777) to:**
  1. turn the VM on, and
  2. give you the **database password privately** (never through a public message).
- **No database, no password and no real data are included in this repository.** Only `database/schema.sql` (empty structure) is here.

---

## What's inside

- IAM users, groups, roles, and policies explained with a NovaShop example
- Interactive access-request and allow/deny demonstrations
- A guided walkthrough of how policies are evaluated
- A short IAM knowledge check with a leaderboard
- A name/welcome feature stored in a database
- KYUBI, the AI assistant (Google Gemini, key kept on the server)
- An animated AWS cloud hero

The IAM Lab section describes practice missions and a sandbox, but is **not** connected to a live AWS account. The examples run in the browser and do not send requests to AWS.

The project lives in the **`aws-iam-platform`** sub-folder.

## Run locally

Requirements: **Node.js 20+**, **npm**, and **git**.

```powershell
git clone https://github.com/IDRIHOUSSAM777/AWS-IAM-Website.git
cd AWS-IAM-Website/aws-iam-platform
npm install
```

Then create your local env file and fill it in:

```powershell
copy .env.example .env
```

Open `.env` and set at least:

```bash
GEMINI_API_KEY=the-team-key          # optional: KYUBI stays silent without it
DB_HOST=192.168.59.128               # the owner's VM (must be turned on)
DB_PORT=3306
DB_USER=aws
DB_PASSWORD=the-password-from-the-owner
DB_NAME=aws_iam_platform
```

Start the site:

```powershell
npm run dev
```

Open the local URL printed by Vite (usually <http://localhost:5173>).

### What works without the VM / without the Gemini key

| Feature | Needs the VM | Needs Gemini key |
| --- | --- | --- |
| The whole IAM course and demos | no | no |
| Saving a name / welcome-back | **yes** | no |
| Quiz + leaderboard | **yes** | no |
| KYUBI answers | no | **yes** |

If the VM is off, saving a name shows a polite message instead of an error, and you can still use the rest of the site. If there is no Gemini key, KYUBI replies that it is not connected yet — not a bug.
