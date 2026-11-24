# Plan #2 — Base de données : Prisma, schéma complet, données de démo

Issue : https://github.com/ThibaultR14/PFE-platform-betatesting/issues/2 · Branche : `feat/2-schema-prisma`

## Choix techniques

- **Prisma 7.10** (dernière version stable). Ce qui change par rapport à la v6, d'après la doc lue le 2026-11-24 :
  - générateur `prisma-client` avec un `output` obligatoire ;
  - l'URL de connexion se met dans `prisma.config.ts` ;
  - driver adapter `@prisma/adapter-pg` ;
  - le `.env` n'est plus chargé tout seul (il faut `dotenv`) ;
  - le seed ne se lance plus tout seul après `migrate dev` ;
  - le paquet doit être en ESM.
- **Client généré dans `packages/db/src/generated/`**, ignoré par Git. Il est généré par `pnpm db:generate`, lancé automatiquement par le `postinstall` du paquet.
- **Postgres Docker sur le port 5433**, parce que le 5432 est déjà pris par le Postgres installé sur la machine de Thibault. Le script d'initialisation de Docker crée deux bases : `microbeta` pour le dev et `microbeta_test` pour les tests.
- **Tests d'intégration séparés** (`*.int.test.ts`, `pnpm test:int`) pour que `pnpm test` reste rapide et marche sans BDD. En CI, un service Postgres lance `migrate deploy` puis `test:int`.
- **Pas de tables Auth.js** (Account, Session…). Le schéma suit SPEC.md. Le choix de la session sera fait dans #5 (connexion Discord), probablement une session JWT avec une mise à jour du `User` à la connexion, ce qui ne demande aucune table en plus.

## Fichiers touchés

| Fichier                                    | Changement                                                                                                              |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `packages/db/package.json`                 | paquet `@microbeta/db`, scripts `generate`, `migrate`, `deploy`, `seed`, `studio`, `postinstall`                        |
| `packages/db/prisma.config.ts`             | schéma, migrations, seed, `datasource.url` (`process.env.DATABASE_URL ?? ""` pour que `generate` marche sans BDD en CI) |
| `packages/db/prisma/schema.prisma`         | schéma complet (ci-dessous)                                                                                             |
| `packages/db/prisma/migrations/…_init/`    | migration initiale générée                                                                                              |
| `packages/db/prisma/seed.ts`               | point d'entrée CLI, qui appelle `seed()`                                                                                |
| `packages/db/src/client.ts`                | `createPrismaClient(url)` et un singleton `prisma` (réutilisé en dev pour survivre au rechargement à chaud de Next)     |
| `packages/db/src/seed.ts`                  | `seed(prisma)` : vide les tables puis insère les données de démo. Refuse de tourner si `NODE_ENV=production`            |
| `packages/db/src/index.ts`                 | exporte le client, les types et les enums Prisma                                                                        |
| `packages/db/src/seed.int.test.ts`         | test d'intégration du seed                                                                                              |
| `docker-compose.yml`, `docker/init-db.sql` | port 5433, création de la base `microbeta_test`                                                                         |
| `.env.example`                             | `DATABASE_URL` sur le port 5433, plus `TEST_DATABASE_URL`                                                               |
| racine `package.json`                      | `db:*` (délègue à `@microbeta/db`), `test:int`                                                                          |
| `vitest.config.ts`, `vitest.int.config.ts` | `pnpm test` exclut `*.int.test.ts`, la config d'intégration ne prend que ceux-là                                        |
| `turbo.json`                               | `typecheck` dépend de `generate` (le client doit exister)                                                               |
| `.github/workflows/ci.yml`                 | service Postgres, `db:generate`, `db:deploy`, `test:int`                                                                |
| `CLAUDE.md`, `docs/architecture.md`        | commandes BDD, port 5433, `packages/db` n'est plus « à venir »                                                          |
| `docs/decisions.md`                        | entrée Prisma 7 et port 5433                                                                                            |

## Schéma (résumé)

Les modèles et les champs de SPEC.md, plus :

- Tous les ids en `cuid()`. `createdAt` partout, `updatedAt` sur les entités qu'on modifie.
- **Contraintes d'unicité :**
  - `User.discordId` ;
  - `Campaign.inviteCode` ;
  - `Tester(campaignId, discordUserId)` ;
  - `Assignment(testerId, microTestId)` ;
  - `Answer(assignmentId, questionId)` : une réponse modifiée remplace l'ancienne, ce qui évite les doublons si une tâche est rejouée.
- **Index** (architecture.md) : `Assignment(status, scheduledAt)`, `Tester(campaignId, status)`, `Answer(questionId)`, `AiUsage(userId, createdAt)`, plus `MicroTest(campaignId, position)` et `Question(microTestId, position)`.
- **Suppressions en cascade :**
  - supprimer une Campaign supprime ses micro-tests, questions, testeurs, assignments et réponses ;
  - supprimer un Tester supprime ses assignments, réponses, questions et le journal de ses messages (RGPD, #21) ;
  - `AiUsage.campaignId` passe à `SET NULL` quand la campagne est supprimée, pour garder l'historique des coûts.
- `AiUsage.costUsd` en `Decimal(10,6)`. `Question.options` et `Answer.value` / `questionSnapshot` en `Json`.

## Données de démo (`seed`)

- 1 porteur (offre PRO) et 1 campagne ACTIVE (« Appli de covoiturage étudiant »).
- 3 micro-tests de 3 à 4 questions qui couvrent les 5 types de question.
- 5 testeurs : 2 ACTIVE, 1 INACTIVE, 1 UNREACHABLE (avec email), 1 OPTED_OUT.
- Des assignments dans des statuts variés (COMPLETED, SENT, IN_PROGRESS, SCHEDULED), avec les réponses des assignments terminés.
- 2 questions de testeurs (1 OPEN, 1 ANSWERED), 3 lignes `AiUsage`, quelques `OutboundMessage` (dont 1 FAILED).
- 8 questions types : facilité 1–5, NPS, « qu'est-ce qui vous a bloqué ? », etc.
- Les volumes attendus sont exportés (`SEED_COUNTS`) pour que le test s'y réfère.

## Tests

- `seed.int.test.ts` :
  - les volumes correspondent à `SEED_COUNTS` ;
  - lancer le seed deux fois donne les mêmes volumes (il peut être relancé sans risque) ;
  - les 5 types de question sont présents ;
  - chaque `Answer` a un `questionSnapshot` ;
  - supprimer un testeur supprime ses réponses (cascade RGPD) ;
  - le seed refuse de tourner avec `NODE_ENV=production`.
- Les tests d'intégration lancent d'abord `prisma migrate deploy` sur `microbeta_test`.

## Hors scope

- Les tables Auth.js (→ #5).
- La logique métier sur ces modèles : quotas, planification (→ `packages/core`, dans les issues concernées).
- pg-boss et son schéma (→ #3).
