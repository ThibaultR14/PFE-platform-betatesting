# MicroBeta (nom provisoire)

Plateforme de micro-testing : l'IA génère et découpe un plan de test, un bot Discord l'envoie par petits lots aux testeurs et les relance, et le site regroupe les réponses. Voir @docs/SPEC.md et @docs/architecture.md.

## Commandes

- install : `pnpm install`, `cp .env.example .env`, `docker compose up -d --wait` (Postgres sur le port **5433**). Guide complet : docs/dev-setup.md
- dev : `pnpm dev` (web + bot via Turborepo) — un seul : `pnpm --filter @microbeta/web dev`
- test : `pnpm test` (unitaires, sans BDD) · `pnpm test:int` (`*.int.test.ts`, sur `TEST_DATABASE_URL`, qui est vidée à chaque run) · `pnpm test:e2e` (Playwright, `apps/web/e2e`)
- lint : `pnpm lint` (ESLint) et `pnpm format:check` (Prettier) — corriger : `pnpm lint:fix && pnpm format`
- typecheck : `pnpm typecheck`
- build : `pnpm build`
- BDD : `pnpm db:migrate --name <nom>` (nouvelle migration) · `pnpm db:deploy` · `pnpm db:seed` (efface et recrée les données de démo) · `pnpm db:studio` · `pnpm db:generate`

## Structure

- `apps/web` : site Next.js (porteur + pages web testeur)
- `apps/bot` : bot discord.js + tâches pg-boss (envois, relances)
- `packages/core` : logique métier partagée (planification, quotas, règles de campagne)
- `packages/i18n` : tous les textes affichés, en français
- `packages/jobs` : contrat des tâches pg-boss (payloads Zod, `enqueue()`, `registerWorkers()`). Toute nouvelle tâche s'y déclare. Test manuel : lancer le bot, puis `pnpm jobs:send-test`.
- `packages/db` : Prisma 7, schéma, migrations, données de démo. Importer depuis `@microbeta/db` (`getPrisma()`), jamais depuis `src/generated/`.
- À venir : `packages/ai` (couche IA, sorties validées par Zod)
- TypeScript reste en 6.0 : typescript-eslint ne supporte pas encore la 7.

## Conventions

- TypeScript strict partout, pas de `any`.
- Aucun texte écrit en dur dans les composants ni dans le bot : il passe par `packages/i18n`.
- La logique métier va dans `packages/core`, jamais directement dans `apps/web` ni `apps/bot`.
- Les tâches pg-boss doivent pouvoir être rejouées sans doublon (vérifier l'état avant d'envoyer).
- Chaque appel IA est enregistré dans `AiUsage` (modèle, tokens, coût).
- Chaque réponse garde une copie de la question posée (`questionSnapshot`).

## Git

- **Ne jamais ajouter Claude comme co-auteur** : pas de ligne `Co-Authored-By: Claude`, ni de mention « Generated with Claude Code », dans les commits comme dans les PR.
- Messages de commit en français, au format Conventional Commits (`feat:`, `fix:`, `chore:`…).
- Ne jamais pousser directement sur `main` : tout passe par une PR, avec la CI `check` au vert. La relecture par l'autre membre de l'équipe est conseillée mais pas obligatoire : chacun peut merger sa propre PR.

## Workflow

- Toute feature part d'une issue GitHub. On s'assigne l'issue et on déplace sa carte sur le board **avant** de commencer.
- Sauvegarde chaque plan dans docs/plans/<numéro-issue>-<nom>.md avant d'implémenter.
- Toute modification de `packages/db/prisma/schema.prisma` se fait dans une PR à part, annoncée à l'autre membre de l'équipe.
- Note toute décision importante dans docs/decisions.md.
- Toute UI respecte docs/design.md.
- Lance les tests et le lint avant de dire qu'une tâche est finie, et montre la sortie.
- Branches : feat/<numéro>-<nom>, fix/<numéro>-<nom>. PR avec "Closes #<numéro>".
- Avant d'ouvrir une PR, rebase sur `main`.

## Compaction

Lors d'une compaction, garde toujours : l'issue en cours, la liste des fichiers modifiés, les commandes de test.
