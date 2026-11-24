# Journal des décisions

Les entrées les plus récentes sont en haut.

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
