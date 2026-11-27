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
        "• Je ne t'envoie aucun micro-test avant que tu aies accepté de participer à une campagne.\n\n" +
        "**Commandes**\n" +
        "• `/aide` : afficher ce message",
    },
    // Message privé d'accueil, envoyé une seule fois par campagne (tâche send-welcome).
    welcome: {
      intro:
        "Salut ! Je suis le bot **{appName}**. **{ownerName}** t'invite à tester **{campaignName}**.",
      durationOne: "Le test tient en **1 micro-test** d'environ {minutes} minutes.",
      durationMany:
        "Le test se fait en **{count} micro-tests** d'environ {minutes} minutes chacun, que je t'envoie un par un.",
      product: "Le produit à tester : {url}",
      privacy: "Ce qu'on fait de tes réponses : {url}",
      callToAction:
        "Si tu es partant, clique sur le bouton ci-dessous. Je ne t'envoie rien avant ton accord, et tu pourras arrêter quand tu veux.",
      // Libellé d'un bouton Discord : 80 caractères max.
      button: "J'accepte de participer",
    },
    // Réponses au clic sur « J'accepte de participer ».
    consent: {
      accepted: "✅ C'est noté, merci ! Ton premier micro-test arrive très vite.",
      alreadyAccepted: "C'est déjà noté : tu participes à cette campagne.",
      optedOut: "Tu as quitté cette campagne : je ne t'enverrai plus rien.",
      notYou: "Cette invitation ne t'est pas destinée.",
      unknownTester: "Cette invitation n'existe plus.",
    },
    // Message privé d'un micro-test : intro et première question (tâche send-microtest).
    microtest: {
      title: "📝 **Nouveau micro-test : {title}**",
      durationOne: "Environ {minutes} minutes · 1 question",
      durationMany: "Environ {minutes} minutes · {count} questions",
      questionHeader: "**Question {number}/{count}**",
      optional: "(facultative)",
      hint: {
        TEXT: "Réponse libre.",
        RATING: "Donne une note de 1 à 5.",
        YESNO: "Réponds par oui ou par non.",
        SINGLE: "Un seul choix possible :",
        MULTI: "Plusieurs choix possibles :",
      },
      webHint:
        "Tu préfères répondre sur le web, ou joindre une capture d'écran ? Utilise le bouton ci-dessous.",
      // Libellé d'un bouton Discord : 80 caractères max.
      webButton: "Répondre sur le web",
    },
    errors: {
      unknownCommand:
        "Cette commande n'existe plus. Tape `/aide` pour voir celles qui sont disponibles.",
      unknownButton: "Ce bouton n'est plus valable.",
      generic: "Oups, quelque chose s'est mal passé de mon côté. Réessaie dans quelques instants.",
    },
  },
} as const;
