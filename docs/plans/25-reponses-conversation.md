# Plan #25 — Répondre dans la conversation et enchaîner

Issue : https://github.com/ThibaultR14/PFE-platform-betatesting/issues/25 · Branche : `feat/25-reponses-conversation`

## Choix techniques

- **Règles de réponse dans `packages/core`** (`answers.ts`, fonctions pures, réutilisables par la page web #17) :
  - `parseAnswer(question, input)` : vérifie une réponse et renvoie la valeur à enregistrer, ou une erreur. Valeurs (commentaire de `Answer.value` dans le schéma) :
    - `TEXT` : texte nettoyé (vide refusé si la question est obligatoire) ;
    - `RATING` : entier de 1 à 5 ;
    - `YESNO` : booléen ;
    - `SINGLE` : le texte du choix ;
    - `MULTI` : la liste des textes choisis (vide refusée si obligatoire), dans l'ordre de la question, sans doublon ;
    - **question facultative passée : `null`**. Une `Answer` est quand même créée : elle distingue « passée » de « pas encore posée », et la question suivante se calcule simplement. Contrat à signaler pour #14, #15 et #17 (ignorer `null` dans les statistiques, case vide dans le CSV).
  - Les choix sont envoyés à Discord par leur **numéro** (limite de 100 caractères des `customId`), puis traduits en texte avec la liste de la question. `parseOptions` passe dans `core` (`questionOptions`) pour que le bot et le site numérotent les choix de la même façon.
  - `questionSnapshot(question)` : `{ type, prompt, options, version }`, la copie gardée dans `Answer.questionSnapshot`.
  - `nextQuestion(questions, answeredIds)` : la première question non archivée (ordre `position`, puis `id`) sans réponse, avec son numéro et le total. `null` si tout est répondu. On se fie aux réponses enregistrées plutôt qu'à `currentQuestionIdx`, ce qui résiste aux réponses venues du web et aux modifications du corpus. `currentQuestionIdx` reste à jour pour l'affichage et le tableau de bord.
  - `nextAssignment(microTests, assignedMicroTestIds, completedAt, cadenceHours)` : le premier micro-test non archivé (ordre `position`, puis `id`) qui n'a pas encore d'assignment pour ce testeur, planifié à `completedAt + cadenceHours`. `null` après le dernier (critère de l'issue). `firstAssignment` réutilise la même sélection.
- **Enregistrement d'une réponse** (`apps/bot/src/microtest/answer.ts`, `recordAnswer(prisma, input, now)`) :
  - Vérifications avant d'écrire, chacune avec son résultat : assignment inconnu, autre utilisateur Discord, testeur désinscrit (`OPTED_OUT`), assignment pas encore envoyé ou déjà terminé, question archivée ou modifiée depuis l'envoi (`stale`), question déjà répondue (`alreadyAnswered`), valeur refusée par `parseAnswer`.
  - Un testeur **en pause** peut finir le micro-test en cours : la pause bloque seulement les envois suivants (`core.isDue`).
  - Dans une transaction :
    - `SELECT … FOR UPDATE` sur l'assignment. Deux réponses simultanées (deux clics, ou Discord et la page web en même temps) passent l'une après l'autre. Sans ce verrou, chacune pourrait croire qu'il reste une question et le micro-test ne serait jamais terminé ;
    - relecture des réponses, puis `Answer` créée avec `questionSnapshot` et `channel = DISCORD` (`createMany` + `skipDuplicates` : un second clic ne remplace rien) ;
    - s'il reste une question : `IN_PROGRESS`, `currentQuestionIdx` mis à jour ;
    - sinon : `COMPLETED`, `completedAt = now`, puis l'assignment suivant (`core.nextAssignment`), créé avec `skipDuplicates` sur l'unicité `(testerId, microTestId)`.
  - Le résultat porte ce que le message doit afficher : la réponse en clair, la question suivante, ou la fin du micro-test (avec la date du suivant, ou rien si c'était le dernier).
- **Composants Discord sous chaque question** (`apps/bot/src/microtest/message.ts`) :
  - `RATING` : 5 boutons, de 1 à 5 ;
  - `YESNO` : boutons « Oui » et « Non » ;
  - `SINGLE` : un bouton par choix jusqu'à 5 choix, au-delà un menu de sélection à un seul choix ;
  - `MULTI` : menu de sélection à plusieurs choix ;
  - `TEXT` : bouton « ✏️ Répondre », qui ouvre une fenêtre de saisie (champ long, 4 000 caractères au plus, obligatoire si la question l'est) ;
  - question facultative : bouton « Passer » en plus ;
  - « Répondre sur le web » sur chaque question, avec un lien signé neuf. Le lien reste ainsi sur le dernier message.
  - `customId` : `<préfixe>:<assignmentId>:<questionId>:<version>[:<valeur>]`, moins de 70 caractères avec des cuid. La **version** permet de repérer une question modifiée entre l'envoi et le clic. Préfixes : `ans` (bouton de réponse), `skip`, `text` (ouvre la fenêtre), `pick` (menu), `textm` (fenêtre envoyée).
- **Après une réponse** :
  - le message de la question est modifié : boutons retirés, « ✅ Ta réponse : … » ajouté (texte libre coupé s'il est trop long) ;
  - la question suivante part dans un **nouveau message privé**, pour que la conversation se lise comme un échange. Il passe par le `DmSender`, comme l'intro : envoyé en suite de l'interaction (`followUp`), Discord l'afficherait comme une réponse, avec un aperçu de la question précédente (vu au test manuel, corrigé) ;
  - à la fin : « 🎉 Micro-test terminé, merci ! », puis « Le prochain arrive dans environ 2 jours » (d'après `cadenceHours`), ou « C'était le dernier micro-test » s'il n'y a pas de suivant ou s'il tomberait après la date limite ;
  - clic sur une question déjà répondue, ou sur un micro-test terminé : réponse éphémère polie, rien ne change (critère de l'issue) ;
  - question modifiée depuis l'envoi : l'ancien message perd ses boutons et la question à jour est reposée.
  - Si l'envoi du nouveau message échoue, la réponse reste enregistrée. Les relances (#26) reposeront la question en cours.
- **Indications sous les questions** (reprise de #24) : le bot ne lit pas les messages écrits en privé (intent `Guilds` seul). Les indications de chaque type deviennent explicites (« Choisis une note avec les boutons ci-dessous », « Clique sur Répondre pour écrire ta réponse »…), et l'intro du micro-test ajoute « Réponds avec les boutons sous chaque question ».
- **Routage des interactions** (`apps/bot/src/discord/`) :
  - `client.ts` route aussi les menus de sélection et les fenêtres de saisie ;
  - `interactions.ts` : `handleButton` devient un traitement commun aux boutons, menus et fenêtres (choix du handler par préfixe, erreur loguée, message générique) ;
  - nouveaux types d'interaction réduits (`SelectInteraction`, `ModalInteraction`, `showModal` sur `ButtonInteraction`), pour garder les faux objets dans les tests ;
  - handlers dans `discord/answers/` : ils décodent le `customId`, appellent `recordAnswer` et construisent la réponse Discord.
  - Pas de `deferUpdate` : le traitement reste court (quelques requêtes), comme pour le bouton d'accord. Le bouton « ✏️ Répondre » ouvre la fenêtre sans lire la BDD, car la fenêtre doit être la toute première réponse à l'interaction. Les vérifications se font à l'envoi de la fenêtre.
- **Micro-test archivé après sa planification** (reprise de #24) : jusqu'ici l'assignment `SCHEDULED` restait bloqué et le testeur ne recevait plus rien. Le `scheduler-tick` repère ces assignments (100 au plus par tick, testeur pas désinscrit), les passe `SKIPPED` et planifie le micro-test suivant **à la même date**, puisque le délai a déjà été respecté. Une mise à jour conditionnelle (`status = SCHEDULED`) évite le doublon si deux ticks se chevauchent.
- **Pas de modification de `schema.prisma`**. La signification de `value = null` est écrite dans `docs/architecture.md`, pas dans le commentaire du schéma (sinon PR à part).
- **Hors de cette issue** : un testeur `INACTIVE` qui répond ne repasse pas `ACTIVE` (à trancher avec les relances, #26). Lire les messages écrits demanderait l'intent `DirectMessages` et un analyseur de texte libre, ce qui est écarté (voir les alternatives).

## Fichiers touchés

| Fichier                                         | Changement                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `packages/core/src/answers.ts`                  | `parseAnswer()`, `questionOptions()`, `questionSnapshot()`, `nextQuestion()`                |
| `packages/core/src/scheduling.ts`               | `nextAssignment()`, `firstAssignment()` réécrit avec la même sélection                      |
| `packages/core/src/index.ts`                    | exports                                                                                     |
| `apps/bot/src/microtest/answer.ts`              | `recordAnswer()` (transaction, fin du micro-test, assignment suivant)                       |
| `apps/bot/src/microtest/message.ts`             | composants par type, message d'une question, réponse affichée, message de fin               |
| `apps/bot/src/microtest/send-microtest.ts`      | passe l'assignment et la question complète au message (composants de la 1re question)       |
| `apps/bot/src/microtest/scheduler-tick.ts`      | passe `SKIPPED` les assignments de micro-tests archivés et planifie le suivant              |
| `apps/bot/src/discord/answers/*.ts`             | `customId` des réponses, handlers des boutons, du menu et de la fenêtre                     |
| `apps/bot/src/discord/buttons/types.ts`         | `showModal`, types des menus et des fenêtres                                                |
| `apps/bot/src/discord/interactions.ts`          | traitement commun aux boutons, menus et fenêtres                                            |
| `apps/bot/src/discord/client.ts`                | routage des menus et des fenêtres                                                           |
| `apps/bot/src/discord/buttons/index.ts`         | `createButtons` reçoit l'URL du site et le secret (lien web sur chaque question)            |
| `apps/bot/src/discord/fake-interaction.ts`      | faux menus et fausses fenêtres pour les tests                                               |
| `apps/bot/src/index.ts`, `apps/bot/src/jobs.ts` | câblage des nouvelles dépendances et log du nombre d'assignments passés                     |
| `packages/i18n/src/fr.ts`                       | `bot.answer.*`, indications des questions                                                   |
| `docs/decisions.md`                             | réponse `null` pour une question passée, pause, version dans le `customId`, archivés passés |
| `docs/architecture.md`                          | flux de réponse, verrou, valeurs d'`Answer`                                                 |
| `docs/dev-setup.md`                             | test manuel des réponses                                                                    |
| tests `*.test.ts` et `*.int.test.ts`            | voir plus bas                                                                               |

## Tests

- **Unitaires** (Vitest, sans Discord ni BDD) :
  - `core/answers` :
    - `parseAnswer` pour chaque type : valeurs acceptées, note hors de 1–5, choix inconnu, liste vide, texte vide, « passer » refusé sur une question obligatoire ;
    - `questionSnapshot` ;
    - `nextQuestion` : première sans réponse, questions archivées ignorées, numéro et total, `null` quand tout est répondu ;
  - `core/scheduling` :
    - `nextAssignment` : date = fin + rythme, micro-tests archivés et déjà attribués sautés, ordre par position, **dernier micro-test : aucun** (critère de l'issue) ;
    - `firstAssignment` : mêmes résultats qu'avant ;
  - `microtest/message` : composants attendus pour chaque type, menu au-delà de 5 choix, « Passer » seulement si facultative, lien web, `customId` de moins de 100 caractères, message de moins de 2 000 caractères, affichage de la réponse, messages de fin ;
  - `discord/answers` (faux `recordAnswer`) : décodage des `customId`, clic enregistré (message modifié et question suivante envoyée), fin du micro-test, **clic sur une question déjà répondue ignoré poliment** (critère), « Répondre » ouvre la fenêtre, envoi de la fenêtre enregistré ;
  - `discord/interactions` : menus et fenêtres routés comme les boutons, préfixe inconnu.
- **Intégration** (`apps/bot/src/microtest/answer.int.test.ts`, sur `TEST_DATABASE_URL`) :
  - micro-test répondu jusqu'au bout : `Answer` avec `questionSnapshot` et `channel = DISCORD`, `SENT` → `IN_PROGRESS` → `COMPLETED`, assignment suivant à `completedAt + cadenceHours` ;
  - dernier micro-test : `COMPLETED`, aucun assignment créé ;
  - même réponse envoyée deux fois : une seule `Answer` ;
  - deux réponses simultanées aux deux dernières questions : un seul passage en `COMPLETED`, un seul assignment suivant ;
  - question facultative passée : `Answer` avec `value = null` ;
  - question modifiée (version) ou archivée depuis l'envoi : `stale`, rien n'est enregistré ;
  - testeur désinscrit : refus. Testeur en pause : réponse acceptée ;
  - `scheduler-tick` : assignment d'un micro-test archivé passé `SKIPPED`, suivant planifié à la même date, rien en double si le tick est rejoué.
- **À la main** (bot de test, campagne de démo : le micro-test n°1 contient une note, un texte, un oui/non et un choix unique, le n°2 un choix multiple) :
  - `pnpm --filter @microbeta/bot welcome:test 543728433403002892 --reset`, puis « J'accepte » ;
  - micro-test n°1 : répondre aux 4 questions. Chaque message perd ses boutons et affiche la réponse, la suivante arrive, puis le message de fin annonce le suivant dans environ 2 jours ;
  - recliquer sur un ancien bouton (si Discord l'affiche encore) : message éphémère ;
  - dans `pnpm db:studio` : 4 `Answer` avec leur copie de la question, assignment `COMPLETED`, assignment n°2 planifié 48 h plus tard ;
  - avancer la date de l'assignment n°2 dans `db:studio` : il arrive dans la minute, tester le menu à choix multiples.

## Critères d'acceptation (issue)

- [ ] Test `core` : calcul de l'assignment suivant (dernier micro-test : aucun).
- [ ] Un clic sur une ancienne question déjà répondue est ignoré poliment.
- [ ] Test manuel documenté dans la PR (captures).

## Alternatives écartées

- **Un seul message modifié à chaque question** : moins de messages, mais on perd l'historique des réponses dans la conversation.
- **Lire les messages écrits** (« 3 » tapé en privé) : il faut l'intent `DirectMessages`, et deviner à quelle question le message répond. Les boutons suffisent, et la SPEC exclut la compréhension des messages libres.
- **Aucune `Answer` pour une question passée** : il faudrait suivre la progression avec `currentQuestionIdx` seul. On se tromperait de question quand le corpus change en cours de route, ou quand une réponse arrive du web.
- **Avancer par `currentQuestionIdx` seul** : même problème que ci-dessus.
- **`deferUpdate` avant chaque traitement** : impossible pour le bouton qui ouvre la fenêtre de saisie, et inutile pour un traitement aussi court.
