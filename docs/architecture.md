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
| `packages/jobs` | Contrat des tâches pg-boss : noms, payloads Zod, clés anti-doublon, `enqueue()`, `registerWorkers()`      | web, bot    |
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

- **Par lien d'invitation** : `/join/[inviteCode]` → OAuth Discord (scopes `identify guilds.join`) → page de présentation → création du `Tester` en `INVITED`, **sans** `consentAt` → le bot ajoute le testeur au serveur commun (`guilds.join`) → tâche `send-welcome`.
- **Par le serveur du porteur** : le bot publie une annonce avec un bouton « Participer ». Un clic crée le `Tester` en `INVITED` → tâche `send-welcome`.
- **Dans les deux cas**, `send-welcome` envoie le message privé d'accueil avec le bouton « J'accepte de participer ». **Seul ce clic** renseigne `consentAt` et passe le testeur en `ACTIVE` (voir `docs/decisions.md`).
- Le premier `Assignment` (micro-test n°1, `core.firstAssignment`) est planifié au moment du clic. Un double clic n'en crée qu'un.

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
- Les files pg-boss sont en politique `exclusive` : au plus une tâche en attente ou en cours par `singletonKey`. Chaque tâche a une clé par défaut tirée de son payload (`reminder:<assignmentId>:<n>`, `send-microtest:<assignmentId>`…). Un second envoi avec la même clé renvoie `null`.
- Le payload est validé par Zod à l'envoi (`enqueue` lève une erreur) et à la réception (la tâche part en échec définitif, sans appeler le handler).
- Relances pg-boss : 3 nouvelles tentatives après le premier essai (4 au total), avec un délai exponentiel (30 s au départ), sauf pour `scheduler-tick` (cron chaque minute, en UTC, sans relance).
- pg-boss range ses tables dans le schéma Postgres `pgboss`, à côté du schéma `public` géré par Prisma.
- Toutes les dates sont stockées en UTC. L'affichage utilise le fuseau `Europe/Paris` (MVP).
- Rythme d'envoi des messages privés limité côté bot (file avec concurrence réduite) pour rester sous les limites de Discord.

## Schéma de BDD

Le schéma qui fait foi est [`packages/db/prisma/schema.prisma`](../packages/db/prisma/schema.prisma). Le résumé est dans la section _Modèle de données_ de [SPEC.md](SPEC.md).

**Index :**

- `Assignment(status, scheduledAt)` pour le scheduler ;
- `Tester(campaignId, status)` ;
- `Answer(questionId)` pour les agrégats ;
- `AiUsage(userId, createdAt)` pour les quotas mensuels ;
- `MicroTest(campaignId, position)` et `Question(microTestId, position)`.

**Unicités qui empêchent les doublons quand une tâche est rejouée :**

- `Tester(campaignId, discordUserId)` ;
- `Assignment(testerId, microTestId)` ;
- `Answer(assignmentId, questionId)` : une réponse modifiée remplace l'ancienne.

**Suppressions :**

- supprimer une campagne supprime tout ce qui en dépend ;
- supprimer un testeur supprime ses assignments, réponses, questions et le journal de ses messages (RGPD) ;
- `AiUsage.campaignId` passe à `SET NULL` quand la campagne est supprimée, pour garder l'historique des coûts.

**Client :**

- `@microbeta/db` exporte `getPrisma()` (singleton) et `createPrismaClient(url)` ;
- Prisma 7 utilise le driver adapter `@prisma/adapter-pg` ;
- le client est généré dans `packages/db/src/generated/` (non versionné, recréé au `postinstall`).

## Environnements

| Env   | Web                                 | Bot                                    | BDD                                                                                     |
| ----- | ----------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------- |
| local | `pnpm dev`                          | `pnpm dev` (bot de test Discord dédié) | Docker Compose, port 5433 : `microbeta` (dev) et `microbeta_test` (tests d'intégration) |
| CI    | `next build` + `start` (Playwright) | —                                      | service Postgres GitHub Actions (`microbeta_test`)                                      |
| prod  | Vercel                              | Railway service                        | Railway Postgres                                                                        |

Chaque dev a **son propre bot Discord de test** et son propre serveur de test, pour ne pas se marcher dessus. Installation pas à pas : [dev-setup.md](dev-setup.md).
