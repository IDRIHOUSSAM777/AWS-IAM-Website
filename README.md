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

Requirements: Node.js and npm.

```powershell
cd aws-iam-platform
npm install
npm run dev
```

Open the local URL printed by Vite.

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