# Plan #24 — Scheduler et envoi d'un micro-test

Issue : https://github.com/ThibaultR14/PFE-platform-betatesting/issues/24 · Branche : `feat/24-scheduler-envoi-microtest`

## Choix techniques

- **Règle « à envoyer » dans `packages/core`** (`scheduling.ts`, fonctions pures) :
  - `isDue(candidate, now)` : vrai si **toutes** ces conditions sont remplies :
    - l'assignment est `SCHEDULED` et `scheduledAt <= now` ;
    - le testeur est `ACTIVE` et a donné son accord (`consentAt` renseigné) ;
    - la campagne est `ACTIVE` et sa date limite n'est pas passée (pas de `deadline`, ou `deadline > now`) ;
    - le micro-test n'est pas archivé.
  - Un testeur `PAUSED`, `INACTIVE`, `UNREACHABLE`, `OPTED_OUT` ou encore `INVITED` ne reçoit rien. Une campagne `DRAFT`, `PAUSED` ou `DONE` non plus.
  - `selectDue(candidates, now)` filtre une liste avec `isDue` et garde le type reçu.
  - Les statuts autorisés sont exportés en constantes (`SENDABLE_TESTER_STATUS`, `SENDABLE_CAMPAIGN_STATUS`…), pour que la requête du bot reprenne les mêmes valeurs.
  - Choix à noter dans `docs/decisions.md` : rien ne part après la date limite de la campagne.
- **Tâche `scheduler-tick`** (`apps/bot/src/microtest/scheduler-tick.ts`, chaque minute) :
  - Requête Prisma sur l'index `Assignment(status, scheduledAt)`. Elle préfiltre avec les mêmes conditions que `isDue` (testeur, campagne, micro-test non archivé avec au moins une question active), triée par `scheduledAt`, 100 au plus par tick. Sans ce préfiltre, des assignments en attente pour des testeurs en pause rempliraient chaque lot et bloqueraient les autres.
  - `selectDue` est appliqué au résultat, puis `enqueue("send-microtest", { assignmentId })` pour chacun. La clé `send-microtest:<assignmentId>` (politique `exclusive`) évite les doublons tant qu'une tâche est en attente ou en cours.
  - Sans Discord configuré, le tick ne fait rien : inutile de remplir une file qui ne peut pas aboutir. Un avertissement s'affiche déjà au démarrage.
  - Le handler reçoit un `JobSender` (le `boss`) dans ses dépendances, ce qui permet de le tester avec un faux.
- **Tâche `send-microtest`** (`apps/bot/src/microtest/send-microtest.ts`), qui peut être rejouée sans doublon :
  - Elle relit l'assignment avec le testeur, la campagne, le micro-test et ses questions actives (triées par `position`).
  - Elle n'envoie rien si :
    - l'assignment n'existe plus (`unknownAssignment`) ;
    - il n'est plus `SCHEDULED` (`alreadySent`). C'est cette vérification qui empêche un second envoi quand la tâche est rejouée ;
    - `isDue` est faux au moment de l'envoi (`notDue`), par exemple si le testeur s'est mis en pause entre le tick et l'envoi ;
    - le micro-test n'a aucune question active (`noQuestion`).
  - Sinon, elle envoie **un seul message privé** : intro (titre, durée estimée, consignes), première question, et le lien « Répondre sur le web » s'il est disponible. Puis, dans une transaction :
    - `updateMany` conditionnel (`status = SCHEDULED`) → `SENT`, `sentAt = now`, `currentQuestionIdx = 0` ;
    - `OutboundMessage` `MICROTEST` / `SENT`.
  - **Messages privés fermés** (`DmUnavailableError`) : `OutboundMessage` `FAILED`, et le testeur passe `UNREACHABLE` (seulement s'il est encore `ACTIVE`). Il sort ainsi du scheduler, au lieu d'un nouvel essai à chaque minute. Pas de nouvel essai pg-boss. #30 ajoutera l'email de secours.
  - **Autre erreur** (réseau, Discord indisponible) : `OutboundMessage` `FAILED`, et l'erreur remonte pour que pg-boss réessaie (3 fois). L'assignment reste `SCHEDULED`.
  - Même limite connue que `send-welcome` : si le bot s'arrête entre l'envoi et l'enregistrement, le message peut repartir une fois (#31).
- **Contenu du message** (`apps/bot/src/microtest/message.ts`, tutoiement, textes dans `packages/i18n`) :
  - En-tête avec le titre du micro-test et la durée estimée, puis les consignes en citation, coupées si elles sont trop longues (limite Discord de 2 000 caractères pour tout le message).
  - « Question 1/N », l'énoncé, et une ligne qui dépend du type : note de 1 à 5, oui/non, liste des choix (unique ou multiple), réponse libre.
  - **Pas de boutons de réponse dans #24** : l'issue #25 les ajoute avec leurs handlers (boutons, menu, fenêtre de saisie). Ça évite des boutons qui ne feraient rien. En attendant, on répond par la page web.
  - Le constructeur de la question est séparé de l'intro, pour que #25 le réutilise pour les questions suivantes.
- **Lien signé vers la page web** (`packages/core/src/tester-link.ts`, contrat avec #17) :
  - `signTesterLink({ testerId, assignmentId }, secret, now)` et `verifyTesterLink(token, secret, now)`, avec la bibliothèque `jose` (JWT HS256). Elle fonctionne dans Node comme dans Next.js.
  - Contenu : `sub` = testerId, `assignmentId`, `aud` = `tester-link` (un jeton signé pour un autre usage est refusé), `exp` = 7 jours. Les relances (#26) renverront un lien neuf.
  - Secret partagé `TESTER_LINK_SECRET` (déjà dans `.env.example`), 32 caractères au moins. URL : `${PUBLIC_WEB_URL}/t/<token>`, construite par `testerLinkUrl()` dans `core` pour que le bot et le site utilisent le même chemin.
  - `verifyTesterLink` renvoie `null` pour un jeton expiré, modifié ou signé avec un autre secret. La page web (#17) vérifie ensuite l'état de l'assignment, ce qui limite l'usage du lien.
  - Côté bot : `TESTER_LINK_SECRET` est facultative. Sans elle, ou sans `PUBLIC_WEB_URL`, le lien est omis, avec un avertissement au démarrage.
  - Un commentaire sur #17 explique le contrat à ThibaultR14.
- **Pas de modification de `schema.prisma`**.
- **Limite connue, pour #25** : un assignment `SCHEDULED` dont le micro-test a été archivé reste en attente (il n'est pas envoyé). C'est #25, qui planifie l'assignment suivant, qui devra passer les micro-tests archivés.

## Fichiers touchés

| Fichier                                    | Changement                                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `packages/core/src/scheduling.ts`          | `isDue()`, `selectDue()`, constantes des statuts autorisés                                    |
| `packages/core/src/tester-link.ts`         | `signTesterLink()`, `verifyTesterLink()`, `testerLinkUrl()`                                   |
| `packages/core/src/index.ts`               | exports                                                                                       |
| `packages/core/package.json`               | dépendances `jose` et `@types/node` (dev)                                                     |
| `packages/core/tsconfig.json`              | `"types": ["node"]` (TypeScript 6 ne les inclut plus d'office, `jose` demande `TextEncoder`)  |
| `apps/bot/src/config.ts`                   | `TESTER_LINK_SECRET` facultative (32 caractères au moins)                                     |
| `apps/bot/src/microtest/message.ts`        | message du micro-test : intro, question, bouton lien                                          |
| `apps/bot/src/microtest/send-microtest.ts` | handler `send-microtest`                                                                      |
| `apps/bot/src/microtest/scheduler-tick.ts` | handler `scheduler-tick`                                                                      |
| `apps/bot/src/jobs.ts`                     | vrais handlers `send-microtest` et `scheduler-tick`, dépendances `jobs` et `testerLinkSecret` |
| `apps/bot/src/index.ts`                    | passe le `boss` et le secret aux handlers, avertissement si le lien web est désactivé         |
| `packages/i18n/src/fr.ts`                  | `bot.microtest.*`                                                                             |
| `docs/decisions.md`                        | lien signé (contrat avec #17), `UNREACHABLE` dès #24, rien après la date limite               |
| `docs/architecture.md`                     | détails du lien signé et de l'envoi                                                           |
| `docs/dev-setup.md`                        | `TESTER_LINK_SECRET` côté bot, test manuel de l'envoi                                         |
| tests `*.test.ts` et `*.int.test.ts`       | voir plus bas                                                                                 |

## Tests

- **Unitaires** (Vitest, sans Discord ni BDD) :
  - `core/scheduling` (`isDue` / `selectDue`) :
    - échéance passée ou égale à `now` : envoyé ; future : non ;
    - testeur `PAUSED`, `OPTED_OUT`, `UNREACHABLE`, `INACTIVE`, `INVITED`, ou sans `consentAt` : exclu ;
    - campagne `PAUSED`, `DRAFT` ou `DONE`, ou date limite passée : exclue ;
    - micro-test archivé, assignment déjà `SENT` : exclu ;
  - `core/tester-link` : aller-retour, jeton expiré, modifié, autre secret, autre `aud` refusés, secret trop court rejeté ;
  - `microtest/message` : titre, durée, consignes coupées, « Question 1/N », ligne selon le type, liste des choix, bouton lien présent ou absent, message de moins de 2 000 caractères ;
  - `config` : `TESTER_LINK_SECRET` facultative, refusée si trop courte.
- **Intégration** (`apps/bot/src/microtest/microtest.int.test.ts`, sur `TEST_DATABASE_URL`, faux `DmSender` et faux `JobSender`) :
  - le tick ne place que les assignments à envoyer (testeur en pause, campagne en pause et échéance future exclus) ;
  - `send-microtest` : message envoyé, assignment `SENT` avec `sentAt`, `OutboundMessage` `MICROTEST`/`SENT` ;
  - rejouée : un seul envoi (critère de l'issue) ;
  - testeur passé en pause entre le tick et l'envoi : rien n'est envoyé ;
  - messages privés fermés : testeur `UNREACHABLE`, journal `FAILED`, pas d'erreur levée, et le tick suivant l'ignore ;
  - erreur passagère : journal `FAILED`, l'erreur remonte, l'assignment reste `SCHEDULED`.
- **À la main** (bot de test, `.env` avec `TESTER_LINK_SECRET`) :
  - `pnpm --filter @microbeta/bot welcome:test 543728433403002892 --reset`, puis clic sur « J'accepte » ;
  - dans la minute, le micro-test n°1 arrive en privé, avec le bouton « Répondre sur le web » ;
  - dans `pnpm db:studio` : assignment `SENT`, `OutboundMessage` `MICROTEST`/`SENT` ;
  - redémarrer le bot : aucun second message.

## Critères d'acceptation (issue)

- [ ] Test `core` : `selectDue` (échéance, testeur en pause, désinscrit ou injoignable exclu, campagne en pause).
- [ ] Une tâche rejouée n'envoie pas deux fois le message (vérification d'état).
