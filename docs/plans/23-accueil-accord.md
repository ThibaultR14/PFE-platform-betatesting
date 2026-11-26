# Plan #23 — Message d'accueil et accord du testeur

Issue : https://github.com/ThibaultR14/PFE-platform-betatesting/issues/23 · Branche : `feat/23-accueil-accord`

## Choix techniques

- **L'accord se donne uniquement par le bouton Discord** « J'accepte de participer », quelle que soit la voie d'arrivée du testeur (lien d'invitation ou serveur du porteur).
  - Un seul chemin dans le code pour renseigner `consentAt`.
  - Le clic prouve aussi que le bot peut écrire en message privé au testeur.
  - Conséquence pour le web : la page d'accord du lien d'invitation crée le `Tester` sans `consentAt` (statut `INVITED`), puis lance `send-welcome`. `docs/architecture.md` est mis à jour en ce sens, et la décision est notée dans `docs/decisions.md` (contrat à valider avec ThibaultR14).
- **Tâche `send-welcome`** (`apps/bot`) :
  - Elle charge le testeur, sa campagne, le porteur et les micro-tests non archivés.
  - Elle n'envoie rien si :
    - le testeur n'existe plus ;
    - il n'est pas `INVITED` (déjà accepté, désinscrit…) ;
    - la campagne n'est pas `ACTIVE` ;
    - un `OutboundMessage` `WELCOME`/`SENT` existe déjà pour lui.
      C'est ce qui permet de la rejouer sans doublon.
  - Contenu du message, en tutoiement (`docs/design.md`) :
    - qui est le bot ;
    - le nom de la campagne et le nom du porteur ;
    - le `welcomeMessage` du porteur s'il existe ;
    - le nombre de micro-tests et la durée de chacun (environ, d'après `estimatedMinutes`) ;
    - le lien du produit ;
    - le lien de confidentialité ;
    - le bouton.
  - Chaque tentative est enregistrée dans `OutboundMessage` (`WELCOME`, `SENT` ou `FAILED` avec l'erreur).
  - Messages privés fermés (erreur Discord 50007) : enregistré en `FAILED`, sans nouvel essai, puisque ça ne changerait rien. Le passage en `UNREACHABLE` viendra avec #30. Une autre erreur (réseau, Discord indisponible) est relancée, et pg-boss refait un essai.
  - Limite connue : si le bot s'arrête entre l'envoi et l'enregistrement de l'`OutboundMessage`, le message peut repartir une fois. La fiabilité des envois est le sujet de #31.
  - Sans Discord (variables `DISCORD_*` absentes), la tâche échoue avec un message clair au lieu de se terminer sans rien envoyer.
- **Lien de confidentialité** : nouvelle variable facultative `PUBLIC_WEB_URL` dans la config du bot. Le lien vaut `${PUBLIC_WEB_URL}/confidentialite` (chemin à confirmer avec le web). Si la variable est absente, un avertissement s'affiche au démarrage et la ligne n'apparaît pas dans le message.
- **Bouton « J'accepte »** : son `customId` vaut `consent:<testerId>`. Au clic :
  - on vérifie que la personne qui clique est bien le testeur (`discordUserId`). Sinon, réponse éphémère de refus ;
  - en une transaction :
    - un `updateMany` conditionnel (`id`, `status = INVITED`, `consentAt = null`) renseigne `consentAt` et passe le testeur en `ACTIVE` ;
    - si une ligne a été modifiée, le premier `Assignment` est créé (`createMany` avec `skipDuplicates`, sur la contrainte unique `(testerId, microTestId)` déjà présente dans le schéma).
      Un second clic simultané attend le verrou de la ligne, ne trouve plus `consentAt = null` et ne fait rien. C'est ce qui garantit un seul assignment ;
  - le message d'accueil est ensuite modifié : bouton retiré, texte de confirmation. Un clic tardif (déjà accepté ou désinscrit) reçoit une réponse éphémère adaptée.
- **Logique métier dans `packages/core`** (fonctions pures, sans BDD) :
  - `scheduling.firstAssignment(microTests, consentAt)` : le micro-test non archivé de plus petite `position`, planifié à `consentAt` (le rythme ne s'applique qu'entre deux micro-tests). Renvoie `null` s'il n'y a aucun micro-test. L'envoi lui-même viendra avec #24 (scheduler).
  - `campaign.durationSummary(microTests)` : nombre de micro-tests non archivés et durée de chacun, pour le message d'accueil.
- **Accès à la BDD dans le bot** : `apps/bot` dépend désormais de `@microbeta/db` (`getPrisma()`). La lecture et l'écriture restent dans des fonctions du bot (`welcome/`) qui appellent `core` pour les décisions.
- **Envoi de messages derrière une interface** `DmSender` (`sendDm(discordUserId, message)`). Le vrai client discord.js l'implémente, et les tests passent un faux, sans Discord.
- **Routage des boutons** : `interactions.ts` traite aussi les boutons, selon le préfixe du `customId`. Un bouton inconnu reçoit une réponse éphémère, et une erreur donne le message générique, comme pour les commandes. #27 y ajoutera ses boutons.
- **Pas de modification de `schema.prisma`** : tout ce qu'il faut existe déjà.

## Fichiers touchés

| Fichier                                   | Changement                                                                                               |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `packages/core/src/scheduling.ts`         | `firstAssignment()`                                                                                      |
| `packages/core/src/campaign.ts`           | `durationSummary()`                                                                                      |
| `packages/core/src/index.ts`              | exports                                                                                                  |
| `apps/bot/package.json`                   | dépendance `@microbeta/db`, script `welcome:test`                                                        |
| `apps/bot/src/config.ts`                  | `PUBLIC_WEB_URL` facultative                                                                             |
| `apps/bot/src/welcome/message.ts`         | construit le message d'accueil (texte i18n et bouton) à partir des données de la campagne                |
| `apps/bot/src/welcome/send-welcome.ts`    | handler de la tâche `send-welcome` (vérifications, envoi via `DmSender`, `OutboundMessage`)              |
| `apps/bot/src/welcome/consent.ts`         | `acceptConsent(testerId, discordUserId)` : transaction accord et premier assignment                      |
| `apps/bot/src/discord/buttons/consent.ts` | bouton `consent:<testerId>` : appelle `acceptConsent`, modifie le message                                |
| `apps/bot/src/discord/buttons/index.ts`   | liste des boutons, routage par préfixe                                                                   |
| `apps/bot/src/discord/interactions.ts`    | `handleButton()` à côté de `handleCommand()`                                                             |
| `apps/bot/src/discord/client.ts`          | écoute des boutons, `DmSender` discord.js                                                                |
| `apps/bot/src/jobs.ts`                    | `createJobHandlers({ prisma, dm, webUrl })` : vrai handler pour `send-welcome`, les autres loguent       |
| `apps/bot/src/index.ts`                   | branche les nouveaux handlers                                                                            |
| `apps/bot/scripts/welcome-test.ts`        | test manuel : crée (ou remet à zéro) un testeur `INVITED` dans la campagne de démo, lance `send-welcome` |
| `packages/i18n/src/fr.ts`                 | `bot.welcome.*`, `bot.consent.*` (bouton, confirmation, déjà accepté, désinscrit, pas toi)               |
| `.env.example`                            | `PUBLIC_WEB_URL`                                                                                         |
| `docs/architecture.md`                    | parcours du lien d'invitation : l'accord passe par le bouton Discord                                     |
| `docs/decisions.md`                       | accord uniquement par le bouton Discord, `PUBLIC_WEB_URL`                                                |
| `docs/dev-setup.md`                       | tester l'accueil à la main                                                                               |
| tests `*.test.ts` et `*.int.test.ts`      | voir plus bas                                                                                            |

## Tests

- **Unitaires** (Vitest, sans Discord ni BDD) :
  - `core/scheduling` : premier micro-test par `position`, micro-tests archivés ignorés, aucun micro-test → `null`, `scheduledAt` égal à la date de l'accord ;
  - `core/campaign` : nombre et durée, micro-tests archivés ignorés ;
  - `welcome/message` : contient la campagne, le porteur, la durée, le lien produit, le lien de confidentialité et un bouton `consent:<testerId>`. Sans `PUBLIC_WEB_URL`, pas de lien de confidentialité. Sans `productUrl` ni `welcomeMessage`, pas de ligne vide ;
  - `interactions` : un bouton `consent:` est routé vers son handler, un bouton inconnu reçoit une réponse éphémère, une erreur donne `bot.errors.generic` ;
  - `config` : `PUBLIC_WEB_URL` facultative.
- **Intégration** (`apps/bot/src/welcome/*.int.test.ts`, sur `TEST_DATABASE_URL`, avec un faux `DmSender`) :
  - double clic : deux `acceptConsent` lancés en même temps → un seul assignment, `consentAt` renseigné une fois ;
  - rien n'est envoyé avant l'accord : après `send-welcome`, seul le message d'accueil est parti, et aucun `Assignment` n'existe ;
  - `send-welcome` rejouée : un seul envoi ;
  - testeur `OPTED_OUT` ou campagne non `ACTIVE` : aucun envoi ;
  - clic par un autre utilisateur Discord : rien ne change ;
  - campagne sans micro-test : accord enregistré, aucun assignment ;
  - messages privés fermés : `OutboundMessage` en `FAILED`, sans nouvel essai.
- **À la main** (bot de test, serveur de test, `.env` rempli) :
  - `pnpm db:seed`, puis `pnpm --filter @microbeta/bot dev` ;
  - `pnpm --filter @microbeta/bot welcome:test <ton Discord ID>` : le message d'accueil arrive en privé ;
  - clic sur « J'accepte » : message modifié, testeur `ACTIVE` et assignment n°1 `SCHEDULED` visibles dans `pnpm db:studio` ;
  - double clic rapide : toujours un seul assignment ;
  - relancer le script sans remettre à zéro : aucun second message.

## Critères d'acceptation (issue)

- [ ] Test `core` : planification du premier assignment.
- [ ] Double-clic sur « J'accepte » : un seul assignment créé.
- [ ] Rien n'est envoyé avant l'accord.
