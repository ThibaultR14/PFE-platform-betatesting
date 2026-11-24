# Plan #3 — File de tâches : pg-boss et contrat des tâches

Issue : https://github.com/ThibaultR14/PFE-platform-betatesting/issues/3 · Branche : `feat/3-pg-boss`

## Choix techniques

- **pg-boss 12** (dernière version stable). Il crée ses tables dans un schéma Postgres à part, `pgboss`, dans la même base. Prisma ne gère que `public`, donc les deux ne se gênent pas.
- **Payloads validés par Zod 4 deux fois** :
  - à l'envoi (`enqueue`), qui lève une erreur, et aucune tâche n'est créée ;
  - à la réception (`registerWorkers`), pour une tâche écrite à la main ou par une ancienne version : la tâche part en échec, sans relance.
- **Déduplication** : les files sont créées avec la politique `exclusive`, qui accepte au plus une tâche en attente ou en cours par `singletonKey`. Un second `send` avec la même clé renvoie `null`. Chaque tâche a une clé par défaut, calculée à partir de son payload (par ex. `reminder:<assignmentId>:<n>`). Ça ne remplace pas la règle « relire l'état en BDD avant d'agir », qui reste à la charge de chaque handler.
- **Relances pg-boss** : 3 nouvelles tentatives après le premier essai (4 au total), avec un délai exponentiel. `scheduler-tick` n'en fait pas, puisque le prochain tick passe une minute plus tard.

## Contrat des tâches (`packages/jobs`)

| Tâche            | Payload                                    | `singletonKey` par défaut       |
| ---------------- | ------------------------------------------ | ------------------------------- |
| `send-welcome`   | `{ testerId }`                             | `send-welcome:<testerId>`       |
| `send-microtest` | `{ assignmentId }`                         | `send-microtest:<assignmentId>` |
| `reminder`       | `{ assignmentId, reminderNumber: 1 \| 2 }` | `reminder:<assignmentId>:<n>`   |
| `reply`          | `{ testerQuestionId }`                     | `reply:<testerQuestionId>`      |
| `fallback-email` | `{ testerId }`                             | `fallback-email:<testerId>`     |
| `scheduler-tick` | `{}`                                       | aucune (cron pg-boss)           |

## Fichiers touchés

| Fichier                                                                 | Changement                                                                                                                               |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/jobs/package.json`, `tsconfig.json`                           | nouveau paquet `@microbeta/jobs` (pg-boss, zod)                                                                                          |
| `packages/jobs/src/definitions.ts`                                      | schémas Zod, `JobName`, `JobPayload<N>`, `singletonKey` par tâche                                                                        |
| `packages/jobs/src/boss.ts`                                             | `createBoss(url)`, `ensureQueues(boss)` (files + politique + relances)                                                                   |
| `packages/jobs/src/enqueue.ts`                                          | `enqueue(boss, name, payload, options?)`, typé et validé                                                                                 |
| `packages/jobs/src/workers.ts`                                          | `registerWorkers(boss, handlers)`, `scheduleTick(boss)`                                                                                  |
| `packages/jobs/src/index.ts`                                            | exports                                                                                                                                  |
| `packages/jobs/scripts/send-test-job.ts` + script `pnpm jobs:send-test` | envoie une tâche de démo depuis un script                                                                                                |
| `apps/bot/src/config.ts` (+ test)                                       | `DATABASE_URL` est obligatoire ; les variables Discord deviennent facultatives jusqu'à #22, pour lancer le bot sans token                |
| `apps/bot/src/index.ts`                                                 | démarre pg-boss, enregistre des handlers qui loguent seulement, planifie `scheduler-tick` chaque minute, arrêt propre sur SIGINT/SIGTERM |
| `docs/architecture.md`, `docs/decisions.md`, `CLAUDE.md`                | paquet `jobs`, politique `exclusive`, nouvelle commande                                                                                  |

## Tests

- **Unitaires** (`definitions.test.ts`, `enqueue.test.ts`, avec un faux `boss`) :
  - un payload valide passe ;
  - un payload invalide (champ manquant, `reminderNumber: 3`) est rejeté, et `send` n'est pas appelé ;
  - la `singletonKey` par défaut est bien transmise.
- **Intégration** (`jobs.int.test.ts`, vrai pg-boss sur `microbeta_test`) :
  - une tâche envoyée est consommée par le worker avec le bon payload ;
  - deux envois avec la même `singletonKey` : le second renvoie `null`, et le handler ne s'exécute qu'une fois ;
  - une tâche invalide insérée directement (sans `enqueue`) part en échec, et le handler n'est pas appelé.
- **À la main** : lancer `pnpm --filter @microbeta/bot dev`, puis `pnpm jobs:send-test`, et vérifier le log du bot.

## Hors scope

- La logique des handlers (envoi Discord, relances, email) : #22 à #30.
- Le contenu de `scheduler-tick` (sélection des assignments) : #24.
- L'appel à `enqueue` depuis le web : chaque feature web concernée s'en chargera.
