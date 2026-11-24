# Team setup — lancer le site et KYUBI en local

Guide pour les coéquipiers : **cloner → installer → lancer**.
Le site fonctionne en local, mais il utilise une **base de données MySQL/MariaDB qui tourne dans une machine virtuelle (VM)**. KYUBI (l'assistant IA) utilise une clé Gemini **partagée par l'équipe**, qui reste côté serveur.

> ⚠️ **La VM doit être allumée par le propriétaire du projet.**
> Sans elle, le site s'affiche quand même, mais enregistrer un nom, le quiz et le classement ne fonctionnent pas.
> La VM est sur le réseau privé `192.168.59.128` : il faut être sur le même réseau (ou VPN).
> Demander au propriétaire (1) d'allumer la VM et (2) le mot de passe de la base **en privé**.
> Aucune base, aucun mot de passe et aucune donnée réelle ne sont dans ce dépôt.

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
git clone https://github.com/IDRIHOUSSAM777/AWS-IAM-Website.git
cd AWS-IAM-Website
```

Si git n'est pas installé : bouton vert **Code → Download ZIP** sur la page GitHub, puis décompresser.
Dans les deux cas, la suite se passe dans le sous-dossier `aws-iam-platform`.

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

Dans `aws-iam-platform` (l'ordre n'a pas d'importance : la clé peut être ajoutée avant **ou**
après `npm run dev`, sans relancer) :

```bash
cp .env.example .env
```

Ouvrir `.env` et coller la clé de l'équipe :

```bash
GEMINI_API_KEY=la-cle-de-lequipe
GEMINI_MODEL=gemini-3.5-flash-lite
```

Vite surveille `.env`, mais ce n'est même pas nécessaire : le serveur relit `.env` **à chaque
message envoyé à KYUBI**. Donc une seule exécution de `npm run dev` suffit — pas de `Ctrl+C`,
pas de deuxième lancement, même si tu as ajouté la clé après avoir démarré le serveur.
Réessaie simplement une question dans le chat KYUBI.

KYUBI répond maintenant. La clé est lue uniquement par le serveur Node/Vite
(`server/kyubi-api.mjs`) ; le navigateur n'appelle que `/api/kyubi`, donc la clé
n'apparaît jamais dans le code frontend ni dans le réseau du navigateur.

---

## 4 bis. La base de données (VM) — le propriétaire doit l'allumer

Le site enregistre les noms et les réponses du quiz dans une base **MySQL/MariaDB** qui tourne dans une **machine virtuelle**. Elle n'est pas dans ce dépôt.

- **La VM doit être allumée** par le propriétaire, sinon impossible d'enregistrer un nom, de faire le quiz ou d'afficher le classement. Le reste du site fonctionne quand même.
- La VM est sur le réseau privé `192.168.59.128` (port `3306`) : il faut être sur le même réseau ou en VPN.
- Demander au propriétaire : (1) d'allumer la VM, (2) le mot de passe de la base, **jamais par message public**.
- Le schéma de la base est dans `aws-iam-platform/database/schema.sql`. Aucune donnée réelle n'est dans le dépôt.

Compléter `.env` (dans `aws-iam-platform`) :

```bash
DB_HOST=192.168.59.128
DB_PORT=3306
DB_USER=aws
DB_PASSWORD=le-mot-de-passe-fourni-par-le-proprietaire
DB_NAME=aws_iam_platform
```

Pour tourner **sans la VM**, il faut installer sa propre base MySQL/MariaDB et importer `aws-iam-platform/database/schema.sql`.

---

## 5. Mettre à jour le projet plus tard

Quand le responsable pousse une correction sur GitHub, chaque coéquipier récupère la mise à jour :

```bash
cd AWS-IAM-Website
git pull
cd aws-iam-platform
npm install   # seulement si package.json a changé
npm run dev
```

`.env` reste sur la machine de chacun et n'est jamais écrasé par `git pull` (il est ignoré par git).

---

## 6. Ce qu'il ne faut jamais faire

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

## 7. Commandes utiles

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Site + API KYUBI sur <http://localhost:5173> |
| `npm run build` | Vérification TypeScript + build dans `dist/` |
| `npm run preview` | Sert le build avec l'API KYUBI |
| `npm run start` | Serveur Node de production (`PORT`, défaut `4173`) |
| `npm run lint` | Oxlint |

---

## 8. Problèmes fréquents

| Symptôme | Cause / solution |
| --- | --- |
| « Kyubi is not connected yet » | `.env` absent ou `GEMINI_API_KEY` vide → refaire l'étape 4, enregistrer `.env` et renvoyer un message (aucun redémarrage nécessaire). |
| « The Gemini API key was rejected » | Clé fausse, révoquée ou copiée avec un espace en trop. Corriger `.env`, enregistrer, puis renvoyer un message (aucun redémarrage nécessaire). |
| Réponses « high demand » / lentes | Limite temporaire de Google ; réessayer. Le modèle par défaut `gemini-3.5-flash-lite` est le plus rapide. |
| `git push` échoue en HTTP 400 | Réseau/HTTP2 : `git config http.version HTTP/1.1` puis réessayer. |
| Port 5173 déjà utilisé | `npm run dev -- --port 5174`. |

---

## 9. Option avancée (plus tard)

Pour que l'équipe n'ait **aucune** clé à manipuler en local, on peut déployer une fois
`server/index.mjs` sur un hôte Node (Render, Railway, Fly.io, Cloud Run) avec
`GEMINI_API_KEY` en variable d'environnement, et faire pointer le frontend vers cette API.
Cette option demande un jeton partagé ou une liste d'origines autorisées, sinon l'API déployée
serait utilisable par n'importe qui.
