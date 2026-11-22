# Team setup — lancer le site et KYUBI en local

Guide pour les coéquipiers : **cloner → installer → lancer**.
Le site fonctionne entièrement en local. KYUBI (l'assistant IA) utilise une clé Gemini **partagée par l'équipe**, qui reste côté serveur.

---

## 1. Prérequis

- **Node.js 20 ou plus récent** (testé avec Node 24) — <https://nodejs.org>
- **npm** (installé avec Node)
- **git**

Vérifier :

```bash
node -v
npm -v
git --version
```

---

## 2. Cloner le projet

```bash
git clone https://github.com/IDRIHOUSSAM777/AWS-IAM-Website-main-after-adding-ai-assistant-.git
cd AWS-IAM-Website-main-after-adding-ai-assistant-
```

---

## 3. Installer et lancer (le site marche déjà)

```bash
cd aws-iam-platform
npm install
npm run dev
```

Ouvrir l'URL affichée par Vite, en général <http://localhost:5173>.

À ce stade tout le site fonctionne. Si KYUBI n'est pas encore configuré, il répond simplement
« Kyubi is not connected yet… » — ce n'est pas un bug.

---

## 4. Activer KYUBI (une seule clé pour toute l'équipe)

Personne n'a besoin de créer sa propre clé Gemini. **Une seule clé** est créée par le responsable
du projet et partagée via le gestionnaire de mots de passe de l'équipe (1Password, Bitwarden, etc.).
Un mot de passe ne s'envoie **jamais** par WhatsApp, Discord, email ou dans le code.

Dans `aws-iam-platform` :

```bash
cp .env.example .env
```

Ouvrir `.env` et coller la clé de l'équipe :

```bash
GEMINI_API_KEY=la-cle-de-lequipe
GEMINI_MODEL=gemini-3.5-flash-lite
```

Relancer le serveur :

```bash
npm run dev
```

KYUBI répond maintenant. La clé est lue uniquement par le serveur Node/Vite
(`server/kyubi-api.mjs`) ; le navigateur n'appelle que `/api/kyubi`, donc la clé
n'apparaît jamais dans le code frontend ni dans le réseau du navigateur.

---

## 5. Ce qu'il ne faut jamais faire

- Ne pas committer `.env`, `.env.local` ou tout autre `.env.*` (déjà dans `.gitignore`).
- Ne pas mettre la clé dans un fichier sous `src/`, `public/` ou `index.html`.
- Ne pas coller la clé dans une capture d'écran, un ticket ou un message de groupe.
- Si une clé a fuité : la révoquer sur <https://aistudio.google.com/apikey>, en créer une nouvelle,
  et envoyer la nouvelle via le gestionnaire de mots de passe.

Vérifier avant chaque commit :

```bash
git status          # .env ne doit jamais apparaître
git diff --cached   # aucune clé dans les fichiers ajoutés
```

---

## 6. Commandes utiles

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Site + API KYUBI sur <http://localhost:5173> |
| `npm run build` | Vérification TypeScript + build dans `dist/` |
| `npm run preview` | Sert le build avec l'API KYUBI |
| `npm run start` | Serveur Node de production (`PORT`, défaut `4173`) |
| `npm run lint` | Oxlint |

---

## 7. Problèmes fréquents

| Symptôme | Cause / solution |
| --- | --- |
| « Kyubi is not connected yet » | `.env` absent ou `GEMINI_API_KEY` vide → refaire l'étape 4 et **redémarrer** `npm run dev`. |
| « The Gemini API key was rejected » | Clé fausse, révoquée ou copiée avec un espace en trop. |
| Réponses « high demand » / lentes | Limite temporaire de Google ; réessayer. Le modèle par défaut `gemini-3.5-flash-lite` est le plus rapide. |
| `git push` échoue en HTTP 400 | Réseau/HTTP2 : `git config http.version HTTP/1.1` puis réessayer. |
| Port 5173 déjà utilisé | `npm run dev -- --port 5174`. |

---

## 8. Option avancée (plus tard)

Pour que l'équipe n'ait **aucune** clé à manipuler en local, on peut déployer une fois
`server/index.mjs` sur un hôte Node (Render, Railway, Fly.io, Cloud Run) avec
`GEMINI_API_KEY` en variable d'environnement, et faire pointer le frontend vers cette API.
Cette option demande un jeton partagé ou une liste d'origines autorisées, sinon l'API déployée
serait utilisable par n'importe qui.
