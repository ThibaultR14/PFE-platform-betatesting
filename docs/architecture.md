# Architecture

Le _quoi_ est dans [SPEC.md](SPEC.md). Ce fichier décrit le _comment_.

## Vue d'ensemble

```
                 ┌────────────────────────── Vercel ──────────────────────────┐
 Porteur ──────► │ apps/web (Next.js)                                         │
 (navigateur)    │  - pages porteur (campagnes, corpus, dashboard, inbox)     │
                 │  - pages testeur /t/[token] (page web de secours)          │
 Testeur ──────► │  - API routes : Auth.js, webhook Stripe, actions serveur   │
 (lien web)      └───────────────┬────────────────────────────────────────────┘
                                 │ Prisma                 ▲
                                 ▼                        │ envoi tâche (pg-boss)
                 ┌──────────── Railway ─────────────────────────────────────────┐
                 │ PostgreSQL  ◄──────── tables métier + schéma pgboss         │
                 │     ▲                                                        │
                 │     │ Prisma + pg-boss                                       │
                 │ apps/bot (Node, process permanent)                           │
                 │  - client discord.js (connexion permanente, interactions)    │
                 │  - workers pg-boss : send-microtest, reminder, reply,        │
                 │    fallback-email, scheduler (tick toutes les minutes)      │
                 └─────┬───────────────────────────────────────┬────────────────┘
                       ▼                                       ▼
                   Discord API                        Resend (email)
 Services externes appelés par web : Claude API (packages/ai), Stripe
```

## Paquets

| Paquet          | Rôle                                                                                                      | Utilisé par |
| --------------- | --------------------------------------------------------------------------------------------------------- | ----------- |
| `packages/db`   | Schéma Prisma, migrations, client, données de démo                                                        | web, bot    |
| `packages/core` | Logique métier pure et testable : calcul du prochain envoi, règles de relance, quotas, transitions d'état | web, bot    |
| `packages/ai`   | Prompts, appels LLM, validation Zod, calcul de coût, écriture `AiUsage`                                   | web         |
| `packages/i18n` | Tous les textes (FR), clés typées                                                                         | web, bot    |
| `apps/web`      | Interface et API                                                                                          | —           |
| `apps/bot`      | Bot Discord et workers                                                                                    | —           |

**Règle :** `apps/web` et `apps/bot` ne s'appellent jamais directement. Ils communiquent seulement par la BDD et les files pg-boss. Le web place une tâche (par ex. `reply` quand le porteur répond à une question), et le bot l'exécute.

## Flux principaux

### 1. Génération et découpage du corpus

1. Le porteur remplit la description du produit, puis clique « Générer ».
2. Une server action vérifie le quota (`core.quota.canGenerate`) puis appelle `ai.generateCorpus(description)`.
3. Le LLM renvoie du JSON, validé avec Zod. Une seule nouvelle tentative s'il est invalide.
4. `ai.splitIntoMicroTests(corpus)` renvoie des micro-tests de 3 à 5 questions.
5. Le résultat est enregistré comme brouillon (`MicroTest`, `Question`), avec une ligne `AiUsage` par appel.
6. Le porteur relit et modifie dans l'éditeur, puis lance la campagne.

### 2. Arrivée d'un testeur

- **Par lien d'invitation** : `/join/[inviteCode]` → OAuth Discord (scopes `identify guilds.join`) → page d'accord → création du `Tester` avec `consentAt` → le bot ajoute le testeur au serveur commun (`guilds.join`) → message privé d'accueil.
- **Par le serveur du porteur** : le bot publie une annonce avec un bouton « Participer ». Un clic crée le `Tester`, le bot envoie un message privé d'accueil avec un bouton « J'accepte », qui renseigne `consentAt`.
- Le premier `Assignment` (micro-test n°1) est planifié dès l'accord du testeur.

### 3. Envoi, réponse, relance

- **Le scheduler** (cron pg-boss, toutes les minutes) sélectionne les `Assignment` à envoyer (`SCHEDULED` et `scheduledAt <= now`), et ceux à relancer d'après `core.reminders.nextAction(assignment, campaign, now)`.
- **`send-microtest`** envoie l'intro et la première question (boutons pour les notes et les choix, fenêtre de saisie pour le texte), plus le lien vers la page web.
- **Chaque réponse** (interaction Discord ou envoi du formulaire web) crée une `Answer` avec `questionSnapshot`, puis passe à la question suivante (`currentQuestionIdx`).
- **Quand le micro-test est fini** : `COMPLETED`, et l'`Assignment` suivant est créé avec `scheduledAt = completedAt + cadenceHours`.
- **Relances** : une au bout de `reminder1Hours`, une au bout de `reminder2Hours`, puis le testeur passe `INACTIVE`.
- **Discord refuse le message privé** (erreur 50007) : le testeur passe `UNREACHABLE` et une tâche `fallback-email` part si on a son email.

### 4. Questions des testeurs

- Les boutons de base répondent tout seuls, à partir des données de la campagne (deadline, progression…).
- « Question au porteur » ouvre une fenêtre de saisie qui crée un `TesterQuestion` `OPEN`, visible dans l'inbox du site.
- Quand le porteur répond, une tâche `reply` part et le bot envoie la réponse en message privé.

### 5. Paiement

Stripe Checkout, puis webhook `checkout.session.completed` et `customer.subscription.*`, qui met à jour `User.plan`. Les quotas sont toujours vérifiés côté serveur avec `core.quota`.

## Fiabilité des tâches

- Chaque tâche relit l'état en BDD avant d'agir et ne fait rien si c'est déjà fait. Elle peut donc tourner deux fois sans doublon.
- `singletonKey` pg-boss par `assignmentId + type` pour éviter les doublons.
- Toutes les dates sont stockées en UTC. L'affichage utilise le fuseau `Europe/Paris` (MVP).
- Rythme d'envoi des messages privés limité côté bot (file avec concurrence réduite) pour rester sous les limites de Discord.

## Schéma de BDD

Voir la section _Modèle de données_ de [SPEC.md](SPEC.md). Le schéma qui fait foi est `packages/db/prisma/schema.prisma`, créé par l'issue Socle commun.

Les index à prévoir :

- `Assignment(status, scheduledAt)` pour le scheduler ;
- `Tester(campaignId, status)` ;
- `Answer(questionId)` pour les agrégats ;
- `AiUsage(userId, createdAt)` pour les quotas mensuels.

## Environnements

| Env   | Web        | Bot                                    | BDD                         |
| ----- | ---------- | -------------------------------------- | --------------------------- |
| local | `pnpm dev` | `pnpm dev` (bot de test Discord dédié) | Postgres via Docker Compose |
| prod  | Vercel     | Railway service                        | Railway Postgres            |

Chaque dev a **son propre bot Discord de test** et son propre serveur de test, pour ne pas se marcher dessus.
