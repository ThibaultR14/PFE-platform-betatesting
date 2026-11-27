# Journal des décisions

Les entrées les plus récentes sont en haut.

## 2026-11-27 - Réponses dans la conversation : question passée, pause, version, micro-tests archivés

- Contexte : issue #25. Le testeur répond question par question avec des boutons, des menus et une fenêtre de saisie. Le corpus peut changer pendant la campagne, et la page web (#17) écrira dans la même table `Answer`.
- Décision :
  - **une question facultative passée crée une `Answer` dont `value` vaut `null`**. La question suivante est la première question active sans `Answer`, ce qui résiste aux réponses venues du web et aux questions ajoutées ou archivées. Contrat pour #14, #15 et #17 : ignorer `null` dans les statistiques, case vide dans le CSV, `null` pour une question facultative laissée vide sur la page web ;
  - **un testeur en pause peut finir le micro-test en cours** : la pause bloque seulement les envois suivants. Après `/stop` (`OPTED_OUT`), les réponses sont refusées ;
  - **le `customId` porte la version de la question** : si le porteur la modifie entre l'envoi et le clic, rien n'est enregistré et la version à jour est reposée. Sinon la réponse serait enregistrée avec une copie de la question qui ne correspond pas à ce que le testeur a vu ;
  - les choix voyagent par leur numéro (limite de 100 caractères des `customId`), traduit en texte avec `core.questionOptions`, la même liste que celle affichée. `Answer.value` garde le texte du choix ;
  - un choix unique a un bouton par choix jusqu'à 5 choix, au-delà un menu de sélection ;
  - chaque question suivante part dans un nouveau message privé (par le `DmSender`, comme l'intro), et l'ancien perd ses boutons et rappelle la réponse ;
  - `recordAnswer` verrouille l'assignment (`SELECT … FOR UPDATE`) : deux réponses simultanées ne peuvent pas laisser le micro-test ouvert ;
  - un assignment `SCHEDULED` dont le micro-test est archivé passe `SKIPPED` au tick suivant, et le micro-test suivant est planifié à la même date. Sinon le testeur ne recevrait plus rien ;
  - le micro-test suivant est le premier micro-test actif sans assignment pour ce testeur (pas « position + 1 ») : un micro-test ajouté en cours de campagne est envoyé aussi.
- Alternatives écartées :
  - pas d'`Answer` pour une question passée, et suivre la progression avec `currentQuestionIdx` seul : on se tromperait de question dès que le corpus change ou qu'une réponse arrive du web ;
  - un seul message modifié à chaque question : on perd l'historique des réponses dans la conversation ;
  - envoyer la question suivante en suite de l'interaction (`followUp`) : Discord l'affiche comme une réponse au message précédent, avec un aperçu qui répète la question d'avant (vu au test manuel) ;
  - lire les messages écrits (« 3 » tapé en privé) : il faudrait l'intent `DirectMessages` et deviner à quelle question le message répond. La SPEC exclut la compréhension des messages libres ;
  - `deferUpdate` avant chaque traitement : impossible pour le bouton qui ouvre la fenêtre de saisie, et inutile pour un traitement de quelques requêtes.

## 2026-11-27 - Envoi des micro-tests : règle d'envoi, testeur injoignable, lien signé vers le web

- Contexte : issue #24. Le scheduler tourne chaque minute et doit savoir quels micro-tests envoyer. Le message contient un lien vers la page web testeur `/t/[token]`, que le site (#17) devra vérifier.
- Décision :
  - la règle d'envoi est `core.isDue` : assignment `SCHEDULED` arrivé à échéance, testeur `ACTIVE` avec `consentAt`, campagne `ACTIVE`, micro-test non archivé. **Rien ne part après la date limite de la campagne**. La requête du scheduler reprend ces conditions (sinon des assignments en attente pour des testeurs en pause rempliraient chaque lot de 100), et `send-microtest` les revérifie au moment d'envoyer ;
  - `send-microtest` envoie un seul message privé : intro, première question, bouton « Répondre sur le web ». Les boutons de réponse arrivent avec #25 ;
  - messages privés fermés : le testeur passe **`UNREACHABLE` dès #24**, sinon le scheduler réessaierait chaque minute. #30 ajoute l'email de secours ;
  - lien signé : JWT HS256 (bibliothèque `jose`), valable 7 jours, `sub` = testerId, `assignmentId`, `aud` = `tester-link`, secret partagé `TESTER_LINK_SECRET` (32 caractères au moins). `signTesterLink`, `verifyTesterLink` et `testerLinkUrl` sont dans `packages/core`, pour que le bot et le site utilisent le même contrat. La page vérifie ensuite l'état de l'assignment. `TESTER_LINK_SECRET` est facultative pour le bot : sans elle, le bouton est omis ;
  - `packages/core` déclare les types Node (`@types/node`), comme `packages/jobs` : TypeScript 6 ne les inclut plus d'office, et `jose` demande `TextEncoder`.
- Alternatives écartées :
  - laisser l'assignment `SCHEDULED` après un refus de Discord : un essai par minute, sans fin ;
  - marquer l'assignment `SKIPPED` : le testeur resterait `ACTIVE` alors qu'on ne peut plus lui écrire ;
  - un jeton opaque stocké en base : une table de plus, pour un lien qui n'a besoin que d'être signé et de durer quelques jours ;
  - envoyer l'intro et la question en deux messages : un échec entre les deux renverrait l'intro au nouvel essai.

## 2026-11-26 - Accord du testeur uniquement par le bouton Discord

- Contexte : issue #23. Le testeur arrive soit par le lien d'invitation (page web), soit par le serveur du porteur (bouton « Participer »). Il faut un seul point où l'accord est enregistré.
- Décision :
  - `consentAt` n'est renseigné **que** par le clic sur « J'accepte de participer » dans le message privé d'accueil, quelle que soit la voie d'arrivée. La page web du lien d'invitation crée le `Tester` en `INVITED`, sans `consentAt`, puis lance `send-welcome` ;
  - le clic passe le testeur en `ACTIVE` et planifie son premier micro-test, dans une transaction. Une mise à jour conditionnelle (`INVITED` et `consentAt` vide) et la contrainte unique d'`Assignment` garantissent un seul assignment, même en cas de double clic ;
  - `send-welcome` ne renvoie rien si un accueil est déjà enregistré comme envoyé (`OutboundMessage`), si le testeur n'est plus `INVITED` ou si la campagne n'est pas `ACTIVE`. Messages privés fermés : échec enregistré, sans nouvel essai ;
  - le lien de confidentialité du message vaut `${PUBLIC_WEB_URL}/confidentialite`. `PUBLIC_WEB_URL` est facultative : sans elle, le lien est omis et le bot l'indique au démarrage.
- Alternatives écartées :
  - un accord donné sur la page web pour le lien d'invitation : deux chemins à maintenir, et rien ne prouve que le bot peut écrire en privé au testeur ;
  - réutiliser `AUTH_URL` pour les liens : c'est une variable d'Auth.js côté site, que le bot n'a pas sur Railway.

## 2026-11-24 - Bot : intent `Guilds` seul, slash commands globales enregistrées au démarrage

- Contexte : issue #22. Les testeurs utiliseront les commandes en message privé avec le bot, et #29 les utilisera sur le serveur du porteur. La SPEC exige d'éviter les autorisations sensibles (risque n° 3).
- Décision :
  - discord.js 14, avec l'intent `Guilds` seul. Les slash commands et les boutons arrivent par les interactions, qui ne demandent pas d'intent. Aucun intent privilégié ;
  - commandes **globales**, déclarées pour les contextes `Guild` et `BotDM` ;
  - enregistrées à chaque démarrage par un `PUT` qui remplace toute la liste : pas de doublon, et une commande retirée du code disparaît de Discord ;
  - nom et description des commandes dans `packages/i18n`, réponses éphémères ;
  - Discord se connecte avant pg-boss : un token refusé arrête le bot avant qu'il ne prenne des tâches. Sans aucune variable `DISCORD_*`, le bot tourne toujours en pg-boss seul ;
  - arrêt sur SIGINT/SIGTERM : Discord, puis pg-boss, avec une sortie forcée au bout de 15 s.
- Alternatives écartées :
  - des commandes limitées au serveur de test, qui ne marchent pas en message privé ;
  - un script d'enregistrement séparé, qu'il faudrait penser à lancer après chaque changement ;
  - l'intent `MessageContent` pour lire les messages libres, qui est privilégié et hors scope (pas d'IA sur les messages des testeurs).

## 2026-11-24 - Actions GitHub en dernière version majeure, E2E dans le job `check`

- Contexte : issue #4. La CI affichait un avertissement de dépréciation de Node 20. L'issue demandait les actions en v5, mais des versions plus récentes existent.
- Décision :
  - `actions/checkout@v7`, `pnpm/action-setup@v6`, `actions/setup-node@v7`, `actions/upload-artifact@v7`, toutes sur Node 24. `pnpm/action-setup` lit toujours la version de pnpm dans `packageManager` ;
  - Playwright (Chromium seul) tourne dans le job `check`. En CI, il teste le build de production (`next build` puis `next start`), et le rapport est envoyé en artefact en cas d'échec.
- Alternatives écartées :
  - la v5, déjà dépassée ;
  - un job `e2e` à part, qui aurait demandé de changer les checks obligatoires de la protection de `main` ;
  - tester sur `next dev` en CI, ce qui n'est pas ce qui sera déployé.

## 2026-11-24 - pg-boss 12, files `exclusive`, payloads validés deux fois

- Contexte : issue #3. Les tâches (envois, relances) doivent pouvoir être rejouées sans doublon, et le site et le bot doivent être d'accord sur le format des payloads.
- Décision :
  - `packages/jobs` porte le contrat : un schéma Zod par tâche, une `singletonKey` par défaut, `enqueue()` pour le site et `registerWorkers()` pour le bot ;
  - les files sont créées avec la politique `exclusive` : une seule tâche en attente ou en cours par clé ;
  - le payload est validé à l'envoi et à la réception. Une tâche invalide reçue part en `deadletter` (échec définitif, sans relance) ;
  - le bot démarre sans les variables Discord tant que #22 n'est pas fait. `DATABASE_URL` est obligatoire ;
  - chaque tâche a toujours une clé : en `exclusive`, pg-boss traite l'absence de clé comme une clé vide commune à toute la file. Une tâche planifiée plus tard garde sa clé jusqu'à son exécution, donc « relancer maintenant » (#26) devra passer sa propre clé ;
  - `ensureQueues` met à jour les relances des files existantes et refuse de démarrer si une file n'est pas `exclusive` (pg-boss ne permet pas de changer la politique d'une file).
- Alternatives écartées :
  - la politique `standard`, où une `singletonKey` seule ne garantit pas l'unicité ;
  - `stately`, qui accepte une tâche en attente en plus d'une tâche en cours, donc un doublon possible pendant un envoi ;
  - compter uniquement sur la clé : chaque handler relit quand même l'état en BDD avant d'agir.

## 2026-11-24 - Prisma 7, Postgres local sur le port 5433, tests d'intégration séparés

- Contexte : issue #2. Prisma 7 change la configuration (URL dans `prisma.config.ts`, driver adapter, `.env` qui n'est plus chargé tout seul, seed explicite). Le port 5432 est souvent déjà pris par un Postgres installé sur la machine.
- Décision :
  - Prisma 7.10 avec `@prisma/adapter-pg` ; le client est généré dans `packages/db/src/generated/` et n'est pas versionné ;
  - Docker Compose expose Postgres sur le port **5433**, avec deux bases : `microbeta` (dev) et `microbeta_test` ;
  - les tests d'intégration (`*.int.test.ts`, `pnpm test:int`) tournent sur `TEST_DATABASE_URL`, avec un garde-fou qui exige « test » dans le nom de la base ;
  - le seed vide et recrée les données, peut être relancé sans risque, et refuse `NODE_ENV=production` ;
  - pas de tables Auth.js pour l'instant (à trancher dans #5) ;
  - `Answer → Question` et `Assignment → MicroTest` sont en `NO ACTION` et **`DEFERRABLE INITIALLY DEFERRED`** (ajouté à la main dans la migration init, car Prisma ne sait pas l'exprimer). Une question répondue ou un micro-test envoyé ne peut pas être supprimé, on l'archive, ce qui garantit qu'aucune réponse ne se perd. Supprimer une campagne reste possible, parce que le contrôle se fait au commit, après les cascades. Sans le `DEFERRABLE`, Postgres refuse la suppression de la campagne (vérifié par un test d'intégration). Une migration future qui recrée ces FK doit remettre ce `DEFERRABLE`.
- Alternatives écartées :
  - Prisma 6, qui ne serait bientôt plus maintenu ;
  - Drizzle, moins familier, pour un gain faible ici ;
  - le port 5432, en conflit sur la machine de Thibault ;
  - les tests d'intégration dans `pnpm test`, qui le rendraient lent et dépendant de Docker.

## 2026-11-24 - Organisation à deux : board GitHub Projects et pistes

- Contexte : deux développeurs travaillent en parallèle, et il faut savoir qui fait quoi.
- Décision : issues GitHub et board GitHub Projects (À faire / En cours / En review / Fait). Labels `piste:web`, `piste:bot`, `piste:commun`. Le socle commun (scaffold, schéma Prisma, design system) est fait en premier. Ensuite, une piste chacun.
- Alternatives écartées : un fichier `TODO.md` partagé, qui provoque des conflits Git et n'est jamais à jour. Jira, trop lourd pour deux personnes.

## 2026-11-24 - Aucune mention de Claude dans les commits ni les PR

- Contexte : Claude Code ajoute par défaut une ligne de co-auteur.
- Décision : ne jamais ajouter `Co-Authored-By: Claude` ni « Generated with Claude Code ».
- Alternatives écartées : aucune.

## 2026-11-24 - Couche IA qui permet de changer de fournisseur, Claude Haiku 5.5 par défaut

- Contexte : il faut le meilleur compromis entre coût et qualité, et les crédits de l'école ne sont pas encore connus.
- Décision : `packages/ai` cache le fournisseur. Claude Haiku 5.5 pour le découpage. Pour la génération, Haiku 5.5 ou Sonnet 5.5 après un banc d'essai sur 5 vrais produits. Coût estimé : 0,005 à 0,10 $ par corpus.
- Alternatives écartées : se lier à un seul fournisseur, ce qui empêche de profiter des crédits disponibles. Prendre d'emblée le modèle le plus puissant, ce qui coûte trop cher pour un gain non mesuré.

## 2026-11-24 - Offres Gratuit + Pro via Stripe dès le MVP

- Contexte : il faut valider le modèle économique avec de vrais porteurs.
- Décision : Stripe Checkout et portail client. Gratuit (1 campagne, 10 testeurs, 3 générations IA par mois) et Pro (~10 €/mois). Chiffres provisoires.
- Alternatives écartées : paiement par campagne ou packs de crédits, moins prévisibles pour le porteur.

## 2026-11-24 - Connexion : Discord OAuth pour le porteur, pas de compte testeur

- Contexte : il faut le moins de friction possible, et tout le monde est déjà sur Discord.
- Décision : le porteur se connecte avec Discord (Auth.js). Le testeur est identifié par son Discord ID, et par un lien signé pour les pages web.
- Alternatives écartées : email et mot de passe, ou des comptes testeurs, pour plus de friction sans gain dans le MVP.

## 2026-11-24 - Réponses dans la conversation Discord, page web en secours

- Contexte : les questions simples se font bien dans Discord, mais les questions longues et les captures d'écran non.
- Décision : questions posées une par une avec des boutons et des fenêtres de saisie, plus un lien vers une page web. Un seul modèle `Answer` pour les deux.
- Alternatives écartées : Google Forms (API et OAuth du porteur, réponses difficiles à rapatrier), CSV (pénible sur mobile), web seul (moins engageant).

## 2026-11-24 - Arrivée des testeurs avec accord explicite

- Contexte : un bot Discord ne peut écrire qu'aux membres d'un serveur qu'il partage avec eux, et écrire à des gens qui n'ont rien demandé le fait passer pour un spammeur.
- Décision : deux voies, le lien d'invitation (OAuth et `guilds.join` vers notre serveur) et le bot sur le serveur du porteur (bouton « Participer »). Rien n'est envoyé avant l'accord du testeur.
- Alternatives écartées : messages privés envoyés à des membres à partir d'une liste de pseudos, qui expose au bannissement.

## 2026-11-24 - Discord d'abord, WhatsApp en V2

- Contexte : l'API WhatsApp officielle exige une vérification Meta et des messages modèles payants pour les relances. Les bibliothèques non officielles exposent le numéro au bannissement.
- Décision : MVP sur Discord seulement, avec l'email en secours.
- Alternatives écartées : Meta Cloud API dès le MVP (délais de vérification), Baileys (contraire aux conditions de WhatsApp), Twilio (mêmes contraintes et payant).

## 2026-11-24 - Stack : monorepo TypeScript, Next.js, discord.js, pg-boss, Postgres

- Contexte : le bot doit tourner en continu, et à deux il faut une seule langue et des types partagés.
- Décision : pnpm et Turborepo. `apps/web` en Next.js sur Vercel, `apps/bot` en discord.js avec pg-boss sur Railway. PostgreSQL et Prisma. Vitest et Playwright.
- Alternatives écartées : Python (FastAPI) avec React, qui donne deux langues et aucun type partagé. Supabase, inutile puisqu'on a déjà Postgres et Auth.js. Une file Redis/BullMQ, un service de plus alors que pg-boss tourne sur le même Postgres.
