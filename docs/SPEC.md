# SPEC — Plateforme de micro-testing (nom provisoire : _MicroBeta_)

> Projet de fin d'études. Version 1 — 2026-11-24.

## Objectif

Aider un **porteur de projet** (startup, étudiant, créateur d'app) à faire tester son produit par **ses propres testeurs**, sans les noyer sous un long questionnaire.

Le porteur décrit son produit, l'IA génère un **plan de test** (le « corpus »), puis le découpe en **micro-tests** de ~5 minutes. Un **bot Discord** envoie les micro-tests aux testeurs au rythme choisi, relance ceux qui ne répondent pas, répond aux questions de base et transmet les autres au porteur. Toutes les réponses arrivent sur un **site web** qui les regroupe en temps réel.

**Critère de succès PFE :** une démo devant le jury, plus au moins 2–3 vrais porteurs qui mènent une campagne complète avec de vrais testeurs.

## Utilisateurs

| Rôle             | Description                                                                     | Accès                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Porteur**      | Crée des campagnes, gère ses testeurs, consulte les réponses. Paie l'offre Pro. | Site web, connexion **Discord OAuth** (compte solo, pas d'équipe).                                            |
| **Testeur**      | Amené par le porteur. Reçoit les micro-tests, y répond, pose des questions.     | **Pas de compte** : identifié par son compte Discord, et par un lien signé à usage limité pour les pages web. |
| **Admin** (nous) | Suit les coûts IA, les quotas, les erreurs d'envoi.                             | Page admin protégée (liste blanche de Discord IDs).                                                           |

## Fonctionnalités MVP

### Côté porteur (site web)

1. **Connexion avec Discord** (OAuth).
2. **Créer une campagne** : nom, description du produit, lien (site / téléchargement), date limite, message d'accueil.
3. **Corpus**
   - Le créer à la main (éditeur de micro-tests et de questions).
   - Ou le **générer avec l'IA** à partir de la description du produit.
   - **Découpage par l'IA** en micro-tests de ~5 min (3 à 5 questions chacun). Le porteur relit, modifie, réordonne, puis valide.
   - Types de question : texte libre, note de 1 à 5, choix unique ou multiple, oui/non.
   - Une **banque de questions types** (facilité 1–5, NPS, « qu'est-ce qui vous a bloqué ? »…) à insérer dans le corpus.
   - Le corpus **reste modifiable pendant la campagne**. Une modification ne touche que les micro-tests pas encore envoyés à un testeur, et chaque réponse garde une copie de la question telle qu'elle a été posée.
4. **Rythme et relances** : délai entre deux micro-tests (par ex. 48 h). Le suivant part quand le précédent est fini **et** que le délai est passé. Relance 1 à J+24 h, relance 2 à J+72 h, puis le testeur passe « inactif ». Tous ces délais sont réglables. Un bouton « relancer maintenant » est aussi prévu.
5. **Recruter des testeurs**, de deux façons :
   - **Lien d'invitation de campagne** : le testeur clique, se connecte avec Discord, donne son accord, puis rejoint le serveur commun de la plateforme. Le bot peut alors lui écrire en message privé.
   - **Bot ajouté au serveur du porteur** : le porteur invite le bot sur son serveur, qui publie une annonce avec un bouton **« Participer »**. Le bot n'écrit jamais en privé à un membre qui n'a pas accepté, pour éviter que Discord le considère comme un spammeur.
   - Email facultatif par testeur, utilisé seulement en secours.
6. **Tableau de bord** de la campagne, mis à jour en continu (rafraîchi toutes les ~30 s) :
   - Progression par testeur : micro-test en cours, en retard, inactif, injoignable, désinscrit. Taux de complétion.
   - Réponses regroupées par question : moyenne et répartition des notes, graphiques des choix, liste des réponses en texte.
   - **Export CSV** de toutes les réponses.
7. **Boîte de réception** : les questions des testeurs arrivent ici, et la réponse du porteur leur est renvoyée par le bot.
8. **Offres Stripe** : Gratuit et Pro mensuel (Stripe Checkout, portail client, webhooks). Quotas appliqués côté serveur.

### Côté testeur (Discord + page web de secours)

1. **Premier message** : qui est le bot, pour quelle campagne et quel porteur, combien de temps ça prend, lien vers le produit, lien vers la page de confidentialité, puis un bouton **« J'accepte de participer »**. Aucun micro-test n'est envoyé avant cet accord.
2. **Réception d'un micro-test** : les questions arrivent une par une dans la conversation (boutons pour les notes et les choix, saisie libre pour le texte). Un lien « répondre sur le web » ouvre une page de secours pour les tests longs ou pour joindre une capture d'écran. Les deux voies enregistrent les réponses au même endroit.
3. **Boutons et commandes de base**, sans passer par le porteur : ℹ️ _Qui es-tu ?_, ⏰ _Jusqu'à quand ?_, 📊 _Où j'en suis ?_, ⏸ _Pause_, 🛑 _Stop_ (désinscription immédiate), ❓ _Poser une question au porteur_. Ils existent aussi en commandes `/aide`, `/pause`, `/stop`, `/question`.
4. **Relances** automatiques pour le micro-test suivant ou en cas de silence.
5. **Si le bot ne peut plus écrire** (messages privés fermés, serveur quitté) : le testeur passe « injoignable » et reçoit le lien de la page web par email si on a son adresse.

### Transverse

- **RGPD (niveau minimum sérieux)** : accord explicite avant tout envoi, `/stop` qui désinscrit immédiatement, suppression des données d'un testeur sur demande (bouton côté porteur et côté admin), page de confidentialité.
- **Français seul**, avec tous les textes regroupés dans des fichiers à part pour pouvoir traduire plus tard.
- **Suivi des coûts IA** : chaque appel à l'IA enregistre le modèle utilisé, les tokens et le coût. L'admin voit le coût par porteur.

## Hors scope (MVP)

- **WhatsApp** : prévu en V2, via l'API officielle de Meta. Il faudra une vérification Meta et des messages modèles payants pour les relances.
- Telegram, SMS, et l'email comme canal principal (l'email ne sert qu'en secours).
- Un vivier de testeurs fourni par la plateforme.
- Plusieurs personnes sur un même compte porteur, avec des rôles.
- Une synthèse des réponses par l'IA.
- Une IA qui répond aux questions des testeurs ou qui comprend leurs messages libres.
- Google Forms, et l'envoi ou la réception de CSV côté testeur.
- L'anglais et les autres langues.
- Les applications mobiles.

## Stack

| Brique                  | Choix                                                                                                                                                                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organisation du code    | Un seul dépôt TypeScript (monorepo) : **pnpm workspaces + Turborepo**                                                                                                                                                                                                   |
| Site                    | **Next.js** (App Router), Tailwind CSS, shadcn/ui                                                                                                                                                                                                                       |
| Connexion               | **Auth.js** avec Discord. Liens signés (JWT courts) pour les testeurs                                                                                                                                                                                                   |
| Bot + tâches planifiées | Programme Node séparé et toujours allumé : **discord.js** + **pg-boss** (file de tâches dans Postgres : envois, relances, rythme)                                                                                                                                       |
| Base de données         | **PostgreSQL** + **Prisma**                                                                                                                                                                                                                                             |
| IA                      | Une couche d'abstraction (`packages/ai`) qui demande des sorties JSON validées par Zod, pour pouvoir changer de fournisseur. Choix par défaut : **Claude Haiku 5.5** pour le découpage, et Haiku 5.5 ou Sonnet 5.5 pour la génération, à trancher après un banc d'essai |
| Paiement                | **Stripe** (Checkout, portail client, webhooks)                                                                                                                                                                                                                         |
| Email de secours        | **Resend**                                                                                                                                                                                                                                                              |
| Tests                   | **Vitest**, et **Playwright** pour les tests de bout en bout du site                                                                                                                                                                                                    |
| Qualité du code         | ESLint + Prettier, GitHub Actions                                                                                                                                                                                                                                       |
| Hébergement             | **Vercel** pour le site, **Railway** pour le bot et Postgres (~5–10 €/mois)                                                                                                                                                                                             |

## Modèle de données

```
User (porteur)        id, discordId*, name, email?, avatarUrl, plan[FREE|PRO],
                      stripeCustomerId?, stripeSubscriptionId?, createdAt
Campaign              id, ownerId→User, name, productDescription, productUrl,
                      welcomeMessage, deadline?, status[DRAFT|ACTIVE|PAUSED|DONE],
                      cadenceHours, reminder1Hours, reminder2Hours,
                      inviteCode*, discordGuildId?, announceChannelId?, createdAt
MicroTest             id, campaignId→Campaign, position, title, instructions,
                      estimatedMinutes, archivedAt?
Question              id, microTestId→MicroTest, position, type[TEXT|RATING|SINGLE|MULTI|YESNO],
                      prompt, options(json)?, required, version, archivedAt?
QuestionTemplate      id, type, prompt, options(json)?, category   (banque de questions types)
Tester                id, campaignId→Campaign, discordUserId, displayName, email?,
                      source[INVITE_LINK|GUILD], status[INVITED|ACTIVE|PAUSED|INACTIVE|
                      UNREACHABLE|OPTED_OUT], consentAt?, createdAt
                      unique(campaignId, discordUserId)
Assignment            id, testerId→Tester, microTestId→MicroTest,
                      status[SCHEDULED|SENT|IN_PROGRESS|COMPLETED|SKIPPED],
                      scheduledAt, sentAt?, completedAt?, reminderCount, lastReminderAt?,
                      currentQuestionIdx
Answer                id, assignmentId→Assignment, questionId→Question,
                      questionSnapshot(json), value(json), channel[DISCORD|WEB], createdAt
TesterQuestion        id, testerId→Tester, body, reply?, repliedAt?, status[OPEN|ANSWERED]
AiUsage               id, userId→User, campaignId?, kind[GENERATE|SPLIT], model,
                      inputTokens, outputTokens, costUsd, createdAt
OutboundMessage       id, testerId, kind[WELCOME|MICROTEST|REMINDER|REPLY|FALLBACK_EMAIL],
                      status[SENT|FAILED], error?, createdAt   (journal des envois)
```

## Estimation des coûts IA et quotas

| Opération                                                                  | Modèle     | Coût estimé |
| -------------------------------------------------------------------------- | ---------- | ----------- |
| Générer un corpus (~3k tokens en entrée, ~10k en sortie avec la réflexion) | Sonnet 5.5 | ~0,10 $     |
| Pareil                                                                     | Haiku 5.5  | ~0,005 $    |
| Découper en micro-tests                                                    | Haiku 5.5  | ~0,003 $    |

Les quotas proposés, à ajuster d'après les vrais chiffres de `AiUsage` :

- **Gratuit** : 1 campagne active, 10 testeurs, 3 générations IA par mois.
- **Pro (~10 €/mois)** : 5 campagnes actives, 100 testeurs par campagne, 50 générations IA par mois.

Le coût IA d'un porteur Pro qui atteint son quota reste sous 5 $ par mois, même avec Sonnet. Les 300 € de crédits de l'école couvrent largement le développement et la démo.

## Risques techniques (« est-ce si simple ? »)

1. **Discord pourrait considérer le bot comme un spammeur.** Envoyer des messages privés en masse à des gens qui n'ont rien demandé peut le faire bloquer. Parade : bouton « Participer » obligatoire, et un rythme d'envoi limité par la file de tâches.
2. **Messages privés fermés**, ou testeur qui quitte le serveur commun : beaucoup de testeurs deviendront « injoignables ». Parade : statut visible côté porteur et email de secours.
3. **Bot vérifié et autorisations sensibles.** Au-delà de 100 serveurs, Discord exige de vérifier le bot. La lecture de la liste des membres et du contenu des messages demande des autorisations spéciales, qu'on évite si possible en passant par les commandes et les boutons. Pas de problème pour le PFE.
4. **Le bot doit tourner en continu** (connexion permanente à Discord). On ne peut pas tout mettre sur Vercel, d'où un second service hébergé sur Railway.
5. **Corpus modifiable pendant la campagne** : il faut garder une copie de chaque question dans les réponses, sinon les statistiques mélangent des questions différentes.
6. **Les tâches planifiées doivent être fiables** : relances au bon moment, pas de doublon si le bot redémarre (les tâches doivent pouvoir être rejouées sans effet de bord), prise en compte des fuseaux horaires.
7. **Qualité de ce que produit l'IA** : sortie JSON validée par Zod, nouvel essai si elle est invalide, relecture obligatoire par le porteur.
8. **WhatsApp (V2)** : vérification Meta (de quelques jours à quelques semaines), messages modèles payants hors de la fenêtre de 24 h, numéro dédié. À anticiper dès maintenant si on vise la V2.

## Questions ouvertes

- **Choix du modèle IA** : banc d'essai Haiku 5.5 contre Sonnet 5.5 sur 5 descriptions de produits réelles, critère « corpus utilisable sans retouche importante ». Penser aussi à demander les 300 € de crédits à l'école.
- **Chiffres définitifs des quotas** Gratuit/Pro, à fixer après les premiers vrais usages.
- **Nom du produit** et nom du bot.
- **Serveur Discord commun** de la plateforme : un seul serveur pour toutes les campagnes, ou un salon par campagne ?
- **Pièces jointes** (captures d'écran) sur la page web : stockage S3/R2 ou Vercel Blob, et taille maximale.
- **Pause du testeur** : faut-il une reprise automatique après N jours ?
