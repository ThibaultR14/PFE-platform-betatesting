# Installer le projet en local

Ce guide part d'une machine vide et va jusqu'au site et au bot lancés, tests compris. Compte environ 30 minutes, dont 10 pour Discord.

Si une étape ne marche pas comme écrit ici, corrige ce fichier dans ta PR.

## 1. Prérequis

| Outil          | Version | Vérifier                 | Installer                                                                                 |
| -------------- | ------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| Node.js        | 24      | `node -v`                | https://nodejs.org (version LTS 24)                                                       |
| pnpm           | 10      | `pnpm -v`                | `corepack enable` ou, s'il échoue (erreur `EPERM` sous Windows), `npm install -g pnpm@10` |
| Docker Desktop | récent  | `docker compose version` | https://www.docker.com/products/docker-desktop (le lancer avant la suite)                 |
| Git            | récent  | `git --version`          | https://git-scm.com                                                                       |

Sous Windows, lance les commandes dans **PowerShell**, une ligne à la fois : PowerShell 5.1 (celui livré avec Windows) ne comprend pas `&&`. Dans Git Bash, `pnpm` installé par npm n'est parfois pas trouvé (voir [Problèmes courants](#8-problèmes-courants)).

## 2. Installer

```bash
git clone https://github.com/ThibaultR14/PFE-platform-betatesting.git
cd PFE-platform-betatesting
pnpm install                 # génère aussi le client Prisma
cp .env.example .env         # PowerShell : Copy-Item .env.example .env
docker compose up -d --wait  # attend que Postgres soit prêt (port 5433, bases microbeta et microbeta_test)
pnpm db:deploy               # applique les migrations sur la base de dev
pnpm db:seed                 # données de démo (efface et recrée)
```

Le `.env` copié marche tel quel pour la base de données. Le reste (Discord, Stripe…) se remplit plus bas, au fur et à mesure.

**À ce stade, tu peux déjà lancer le site et le bot** sans Discord : passe à l'[étape 6](#6-lancer) pour vérifier, puis reviens ici.

## 3. Créer son bot Discord de test

Chaque développeur a **son propre bot et son propre serveur de test**, pour ne pas recevoir les messages de l'autre.

Une **application** Discord regroupe le bot (un compte piloté par notre code, qui se connecte avec le token), les slash commands (rattachées à l'Application ID) et la connexion OAuth2 du site. Le **serveur** est à part : le bot n'y agit qu'une fois invité (étape 4).

Pour s'y retrouver, on nomme les trois de la même façon :

| Élément     | Nom                                   |
| ----------- | ------------------------------------- |
| Application | `MicroBeta Dev <ton prénom>`          |
| Bot         | `MicroBeta Bot <ton prénom>`          |
| Serveur     | `MicroBeta Serveur Test <ton prénom>` |

1. Va sur https://discord.com/developers/applications → **New Application**. Nom : `MicroBeta Dev <ton prénom>`.
2. Page **General Information** : copie l'**Application ID** → `DISCORD_APPLICATION_ID`.
3. Onglet **Bot** :
   - **Username** → `MicroBeta Bot <ton prénom>`, puis **Save Changes** (si le nom est refusé, ajoute un chiffre) ;
   - **Reset Token** → copie le token → `DISCORD_BOT_TOKEN`. Il n'est affiché qu'une fois, et il ne doit **jamais** être commité ni collé dans une issue.
   - Laisse les trois **Privileged Gateway Intents** désactivés : le bot passe par les commandes et les boutons, pas par la lecture des messages.
4. Onglet **OAuth2** (connexion des porteurs au site) :
   - **Client ID** → `AUTH_DISCORD_ID` (c'est le même nombre que l'Application ID) ;
   - **Reset Secret** → `AUTH_DISCORD_SECRET` ;
   - **Redirects** → ajoute `http://localhost:3000/api/auth/callback/discord`, puis **Save Changes**.

## 4. Créer son serveur de test et y inviter le bot

1. Dans l'application Discord (pas sur le Developer Portal) : **+** en bas de la colonne des serveurs (ajouter un serveur) → **Créer le mien** → **Pour moi et mes amis**. Nom : `MicroBeta Serveur Test <ton prénom>`.
2. Active le mode développeur : **Paramètres utilisateur (⚙️) → Avancés → Mode développeur**.
3. Clic droit sur l'icône du serveur → **Copier l'identifiant du serveur** → `DISCORD_HUB_GUILD_ID`.
4. Invite le bot : Developer Portal → **OAuth2 → URL Generator** :
   - scopes `bot` et `applications.commands` (sans ce dernier, `/aide` n'apparaît pas) ;
   - si la liste **Integration Type** est affichée : **Guild Install** ;
   - permissions `View Channels`, `Send Messages`, `Embed Links`, `Read Message History` (en français : Voir les salons, Envoyer des messages, Intégrer des liens, Voir les anciens messages) ;
   - ouvre l'URL générée et choisis ton serveur de test. Le bot apparaît dans les membres, hors ligne tant qu'il n'est pas lancé.

## 5. Remplir `.env`

| Variable                                                              | Où la trouver                                                              | Quand                                                                                                      |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`, `TEST_DATABASE_URL`                                   | déjà bonnes dans `.env.example`                                            | maintenant                                                                                                 |
| `AUTH_SECRET`                                                         | `openssl rand -base64 32` (ou n'importe quelle chaîne longue et aléatoire) | avec la connexion (#5)                                                                                     |
| `AUTH_URL`                                                            | déjà bonne (`http://localhost:3000`)                                       | —                                                                                                          |
| `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`                              | étape 3.4                                                                  | avec la connexion (#5)                                                                                     |
| `DISCORD_BOT_TOKEN`, `DISCORD_APPLICATION_ID`, `DISCORD_HUB_GUILD_ID` | étapes 3 et 4                                                              | avec la connexion du bot (#22). **Toutes ou aucune** : le bot refuse de démarrer s'il n'en a qu'une partie |
| `STRIPE_*`                                                            | dashboard Stripe en mode test                                              | avec les paiements (#18)                                                                                   |
| `ANTHROPIC_API_KEY`                                                   | console Anthropic                                                          | avec la génération IA (#9)                                                                                 |
| `TESTER_LINK_SECRET`                                                  | chaîne longue et aléatoire, comme `AUTH_SECRET`                            | avec la page web testeur (#17)                                                                             |
| `RESEND_API_KEY`, `EMAIL_FROM`                                        | dashboard Resend                                                           | avec l'email de secours (#30)                                                                              |

Les variables vides sont ignorées tant que la fonctionnalité qui en a besoin n'existe pas.

## 6. Lancer

```bash
pnpm dev     # site + bot, en parallèle (Turborepo)
```

Ce que tu dois voir :

- le site sur http://localhost:3000 : le nom « MicroBeta » et son accroche ;
- dans le terminal, le log du bot : `[bot] workers pg-boss démarrés…`. La mention « sans Discord » est normale tant que les variables `DISCORD_*` sont vides.

Une fois les trois variables `DISCORD_*` remplies :

- le log affiche aussi `[bot] Bot connecté en tant que <nom du bot>`, et le bot apparaît en ligne sur ton serveur de test ;
- `/aide` répond, sur le serveur comme en message privé au bot. La réponse n'est visible que par toi. La première fois, la commande peut mettre quelques minutes à apparaître dans Discord (redémarre Discord avec Ctrl+R si besoin) ;
- si le log affiche `Connexion à Discord impossible`, le token ou l'Application ID est faux : refais l'étape 3.

Pour vérifier que le bot reçoit bien les tâches, lance dans un **second terminal** :

```bash
pnpm jobs:send-test
```

Le premier terminal doit afficher `[jobs] send-welcome reçue …`.

Autres commandes utiles : `pnpm db:studio` (parcourir la base dans le navigateur), `pnpm --filter @microbeta/web dev` (le site seul).

### Lancer et arrêter le bot

Postgres doit tourner (`docker compose up -d --wait`).

| Besoin                                            | Commande                             |
| ------------------------------------------------- | ------------------------------------ |
| Bot seul, redémarré à chaque modification du code | `pnpm --filter @microbeta/bot dev`   |
| Site et bot ensemble                              | `pnpm dev`                           |
| Bot seul, sans redémarrage automatique            | `pnpm --filter @microbeta/bot start` |
| Arrêter                                           | **Ctrl+C** dans son terminal         |

Ctrl+C affiche `[bot] SIGINT reçu, arrêt en cours…` : le bot se déconnecte de Discord, puis arrête pg-boss. S'il bloque plus de 15 s, il sort tout seul. Ne lance qu'un bot à la fois : deux process avec le même token répondraient tous les deux aux commandes.

## 7. Tester

```bash
pnpm test            # tests unitaires (sans BDD)
pnpm test:int        # tests d'intégration, sur microbeta_test (vidée à chaque run)
pnpm --filter @microbeta/web exec playwright install chromium   # une seule fois (Linux : ajouter --with-deps)
pnpm test:e2e        # tests de bout en bout du site (Playwright, lance next dev tout seul)
pnpm lint
pnpm format:check
pnpm typecheck
```

La CI lance exactement ces commandes sur chaque PR.

## 8. Problèmes courants

- **`port is already allocated` sur 5433**, ou Prisma qui ne se connecte pas : un autre Postgres utilise le port. Arrête-le, ou change le port côté hôte dans `docker-compose.yml` **et** dans les deux URL du `.env`.
- **`database "microbeta_test" does not exist`** : ton volume Docker date d'avant l'ajout de la base de test. Recrée-le (ça efface la base de dev) en lançant, une par une : `docker compose down -v`, `docker compose up -d --wait`, `pnpm db:deploy`, `pnpm db:seed`.
- **`Variables d'environnement manquantes : DATABASE_URL`** : le fichier `.env` n'existe pas à la racine. Refais `cp .env.example .env`.
- **`pnpm` introuvable dans Git Bash** (Windows) : utilise PowerShell, ou `cmd //c "pnpm <commande>"`.
- **`pnpm test:e2e` : `Executable doesn't exist`** : Chromium n'est pas installé, lance la commande `playwright install chromium` de l'étape 7.
- **Le port 3000 est déjà pris** : `pnpm test:e2e` réutilise le serveur déjà lancé s'il répond. Pour un autre port : `E2E_PORT=3100 pnpm test:e2e` (PowerShell : `$env:E2E_PORT=3100; pnpm test:e2e`).
