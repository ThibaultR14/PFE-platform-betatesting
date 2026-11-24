# Plan #4 — Outillage : actions GitHub à jour, Playwright, guide d'installation

Issue : https://github.com/ThibaultR14/PFE-platform-betatesting/issues/4 · Branche : `feat/4-outillage`

## Choix techniques

- **Actions GitHub** : l'issue parle de v5, mais les dernières versions majeures sont plus récentes (vérifié le 2026-11-24) :
  - `actions/checkout@v7` ;
  - `pnpm/action-setup@v6` ;
  - `actions/setup-node@v7` ;
  - `actions/upload-artifact@v7`, pour le rapport Playwright en cas d'échec.

  On prend les dernières : elles tournent toutes sur Node 24.

- **Playwright 1.65**, configuré dans `apps/web`, Chromium seul pour le MVP.
  - En local, `webServer` lance `next dev` et réutilise un serveur déjà lancé.
  - En CI, il lance `next build && next start`, pour tester ce qui sera déployé.
- **E2E dans le job `check` existant**, et pas dans un job à part : c'est le seul check obligatoire de la protection de `main`, donc rien à changer côté GitHub. Ça ajoute environ 1 min à la CI. En CI, on installe Chromium avec `playwright install --with-deps chromium`.
- Les tests E2E sont dans `apps/web/e2e/*.spec.ts`. Vitest ne les ramasse pas, puisqu'il ne lit que `src/**/*.test.ts`.

## Fichiers touchés

| Fichier                                              | Changement                                                                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`                           | actions à jour ; étapes `playwright install` et `test:e2e` ; envoi du rapport si échec                     |
| `apps/web/package.json`                              | `@playwright/test`, script `test:e2e`                                                                      |
| `apps/web/playwright.config.ts`                      | config (Chromium, `baseURL`, `webServer` dev/CI, traces au 1er échec)                                      |
| `apps/web/e2e/home.spec.ts`                          | smoke test : la page d'accueil répond 200, avec le titre, le nom et l'accroche venant de `@microbeta/i18n` |
| `package.json` (racine)                              | `test:e2e`                                                                                                 |
| `eslint.config.mjs`, `.gitignore`, `.prettierignore` | si besoin, pour les dossiers `playwright-report/` et `test-results/` d'`apps/web`                          |
| `docs/dev-setup.md`                                  | **nouveau** guide d'installation (ci-dessous)                                                              |
| `CLAUDE.md`, `docs/architecture.md`                  | commande `test:e2e`, lien vers `dev-setup.md`                                                              |

## Contenu de `docs/dev-setup.md`

1. **Prérequis** : Node 24, pnpm 10, Docker Desktop, Git (et les pièges connus sous Windows).
2. **Installer** : clone, `pnpm install`, `cp .env.example .env`, `docker compose up -d` (port 5433), `pnpm db:deploy`, `pnpm db:seed`.
3. **Créer son bot Discord de test** (chacun le sien) :
   - Developer Portal → New Application ;
   - onglet Bot → token ;
   - Application ID ;
   - OAuth2 → Client ID/Secret et redirect `http://localhost:3000/api/auth/callback/discord` ;
   - aucune intention privilégiée.
4. **Créer son serveur de test** : mode développeur → copier l'ID du serveur ; inviter le bot (scopes `bot applications.commands`).
5. **Remplir `.env`** : tableau variable → où la trouver → obligatoire maintenant, ou plus tard (Stripe, Anthropic, Resend).
6. **Lancer** : `pnpm dev`. Ce qu'on doit voir : le site sur `localhost:3000` et le log du bot. Puis `pnpm jobs:send-test`.
7. **Tester** : `test`, `test:int`, `test:e2e` (`pnpm --filter @microbeta/web exec playwright install chromium` la première fois), lint et format.
8. **Problèmes courants** : port 5432/5433 déjà pris, ancien volume Docker, pnpm dans Git Bash, `.env` absent.

## Tests et vérifications

- `pnpm test:e2e` passe en local (avec `next dev`) et en CI (avec `next build` puis `start`).
- La CI est verte, et je relis les annotations du run (API GitHub) pour vérifier qu'il n'y a plus aucun avertissement de dépréciation.
- **Le guide est vérifié en conditions réelles** : je clone le repo dans un dossier vide et je suis `dev-setup.md` à la lettre, sans le bot Discord (pas de token). Tout écart trouvé est corrigé dans le guide.

## Hors scope

- Les tests E2E des vraies pages, chacun avec sa feature.
- Firefox et WebKit.
- Le déploiement (#33).
