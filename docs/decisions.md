# Journal des décisions

Les entrées les plus récentes sont en haut.

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
