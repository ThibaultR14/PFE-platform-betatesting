/** Textes français. Toute chaîne visible par un utilisateur doit être ici. */
export const fr = {
  app: {
    name: "MicroBeta",
    tagline: "Faites tester votre produit, cinq minutes à la fois.",
  },
  bot: {
    ready: "Bot connecté en tant que {tag}",
    commands: {
      // Discord impose un nom en minuscules, sans espace (32 caractères max)
      // et une description de 100 caractères max.
      aide: {
        name: "aide",
        description: "Découvrir ce que fait ce bot et les commandes disponibles",
      },
    },
    help: {
      body:
        "Salut ! Je suis le bot **{appName}**. Je t'envoie les micro-tests des projets auxquels tu participes.\n\n" +
        "• Un micro-test prend environ 5 minutes : quelques questions, auxquelles tu réponds avec des boutons ou un court texte.\n" +
        "• Je ne t'écris jamais avant que tu aies accepté de participer à une campagne.\n\n" +
        "**Commandes**\n" +
        "• `/aide` : afficher ce message",
    },
    errors: {
      unknownCommand:
        "Cette commande n'existe plus. Tape `/aide` pour voir celles qui sont disponibles.",
      generic: "Oups, quelque chose s'est mal passé de mon côté. Réessaie dans quelques instants.",
    },
  },
} as const;
