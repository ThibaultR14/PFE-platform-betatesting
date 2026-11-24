# Design system

> La direction visuelle n'est pas encore choisie. Elle sera tranchée dans l'issue « Design system ». Valeurs proposées par défaut, à valider.

## Principes

- **Clair et rassurant** : le porteur doit voir d'un coup d'œil où en est sa campagne.
- **Dense mais aéré** : le tableau de bord contient beaucoup de données, donc une hiérarchie typographique nette.
- **Mobile d'abord pour les pages testeur** (page web de secours), bureau d'abord pour le porteur.

## Palette (TODO : valider)

| Rôle                          | Token                | Valeur proposée              |
| ----------------------------- | -------------------- | ---------------------------- |
| Primaire                      | `--primary`          | `#4F46E5` (indigo 600)       |
| Primaire survol               | `--primary-hover`    | `#4338CA`                    |
| Fond                          | `--background`       | `#FFFFFF` / sombre `#0B0B12` |
| Surface                       | `--card`             | `#F8FAFC` / sombre `#151522` |
| Texte                         | `--foreground`       | `#0F172A` / sombre `#E2E8F0` |
| Texte secondaire              | `--muted-foreground` | `#64748B`                    |
| Succès (complété)             | `--success`          | `#16A34A`                    |
| Alerte (en retard)            | `--warning`          | `#D97706`                    |
| Danger (inactif, injoignable) | `--destructive`      | `#DC2626`                    |
| Neutre (désinscrit)           | `--muted`            | `#94A3B8`                    |

Les statuts testeur ont toujours une couleur **et** une icône ou un libellé, jamais la couleur seule (accessibilité).

## Typographie (TODO : valider)

- Police : **Inter** (UI), **JetBrains Mono** (codes d'invitation, identifiants).
- Échelle : 12 / 14 (corps) / 16 / 20 / 24 / 30 px. Interlignage de 1,5 pour le corps.
- Graisses : 400 corps, 500 libellés, 600 titres.

## Espacements et formes

- Grille de 4 px. Espacements utilisés : 4, 8, 12, 16, 24, 32, 48.
- Rayon : 8 px (cartes, inputs), 6 px (boutons), arrondi complet (badges de statut).
- Ombres : une seule, discrète (`shadow-sm`) sur les cartes.

## Composants de base (shadcn/ui)

Button, Input, Textarea, Select, Checkbox, Dialog, DropdownMenu, Tabs, Table, Badge (statuts), Card, Toast, Skeleton, Progress, Tooltip.

Composants métier à créer :

- `StatusBadge` (statut testeur ou assignment) ;
- `QuestionEditor` ;
- `MicroTestCard` (déplaçable) ;
- `RatingChart` ;
- `ProgressMatrix` (testeurs × micro-tests) ;
- `QuotaMeter`.

## Graphiques

Recharts, avec la palette ci-dessus. Notes de 1 à 5 en barres horizontales, choix en barres, oui/non en barre empilée unique.

## Ton des textes

- **Tutoiement côté testeur** dans le bot (« Salut ! Je suis le bot de test de _Nom produit_ »). C'est court, sympa, et ça n'est jamais insistant dans les relances.
- **Vouvoiement côté site porteur**, ton professionnel et direct.
- Des verbes d'action sur les boutons (« Générer le corpus », « Lancer la campagne »).
- Les messages d'erreur disent quoi faire (« Le testeur a fermé ses MP. On lui a envoyé le lien par email. »).
- Tous les textes passent par `packages/i18n`.

## TODO

- [ ] Choisir la direction visuelle (moodboard, ou une ou deux références)
- [ ] Nom et logo du produit
- [ ] Avatar et nom du bot Discord
- [ ] Mode sombre dans le MVP : oui ou non ?
