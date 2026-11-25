# Plan #22 — Connexion Discord et commande `/aide`

Issue : https://github.com/ThibaultR14/PFE-platform-betatesting/issues/22 · Branche : `feat/22-connexion-discord`

## Choix techniques

- **discord.js 14** (dernière version stable), ajouté seulement à `apps/bot`.
- **Intents minimaux** : `Guilds` seul. Les slash commands et les boutons arrivent par les interactions, qui ne demandent aucun intent. Aucun intent privilégié (`MessageContent`, `GuildMembers`, `GuildPresences`), conformément à la SPEC (risque n° 3).
- **Commandes globales** plutôt que limitées au serveur de test :
  - les testeurs utiliseront `/aide` en message privé, ce qu'une commande de serveur ne permet pas ;
  - #29 aura besoin des commandes sur le serveur du porteur ;
  - chaque dev a son propre bot, donc les commandes globales de l'un ne gênent pas l'autre.
  - Déclarées avec `contexts: [Guild, BotDM]` et `integration_types: [GuildInstall]`.
- **Enregistrement au démarrage** : un `PUT /applications/{id}/commands` écrase toute la liste. On peut le relancer à chaque démarrage sans créer de doublon, et une commande retirée du code disparaît de Discord. Pas de script séparé à penser à lancer.
- **Nom et description des commandes dans l'i18n** : ils sont visibles par l'utilisateur. Le routage se fait sur le nom tiré de l'i18n, donc il ne peut pas diverger de la déclaration.
- **`/aide`** répond en éphémère (visible par le seul utilisateur) : qui est le bot et quelles commandes existent. Il n'y a pas encore de campagne en B1, donc le texte reste générique. #27 l'enrichira (deadline, progression).
- **Sans variables Discord**, le bot démarre comme aujourd'hui (pg-boss seul). Avec les trois, il se connecte. Un token refusé par Discord arrête le process avec un message clair, plutôt que de tourner à moitié.
- **Erreurs dans un handler de commande** : loguées, et l'utilisateur reçoit une réponse éphémère générique (texte i18n). Une commande inconnue (ancienne commande encore en cache chez Discord) reçoit aussi une réponse éphémère.
- **Arrêt propre (SIGINT/SIGTERM)** : `client.destroy()` (ferme la connexion Discord), puis `boss.stop({ graceful: true, timeout: 10_000 })`. Un second signal pendant l'arrêt est ignoré. Si l'arrêt dépasse 15 s, le process sort quand même avec un code d'erreur.
- **Logs console** : ils restent en français dans le code, comme les logs existants de `index.ts`. Ils ne sont pas visibles par un utilisateur. Le log de connexion utilise la clé existante `bot.ready`.

## Fichiers touchés

| Fichier                                   | Changement                                                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `apps/bot/package.json`                   | dépendance `discord.js`                                                                                                       |
| `apps/bot/src/discord/client.ts`          | `createDiscordClient()` (intent `Guilds`), `startDiscord(config, commands)` : login, log `bot.ready`, écoute des interactions |
| `apps/bot/src/discord/commands/types.ts`  | interface `BotCommand` : `data` (JSON de déclaration) et `execute(interaction)`                                               |
| `apps/bot/src/discord/commands/aide.ts`   | commande `/aide`                                                                                                              |
| `apps/bot/src/discord/commands/index.ts`  | liste des commandes du bot                                                                                                    |
| `apps/bot/src/discord/register.ts`        | `registerCommands(rest, applicationId, commands)` : `PUT` global                                                              |
| `apps/bot/src/discord/interactions.ts`    | `handleInteraction(interaction, commands)` : routage, commande inconnue, erreur de handler                                    |
| `apps/bot/src/shutdown.ts`                | `createShutdown(steps, options)` : arrêt dans l'ordre, une seule fois, avec délai maximal                                     |
| `apps/bot/src/index.ts`                   | branche Discord quand la config est présente, et utilise `createShutdown`                                                     |
| `packages/i18n/src/fr.ts`                 | `bot.commands.aide.{name,description}`, `bot.help.*`, `bot.errors.{unknownCommand,generic}`                                   |
| tests `*.test.ts` à côté de chaque module | voir plus bas                                                                                                                 |
| `docs/decisions.md`                       | commandes globales enregistrées au démarrage, intent `Guilds` seul                                                            |
| `docs/dev-setup.md`                       | étape 6 : ce qu'on doit voir avec les variables Discord (bot en ligne, `/aide` répond)                                        |

Le code des handlers reste typé sur les sous-ensembles d'interfaces discord.js qu'il utilise, pour pouvoir passer de fausses interactions dans les tests sans `any`.

## Tests

- **Unitaires** (Vitest, sans Discord ni BDD) :
  - `commands` : chaque commande a un nom et une description non vides venant de l'i18n, des noms uniques, et les contextes `Guild` et `BotDM` ;
  - `aide` : répond en éphémère avec le texte `bot.help` ;
  - `interactions` : route vers la bonne commande ; une commande inconnue reçoit `bot.errors.unknownCommand` ; un handler qui lève une erreur donne `bot.errors.generic` ; une interaction qui n'est pas une slash command est ignorée ;
  - `register` : un seul `PUT` sur la route globale, avec le JSON de toutes les commandes (faux client REST) ;
  - `shutdown` : les étapes s'exécutent dans l'ordre, une seule fois même avec deux signaux, et le délai maximal fait sortir avec un code d'erreur.
- **Pas de test d'intégration** : aucune table ni tâche touchée. `pnpm test:int` tourne quand même pour vérifier qu'il n'y a pas de régression.
- **À la main** (après avoir rempli les `DISCORD_*` du `.env`, étapes 3 et 4 de `dev-setup.md`) :
  - `pnpm --filter @microbeta/bot dev` : le log `Bot connecté en tant que …` s'affiche et le bot apparaît en ligne sur le serveur de test ;
  - `/aide` sur le serveur de test, puis en message privé au bot : réponse éphémère ;
  - Ctrl+C : le bot passe hors ligne et le process sort sans erreur ;
  - sans les variables `DISCORD_*` : le bot démarre toujours, en pg-boss seul.

## Critères d'acceptation (issue)

- [ ] Le bot apparaît en ligne sur le serveur de test, `/aide` répond.
- [ ] Tous les textes viennent de `packages/i18n`.

## Hors scope

- `/pause`, `/stop`, `/question` et les boutons de base : #27 et #28.
- Le message d'accueil et l'accord : #23.
- Le contenu de `/aide` lié à une campagne (deadline, progression) : #27.
- L'annonce sur le serveur du porteur : #29.
- Le rythme d'envoi des messages privés : #31.
