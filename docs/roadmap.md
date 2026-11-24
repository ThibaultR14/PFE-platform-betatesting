# Roadmap

> **La source de vérité, ce sont les issues GitHub et le board**, pas ce fichier : le détail, les critères d'acceptation, la personne assignée et le statut y sont.
> Cet index liste le découpage initial (2026-11-24) et les dépendances. Une nouvelle tâche = une nouvelle issue, pas une modification d'ici.

- Issues : https://github.com/ThibaultR14/PFE-platform-betatesting/issues
- Milestones : https://github.com/ThibaultR14/PFE-platform-betatesting/milestones
- Labels piste : `piste:commun`, `piste:web`, `piste:bot` · type : `type:feature`, `type:chore`, `type:design`, `type:infra`

**Ordre conseillé :** M0 (#1–#4) d'abord, puis une piste par personne. Les deux pistes ne se rejoignent qu'à 4 endroits (#12, #28, #29, #30), et toujours via la BDD ou la file de tâches.

## M0 - Socle commun

| Issue                                                                  | ID  | Tâche                                                     | Dépend de |
| ---------------------------------------------------------------------- | --- | --------------------------------------------------------- | --------- |
| [#1](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/1) | S1  | Design system                                             | —         |
| [#2](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/2) | S2  | Base de données : Prisma, schéma complet, données de démo | —         |
| [#3](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/3) | S3  | File de tâches : pg-boss et contrat des tâches            | #2 (S2)   |
| [#4](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/4) | S4  | Outillage : actions v5, Playwright, guide d'installation  | —         |

## V1 - MVP · Piste Site (`piste:web`)

| Issue                                                                    | ID  | Tâche                                             | Dépend de          |
| ------------------------------------------------------------------------ | --- | ------------------------------------------------- | ------------------ |
| [#5](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/5)   | W1  | Connexion porteur avec Discord                    | #2 (S2)            |
| [#6](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/6)   | W2  | Créer et lister ses campagnes                     | #5 (W1), #1 (S1)   |
| [#7](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/7)   | W3  | Éditeur de micro-tests (manuel)                   | #6 (W2)            |
| [#8](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/8)   | W4  | Éditeur de questions et banque de questions types | #7 (W3)            |
| [#9](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/9)   | W5  | Génération du corpus par l'IA                     | #7 (W3)            |
| [#10](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/10) | W6  | Découpage du corpus en micro-tests par l'IA       | #9 (W5)            |
| [#11](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/11) | W7  | Rythme, relances et lancement de la campagne      | #8 (W4)            |
| [#12](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/12) | W8  | Lien d'invitation testeur et accord               | #6 (W2), #3 (S3)   |
| [#13](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/13) | W9  | Tableau de bord : progression par testeur         | #11 (W7), #2 (S2)  |
| [#14](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/14) | W10 | Tableau de bord : réponses par question           | #13 (W9)           |
| [#15](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/15) | W11 | Export CSV                                        | #14 (W10)          |
| [#16](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/16) | W12 | Boîte de réception des questions testeurs         | #5 (W1), #3 (S3)   |
| [#17](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/17) | W13 | Page web de secours `/t/[token]`                  | #8 (W4), #2 (S2)   |
| [#18](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/18) | W14 | Paiement Stripe : offre Pro                       | #5 (W1)            |
| [#19](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/19) | W15 | Quotas Gratuit et Pro                             | #18 (W14), #9 (W5) |
| [#20](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/20) | W16 | Admin : coûts IA et suivi                         | #9 (W5)            |
| [#21](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/21) | W17 | RGPD : suppression des données d'un testeur       | #13 (W9)           |

## V1 - MVP · Piste Bot (`piste:bot`)

| Issue                                                                    | ID  | Tâche                                                           | Dépend de           |
| ------------------------------------------------------------------------ | --- | --------------------------------------------------------------- | ------------------- |
| [#22](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/22) | B1  | Connexion Discord et commande `/aide`                           | #3 (S3), #4 (S4)    |
| [#23](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/23) | B2  | Message d'accueil et accord du testeur                          | #22 (B1)            |
| [#24](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/24) | B3  | Scheduler et envoi d'un micro-test                              | #23 (B2)            |
| [#25](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/25) | B4  | Répondre dans la conversation et enchaîner                      | #24 (B3)            |
| [#26](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/26) | B5  | Relances automatiques                                           | #24 (B3)            |
| [#27](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/27) | B6  | Boutons de base : qui es-tu, échéance, progression, pause, stop | #23 (B2)            |
| [#28](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/28) | B7  | Question au porteur et réponse renvoyée                         | #27 (B6), #3 (S3)   |
| [#29](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/29) | B8  | Mode « bot sur le serveur du porteur »                          | #23 (B2), #6 (W2)   |
| [#30](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/30) | B9  | Testeur injoignable et email de secours                         | #24 (B3), #17 (W13) |
| [#31](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/31) | B10 | Fiabilité des envois : débit limité et journal                  | #24 (B3)            |

## V1 - MVP · Fin de MVP (`piste:commun`)

| Issue                                                                    | ID  | Tâche                            | Dépend de                     |
| ------------------------------------------------------------------------ | --- | -------------------------------- | ----------------------------- |
| [#32](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/32) | C1  | Banc d'essai des modèles IA      | #10 (W6)                      |
| [#33](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/33) | C2  | Déploiement en production        | #24 (B3), #12 (W8)            |
| [#34](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/34) | C3  | Scénario de démo de bout en bout | #33 (C2), #15 (W11), #26 (B5) |

## V2 - Après MVP

| Issue                                                                    | ID   | Tâche                                                               | Dépend de |
| ------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------- | --------- |
| [#35](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/35) | V2-1 | Canal WhatsApp (Meta Cloud API, messages modèles pour les relances) | —         |
| [#36](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/36) | V2-2 | Synthèse IA des réponses                                            | —         |
| [#37](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/37) | V2-3 | FAQ IA pour les messages libres des testeurs                        | —         |
| [#38](https://github.com/ThibaultR14/PFE-platform-betatesting/issues/38) | V2-4 | Interface et bot en anglais                                         | —         |
